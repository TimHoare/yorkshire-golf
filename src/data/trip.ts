// Everything fixed about the trip. Course data is the real thing: men's yellow
// tees from each club's published scorecard (par / yards / SI verified to sum).
// Tee times are confirmed for Elsham, Ganton, Cave Castle and York;
// Beverley's are TBC. All groups are placeholders — check the tee sheet.
import type { BitKind } from '../lib/state';

export interface Hole { n: number; par: number; si: number; yds: number | null }
export interface Group { tee: string; name?: string; players: string[] }
export interface Round {
  id: string; n: number; dow: string; dnum: number; mon: string;
  club: string; short: string; town: string; address: string;
  format: 'stableford' | 'scramble'; pairs: boolean;
  par: number; cr: number; slope: number; tees: string;
  holes: Hole[]; groups: Group[];
}
export interface Player { id: string; name: string; start: number }

function card(pars: number[], sis: number[], yds: number[]): Hole[] {
  return pars.map((par, i) => ({ n: i + 1, par, si: sis[i], yds: yds[i] ?? null }));
}

export const ROUNDS: Round[] = [
  { id: 'd1', n: 1, dow: 'Mon', dnum: 7,  mon: 'Sept', club: 'Elsham Golf Club',      short: 'Elsham',      town: 'Elsham, near Brigg',       format: 'stableford', pairs: true,  par: 71, cr: 71.2, slope: 132, tees: 'yellow',
    address: 'Barton Road, Elsham, Brigg, DN20 0LS',
    holes: card([4,4,4,5,5,3,4,4,3, 5,4,3,4,3,4,4,4,4], [14,6,4,8,12,16,18,2,10, 15,7,11,1,17,5,9,3,13], [311,340,354,506,462,149,297,439,164, 503,362,168,420,163,389,391,411,331]),
    groups: [{ tee: '12:28', players: ['p1','p2','p3','p4'] }, { tee: '12:36', players: ['p5','p6','p7','p8'] }] },
  { id: 'd2', n: 2, dow: 'Tue', dnum: 8,  mon: 'Sept', club: 'Ganton Golf Club',      short: 'Ganton',      town: 'Ganton, near Scarborough', format: 'stableford', pairs: false, par: 71, cr: 72.2, slope: 133, tees: 'yellow',
    address: 'Ganton, Scarborough, YO12 4PA',
    holes: card([4,4,4,4,3,4,4,4,5, 3,4,4,5,4,4,4,3,4], [11,5,15,3,17,1,7,13,9, 18,4,12,6,16,2,8,14,10], [360,398,290,369,150,442,423,372,476, 165,402,357,499,280,429,429,208,391]),
    groups: [{ tee: '14:00', players: ['p1','p5','p2','p6'] }, { tee: '14:07', players: ['p3','p7','p4','p8'] }] },
  { id: 'd3', n: 3, dow: 'Wed', dnum: 9,  mon: 'Sept', club: 'Cave Castle Golf Club', short: 'Cave Castle', town: 'South Cave, East Riding',   format: 'scramble',   pairs: false, par: 72, cr: 69.6, slope: 122, tees: 'yellow',
    address: 'Church Hill, South Cave, HU15 2EU',
    holes: card([4,5,5,4,3,4,4,4,4, 4,4,4,5,3,4,4,3,4], [18,16,10,4,12,2,6,14,8, 1,3,7,9,15,13,11,17,5], [274,459,459,357,187,396,341,367,386, 453,453,383,513,137,326,315,136,327]),
    groups: [
      { tee: '12:36', name: 'Team A', players: ['p1','p3'] }, { tee: '12:36', name: 'Team B', players: ['p5','p7'] },
      { tee: '12:44', name: 'Team C', players: ['p2','p4'] }, { tee: '12:44', name: 'Team D', players: ['p6','p8'] },
    ] },
  { id: 'd4', n: 4, dow: 'Thu', dnum: 10, mon: 'Sept', club: 'Beverley & East Riding Golf Club', short: 'Beverley', town: 'Beverley, East Riding',  format: 'stableford', pairs: false, par: 69, cr: 68.1, slope: 120, tees: 'yellow',
    address: 'Anti Mill, The Westwood, Beverley, HU17 8RG',
    holes: card([4,4,5,3,4,3,4,3,4, 4,4,4,4,4,5,3,4,3], [11,3,13,7,9,17,1,15,5, 14,16,10,8,2,12,6,4,18], [333,435,558,183,319,178,402,171,362, 320,315,316,301,337,477,186,324,136]),
    groups: [{ tee: 'TBC', players: ['p1','p6','p4','p7'] }, { tee: 'TBC', players: ['p2','p5','p3','p8'] }] },
  { id: 'd5', n: 5, dow: 'Fri', dnum: 11, mon: 'Sept', club: 'York Golf Club',        short: 'York',        town: 'Strensall, York',          format: 'stableford', pairs: false, par: 70, cr: 69.6, slope: 123, tees: 'yellow',
    address: 'Lords Moor Lane, Strensall, York, YO32 5XF',
    holes: card([4,3,5,4,4,4,3,4,4, 4,3,4,4,4,5,4,3,4], [7,17,9,11,1,5,13,3,15, 4,18,12,2,16,6,10,14,8], [431,140,500,345,392,414,145,450,336, 394,115,352,367,370,503,379,176,373]),
    groups: [{ tee: '11:03', players: ['p1','p2','p3','p4'] }, { tee: '11:12', players: ['p5','p6','p7','p8'] }] },
];

export const PLAYERS: Player[] = [
  { id: 'p1', name: 'Tim Hoare',         start: 14.0 },
  { id: 'p2', name: 'Matthew Braybrook', start: 18.3 },
  { id: 'p3', name: 'Adam Gooch',        start: 16.7 },
  { id: 'p4', name: 'Joshua Watts',      start: 17.2 },
  { id: 'p5', name: 'Liam Kevern',       start: 9.1 },
  { id: 'p6', name: 'Rob Ellis',         start: 3.8 },
  { id: 'p7', name: 'Harry Gooch',       start: 23.9 },
  { id: 'p8', name: 'Liam Cameron',      start: 9.1 },
];

export const RULES = {
  placePoints: [10, 8, 6, 4, 3, 2, 1, 0],  // individual stableford, 1st–8th
  pairPoints: [6, 4, 2, 0],                // hidden pairs, per player, 1st–4th
  scramblePoints: [6, 4, 2, 0],            // scramble teams, per player, 1st–4th
  bonusKeep: 5,                            // still holding your bonus ball at the end of the trip
  allowance: 100,
  par: 32,                     // stableford points pivot for index adjustment
  scrambleAllowance: [35, 15], // % of course handicaps, lowest first (2-man teams)
};

// Side-bet menagerie: labels for the four things logged hole by hole.
// Amounts (pence each) live in app settings and sync between phones.
export const BITS: Record<BitKind, { label: string; one: string; icon: string; desc: string }> = {
  cuckoo:    { label: 'Cuckoos',     one: 'cuckoo',     icon: '🐦', desc: 'Hit a tree' },
  camel:     { label: 'Camels',      one: 'camel',      icon: '🐫', desc: 'In a bunker' },
  fish:      { label: 'Fish',        one: 'fish',       icon: '🐟', desc: 'In the water' },
  threeputt: { label: 'Three-putts', one: 'three-putt', icon: '⛳', desc: '3 or more putts' },
  lostball:  { label: 'Lost balls',  one: 'lost ball',  icon: '🔍', desc: 'Lost a ball' },
};

// Trip organiser — the only player who can wipe the shared database.
export const ORGANISER = 'p1';

export const AVATAR_COLOURS = ['#22402F', '#5F4E8C', '#8A4A2F', '#3A5A6E', '#A8894B', '#4E6E4E', '#7A3A55', '#54604A'];

export const R = (rid: string) => ROUNDS.find((x) => x.id === rid);
export const playerIdx = (pid: string) => PLAYERS.findIndex((p) => p.id === pid);
export const PL = (pid: string) => PLAYERS[playerIdx(pid)];
export const pName = (pid: string) => PL(pid)?.name || '?';
export const first = (pid: string) => {
  const parts = pName(pid).split(/\s+/);
  const shared = PLAYERS.filter((p) => p.name.split(/\s+/)[0] === parts[0]).length > 1;
  return shared && parts[1] ? `${parts[0]} ${parts[1][0]}` : parts[0];
};
export const initials = (p: Player) => {
  const parts = p.name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};
export const colour = (i: number) => AVATAR_COLOURS[((i % AVATAR_COLOURS.length) + AVATAR_COLOURS.length) % AVATAR_COLOURS.length];
export const gname = (grp: Group, t: number) => grp.name || `Group ${t + 1}`;
