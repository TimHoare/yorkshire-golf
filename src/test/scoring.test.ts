import { describe, expect, it } from 'vitest';
import { defaultState, migrate } from '../lib/state';
import {
  blank18, courseHandicap, fmtMoney, groupBitTally, holePoints, playerBitTotal, shotsOn,
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
  it('splits week points across ties', () => {
    const S = defaultState();
    // everyone shoots identical rounds → all tie for 1st → (8+6+4+2)/8 each... capped by placePoints length
    S.scores.d1 = Object.fromEntries(['p1','p2','p3','p4','p5','p6','p7','p8'].map((pid) => [pid, filled(4)]));
    // different handicaps → different points, so build a real spread instead:
    const rows = stablefordResults(S, 'd1');
    expect(rows).toHaveLength(8);
    const totalWeekPts = rows.reduce((a, r) => a + (r.points ?? 0), 0);
    expect(totalWeekPts).toBe(20); // 8+6+4+2 always fully distributed
    expect(rows[0].place).toBe(1);
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
    expect(S.stakes).toEqual({ cuckoo: 25, camel: 10, fish: 10, threeputt: 10 });
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
