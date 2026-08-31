import { describe, expect, it } from 'vitest';
import { defaultState } from '../lib/state';
import { drawGroups } from '../lib/draw';
import { groupsFor } from '../lib/scoring';
import { PLAYERS, R } from '../data/trip';

const ALL = PLAYERS.map((p) => p.id).sort();

describe('group draws', () => {
  it('stableford draw is a valid partition into the round\'s group sizes', () => {
    const S = defaultState();
    const g = drawGroups(S, 'd1');
    expect(g.map((x) => x.length)).toEqual(R('d1')!.groups.map((x) => x.players.length));
    expect(g.flat().sort()).toEqual(ALL);
  });

  it('scramble teams are seeded off the standings: 1st with 8th, 2nd with 7th…', () => {
    // With no scores everyone ties and standings fall back to list order.
    const S = defaultState();
    expect(drawGroups(S, 'd3')).toEqual([['p1', 'p8'], ['p2', 'p7'], ['p3', 'p6'], ['p4', 'p5']]);
  });

  it('later draws avoid repeating the previous grouping', () => {
    const S = defaultState();
    S.groups.d1 = [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8']];
    for (let i = 0; i < 5; i++) {
      const g = drawGroups(S, 'd2');
      expect(g.flat().sort()).toEqual(ALL);
      // straight repeat of d1 (cost 12) always loses to a mixed draw (cost 4)
      const sets = g.map((grp) => [...grp].sort().join());
      expect(sets).not.toContain('p1,p2,p3,p4');
      expect(sets).not.toContain('p5,p6,p7,p8');
    }
  });

  it('groupsFor overlays a stored draw on the placeholder groups', () => {
    const S = defaultState();
    expect(groupsFor(S, 'd1')[0].players).toEqual(R('d1')!.groups[0].players);
    S.groups.d1 = [['p8', 'p7', 'p6', 'p5'], ['p4', 'p3', 'p2', 'p1']];
    const g = groupsFor(S, 'd1');
    expect(g[0].players).toEqual(['p8', 'p7', 'p6', 'p5']);
    expect(g[0].tee).toBe(R('d1')!.groups[0].tee); // tee times stay with the slot
  });
});
