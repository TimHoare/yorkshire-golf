import { describe, expect, it } from 'vitest';
import { defaultState, migrate } from '../lib/state';
import {
  blank18, countback, courseHandicap, firstUnfinishedHole, flightsFor, fmtMoney, groupBitTally,
  holePoints, pairPointsFor, pairTotals, playerBitTotal, roundPoints, scrambleResults, shotsOn,
  stablefordResults, standings, tally,
} from '../lib/scoring';

const filled = (n: number) => Array(18).fill(n);

describe('handicap maths', () => {
  it('course handicap = index × slope/113 + (CR − par), rounded', () => {
    // Ganton (d2): slope 133, CR 72.2, par 71
    expect(courseHandicap(14.0, 'd2')).toBe(Math.round(14.0 * (133 / 113) + (72.2 - 71)));
    // Elsham (d1): slope 132, CR 71.2, par 71
    expect(courseHandicap(3.8, 'd1')).toBe(Math.round(3.8 * (132 / 113) + 0.2));
  });
  it('shots per hole follow stroke index', () => {
    expect(shotsOn(18, 1)).toBe(1);
    expect(shotsOn(18, 18)).toBe(1);
    expect(shotsOn(5, 5)).toBe(1);
    expect(shotsOn(5, 6)).toBe(0);
    expect(shotsOn(24, 6)).toBe(2);   // 24 = 18 + 6: two shots on SI 1–6
    expect(shotsOn(24, 7)).toBe(1);
    expect(shotsOn(-2, 18)).toBe(-1); // plus handicaps give shots back on high SI
  });
  it('stableford points: 2 for net par, floor at 0', () => {
    expect(holePoints(4, 4, 0)).toBe(2);
    expect(holePoints(5, 4, 1)).toBe(2);
    expect(holePoints(3, 4, 0)).toBe(3);
    expect(holePoints(9, 4, 1)).toBe(0);
    expect(holePoints(null, 4, 0)).toBeNull();
  });
});

describe('tally', () => {
  it('sums points and strokes, tracks completeness', () => {
    const t = tally('d1', filled(4), 0);
    expect(t.complete).toBe(true);
    expect(t.strokes).toBe(72);
    // Elsham par 71: all-4s is level on par-4s (2pts), birdie on par-5s (3), bogey on par-3s (1)
    const expected = t.rows.reduce((a, r) => a + Math.max(0, 2 + r.par - 4), 0);
    expect(t.pts).toBe(expected);
    expect(tally('d1', blank18(), 0).played).toBe(0);
  });
});

describe('results', () => {
  it('distributes the full place-points table', () => {
    const S = defaultState();
    S.scores.d1 = Object.fromEntries(['p1','p2','p3','p4','p5','p6','p7','p8'].map((pid) => [pid, filled(4)]));
    const rows = stablefordResults(S, 'd1');
    expect(rows).toHaveLength(8);
    const totalWeekPts = rows.reduce((a, r) => a + (r.points ?? 0), 0);
    expect(totalWeekPts).toBe(34); // 10+8+6+4+3+2+1+0 always fully distributed
    expect(rows[0].place).toBe(1);
  });
  it('countback reads back 9, back 6, back 3', () => {
    const gross = filled(4);
    gross[17] = 3; // one better on the last
    const t = tally('d1', gross, 0);
    const [b9, b6, b3] = countback(t);
    expect(b9).toBe(t.rows.slice(9).reduce((a, r) => a + (r.pts ?? 0), 0));
    expect(b6).toBe(t.rows.slice(12).reduce((a, r) => a + (r.pts ?? 0), 0));
    expect(b3).toBe(t.rows.slice(15).reduce((a, r) => a + (r.pts ?? 0), 0));
  });
  it('breaks stableford ties on the back 9 instead of sharing', () => {
    const S = defaultState();
    // p5 and p8 both start on 9.1 → identical playing handicaps. Same total
    // gross, but p8's better holes are on the back 9 → p8 takes the place.
    const a = filled(4); a[0] = 3; a[1] = 3;   // front-loaded
    const b = filled(4); b[16] = 3; b[17] = 3; // back-loaded
    S.scores.d1 = { p5: a, p8: b };
    const rows = stablefordResults(S, 'd1');
    expect(rows[0].pts).toBe(rows[1].pts);
    expect(rows[0].pid).toBe('p8');
    expect(rows[0].place).toBe(1);
    expect(rows[1].place).toBe(2);
    expect(rows[0].tied).toBe(false);
    expect(rows[0].points).toBe(10);
    expect(rows[1].points).toBe(8);
  });
  it('pairs add 6/4/2/0 each, ties on aggregate shared', () => {
    const S = defaultState();
    S.scores.d1 = Object.fromEntries(['p1','p2','p3','p4','p5','p6','p7','p8'].map((pid) => [pid, filled(4)]));
    S.pairs.d1 = { pairs: [['p1','p2'],['p3','p4'],['p5','p6'],['p7','p8']], revealed: true };
    const rows = pairTotals(S, 'd1');
    expect(rows.reduce((a, r) => a + (r.points ?? 0), 0)).toBe(12); // 6+4+2+0
    expect(rows[0].place).toBe(1);
    // each member of a pair takes the pair's full points
    const top = rows[0].pair;
    expect(pairPointsFor(S, 'd1', top[0])).toBe(rows[0].points);
    expect(pairPointsFor(S, 'd1', top[1])).toBe(rows[0].points);
    // roundPoints = individual place points + pair points
    const total = ['p1','p2','p3','p4','p5','p6','p7','p8'].reduce((a, pid) => a + (roundPoints(S, 'd1', pid) ?? 0), 0);
    expect(total).toBe(34 + 2 * 12);
  });
  it('scramble scoring flights: teams grouped by tee time', () => {
    const S = defaultState();
    const fs = flightsFor(S, 'd3');
    expect(fs).toHaveLength(2);
    expect(fs[0].teams).toEqual([0, 1]);
    expect(fs[1].teams).toEqual([2, 3]);
    expect(fs[0].players).toEqual(['p1', 'p3', 'p5', 'p7']);
    // a flight's hole isn't done until both its teams have a score
    S.scramble.d3 = { 0: [4, ...Array(17).fill(null)] };
    expect(firstUnfinishedHole(S, 'd3', 0)).toBe(1);
    S.scramble.d3[1] = [4, ...Array(17).fill(null)];
    expect(firstUnfinishedHole(S, 'd3', 0)).toBe(2);
  });
  it('scramble awards 6/4/2/0 per player by team place', () => {
    const S = defaultState();
    // d3 teams: A p1/p3 · B p5/p7 · C p2/p4 · D p6/p8 — a stroke a hole apart
    S.scramble.d3 = { 0: filled(3), 1: filled(4), 2: filled(5), 3: filled(6) };
    const res = scrambleResults(S, 'd3');
    expect(res.decided).toBe(true);
    expect(res.winner).toBe(0);
    expect(res.rows.p1).toEqual({ points: 6, place: 1, won: true, tie: false });
    expect(res.rows.p3.points).toBe(6);
    expect(res.rows.p6.place).toBe(4);
    expect(res.rows.p6.points).toBe(0);
    const total = Object.values(res.rows).reduce((a, r) => a + r.points, 0);
    expect(total).toBe(24); // (6+4+2+0) × 2 players
  });
  it('standings ranks by week points then stableford total', () => {
    const S = defaultState();
    S.scores.d1 = Object.fromEntries(['p1','p2','p3','p4','p5','p6','p7','p8'].map((pid) => [pid, filled(5)]));
    const st = standings(S);
    expect(st[0].rank).toBe(1);
    expect(st.map((r) => r.pid)).toHaveLength(8);
  });
});

describe('side bets', () => {
  it('tallies a group: totals across holes, last one from the highest hole', () => {
    const S = defaultState();
    S.bits.d1 = { 0: { cuckoo: [
      { counts: { p1: 2, p2: 1 }, last: 'p2' }, null, { counts: { p3: 1 }, last: 'p3' },
      ...Array(15).fill(null),
    ] } };
    const t = groupBitTally(S, 'd1', 0, 'cuckoo');
    expect(t.total).toBe(4);
    expect(t.last).toBe('p3');
    // an untouched kind is empty
    expect(groupBitTally(S, 'd1', 0, 'fish').total).toBe(0);
    expect(groupBitTally(S, 'd1', 0, 'fish').last).toBeNull();
  });
  it('counts one player across every round and group', () => {
    const S = defaultState();
    S.bits.d1 = { 0: { camel: [{ counts: { p1: 2 }, last: 'p1' }, ...Array(17).fill(null)] } };
    S.bits.d2 = { 1: { camel: [null, { counts: { p1: 1, p4: 3 }, last: 'p4' }, ...Array(16).fill(null)] } };
    expect(playerBitTotal(S, 'p1', 'camel')).toBe(3);
    expect(playerBitTotal(S, 'p4', 'camel')).toBe(3);
    expect(playerBitTotal(S, 'p1', 'fish')).toBe(0);
  });
  it('migrate keeps bits and stakes, pads holes, drops junk', () => {
    const S = migrate({
      v: 3, scores: {}, pairs: {}, scramble: {}, groups: {},
      bits: { d1: { 0: { cuckoo: [{ counts: { p1: 1, p2: 0 }, last: 'p1' }], junk: [1, 2] } } },
      stakes: { cuckoo: 25, fish: -5, nonsense: 99 },
    });
    const arr = S.bits.d1[0].cuckoo!;
    expect(arr).toHaveLength(18);
    expect(arr[0]).toEqual({ counts: { p1: 1 }, last: 'p1' });
    expect(arr[5]).toBeNull();
    expect((S.bits.d1[0] as Record<string, unknown>).junk).toBeUndefined();
    expect(S.stakes).toEqual({ cuckoo: 25, camel: 10, fish: 10, threeputt: 10, lostball: 10 });
    // states written before side bets existed come up with defaults
    const old = migrate({ v: 3, scores: {}, pairs: {}, scramble: {}, groups: {} });
    expect(old.bits).toEqual({});
    expect(old.stakes.threeputt).toBe(10);
  });
  it('money formatting', () => {
    expect(fmtMoney(10)).toBe('10p');
    expect(fmtMoney(100)).toBe('£1.00');
    expect(fmtMoney(230)).toBe('£2.30');
  });
});

describe('pickups', () => {
  it('a pickup (gross 0) scores 0 points but counts as played', () => {
    expect(holePoints(0, 4, 2)).toBe(0);
    const gross = filled(4);
    gross[0] = 0;
    const t = tally('d1', gross, 0);
    expect(t.played).toBe(18);
    expect(t.complete).toBe(true);
    expect(t.pickups).toBe(1);
    expect(t.rows[0].pts).toBe(0);
    expect(t.strokes).toBe(68); // pickup adds nothing to the strokes floor
  });
});
