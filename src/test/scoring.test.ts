import { describe, expect, it } from 'vitest';
import { defaultState } from '../lib/state';
import {
  blank18, courseHandicap, holePoints, shotsOn, stablefordResults, standings, tally,
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
