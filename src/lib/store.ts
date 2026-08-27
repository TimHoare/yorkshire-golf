// The app store: trip state + identity + sync status, with localStorage
// persistence and Supabase live sync. Local-first writes: every change lands
// in localStorage immediately, queues in an outbox, and upserts to the shared
// database; realtime changes from other phones are applied as they arrive.
// With no Supabase keys configured everything runs single-phone.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../config';
import { PLAYERS, R } from '../data/trip';
import {
  defaultState, loadState, persistState, migrate,
  ME_KEY, OUTBOX_KEY, type TripState, type PairDraw, type HoleScores,
} from './state';
import { blank18 } from './scoring';

export type SyncStatus = 'local' | 'connecting' | 'live' | 'offline';

interface Op { t: 'hole' | 'team' | 'pair'; k: (string | number)[]; v: unknown; key: string }

export interface Snapshot {
  S: TripState;
  me: string | null;               // player id, 'watcher', or null (not chosen)
  syncStatus: SyncStatus;
  pending: number;                 // outbox length
}

export const hasSync = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

let S = loadState();
let me = ((): string | null => {
  const m = localStorage.getItem(ME_KEY);
  return m && (m === 'watcher' || PLAYERS.some((p) => p.id === m)) ? m : null;
})();
let syncStatus: SyncStatus = hasSync ? 'connecting' : 'local';
let outbox: Op[] = (() => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
})();

let snapshot: Snapshot = { S, me, syncStatus, pending: outbox.length };
const listeners = new Set<() => void>();
function emit() {
  snapshot = { S, me, syncStatus, pending: outbox.length };
  listeners.forEach((l) => l());
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const getSnapshot = () => snapshot;

// Test hook: re-read everything from localStorage (the store is a module singleton).
export function reloadFromStorage() {
  S = loadState();
  try { outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { outbox = []; }
  const m = localStorage.getItem(ME_KEY);
  me = m && (m === 'watcher' || PLAYERS.some((p) => p.id === m)) ? m : null;
  emit();
}

function save() { persistState(S); }
function saveOutbox() { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); }
function setSyncStatus(st: SyncStatus) { syncStatus = st; emit(); }

// ---------- Mutations (local + queued push) ----------
export function setGross(rid: string, target: { pid: string } | { team: number }, holeIdx: number, gross: number | null) {
  const v = gross === null ? null : Math.min(20, Math.max(1, Math.round(gross)));
  if ('team' in target) {
    S.scramble[rid] = S.scramble[rid] || {};
    const arr = S.scramble[rid][target.team] || blank18();
    arr[holeIdx] = v;
    S.scramble[rid][target.team] = arr;
    pushOp('team', [rid, target.team, holeIdx + 1], v);
  } else {
    S.scores[rid] = S.scores[rid] || {};
    const arr = S.scores[rid][target.pid] || blank18();
    arr[holeIdx] = v;
    S.scores[rid][target.pid] = arr;
    pushOp('hole', [rid, target.pid, holeIdx + 1], v);
  }
  save(); emit();
}

export function setPairDraw(rid: string, draw: PairDraw | null) {
  if (draw) S.pairs[rid] = draw; else delete S.pairs[rid];
  pushOp('pair', [rid], draw);
  save(); emit();
}

export function setMe(id: string | null) {
  me = id;
  if (id) localStorage.setItem(ME_KEY, id); else localStorage.removeItem(ME_KEY);
  emit();
}

export function importState(json: string) {
  S = migrate(JSON.parse(json));
  save(); emit();
}
export const exportState = () => JSON.stringify(S, null, 2);

export async function resetAll() {
  S = defaultState();
  outbox = []; saveOutbox(); save(); emit();
  if (sb) {
    await Promise.all([
      sb.from('hole_scores').delete().neq('round_id', ''),
      sb.from('team_scores').delete().neq('round_id', ''),
      sb.from('pair_draws').delete().neq('round_id', ''),
    ]);
  }
}

// ---------- Outbox ----------
// One op per (table, key): later writes to the same hole replace the queued one.
function pushOp(t: Op['t'], k: (string | number)[], v: unknown) {
  if (!hasSync) return;
  const key = t + '|' + k.join('|');
  outbox = outbox.filter((o) => o.key !== key);
  outbox.push({ t, k, v, key });
  saveOutbox(); emit();
  void flushOutbox();
}

let sb: SupabaseClient | null = null;
let flushing = false;
let retryT: ReturnType<typeof setTimeout> | undefined;
export async function flushOutbox() {
  if (!sb || flushing) return;
  flushing = true;
  try {
    while (outbox.length) {
      const op = outbox[0];
      const now = new Date().toISOString();
      let error;
      if (op.t === 'hole') {
        ({ error } = await sb.from('hole_scores').upsert({ round_id: op.k[0], player_id: op.k[1], hole: op.k[2], gross: op.v, updated_at: now }));
      } else if (op.t === 'team') {
        ({ error } = await sb.from('team_scores').upsert({ round_id: op.k[0], team: op.k[1], hole: op.k[2], gross: op.v, updated_at: now }));
      } else if (op.v === null) {
        ({ error } = await sb.from('pair_draws').delete().eq('round_id', op.k[0]));
      } else {
        const d = op.v as PairDraw;
        ({ error } = await sb.from('pair_draws').upsert({ round_id: op.k[0], pairs: d.pairs, revealed: d.revealed, updated_at: now }));
      }
      if (error) throw error;
      outbox.shift(); saveOutbox();
    }
    setSyncStatus('live');
  } catch {
    setSyncStatus('offline');
    clearTimeout(retryT);
    retryT = setTimeout(() => void flushOutbox(), 5000);
  }
  flushing = false;
}

// ---------- Applying server rows ----------
function applyHole(rid: string, pid: string, hole: number, gross: number | null) {
  if (!R(rid) || !PLAYERS.some((p) => p.id === pid)) return;
  S.scores[rid] = S.scores[rid] || {};
  const arr = S.scores[rid][pid] || blank18();
  arr[hole - 1] = gross;
  S.scores[rid][pid] = arr;
}
function applyTeamHole(rid: string, t: number, hole: number, gross: number | null) {
  if (!R(rid)) return;
  S.scramble[rid] = S.scramble[rid] || {};
  const arr = S.scramble[rid][t] || blank18();
  arr[hole - 1] = gross;
  S.scramble[rid][t] = arr;
}

interface Row { round_id: string; player_id?: string; team?: number; hole?: number; gross?: number | null; pairs?: string[][]; revealed?: boolean }
function onRowChange(table: string, type: string, row: Row) {
  if (table === 'hole_scores') applyHole(row.round_id, row.player_id!, row.hole!, type === 'DELETE' ? null : row.gross ?? null);
  else if (table === 'team_scores') applyTeamHole(row.round_id, Number(row.team), row.hole!, type === 'DELETE' ? null : row.gross ?? null);
  else if (table === 'pair_draws') {
    if (type === 'DELETE') delete S.pairs[row.round_id];
    else S.pairs[row.round_id] = { pairs: row.pairs!, revealed: !!row.revealed };
  }
  save(); emit();
}

async function hydrateFromServer(client: SupabaseClient) {
  const [hs, ts, pd] = await Promise.all([
    client.from('hole_scores').select('*'),
    client.from('team_scores').select('*'),
    client.from('pair_draws').select('*'),
  ]);
  if (hs.error || ts.error || pd.error) throw hs.error || ts.error || pd.error;
  const seen = new Set<string>();
  for (const r of hs.data as Row[]) { seen.add(`hole|${r.round_id}|${r.player_id}|${r.hole}`); applyHole(r.round_id, r.player_id!, r.hole!, r.gross ?? null); }
  for (const r of ts.data as Row[]) { seen.add(`team|${r.round_id}|${r.team}|${r.hole}`); applyTeamHole(r.round_id, Number(r.team), r.hole!, r.gross ?? null); }
  for (const r of pd.data as Row[]) { seen.add(`pair|${r.round_id}`); S.pairs[r.round_id] = { pairs: r.pairs!, revealed: !!r.revealed }; }
  // Push anything this phone has that the server doesn't (first phone to connect seeds it).
  for (const [rid, byP] of Object.entries(S.scores)) for (const [pid, arr] of Object.entries(byP))
    arr.forEach((g, i) => { if (g !== null && !seen.has(`hole|${rid}|${pid}|${i + 1}`)) pushOp('hole', [rid, pid, i + 1], g); });
  for (const [rid, byT] of Object.entries(S.scramble)) for (const [t, arr] of Object.entries(byT))
    (arr as HoleScores).forEach((g, i) => { if (g !== null && !seen.has(`team|${rid}|${t}|${i + 1}`)) pushOp('team', [rid, Number(t), i + 1], g); });
  for (const [rid, pr] of Object.entries(S.pairs))
    if (!seen.has(`pair|${rid}`)) pushOp('pair', [rid], pr);
  save(); emit();
}

// createClient is injectable for tests.
export function initSync(create: typeof createClient = createClient) {
  if (!hasSync) return;
  sb = create(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  const hydrate = () => hydrateFromServer(sb!)
    .then(() => { setSyncStatus('live'); void flushOutbox(); })
    .catch(() => { setSyncStatus('offline'); setTimeout(hydrate, 5000); });
  hydrate();
  sb.channel('yg-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, (p) => onRowChange('hole_scores', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_scores' }, (p) => onRowChange('team_scores', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_draws' }, (p) => onRowChange('pair_draws', p.eventType, (p.new as Row)?.round_id ? p.new as Row : p.old as Row))
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') { setSyncStatus('live'); void flushOutbox(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('offline');
    });
  window.addEventListener('online', () => void flushOutbox());
}
