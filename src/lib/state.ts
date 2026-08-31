// State shapes and localStorage persistence.
export type HoleScores = (number | null)[];
export interface PairDraw { pairs: string[][]; revealed: boolean }
export interface TripState {
  v: 3;
  scores: Record<string, Record<string, HoleScores>>;    // scores[rid][pid] = 18 gross
  pairs: Record<string, PairDraw>;
  scramble: Record<string, Record<number, HoleScores>>;  // scramble[rid][team] = 18 team gross
  groups: Record<string, string[][]>;                    // groups[rid] = player ids per group, overriding the placeholder draw
}

export const STORE_KEY = 'yorkshire-golf-2026';
export const ME_KEY = STORE_KEY + '-me';
export const OUTBOX_KEY = STORE_KEY + '-outbox';
export const ROUTE_KEY = STORE_KEY + '-route';

export function defaultState(): TripState {
  return { v: 3, scores: {}, pairs: {}, scramble: {}, groups: {} };
}
// Normalise a hole array to exactly 18 entries of number-or-null.
const pad18 = (a: unknown): HoleScores =>
  Array.from({ length: 18 }, (_, i) => {
    const v = Array.isArray(a) ? a[i] : null;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  });
const padMap = <K extends string | number>(m: Record<K, unknown> | undefined): Record<K, HoleScores> =>
  Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, pad18(v)])) as Record<K, HoleScores>;

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
    pairs: o.pairs || d.pairs,
    groups: cleanGroups(o.groups),
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
