// The scoring engine: handicap maths, stableford tallies, results and
// standings. Pure functions over the trip data and a TripState — no globals,
// no DOM, fully unit-testable.
import { ROUNDS, PLAYERS, RULES, R, PL, gname, type Group, type Round, type TeeSet } from '../data/trip';
import { BIT_KINDS, stakesFor, type BitKind, type HoleBits, type TripState, type HoleScores, type HoleDrives } from './state';

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
export const blankDrives = (): HoleDrives => Array(18).fill(null);
export const teamDrives = (S: TripState, rid: string, t: number): HoleDrives => S.drives[rid]?.[t] || blankDrives();

// The tees a round is actually being played off: the stored choice when it
// names one of the round's alternative sets, else the default from trip data.
export function teeFor(S: TripState, rid: string): TeeSet {
  const r = R(rid)!;
  const alt = r.altTees?.find((t) => t.key === S.teeChoice[rid]);
  return alt ?? { key: r.tees, label: r.tees, cr: r.cr, slope: r.slope, yds: r.holes.map((h) => h.yds) };
}

// ---------- Handicap maths ----------
export function courseHandicap(S: TripState, index: number, rid: string) {
  const t = teeFor(S, rid);
  return Math.round(index * (t.slope / 113) + (t.cr - R(rid)!.par));
}
export function playingHandicap(S: TripState, index: number, rid: string) {
  return Math.round(courseHandicap(S, index, rid) * (RULES.allowance / 100));
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

export interface TallyRow { n: number; par: number; si: number; yds: number | null; shots: number; gross: number | null; pts: number | null; bonus?: boolean }
export interface Tally { rows: TallyRow[]; played: number; pts: number; strokes: number; pickups: number; complete: boolean }

// Per-hole breakdown for a set of 18 gross scores. bonusHole (0–17) is the
// hole the player's bonus ball doubles, if they played it this round.
export function tally(rid: string, gross: HoleScores, ph: number, bonusHole: number | null = null): Tally {
  const r = R(rid)!;
  const rows = r.holes.map((h, i) => {
    const shots = shotsOn(ph, h.si);
    const g = gross[i];
    const base = holePoints(g, h.par, shots);
    const bonus = i === bonusHole;
    return { ...h, shots, gross: g, pts: bonus && base !== null ? base * 2 : base, bonus };
  });
  const played = rows.filter((x) => x.gross !== null).length;
  const pts = rows.reduce((a, x) => a + (x.pts ?? 0), 0);
  const strokes = rows.reduce((a, x) => a + (x.gross ?? 0), 0);
  const pickups = rows.filter((x) => isPickup(x.gross)).length;
  return { rows, played, pts, strokes, pickups, complete: played === 18 };
}

// ---------- Bonus balls ----------
const roundIdx = (rid: string) => ROUNDS.findIndex((r) => r.id === rid);
// The hole (0–17) whose points double for pid this round. The ball has to be
// played once every stableford round: not called by the time the 18th is
// scored, it's deemed played on the 18th. Null once it's lost — in an earlier
// round, or this one: losing the ball on its hole voids the 2×, either/or.
export function bonusHoleFor(S: TripState, rid: string, pid: string): number | null {
  const bb = S.bonus[pid];
  if (bb?.lost && roundIdx(bb.lost) <= roundIdx(rid)) return null;
  const h = bb?.used[rid];
  if (h !== undefined) return h;
  return R(rid)!.format === 'stableford' && holesOf(S, rid, pid)[17] !== null ? 17 : null;
}
// Ball lost in this round or any earlier one → no more 2×s from here on.
export const bonusGoneBy = (S: TripState, rid: string, pid: string): boolean => {
  const lost = S.bonus[pid]?.lost;
  return !!lost && roundIdx(lost) < roundIdx(rid);
};

// Index entering each round: −0.5 per point over 32 for every completed stableford round before it.
// Uses competition points, so a bonus ball's doubled hole moves the handicap too.
export function indexHistory(S: TripState, pid: string) {
  const p = PL(pid);
  const out: { round: Round; before: number; after: number; applied: boolean }[] = [];
  let idx = p.start;
  for (const r of ROUNDS) {
    const before = idx;
    let after = idx, applied = false;
    if (r.format === 'stableford') {
      const t = tally(r.id, holesOf(S, r.id, pid), playingHandicap(S, idx, r.id), bonusHoleFor(S, r.id, pid));
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
  playingHandicap(S, indexBefore(S, pid, rid), rid);
export const playerTally = (S: TripState, rid: string, pid: string) =>
  tally(rid, holesOf(S, rid, pid), phFor(S, pid, rid), bonusHoleFor(S, rid, pid));

// Scramble team handicap: 15% of the lower course handicap plus 35% of the
// higher, kept to one decimal place and taken off the team's gross score.
export const round1 = (n: number) => Math.round(n * 10) / 10;
export function teamHandicap(S: TripState, rid: string, t: number) {
  const g = groupsFor(S, rid)[t];
  const chs = g.players.map((pid) => courseHandicap(S, indexBefore(S, pid, rid), rid)).sort((a, b) => a - b);
  return round1(chs.reduce((a, ch, i) => a + ch * (RULES.scrambleAllowance[i] ?? 0) / 100, 0));
}
// The scramble is net stroke play, not stableford: no shots on the holes, no
// points. toPar is the gross against par of the holes played; netToPar takes
// the whole team handicap off that, so teams can be compared mid-round; net
// is the final gross less the handicap, once all 18 are in.
export interface TeamTally extends Tally { hcp: number; toPar: number; netToPar: number | null; net: number | null }
export function teamTally(S: TripState, rid: string, t: number): TeamTally {
  const hcp = teamHandicap(S, rid, t);
  const base = tally(rid, teamHoles(S, rid, t), 0);
  const rows = base.rows.map((x) => ({ ...x, shots: 0, pts: null }));
  const parPlayed = rows.filter((x) => x.gross !== null).reduce((a, x) => a + x.par, 0);
  const toPar = base.strokes - parPlayed;
  return {
    ...base, rows, pts: 0, hcp, toPar,
    netToPar: base.played ? round1(toPar - hcp) : null,
    net: base.complete ? round1(base.strokes - hcp) : null,
  };
}

// Scramble drives: each member's tee shot has to be used on at least
// RULES.scrambleDrives holes. Per member: drives used so far, and how many
// more the team still has to take from them. unmarked = holes scored without
// saying whose drive it was; left = holes not yet scored. A team is short
// when the holes still to play (plus any unmarked ones) can't cover what's
// owed; done when everyone has their quota.
export interface DriveTally {
  by: { pid: string; used: number; need: number }[];
  marked: number; unmarked: number; left: number; owed: number; short: boolean; done: boolean;
}
export function driveTally(S: TripState, rid: string, t: number): DriveTally {
  const g = groupsFor(S, rid)[t];
  const drives = teamDrives(S, rid, t);
  const holes = teamHoles(S, rid, t);
  const by = g.players.map((pid) => {
    const used = drives.filter((d) => d === pid).length;
    return { pid, used, need: Math.max(0, RULES.scrambleDrives - used) };
  });
  const marked = drives.filter((d) => d !== null).length;
  const played = holes.filter((h) => h !== null).length;
  const unmarked = holes.filter((h, i) => h !== null && drives[i] === null).length;
  const left = 18 - played;
  const owed = by.reduce((a, x) => a + x.need, 0);
  return { by, marked, unmarked, left, owed, short: owed > left + unmarked, done: owed === 0 };
}
// "Tim 4 · Adam 3" — the drive count per member, in team order.
export const driveLine = (dt: DriveTally, name: (pid: string) => string) =>
  dt.by.map((x) => `${name(x.pid)} ${x.used}`).join(' · ');

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
  // Lowest net score wins. Teams level on net share the points.
  const order: { t: number; net: number; place?: number; points?: number; tied?: boolean }[] =
    ts.map((tt, t) => ({ t, net: tt.net! })).sort((a, b) => a.net - b.net);
  award(order, RULES.scramblePoints, (a, b) => a.net === b.net);
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

export interface StandingsRow { pid: string; i: number; pts: number; stab: number; played: number; rank: number; bonusKept: number }
export function standings(S: TripState): StandingsRow[] {
  // +1 for a bonus ball that survives the whole trip, added once every round is in.
  const tripDone = ROUNDS.every((r) => roundStatus(S, r.id) === 'done');
  const rows = PLAYERS.map((p, i) => {
    let pts = 0, stab = 0, played = 0;
    for (const r of ROUNDS) {
      const rp = roundPoints(S, r.id, p.id);
      if (rp !== null) { pts += rp; played++; }
      if (r.format === 'stableford') stab += playerTally(S, r.id, p.id).pts;
    }
    const bonusKept = tripDone && !S.bonus[p.id]?.lost ? RULES.bonusKeep : 0;
    return { pid: p.id, i, pts: pts + bonusKept, stab, played, rank: 0, bonusKept };
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

// Scramble teams share tee times, so scoring happens per flight — the four
// players walking together — not per team: one scorer keeps both cards.
export interface Flight { tee: string; teams: number[]; players: string[] }
export function flightsFor(S: TripState, rid: string): Flight[] {
  const out: Flight[] = [];
  groupsFor(S, rid).forEach((g, t) => {
    const f = out.find((x) => x.tee === g.tee);
    if (f) { f.teams.push(t); f.players.push(...g.players); }
    else out.push({ tee: g.tee, teams: [t], players: [...g.players] });
  });
  return out;
}
export const flightName = (S: TripState, rid: string, i: number) => {
  const groups = groupsFor(S, rid);
  const f = flightsFor(S, rid)[i];
  return 'Teams ' + f.teams.map((t) => gname(groups[t], t).replace(/^Team /, '')).join(' & ');
};

// On scramble day `group` is a flight index; otherwise a tee-group index.
export function firstUnfinishedHole(S: TripState, rid: string, group: number) {
  const r = R(rid)!;
  const done = (n: number) => r.format === 'scramble'
    ? (flightsFor(S, rid)[group]?.teams ?? []).every((t) => teamHoles(S, rid, t)[n - 1] !== null)
    : groupsFor(S, rid)[group].players.every((pid) => holesOf(S, rid, pid)[n - 1] !== null);
  for (let n = 1; n <= 18; n++) if (!done(n)) return n;
  return 18;
}

// ---------- Side bets (cuckoos · camels · fish · three-putts · lost balls · equipment abuse) ----------
export const blankBits = (): (HoleBits | null)[] => Array(18).fill(null);
export const bitsOf = (S: TripState, rid: string, group: number, kind: BitKind): (HoleBits | null)[] =>
  S.bits[rid]?.[group]?.[kind] || blankBits();
export const holeBitTotal = (hb: HoleBits | null): number =>
  hb ? Object.values(hb.counts).reduce((a, c) => a + c, 0) : 0;

// Three-putts on scramble day are the team's — one ball on the green — so
// they're logged against both members and each pays the stake per one, rather
// than whoever had the last one paying the flight's total.
export const teamBit = (rid: string, kind: BitKind) => R(rid)!.format === 'scramble' && kind === 'threeputt';
// What a group's sheet for one kind is logged in: each player on their own,
// or each team in the flight for a team kind.
export function bitUnits(S: TripState, rid: string, group: number, kind: BitKind): string[][] {
  const groups = groupsFor(S, rid);
  if (!teamBit(rid, kind)) return groups[group]?.players.map((pid) => [pid]) ?? [];
  return (flightsFor(S, rid)[group]?.teams ?? []).map((t) => groups[t].players);
}
// A unit's count on one hole: a team's is what its members were logged with.
export const unitBitCount = (hb: HoleBits | null, unit: string[]) =>
  hb ? Math.max(0, ...unit.map((pid) => hb.counts[pid] || 0)) : 0;

// A group's running tally for one kind: total across the round, and who had
// the last one — the marked player on the highest hole with any logged. A
// team kind counts team three-putts, and nobody holds the last one.
export interface BitTally { kind: BitKind; total: number; last: string | null }
export function groupBitTally(S: TripState, rid: string, group: number, kind: BitKind): BitTally {
  const team = teamBit(rid, kind);
  const units = team ? bitUnits(S, rid, group, kind) : [];
  let total = 0, last: string | null = null;
  for (const hb of bitsOf(S, rid, group, kind)) {
    const n = team ? units.reduce((a, u) => a + unitBitCount(hb, u), 0) : holeBitTotal(hb);
    if (!n) continue;
    total += n;
    if (!team) last = hb!.last ?? Object.keys(hb!.counts)[0] ?? last;
  }
  return { kind, total, last };
}
export const groupBitTallies = (S: TripState, rid: string, group: number): BitTally[] =>
  BIT_KINDS.map((k) => groupBitTally(S, rid, group, k));

// What each player in a group puts into the pot for one kind (pence): the
// last holder pays the group's total at the day's stake, or for a team kind
// everyone pays the stake for each one they were logged with.
export function groupBitOwed(S: TripState, rid: string, group: number, kind: BitKind): Record<string, number> {
  const stake = stakesFor(S, rid)[kind];
  const owed: Record<string, number> = {};
  if (teamBit(rid, kind)) {
    for (const hb of bitsOf(S, rid, group, kind))
      for (const [pid, n] of Object.entries(hb?.counts ?? {})) if (n) owed[pid] = (owed[pid] || 0) + n * stake;
  } else {
    const t = groupBitTally(S, rid, group, kind);
    if (t.total > 0 && t.last) owed[t.last] = t.total * stake;
  }
  return owed;
}

// One player's count of a kind in one round, whichever group logged it.
export function playerBitCount(S: TripState, rid: string, pid: string, kind: BitKind): number {
  let n = 0;
  for (const sheet of Object.values(S.bits[rid] || {}))
    for (const hb of sheet[kind] || []) n += hb?.counts[pid] || 0;
  return n;
}
// One player's count of a kind across every round of the week.
export const playerBitTotal = (S: TripState, pid: string, kind: BitKind): number =>
  Object.keys(S.bits).reduce((a, rid) => a + playerBitCount(S, rid, pid, kind), 0);

// What one player puts into the group bets in one round (pence), every kind
// in every group that logged them.
export function playerBetPaid(S: TripState, rid: string, pid: string): number {
  let p = 0;
  for (const g of Object.keys(S.bits[rid] || {}))
    for (const k of BIT_KINDS) p += groupBitOwed(S, rid, Number(g), k)[pid] || 0;
  return p;
}

export const fmtMoney = (pence: number) =>
  pence >= 100 ? '£' + (pence / 100).toFixed(2) : pence + 'p';

// Score relative to par, for entry labels: ['birdie', 'under'] etc.
export type ParBand = 'eagle' | 'under' | 'level' | 'over' | 'double';
export function relPar(diff: number): [string, ParBand] {
  if (diff <= -3) return ['Albatross', 'eagle'];
  if (diff === -2) return ['Eagle', 'eagle'];
  if (diff === -1) return ['Birdie', 'under'];
  if (diff === 0) return ['Par', 'level'];
  if (diff === 1) return ['Bogey', 'over'];
  return ['+' + diff, 'double'];
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
// Whole strokes against par the way a leaderboard writes them: E, +2, −1.
export const toParStr = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt1(Math.abs(n));
export const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
