// Sync engine against a mocked Supabase client: hydration (server wins, local
// extras seeded up), score writes upserting per hole, realtime application.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushOutbox, initSync, reloadFromStorage, setGross } from '../lib/store';

type Handler = (p: { eventType: string; new: unknown; old: unknown }) => void;

function mockSupabase(db: Record<string, unknown[]>) {
  const upserts: { table: string; row: Record<string, unknown> }[] = [];
  const handlers: { table: string; cb: Handler }[] = [];
  const client = {
    from: (table: string) => ({
      select: async () => ({ data: db[table] ?? [], error: null }),
      upsert: async (row: Record<string, unknown>) => { upserts.push({ table, row }); return { error: null }; },
      delete: () => ({ eq: async () => ({ error: null }), neq: async () => ({ error: null }) }),
    }),
    channel: () => {
      const ch = {
        on: (_ev: string, filter: { table: string }, cb: Handler) => { handlers.push({ table: filter.table, cb }); return ch; },
        subscribe: (cb: (s: string) => void) => { setTimeout(() => cb('SUBSCRIBED'), 0); return ch; },
      };
      return ch;
    },
  };
  return { client, upserts, handlers };
}

const tick = () => new Promise((r) => setTimeout(r, 10));

describe('sync engine', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadFromStorage();
  });

  it('hydrates server rows, seeds local-only scores up, and applies realtime changes', async () => {
    localStorage.setItem('yorkshire-golf-2026', JSON.stringify({
      v: 3, scores: { d1: { p2: [5, ...Array(17).fill(null)] } }, pairs: {}, scramble: {},
    }));
    reloadFromStorage();

    const { client, upserts, handlers } = mockSupabase({
      hole_scores: [{ round_id: 'd1', player_id: 'p1', hole: 1, gross: 4 }],
      team_scores: [], pair_draws: [],
    });
    initSync(vi.fn().mockReturnValue(client) as never);
    await tick();

    // server row applied locally (server wins)
    let S = JSON.parse(localStorage.getItem('yorkshire-golf-2026')!);
    expect(S.scores.d1.p1[0]).toBe(4);
    // local-only p2 score pushed to server
    expect(upserts.some((u) => u.table === 'hole_scores' && u.row.player_id === 'p2' && u.row.hole === 1 && u.row.gross === 5)).toBe(true);

    // entering a score upserts with the right hole number
    upserts.length = 0;
    setGross('d1', { pid: 'p1' }, 6, 3); // hole 7 (index 6)
    await tick();
    expect(upserts.some((u) => u.table === 'hole_scores' && u.row.hole === 7 && u.row.gross === 3)).toBe(true);
    expect(JSON.parse(localStorage.getItem('yorkshire-golf-2026-outbox')!)).toHaveLength(0);

    // realtime change from another phone lands in local state
    handlers.find((h) => h.table === 'hole_scores')!.cb({
      eventType: 'UPDATE', new: { round_id: 'd1', player_id: 'p3', hole: 2, gross: 5 }, old: {},
    });
    S = JSON.parse(localStorage.getItem('yorkshire-golf-2026')!);
    expect(S.scores.d1.p3[1]).toBe(5);

    // realtime pair draw
    handlers.find((h) => h.table === 'pair_draws')!.cb({
      eventType: 'INSERT', new: { round_id: 'd1', pairs: [['p1', 'p2']], revealed: false }, old: {},
    });
    S = JSON.parse(localStorage.getItem('yorkshire-golf-2026')!);
    expect(S.pairs.d1.revealed).toBe(false);

    await flushOutbox();
  });
});
