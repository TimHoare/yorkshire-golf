// Competition rules the scoring tests only reach indirectly: index drift,
// scramble team handicaps, points shared on ties, round status and standings.
import { describe, expect, it } from 'vitest';
import { R } from '../data/trip';
import { defaultState, type TripState } from '../lib/state';
import {
  courseHandicap, currentIndex, indexHistory, pairPointsFor, pairTotals, phFor, playerTally, playingHandicap,
  indexBefore, roundStatus, scrambleResults, shotsOn, stablefordResults, standings, teamHandicap, teamTally,
} from '../lib/scoring';

const PIDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
// Gross scores that make net par on every hole off handicap ph — 2 points a
// hole, 36 for the round — with per-hole stroke adjustments on top.
const netPar = (rid: string, ph: number, delta: number[] = []) =>
  R(rid)!.holes.map((h, i) => h.par + shotsOn(ph, h.si) + (delta[i] ?? 0));
// The same for a player, off the handicap they carry into the round.
const netParFor = (S: TripState, rid: string, pid: string, delta: number[] = []) =>
  netPar(rid, phFor(S, pid, rid), delta);
const bogeys = (n: number) => Array(n).fill(1);

describe('index drift', () => {
  it('moves −0.5 per point over 32 once a stableford round is complete', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') }; // 36 points, 38 with the 18th doubled by default
    const [d1, d2] = indexHistory(S, 'p1');
    expect(d1.before).toBe(14.0);
    expect(d1.applied).toBe(true);
    expect(d1.after).toBe(11.0);
    expect(d2.before).toBe(11.0);
    expect(d2.applied).toBe(false); // nothing entered yet
    expect(currentIndex(S, 'p1')).toBe(11.0);
    // the next round is played off the drifted index, not the starting one
    expect(phFor(S, 'p1', 'd2')).toBe(playingHandicap(S, 11.0, 'd2'));
    expect(phFor(S, 'p1', 'd2')).not.toBe(playingHandicap(S, 14.0, 'd2'));
  });
  it('goes up after a poor round; a partial round does not count', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1', bogeys(8)) }; // 28 points, 30 with the 18th doubled
    expect(indexHistory(S, 'p1')[0].after).toBe(15.0);
    S.scores.d1.p1[17] = null;
    expect(indexHistory(S, 'p1')[0].applied).toBe(false);
    expect(indexHistory(S, 'p1')[0].after).toBe(14.0);
  });
  it('counts the bonus-ball doubling; the scramble moves it by team place once every team is in', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') };
    S.bonus.p1 = { used: { d1: 0 }, lost: null };
    expect(playerTally(S, 'd1', 'p1').pts).toBe(38); // doubled for the competition…
    expect(indexHistory(S, 'p1')[0].after).toBe(11.0); // …and the handicap moves on the 38
    S.bonus.p1 = { used: { d1: 0 }, lost: 'd1' }; // lost on its hole: the 2× is void, back to 36
    expect(indexHistory(S, 'p1')[0].after).toBe(12.0);
    S.bonus.p1 = { used: { d1: 0 }, lost: null };
    S.scramble.d3 = { 0: Array(18).fill(4), 1: Array(18).fill(4), 2: Array(18).fill(4) };
    let d3 = indexHistory(S, 'p1')[2];
    expect(d3.round.id).toBe('d3');
    expect(d3.applied).toBe(false);   // one team still out
    expect(d3.after).toBe(d3.before);
    S.scramble.d3[3] = Array(18).fill(4);
    d3 = indexHistory(S, 'p1')[2];
    expect(d3.applied).toBe(true);
    expect(d3.after).not.toBe(d3.before);
  });
  it('scramble day: 1st −1, 2nd −0.5, 3rd +0.5, 4th +1 for each member, off the index carried in', () => {
    const S = defaultState();
    // Teams as placeholders: A Tim & Adam, B Liam K & Harry, C Matthew & Josh, D Rob & Liam C.
    // Handicaps 7.0 · 5.9 · 8.3 · 1.8 — level gross puts C 1st, A 2nd, B 3rd, D 4th.
    S.scramble.d3 = { 0: Array(18).fill(4), 1: Array(18).fill(4), 2: Array(18).fill(4), 3: Array(18).fill(4) };
    const res = scrambleResults(S, 'd3');
    expect([res.rows.p2.place, res.rows.p1.place, res.rows.p5.place, res.rows.p6.place]).toEqual([1, 2, 3, 4]);
    const at = (pid: string) => indexHistory(S, pid).find((h) => h.round.id === 'd3')!;
    expect(at('p2')).toMatchObject({ before: 19.3, after: 18.3, applied: true }); // Matthew, 1st
    expect(at('p4')).toMatchObject({ before: 17.2, after: 16.2, applied: true }); // Josh, 1st
    expect(at('p1')).toMatchObject({ before: 14.0, after: 13.5, applied: true }); // Tim, 2nd
    expect(at('p5')).toMatchObject({ before: 9.1, after: 9.6, applied: true });   // Liam K, 3rd
    expect(at('p6')).toMatchObject({ before: 3.8, after: 4.8, applied: true });   // Rob, 4th
    // it carries into Thursday, and Thursday's card is played off it
    expect(indexBefore(S, 'p6', 'd4')).toBe(4.8);
    expect(currentIndex(S, 'p2')).toBe(18.3);
    // the team handicap is off the index carried in, not the one going out
    expect(teamHandicap(S, 'd3', 3)).toBe(1.8);
    // a poor Monday lifts Tim's index first; the scramble step comes off that
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1', bogeys(8)) }; // 30 points → 15.0
    expect(at('p1').before).toBe(15.0);
    expect(at('p1').after).toBe(15.0 + [-1, -0.5, 0.5, 1][scrambleResults(S, 'd3').rows.p1.place - 1]);
  });
  it('scramble day: teams level on net take the shared place, so two tied 1st both come down a shot', () => {
    const S = defaultState();
    // Adam & Liam K and Josh & Liam C off the same team handicap, level gross
    S.groups.d3 = [['p3', 'p5'], ['p4', 'p8'], ['p1', 'p2'], ['p6', 'p7']];
    const gross = (over: number) => R('d3')!.holes.map((h, i) => h.par + (i < over ? 1 : 0));
    S.scramble.d3 = { 0: gross(0), 1: gross(0), 2: gross(3), 3: gross(4) };
    const res = scrambleResults(S, 'd3');
    expect(res.rows.p3).toMatchObject({ place: 1, tie: true });
    expect(res.rows.p8).toMatchObject({ place: 1, tie: true });
    expect(res.rows.p1.place).toBe(3);
    const at = (pid: string) => indexHistory(S, pid).find((h) => h.round.id === 'd3')!;
    expect(at('p3').after).toBe(at('p3').before - 1);
    expect(at('p8').after).toBe(at('p8').before - 1);
    expect(at('p1').after).toBe(at('p1').before + 0.5);
    expect(at('p7').after).toBe(at('p7').before + 1);
  });
});

describe('scramble team handicap', () => {
  it('takes 35% of the lower course handicap and 15% of the higher, to one decimal, whichever order the team is listed', () => {
    const S = defaultState();
    // Team A at Cave Castle: Tim (14.0) and Adam (16.7)
    const lo = courseHandicap(S, 14.0, 'd3');
    const hi = courseHandicap(S, 16.7, 'd3');
    expect([lo, hi]).toEqual([13, 16]);
    expect(teamHandicap(S, 'd3', 0)).toBe(Math.round((lo * 0.35 + hi * 0.15) * 10) / 10);
    expect(teamHandicap(S, 'd3', 0)).toBe(7); // 4.55 + 2.4 = 6.95 → 7.0
    S.groups.d3 = [['p3', 'p1'], ['p5', 'p7'], ['p2', 'p4'], ['p6', 'p8']];
    expect(teamHandicap(S, 'd3', 0)).toBe(7);
  });
  it('uses the index each player carries into the round', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1') }; // Tim drifts 14.0 → 11.0 (38 points with the 18th doubled)
    expect(currentIndex(S, 'p1')).toBe(11.0);
    expect(courseHandicap(S, 11.0, 'd3')).toBe(9);
    expect(teamHandicap(S, 'd3', 0)).toBe(Math.round((9 * 0.35 + 16 * 0.15) * 10) / 10);
    expect(teamHandicap(S, 'd3', 0)).toBe(5.6); // 3.15 + 2.4 = 5.55 → 5.6
  });
  it('comes off the gross to one decimal: the team net is what places the team', () => {
    const S = defaultState();
    S.scramble.d3 = { 0: Array(18).fill(4) }; // 72 gross
    const tt = teamTally(S, 'd3', 0);
    expect(tt.hcp).toBe(7);
    expect(tt.strokes).toBe(72);
    expect(tt.net).toBe(65);
    expect(tt.rows.every((x) => x.shots === 0 && x.pts === null)).toBe(true); // no stableford on scramble day
    // mid-round: gross to par so far, less the whole team handicap
    S.scramble.d3 = { 0: [5, 5, ...Array(16).fill(null)] };
    const part = teamTally(S, 'd3', 0);
    expect(part.net).toBeNull();
    expect(part.toPar).toBe(10 - R('d3')!.holes[0].par - R('d3')!.holes[1].par);
    expect(part.netToPar).toBe(Math.round((part.toPar - 7) * 10) / 10);
  });
});

describe('ties', () => {
  it('stableford: level on points and every countback shares the place points', () => {
    const S = defaultState();
    S.scores.d1 = {
      p1: netParFor(S, 'd1', 'p1'), p2: netParFor(S, 'd1', 'p2'), // 36 each, 2 points on every hole
      p3: netParFor(S, 'd1', 'p3', bogeys(1)),                   // 35
    };
    const rows = stablefordResults(S, 'd1');
    expect(rows.slice(0, 2).map((r) => r.pid).sort()).toEqual(['p1', 'p2']);
    for (const r of rows.slice(0, 2)) expect(r).toMatchObject({ place: 1, points: 9, tied: true }); // (10+8)/2
    expect(rows[2]).toMatchObject({ pid: 'p3', place: 3, points: 6, tied: false });
  });
  it('pairs: level on aggregate share, (6+4)/2 = 5 each at the top', () => {
    const S = defaultState();
    S.scores.d1 = Object.fromEntries(PIDS.map((pid, i) => [pid, netParFor(S, 'd1', pid, bogeys(i < 4 ? 0 : i < 6 ? 1 : 2))]));
    S.pairs.d1 = { pairs: [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['p7', 'p8']], revealed: true };
    const rows = pairTotals(S, 'd1');
    // 38 a head for net par: the uncalled bonus ball doubles the 18th
    expect(rows.map((r) => r.total)).toEqual([76, 76, 74, 72]);
    expect(rows[0]).toMatchObject({ place: 1, points: 5, tied: true });
    expect(rows[1]).toMatchObject({ place: 1, points: 5, tied: true });
    expect(rows[2]).toMatchObject({ place: 3, points: 2, tied: false });
    expect(rows[3]).toMatchObject({ place: 4, points: 0, tied: false });
    expect(pairPointsFor(S, 'd1', 'p1')).toBe(5);
    expect(pairPointsFor(S, 'd1', 'p4')).toBe(5);
    expect(pairPointsFor(S, 'd1', 'p7')).toBe(0);
  });
  it('scramble: two teams level on net at the top share 5 each and nobody wins outright', () => {
    const S = defaultState();
    // Two teams off the same handicap: Adam (16) & Liam K (7) and Josh (16) &
    // Liam C (7), both 0.35×7 + 0.15×16 = 4.85 → 4.9.
    S.groups.d3 = [['p3', 'p5'], ['p4', 'p8'], ['p1', 'p2'], ['p6', 'p7']];
    expect(teamHandicap(S, 'd3', 0)).toBe(4.9);
    expect(teamHandicap(S, 'd3', 1)).toBe(4.9);
    expect(teamHandicap(S, 'd3', 2)).toBe(7.3); // Tim 13 & Matthew 18: 4.55 + 2.7 = 7.25 → 7.3
    expect(teamHandicap(S, 'd3', 3)).toBe(4.2); // Rob 2 & Harry 23: 0.7 + 3.45 = 4.15 → 4.2
    const gross = (over: number) => R('d3')!.holes.map((h, i) => h.par + (i < over ? 1 : 0));
    S.scramble.d3 = { 0: gross(0), 1: gross(0), 2: gross(3), 3: gross(4) };
    const res = scrambleResults(S, 'd3');
    expect(res.ts.map((t) => t.net)).toEqual([67.1, 67.1, 67.7, 71.8]); // 72 − 4.9 · 75 − 7.3 · 76 − 4.2
    expect(res.decided).toBe(true);
    expect(res.winner).toBeNull();
    expect(res.rows.p3).toEqual({ points: 5, place: 1, won: false, tie: true }); // Team A
    expect(res.rows.p8).toEqual({ points: 5, place: 1, won: false, tie: true }); // Team B
    expect(res.rows.p1).toEqual({ points: 2, place: 3, won: false, tie: false }); // Team C
    expect(res.rows.p7.points).toBe(0);                                          // Team D
  });
});

describe('round status', () => {
  it('stableford: none → partial → done only when all eight cards are complete', () => {
    const S = defaultState();
    expect(roundStatus(S, 'd1')).toBe('none');
    S.scores.d1 = { p1: [4, ...Array(17).fill(null)] };
    expect(roundStatus(S, 'd1')).toBe('partial');
    S.scores.d1 = Object.fromEntries(PIDS.slice(0, 7).map((pid) => [pid, netParFor(S, 'd1', pid)]));
    expect(roundStatus(S, 'd1')).toBe('partial');
    S.scores.d1.p8 = netParFor(S, 'd1', 'p8');
    expect(roundStatus(S, 'd1')).toBe('done');
  });
  it('scramble: done only when all four team cards are complete', () => {
    const S = defaultState();
    expect(roundStatus(S, 'd3')).toBe('none');
    S.scramble.d3 = { 0: Array(18).fill(4), 1: Array(18).fill(4), 2: Array(18).fill(4) };
    expect(roundStatus(S, 'd3')).toBe('partial');
    S.scramble.d3[3] = Array(18).fill(4);
    expect(roundStatus(S, 'd3')).toBe('done');
  });
});

describe('standings', () => {
  it('equal week points and stableford share a rank; the next rank skips', () => {
    const S = defaultState();
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1'), p2: netParFor(S, 'd1', 'p2') };
    const st = standings(S);
    expect(st.slice(0, 2).map((r) => r.pid).sort()).toEqual(['p1', 'p2']);
    expect(st[0]).toMatchObject({ rank: 1, pts: 9, stab: 38 }); // 36 + the 18th doubled
    expect(st[1]).toMatchObject({ rank: 1, pts: 9, stab: 38 });
    expect(st[2].rank).toBe(3);
    expect(st[7].rank).toBe(3);
  });
  it('splits equal week points on total stableford', () => {
    const S = defaultState();
    // Elsham: Tim first (10), Matthew second (8). Ganton: the other way round —
    // level on 18 for the week, but Matthew's birdie gives him 76 stableford to
    // Tim's 75 (each round's 18th doubled by the uncalled bonus ball).
    S.scores.d1 = { p1: netParFor(S, 'd1', 'p1'), p2: netParFor(S, 'd1', 'p2', bogeys(1)) };
    S.scores.d2 = { p1: netParFor(S, 'd2', 'p1', bogeys(1)), p2: netParFor(S, 'd2', 'p2', [-1]) };
    const [a, b] = standings(S);
    expect(a).toMatchObject({ pid: 'p2', rank: 1, pts: 18, stab: 76 });
    expect(b).toMatchObject({ pid: 'p1', rank: 2, pts: 18, stab: 75 });
  });
});
