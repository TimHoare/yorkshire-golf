// Group draws. Day 1 is a straight random draw. Later stableford rounds are
// weighted so repeat groupings are avoided — by the end of the week everyone
// should have played with everyone. The scramble is seeded off the standings:
// 1st plays with 8th, 2nd with 7th, and so on.
import { PLAYERS, R, ROUNDS } from '../data/trip';
import { groupsFor, roundStatus, standings } from './scoring';
import type { TripState } from './state';

export function shuffle<T>(a: T[], rand: () => number = Math.random): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const pairKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);

// How often each pair has already been grouped together, counting only rounds
// whose groups are settled: a stored draw, or scores already on the card.
export function timesTogether(S: TripState, rid: string): Map<string, number> {
  const n = new Map<string, number>();
  for (const other of ROUNDS) {
    if (other.id === rid) continue;
    if (!S.groups[other.id] && roundStatus(S, other.id) === 'none') continue;
    for (const g of groupsFor(S, other.id)) {
      for (let i = 0; i < g.players.length; i++) for (let j = i + 1; j < g.players.length; j++) {
        const k = pairKey(g.players[i], g.players[j]);
        n.set(k, (n.get(k) || 0) + 1);
      }
    }
  }
  return n;
}

export function drawGroups(S: TripState, rid: string, rand: () => number = Math.random): string[][] {
  const r = R(rid)!;
  const sizes = r.groups.map((g) => g.players.length);
  if (r.format === 'scramble') {
    // Seeded off the standings: 1st with 8th, 2nd with 7th, ...
    const order = standings(S).map((row) => row.pid);
    return sizes.map((_, t) => [order[t], order[order.length - 1 - t]]);
  }
  const seen = timesTogether(S, rid);
  let best: string[][] = [];
  let bestCost = Infinity;
  for (let it = 0; it < 800; it++) {
    const ids = shuffle(PLAYERS.map((p) => p.id), rand);
    const part: string[][] = [];
    let off = 0;
    for (const s of sizes) { part.push(ids.slice(off, off + s)); off += s; }
    let cost = 0;
    for (const g of part) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const c = seen.get(pairKey(g[i], g[j])) || 0;
      cost += c * c;
    }
    if (cost < bestCost) { bestCost = cost; best = part; }
    if (bestCost === 0 && it >= 50) break; // random enough, no repeats — done
  }
  return best;
}
