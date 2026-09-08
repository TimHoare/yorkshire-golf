// State shapes and localStorage persistence.
export type HoleScores = (number | null)[];
export type HoleDrives = (string | null)[];        // whose tee shot a scramble team took, per hole
export interface PairDraw { pairs: string[][]; revealed: boolean }

// Side bets: cuckoo = hit a tree, camel = bunker, fish = water, threeputt = 3+ putts,
// lostball = lost a ball, equipment = equipment abuse (club, ball or bag thrown, slammed or snapped).
export const BIT_KINDS = ['cuckoo', 'camel', 'fish', 'threeputt', 'lostball', 'equipment'] as const;
export type BitKind = (typeof BIT_KINDS)[number];
// One hole's log for one kind: how many each player had, and who had the last one.
export interface HoleBits { counts: Record<string, number>; last: string | null }
export type BitSheet = Partial<Record<BitKind, (HoleBits | null)[]>>;
export type Stakes = Record<BitKind, number>;            // pence per one

// Bonus balls: one per player for the whole trip. used[rid] = the hole index
// (0–17) they played it on that round (that hole's points double; it must go
// on one hole a round, and defaults to the 18th if never called); lost = the
// round it was lost in, if it was — no more 2×s after that round, and no +1
// for keeping it to the end.
export interface BonusBall { used: Record<string, number>; lost: string | null }

export interface TripState {
  v: 3;
  scores: Record<string, Record<string, HoleScores>>;    // scores[rid][pid] = 18 gross
  pairs: Record<string, PairDraw>;
  scramble: Record<string, Record<number, HoleScores>>;  // scramble[rid][team] = 18 team gross
  drives: Record<string, Record<number, HoleDrives>>;    // drives[rid][team] = 18 player ids: whose drive the team used
  groups: Record<string, string[][]>;                    // groups[rid] = player ids per group, overriding the placeholder draw
  bits: Record<string, Record<number, BitSheet>>;        // bits[rid][group][kind] = 18 hole logs
  stakes: Stakes;                                        // default pence per cuckoo/camel/fish/three-putt/lost ball/equipment abuse
  roundStakes: Record<string, Stakes>;                   // roundStakes[rid] = that day's own stakes, absent = the defaults
  bonus: Record<string, BonusBall>;                      // bonus[pid] = bonus-ball record
  teeChoice: Record<string, string>;                     // teeChoice[rid] = alt tee key, absent = the round's default tees
}

// Storage generation: bumping the suffix orphans whatever an older build
// saved (state and outbox alike), so a phone that last ran old sync code
// starts clean from the server instead of replaying stale local data.
// Who you are and where you were stay put across generations.
export const STORE_KEY = 'yorkshire-golf-2026-g2';
export const ME_KEY = 'yorkshire-golf-2026-me';
export const OUTBOX_KEY = STORE_KEY + '-outbox';
export const ROUTE_KEY = 'yorkshire-golf-2026-route';

export const defaultStakes = (): Stakes => ({ cuckoo: 10, camel: 10, fish: 10, threeputt: 10, lostball: 10, equipment: 10 });
export function defaultState(): TripState {
  return { v: 3, scores: {}, pairs: {}, scramble: {}, drives: {}, groups: {}, bits: {}, stakes: defaultStakes(), roundStakes: {}, bonus: {}, teeChoice: {} };
}
// Normalise a hole array to exactly 18 entries of number-or-null.
const pad18 = (a: unknown): HoleScores =>
  Array.from({ length: 18 }, (_, i) => {
    const v = Array.isArray(a) ? a[i] : null;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  });
const padMap = <K extends string | number>(m: Record<K, unknown> | undefined): Record<K, HoleScores> =>
  Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, pad18(v)])) as Record<K, HoleScores>;
const pad18Drives = (a: unknown): HoleDrives =>
  Array.from({ length: 18 }, (_, i) => {
    const v = Array.isArray(a) ? a[i] : null;
    return typeof v === 'string' && v ? v : null;
  });
const padDrives = (m: Record<string | number, unknown> | undefined): Record<number, HoleDrives> =>
  Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, pad18Drives(v)])) as Record<number, HoleDrives>;

// A hole's side-bet log: positive integer counts only; empty holes collapse to null.
export const cleanHoleBits = (v: unknown): HoleBits | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as { counts?: unknown; last?: unknown };
  const counts: Record<string, number> = {};
  if (o.counts && typeof o.counts === 'object')
    for (const [pid, n] of Object.entries(o.counts as Record<string, unknown>))
      if (typeof n === 'number' && n >= 1) counts[pid] = Math.round(n);
  if (!Object.keys(counts).length) return null;
  const last = typeof o.last === 'string' && counts[o.last] ? o.last : Object.keys(counts)[0];
  return { counts, last };
};
const pad18Bits = (a: unknown): (HoleBits | null)[] =>
  Array.from({ length: 18 }, (_, i) => cleanHoleBits(Array.isArray(a) ? a[i] : null));

const cleanBits = (b: unknown): TripState['bits'] => {
  const out: TripState['bits'] = {};
  for (const [rid, byG] of Object.entries((b as Record<string, unknown>) || {})) {
    if (!byG || typeof byG !== 'object') continue;
    const groups: Record<number, BitSheet> = {};
    for (const [g, sheet] of Object.entries(byG as Record<string, unknown>)) {
      if (!sheet || typeof sheet !== 'object' || Number.isNaN(Number(g))) continue;
      const s: BitSheet = {};
      for (const k of BIT_KINDS) {
        const arr = (sheet as Record<string, unknown>)[k];
        if (arr !== undefined) s[k] = pad18Bits(arr);
      }
      groups[Number(g)] = s;
    }
    out[rid] = groups;
  }
  return out;
};

// A full set of stakes: valid amounts kept, anything missing filled from base
// (the built-in defaults unless told otherwise).
export const cleanStakes = (s: unknown, base: Stakes = defaultStakes()): Stakes => {
  const d = { ...base };
  if (s && typeof s === 'object')
    for (const k of BIT_KINDS) {
      const v = (s as Record<string, unknown>)[k];
      if (typeof v === 'number' && v >= 0) d[k] = Math.round(v);
    }
  return d;
};
// One day's own stakes, or null when it has none ({} / junk means "use the defaults").
export const cleanRoundStakes = (s: unknown, base: Stakes): Stakes | null => {
  if (!s || typeof s !== 'object') return null;
  const has = BIT_KINDS.some((k) => typeof (s as Record<string, unknown>)[k] === 'number');
  return has ? cleanStakes(s, base) : null;
};
// The stakes in play on a round: its own if set, else the defaults.
export const stakesFor = (S: TripState, rid: string): Stakes => S.roundStakes[rid] ?? S.stakes;

export const cleanBonusBall = (v: unknown): BonusBall => {
  const o = (v && typeof v === 'object' ? v : {}) as { used?: unknown; lost?: unknown };
  const used: Record<string, number> = {};
  if (o.used && typeof o.used === 'object')
    for (const [rid, h] of Object.entries(o.used as Record<string, unknown>))
      if (typeof h === 'number' && h >= 0 && h <= 17) used[rid] = Math.round(h);
  return { used, lost: typeof o.lost === 'string' ? o.lost : null };
};
const cleanBonus = (b: unknown): TripState['bonus'] =>
  Object.fromEntries(Object.entries((b as Record<string, unknown>) || {}).map(([pid, v]) => [pid, cleanBonusBall(v)]));

const cleanRoundStakesMap = (m: unknown, base: Stakes): Record<string, Stakes> => {
  const out: Record<string, Stakes> = {};
  for (const [rid, v] of Object.entries((m as Record<string, unknown>) || {})) {
    const st = cleanRoundStakes(v, base);
    if (st) out[rid] = st;
  }
  return out;
};

const cleanGroups = (g: unknown): Record<string, string[][]> =>
  Object.fromEntries(Object.entries((g as Record<string, unknown>) || {}).filter(([, v]) =>
    Array.isArray(v) && v.every((grp) => Array.isArray(grp) && grp.every((pid) => typeof pid === 'string')))) as Record<string, string[][]>;

export function migrate(s: unknown): TripState {
  const d = defaultState();
  const o = s as Partial<TripState> | null;
  if (!o || o.v !== 3) return { ...d, pairs: (o && o.pairs) || {} };
  return {
    v: 3,
    scores: Object.fromEntries(Object.entries(o.scores || {}).map(([rid, byP]) => [rid, padMap(byP)])),
    scramble: Object.fromEntries(Object.entries(o.scramble || {}).map(([rid, byT]) => [rid, padMap(byT)])),
    drives: Object.fromEntries(Object.entries(o.drives || {}).map(([rid, byT]) => [rid, padDrives(byT)])),
    pairs: o.pairs || d.pairs,
    groups: cleanGroups(o.groups),
    bits: cleanBits(o.bits),
    stakes: cleanStakes(o.stakes),
    roundStakes: cleanRoundStakesMap(o.roundStakes, cleanStakes(o.stakes)),
    bonus: cleanBonus(o.bonus),
    teeChoice: Object.fromEntries(Object.entries(o.teeChoice || {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
  };
}
export function loadState(): TripState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}
export function persistState(S: TripState) {
  localStorage.setItem(STORE_KEY, JSON.stringify(S));
}
