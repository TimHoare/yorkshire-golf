// Where the back button goes. The router only knows the current location, so
// we keep our own trail of this session's pages: back returns to the page you
// were actually on (a standings row, a leaderboard row…) rather than a fixed
// parent, and the button says which. On a cold start or deep link there's
// nothing behind us, so each page falls back to its natural parent.
import type { Location, NavigationType } from 'react-router-dom';
import { PL, R, first } from '../data/trip';

const trail: { key: string; path: string }[] = [];

// Called on every render of the route shell, before the page renders. Keyed
// by the router's location key, so repeat renders are no-ops.
export function recordNav(loc: Location, type: NavigationType) {
  const top = trail[trail.length - 1];
  const entry = { key: loc.key, path: loc.pathname };
  // 'default' is the session's first location — reached fresh, or by going
  // all the way back — and either way nothing sits behind it. Checked before
  // the same-key short-circuit: a new session starts on that key too.
  if (loc.key === 'default') {
    if (top?.key === 'default' && top.path === loc.pathname) return;
    trail.length = 0; trail.push(entry); return;
  }
  if (top?.key === loc.key) return;
  if (type === 'REPLACE' && trail.length) trail[trail.length - 1] = entry;
  else if (type === 'POP') {
    const i = trail.findIndex((e) => e.key === loc.key);
    if (i >= 0) trail.length = i + 1; else trail.push(entry);
  } else trail.push(entry);
}

export const previousPath = (): string | null => (trail.length > 1 ? trail[trail.length - 2].path : null);

// Short name for a page, as the back button's label.
export function backLabel(path: string): string {
  const p = path.split('/').filter(Boolean);
  if (p[0] === 'trip') return 'Trip';
  if (p[0] === 'players') return 'Players';
  if (p[0] === 'standings') return 'Standings';
  if (p[0] === 'player' && PL(p[1])) return p[2] === 'round' && R(p[3]) ? `${first(p[1])} · ${R(p[3])!.short}` : first(p[1]);
  if (p[0] === 'round' && R(p[1])) return p[2] === 'score' ? `${R(p[1])!.short} scores` : R(p[1])!.short;
  return 'Back';
}
