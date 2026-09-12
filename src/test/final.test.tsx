// The week is over: with FINAL on, nothing writes — not the steppers, the
// side-bet panel, the settings sheet, the store itself, or a stale outbox.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import {
  flushOutbox, getSnapshot, initSync, reloadFromStorage, setBonusBall, setGross, setGroupDraw, setHoleBits,
  setMe, setPairDraw, setStakes, setTeeChoice,
} from '../lib/store';
import { OUTBOX_KEY, STORE_KEY } from '../lib/state';

vi.mock('../data/trip', async (orig) => ({ ...(await orig<typeof import('../data/trip')>()), FINAL: true }));

const groups = { d1: [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']] };
const seed = () => {
  localStorage.setItem(STORE_KEY, JSON.stringify({ v: 3, scores: { d1: { p6: [4, 3] } }, pairs: {}, scramble: {}, groups }));
  reloadFromStorage();
};
const mount = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => { cleanup(); localStorage.clear(); reloadFromStorage(); setMe(null); });

describe('final week', () => {
  it('store mutations are no-ops and queue nothing', () => {
    seed();
    setGross('d1', { pid: 'p6' }, 0, 7);
    setGross('d3', { team: 1 }, 0, 4);
    setHoleBits('d1', 1, 'cuckoo', 0, { counts: { p6: 1 }, last: 'p6' });
    setBonusBall('p6', { used: { d1: 4 }, lost: null });
    setStakes({ cuckoo: 99, camel: 10, fish: 10, threeputt: 10, lostball: 10, equipment: 10 });
    setTeeChoice('d2', 'white');
    setPairDraw('d1', { pairs: [['p1', 'p2']], revealed: true });
    setGroupDraw('d1', null);
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)!);
    expect(saved.scores.d1.p6[0]).toBe(4);
    expect(saved.groups.d1).toEqual(groups.d1);
    expect(saved.bits ?? {}).toEqual({});
    expect(saved.bonus ?? {}).toEqual({});
    expect(saved.pairs).toEqual({});
    expect(saved.stakes?.cuckoo ?? 10).toBe(10);
    expect(saved.teeChoice ?? {}).toEqual({});
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    expect(getSnapshot().pending).toBe(0);
  });

  it('a stale outbox from the week is discarded, not sent', async () => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([{ t: 'hole', k: ['d1', 'p6', 1], v: 9, key: 'hole|d1|p6|1' }]));
    reloadFromStorage();
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    expect(getSnapshot().pending).toBe(0);
    const upserts: unknown[] = [];
    const client = {
      from: () => ({ select: async () => ({ data: [], error: null }), upsert: async (row: unknown) => { upserts.push(row); return { error: null }; } }),
      channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    };
    initSync(vi.fn().mockReturnValue(client) as never);
    await flushOutbox();
    await new Promise((r) => setTimeout(r, 10));
    expect(upserts).toEqual([]);
  });

  it('my own card is read-only on the scoring page, with no side-bet steppers', () => {
    seed();
    setMe('p6');
    const { container } = mount('/round/d1/score/1');
    expect(screen.getByText('The week is over — these scores are final')).toBeTruthy();
    expect(container.querySelectorAll('.stepper button')).toHaveLength(0);
    expect(container.querySelectorAll('.stepper.ro').length).toBeGreaterThan(0);
    const slide1 = container.querySelector('.slide[data-slide="1"]')! as HTMLElement;
    fireEvent.click(within(slide1).getByText('Three-putts'));
    expect(within(slide1).queryByLabelText('One three-putt more for Rob')).toBeNull();
    fireEvent.click(within(slide1).getByText('Bonus balls'));
    expect(within(slide1).queryByText('Used')).toBeNull();
  });

  it('round page hides the groups and pairs editors; settings are read-only', () => {
    seed();
    setMe('p6');
    mount('/round/d1');
    expect(screen.queryByText(/Set groups|Change groups/)).toBeNull();
    expect(screen.queryByText('Draw the pairs')).toBeNull();
    expect(screen.queryByText('Redraw')).toBeNull();
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByText(/every score, side bet, stake and tee choice is final/)).toBeTruthy();
    const sheet = screen.getByRole('dialog');
    // every stake box and tee select is off; the only live control picks which day's stakes to look at
    for (const el of sheet.querySelectorAll('input, .stakes:not(.stake-day) select')) expect((el as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByText('Clear all scores')).toBeNull();
  });

  it('the trip page says so instead of counting down', () => {
    setMe('p1');
    mount('/trip');
    expect(screen.getByText("That's the week.")).toBeTruthy();
  });
});
