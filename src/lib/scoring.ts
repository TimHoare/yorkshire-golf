// The scoring engine: handicap maths, stableford tallies, results and
// standings. Pure functions over the trip data and a TripState — no globals,
// no DOM, fully unit-testable.
import { ROUNDS, PLAYERS, RULES, R, PL, type Group, type Round } from '../data/trip';
import { BIT_KINDS, type BitKind, type HoleBits, type TripState, type HoleScores } from './state';

// The groups actually playing a round: the placeholder draw from trip.ts,
// with players replaced by the stored draw when one has been made.
export function groupsFor(S: TripState, rid: string): Group[] {
  const r = R(rid)!;
  const ov = S.groups[rid];
  if (!ov) return r.groups;
  return r.groups.map((g, i) => ({ ...g, players: ov[i] || g.players }));
}

export const blank18 = (): HoleScores => Array(18).fill(null);
export const holesOf = (S: TripState, rid: string, pid: string): HoleScores => S.scores[rid]?.[pid] || blank18();
export const teamHoles = (S: TripState, rid: string, t: number): HoleScores => S.scramble[rid]?.[t] || blank18();

// ---------- Handicap maths ----------
export function courseHandicap(index: number, rid: string) {
  const c = R(rid)!;
  return Math.round(index * (c.slope / 113) + (c.cr - c.par));
}
export function playingHandicap(index: number, rid: string) {
  return Math.round(courseHandicap(index, rid) * (RULES.allowance / 100));
}
// Shots received on a hole of stroke index si for playing handicap ph.
export function shotsOn(ph: number, si: number) {
  if (ph >= 0) return Math.floor(ph / 18) + (si <= ph % 18 ? 1 : 0);
  const give = -ph;
  return -(Math.floor(give / 18) + (si > 18 - (give % 18) ? 1 : 0));
}
// gross 0 = picked the ball up: the hole was played but there's no score, so
// no points — distinct from null (not entered yet).
export const isPickup = (gross: number | null) => gross === 0;
export const holePoints = (gross: number | null, par: number, shots: number) =>
  gross === null ? null : gross === 0 ? 0 : Math.max(0, 2 + par + shots - gross);

export interface TallyRow { n: number; par: number; si: number; yds: number | null; shots: number; gross: number | null; pts: number | null }
export interface Tally { rows: TallyRow[]; played: number; pts: number; strokes: number; pickups: number; complete: boolean }

// Per-hole breakdown for a set of 18 gross scores.
export function tally(rid: string, gross: HoleScores, ph: number): Tally {
  const r = R(rid)!;
  const rows = r.holes.map((h, i) => {
    const shots = shotsOn(ph, h.si);
    const g = gross[i];
    return { ...h, shots, gross: g, pts: holePoints(g, h.par, shots) };
  });
  const played = rows.filter((x) => x.gross !== null).length;
  const pts = rows.reduce((a, x) => a + (x.pts ?? 0), 0);
  const strokes = rows.reduce((a, x) => a + (x.gross ?? 0), 0);
  const pickups = rows.filter((x) => isPickup(x.gross)).length;
  return { rows, played, pts, strokes, pickups, complete: played === 18 };
}

// Index entering each round: −0.5 per point over 32 for every completed stableford round before it.
export function indexHistory(S: TripState, pid: string) {
  const p = PL(pid);
  const out: { round: Round; before: number; after: number; applied: boolean }[] = [];
  let idx = p.start;
  for (const r of ROUNDS) {
    const before = idx;
    let after = idx, applied = false;
    if (r.format === 'stableford') {
      const t = tally(r.id, holesOf(S, r.id, pid), playingHandicap(idx, r.id));
      if (t.complete) { after = idx - 0.5 * (t.pts - RULES.par); applied = true; }
    }
    out.push({ round: r, before, after, applied });
    idx = after;
  }
  return out;
}
export const currentIndex = (S: TripState, pid: string) => {
  const h = indexHistory(S, pid);
  return h[h.length - 1].after;
};
export const indexBefore = (S: TripState, pid: string, rid: string) =>
  indexHistory(S, pid).find((h) => h.round.id === rid)!.before;
export const phFor = (S: TripState, pid: string, rid: string) =>
  playingHandicap(indexBefore(S, pid, rid), rid);
export const playerTally = (S: TripState, rid: string, pid: string) =>
  tally(rid, holesOf(S, rid, pid), phFor(S, pid, rid));

// Scramble team playing handicap: 35/15 % of the members' course handicaps, lowest first.
export function teamHandicap(S: TripState, rid: string, t: number) {
  const g = groupsFor(S, rid)[t];
  const chs = g.players.map((pid) => courseHandicap(indexBefore(S, pid, rid), rid)).sort((a, b) => a - b);
  return Math.round(chs.reduce((a, ch, i) => a + ch * (RULES.scrambleAllowance[i] ?? 0) / 100, 0));
}
export const teamTally = (S: TripState, rid: string, t: number) =>
  tally(rid, teamHoles(S, rid, t), teamHandicap(S, rid, t));

// ---------- Results ----------
// Award place points down a sorted list, splitting the table across ties:
// rows i..j equal under `same` share (pp[i]+…+pp[j]) / count.
function award<T extends { place?: number; points?: number; tied?: boolean }>(
  rows: T[], pp: number[], same: (a: T, b: T) => boolean,
) {
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && same(rows[i], rows[j + 1])) j++;
    let sum = 0;
    for (let k = i; k <= j; k++) sum += pp[k] || 0;
    for (let k = i; k <= j; k++) { rows[k].place = i + 1; rows[k].points = sum / (j - i + 1); rows[k].tied = j > i; }
    i = j + 1;
  }
}

// Countback for individual ties: points on the back 9, then back 6, then back 3.
export const countback = (t: { rows: TallyRow[] }): number[] =>
  [9, 12, 15].map((from) => t.rows.slice(from).reduce((a, x) => a + (x.pts ?? 0), 0));

export interface StablefordRow extends Tally { pid: string; place?: number; points?: number; tied?: boolean }
export function stablefordResults(S: TripState, rid: string): StablefordRow[] {
  const rows: StablefordRow[] = PLAYERS.map((p) => ({ pid: p.id, ...playerTally(S, rid, p.id) })).filter((r) => r.played > 0);
  const key = (r: StablefordRow) => [r.pts, ...countback(r)];
  rows.sort((a, b) => {
    const ka = key(a), kb = key(b);
    return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2] || kb[3] - ka[3];
  });
  // Countback separates most ties; only players level on all of it share points.
  award(rows, RULES.placePoints, (a, b) => key(a).join() === key(b).join());
  return rows;
}

export interface ScrambleOutcome { points: number; place: number; won: boolean; tie: boolean }
export function scrambleResults(S: TripState, rid: string) {
  const groups = groupsFor(S, rid);
  const out: Record<string, ScrambleOutcome> = {};
  const ts = groups.map((_, t) => teamTally(S, rid, t));
  const decided = ts.every((t) => t.complete);
  if (!decided) return { rows: out, decided, ts, winner: null as number | null };
  const order: { t: number; pts: number; place?: number; points?: number; tied?: boolean }[] =
    ts.map((tt, t) => ({ t, pts: tt.pts })).sort((a, b) => b.pts - a.pts);
  award(order, RULES.scramblePoints, (a, b) => a.pts === b.pts);
  for (const o of order)
    for (const pid of groups[o.t].players)
      out[pid] = { points: o.points!, place: o.place!, won: o.place === 1 && !o.tied, tie: !!o.tied };
  return { rows: out, decided, ts, winner: order[0].tied ? null : order[0].t };
}

export function roundPoints(S: TripState, rid: string, pid: string): number | null {
  const r = R(rid)!;
  if (r.format === 'scramble') return scrambleResults(S, rid).rows[pid]?.points ?? null;
  const ind = stablefordResults(S, rid).find((x) => x.pid === pid)?.points;
  if (ind === undefined) return null;
  return ind + (r.pairs ? pairPointsFor(S, rid, pid) : 0);
}
export const roundPlace = (S: TripState, rid: string, pid: string) =>
  stablefordResults(S, rid).find((x) => x.pid === pid)?.place ?? null;

export interface StandingsRow { pid: string; i: number; pts: number; stab: number; played: number; rank: number }
export function standings(S: TripState): StandingsRow[] {
  const rows = PLAYERS.map((p, i) => {
    let pts = 0, stab = 0, played = 0;
    for (const r of ROUNDS) {
      const rp = roundPoints(S, r.id, p.id);
      if (rp !== null) { pts += rp; played++; }
      if (r.format === 'stableford') stab += playerTally(S, r.id, p.id).pts;
    }
    return { pid: p.id, i, pts, stab, played, rank: 0 };
  });
  rows.sort((a, b) => b.pts - a.pts || b.stab - a.stab || a.i - b.i);
  let rank = 0;
  rows.forEach((r, k) => {
    if (k === 0 || r.pts !== rows[k - 1].pts || r.stab !== rows[k - 1].stab) rank = k + 1;
    r.rank = rank;
  });
  return rows;
}

export function roundStatus(S: TripState, rid: string): 'done' | 'partial' | 'none' {
  const r = R(rid)!;
  const ts = r.format === 'scramble'
    ? groupsFor(S, rid).map((_, t) => teamTally(S, rid, t))
    : PLAYERS.map((p) => playerTally(S, rid, p.id));
  if (ts.every((t) => t.complete)) return 'done';
  return ts.some((t) => t.played > 0) ? 'partial' : 'none';
}

export interface PairRow { pair: string[]; total: number; complete: boolean; place?: number; points?: number; tied?: boolean }
export function pairTotals(S: TripState, rid: string): PairRow[] {
  const pr = S.pairs[rid];
  if (!pr) return [];
  const rows: PairRow[] = pr.pairs.map((pair) => {
    const ts = pair.map((pid) => playerTally(S, rid, pid));
    return { pair, total: ts.reduce((a, t) => a + t.pts, 0), complete: ts.every((t) => t.complete) };
  });
  rows.sort((a, b) => b.total - a.total);
  // No countback for pairs: ties on aggregate share the points, e.g. two pairs
  // level at the top take (6+4)/2 = 5 each.
  award(rows, RULES.pairPoints, (a, b) => a.total === b.total);
  return rows;
}
// Each player in a pair earns the pair's full points (6/4/2/0 per head).
export const pairPointsFor = (S: TripState, rid: string, pid: string): number =>
  pairTotals(S, rid).find((r) => r.pair.includes(pid))?.points ?? 0;

export function firstUnfinishedHole(S: TripState, rid: string, group: number) {
  const r = R(rid)!;
  const done = (n: number) => r.format === 'scramble'
    ? teamHoles(S, rid, group)[n - 1] !== null
    : groupsFor(S, rid)[group].players.every((pid) => holesOf(S, rid, pid)[n - 1] !== null);
  for (let n = 1; n <= 18; n++) if (!done(n)) return n;
  return 18;
}

// ---------- Side bets (cuckoos · camels · fish · three-putts · lost balls) ----------
export const blankBits = (): (HoleBits | null)[] => Array(18).fill(null);
export const bitsOf = (S: TripState, rid: string, group: number, kind: BitKind): (HoleBits | null)[] =>
  S.bits[rid]?.[group]?.[kind] || blankBits();
export const holeBitTotal = (hb: HoleBits | null): number =>
  hb ? Object.values(hb.counts).reduce((a, c) => a + c, 0) : 0;

// A group's running tally for one kind: total across the round, and who had
// the last one — the marked player on the highest hole with any logged.
export interface BitTally { kind: BitKind; total: number; last: string | null }
export function groupBitTally(S: TripState, rid: string, group: number, kind: BitKind): BitTally {
  let total = 0, last: string | null = null;
  for (const hb of bitsOf(S, rid, group, kind)) {
    const n = holeBitTotal(hb);
    if (!n) continue;
    total += n;
    last = hb!.last ?? Object.keys(hb!.counts)[0] ?? last;
  }
  return { kind, total, last };
}
export const groupBitTallies = (S: TripState, rid: string, group: number): BitTally[] =>
  BIT_KINDS.map((k) => groupBitTally(S, rid, group, k));

// One player's count of a kind across every round of the week.
export function playerBitTotal(S: TripState, pid: string, kind: BitKind): number {
  let n = 0;
  for (const byGroup of Object.values(S.bits))
    for (const sheet of Object.values(byGroup))
      for (const hb of sheet[kind] || []) n += hb?.counts[pid] || 0;
  return n;
}

export const fmtMoney = (pence: number) =>
  pence >= 100 ? '£' + (pence / 100).toFixed(2) : pence + 'p';

// Score relative to par, for entry labels: ['birdie', 'under'] etc.
export function relPar(diff: number): [string, 'under' | 'level' | 'over'] {
  if (diff <= -3) return ['Albatross', 'under'];
  if (diff === -2) return ['Eagle', 'under'];
  if (diff === -1) return ['Birdie', 'under'];
  if (diff === 0) return ['Par', 'level'];
  if (diff === 1) return ['Bogey', 'over'];
  return ['+' + diff, 'over'];
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt1(Math.abs(n));
export const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
