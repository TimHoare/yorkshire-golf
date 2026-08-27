/* Yorkshire Golf Week 2026 — single-file app, no build step.
   State lives in localStorage and, when config.js has Supabase keys, syncs live
   between every phone through the shared database (offline entries queue and
   send when signal returns). Without keys it falls back to single-phone mode. */
(() => {
'use strict';

const STORE_KEY = 'yorkshire-golf-2026';

// ---------- Fixed trip structure ----------
// Course data is the real thing: men's yellow tees, taken from each club's
// published scorecard (par / yards / SI verified to sum). Groups and tee times
// are still placeholders — check them against the tee sheet.
const ROUNDS = [
  { id: 'd1', n: 1, dow: 'Mon', dnum: 7,  mon: 'Sept', club: 'Brough Golf Club',      short: 'Brough',      town: 'Brough, East Riding',      format: 'stableford', pairs: true,  par: 68, cr: 68.8, slope: 123, tees: 'yellow',
    address: 'Cave Road, Brough, HU15 1HB',
    holes: card([4,4,3,4,4,3,4,4,3, 5,4,4,3,4,4,4,3,4], [11,17,13,3,7,15,1,5,9, 12,4,6,16,18,8,2,14,10], [352,248,192,416,374,141,449,431,178, 525,382,362,162,289,365,454,175,372]),
    groups: [{ tee: '10:00', players: ['p1','p2','p3','p4'] }, { tee: '10:10', players: ['p5','p6','p7','p8'] }] },
  { id: 'd2', n: 2, dow: 'Tue', dnum: 8,  mon: 'Sept', club: 'Ganton Golf Club',      short: 'Ganton',      town: 'Ganton, near Scarborough', format: 'stableford', pairs: false, par: 71, cr: 72.2, slope: 133, tees: 'yellow',
    address: 'Ganton, Scarborough, YO12 4PA',
    holes: card([4,4,4,4,3,4,4,4,5, 3,4,4,5,4,4,4,3,4], [11,5,15,3,17,1,7,13,9, 18,4,12,6,16,2,8,14,10], [360,398,290,369,150,442,423,372,476, 165,402,357,499,280,429,429,208,391]),
    groups: [{ tee: '11:20', players: ['p1','p5','p2','p6'] }, { tee: '11:30', players: ['p3','p7','p4','p8'] }] },
  { id: 'd3', n: 3, dow: 'Wed', dnum: 9,  mon: 'Sept', club: 'Cave Castle Golf Club', short: 'Cave Castle', town: 'South Cave, East Riding',   format: 'scramble',   pairs: false, par: 72, cr: 69.6, slope: 122, tees: 'yellow',
    address: 'Church Hill, South Cave, HU15 2EU',
    holes: card([4,5,5,4,3,4,4,4,4, 4,4,4,5,3,4,4,3,4], [18,16,10,4,12,2,6,14,8, 1,3,7,9,15,13,11,17,5], [274,459,459,357,187,396,341,367,386, 453,453,383,513,137,326,315,136,327]),
    groups: [{ tee: '12:00', name: 'Team A', players: ['p1','p3','p5','p7'] }, { tee: '12:10', name: 'Team B', players: ['p2','p4','p6','p8'] }] },
  { id: 'd4', n: 4, dow: 'Thu', dnum: 10, mon: 'Sept', club: 'Hessle Golf Club',      short: 'Hessle',      town: 'Cottingham, Hull',         format: 'stableford', pairs: true,  par: 72, cr: 71.9, slope: 129, tees: 'yellow',
    address: 'Westfield Road, Raywell, Cottingham, HU16 5ZA',
    holes: card([4,3,5,4,4,4,4,3,5, 4,3,4,4,5,4,3,4,5], [7,11,13,1,3,5,9,17,15, 10,14,12,6,18,2,8,4,16], [355,187,503,394,423,377,339,130,477, 340,154,361,365,470,396,195,385,489]),
    groups: [{ tee: '10:40', players: ['p1','p6','p4','p7'] }, { tee: '10:50', players: ['p2','p5','p3','p8'] }] },
  { id: 'd5', n: 5, dow: 'Fri', dnum: 11, mon: 'Sept', club: 'York Golf Club',        short: 'York',        town: 'Strensall, York',          format: 'stableford', pairs: false, par: 70, cr: 69.6, slope: 123, tees: 'yellow',
    address: 'Lords Moor Lane, Strensall, York, YO32 5XF',
    holes: card([4,3,5,4,4,4,3,4,4, 4,3,4,4,4,5,4,3,4], [7,17,9,11,1,5,13,3,15, 4,18,12,2,16,6,10,14,8], [431,140,500,345,392,414,145,450,336, 394,115,352,367,370,503,379,176,373]),
    groups: [{ tee: '09:30', players: ['p1','p2','p3','p4'] }, { tee: '09:40', players: ['p5','p6','p7','p8'] }] },
];
function card(pars, sis, yds) { return pars.map((par, i) => ({ n: i + 1, par, si: sis[i], yds: yds ? yds[i] : null })); }

// Players and starting handicap indexes.
const PLAYERS = [
  { id: 'p1', name: 'Tim Hoare',         start: 14.0 },
  { id: 'p2', name: 'Matthew Braybrook', start: 18.3 },
  { id: 'p3', name: 'Adam Gooch',        start: 16.7 },
  { id: 'p4', name: 'Joshua Watts',      start: 17.2 },
  { id: 'p5', name: 'Liam Kevern',       start: 9.1 },
  { id: 'p6', name: 'Rob Ellis',         start: 3.8 },
  { id: 'p7', name: 'Harry Gooch',       start: 23.9 },
  { id: 'p8', name: 'Liam Cameron',      start: 9.1 },
];

// Rules
const RULES = { placePoints: [8, 6, 4, 2], allowance: 100, scrambleWin: 4, scrambleLose: 0, par: 32, scrambleAllowance: [25, 20, 15, 10] };

const AVATAR_COLOURS = ['#22402F', '#5F4E8C', '#8A4A2F', '#3A5A6E', '#A8894B', '#4E6E4E', '#7A3A55', '#54604A'];

// ---------- State ----------
// scores[rid][pid] = 18 gross strokes (null = not entered); scramble[rid][teamIdx] = 18 team gross strokes.
function defaultState() { return { v: 3, scores: {}, pairs: {}, scramble: {} }; }
function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? migrate(JSON.parse(raw)) : defaultState(); }
  catch { return defaultState(); }
}
function migrate(s) {
  const d = defaultState();
  if (!s || s.v !== 3) return { ...d, pairs: (s && s.pairs) || {} }; // older totals-only data can't become hole-by-hole
  return { v: 3, scores: s.scores || d.scores, pairs: s.pairs || d.pairs, scramble: s.scramble || d.scramble };
}
let S = loadState();
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }

// Who this phone belongs to: a player id, 'watcher', or null (not chosen yet).
const ME_KEY = STORE_KEY + '-me';
let me = localStorage.getItem(ME_KEY) || null;
if (me && me !== 'watcher' && !PLAYERS.some((p) => p.id === me)) me = null;

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt1(Math.abs(n));
const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
const R = (rid) => ROUNDS.find((x) => x.id === rid);
const playerIdx = (pid) => PLAYERS.findIndex((p) => p.id === pid);
const PL = (pid) => PLAYERS[playerIdx(pid)];
const pName = (pid) => PL(pid)?.name || '?';
const first = (pid) => { const f = pName(pid).split(/\s+/)[0]; return PLAYERS.filter((p) => p.name.split(/\s+/)[0] === f).length > 1 ? pName(pid) : f; };
const initials = (p) => { const parts = p.name.trim().split(/\s+/); return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase(); };
const colour = (i) => AVATAR_COLOURS[i % AVATAR_COLOURS.length];
const blank18 = () => Array(18).fill(null);
const holesOf = (rid, pid) => S.scores[rid]?.[pid] || blank18();
const teamHoles = (rid, t) => S.scramble[rid]?.[t] || blank18();
const trim = (n) => Number.isInteger(n) ? String(n) : n.toFixed(1);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- Sync (Supabase) ----------
// Scores write to localStorage first (instant, works with no signal), then queue
// in an outbox that upserts to Supabase. Realtime subscription applies everyone
// else's changes as they land. Server rows win on first load; local-only scores
// get pushed up. With no keys in config.js all of this is skipped.
const CFG = window.YG_CONFIG || {};
const hasSync = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
let sb = null;
let syncStatus = hasSync ? 'connecting' : 'local'; // connecting | live | offline | local
const OUTBOX_KEY = STORE_KEY + '-outbox';
let outbox = [];
try { outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { outbox = []; }
function saveOutbox() { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); }
function setSyncStatus(st) { syncStatus = st; renderSyncPill(); }
function renderSyncPill() {
  const el = $('#sync-pill'); if (!el) return;
  el.hidden = !hasSync;
  el.dataset.state = syncStatus;
  el.querySelector('b').textContent =
    syncStatus === 'live' ? 'Live' :
    syncStatus === 'connecting' ? 'Connecting' :
    outbox.length ? `Offline · ${outbox.length} to send` : 'Offline';
}

// One op per (table, key): later writes to the same hole replace the queued one.
function pushOp(t, k, v) {
  if (!hasSync) return;
  const key = t + '|' + k.join('|');
  outbox = outbox.filter((o) => o.key !== key);
  outbox.push({ t, k, v, key });
  saveOutbox(); renderSyncPill();
  flushOutbox();
}
let flushing = false, retryT = null;
async function flushOutbox() {
  if (!sb || flushing) return;
  flushing = true;
  try {
    while (outbox.length) {
      const op = outbox[0];
      const now = new Date().toISOString();
      let q;
      if (op.t === 'hole') q = sb.from('hole_scores').upsert({ round_id: op.k[0], player_id: op.k[1], hole: op.k[2], gross: op.v, updated_at: now });
      else if (op.t === 'team') q = sb.from('team_scores').upsert({ round_id: op.k[0], team: op.k[1], hole: op.k[2], gross: op.v, updated_at: now });
      else if (op.v === null) q = sb.from('pair_draws').delete().eq('round_id', op.k[0]);
      else q = sb.from('pair_draws').upsert({ round_id: op.k[0], pairs: op.v.pairs, revealed: op.v.revealed, updated_at: now });
      const { error } = await q;
      if (error) throw error;
      outbox.shift(); saveOutbox();
    }
    if (syncStatus !== 'connecting') setSyncStatus('live'); else renderSyncPill();
  } catch {
    setSyncStatus('offline');
    clearTimeout(retryT); retryT = setTimeout(flushOutbox, 5000);
  }
  flushing = false;
}

// Apply a value into local state without touching the outbox.
function applyHole(rid, pid, hole, gross) {
  if (!R(rid) || !PL(pid)) return;
  S.scores[rid] = S.scores[rid] || {};
  const arr = S.scores[rid][pid] || blank18(); arr[hole - 1] = gross; S.scores[rid][pid] = arr;
}
function applyTeamHole(rid, t, hole, gross) {
  if (!R(rid)) return;
  S.scramble[rid] = S.scramble[rid] || {};
  const arr = S.scramble[rid][t] || blank18(); arr[hole - 1] = gross; S.scramble[rid][t] = arr;
}

// Re-render on incoming changes, but never yank a field out from under a typer.
function syncRender() {
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT') { syncRender.pending = true; return; }
  render();
}
document.body.addEventListener('focusout', () => {
  if (syncRender.pending) { syncRender.pending = false; setTimeout(render, 50); }
});

function onRowChange(table, type, row) {
  if (table === 'hole_scores') applyHole(row.round_id, row.player_id, row.hole, type === 'DELETE' ? null : row.gross);
  else if (table === 'team_scores') applyTeamHole(row.round_id, Number(row.team), row.hole, type === 'DELETE' ? null : row.gross);
  else if (table === 'pair_draws') {
    if (type === 'DELETE') delete S.pairs[row.round_id];
    else S.pairs[row.round_id] = { pairs: row.pairs, revealed: row.revealed };
  }
  save(); syncRender();
}

async function hydrateFromServer() {
  const [hs, ts, pd] = await Promise.all([
    sb.from('hole_scores').select('*'),
    sb.from('team_scores').select('*'),
    sb.from('pair_draws').select('*'),
  ]);
  if (hs.error || ts.error || pd.error) throw (hs.error || ts.error || pd.error);
  const seen = new Set();
  for (const r of hs.data) { seen.add(`hole|${r.round_id}|${r.player_id}|${r.hole}`); applyHole(r.round_id, r.player_id, r.hole, r.gross); }
  for (const r of ts.data) { seen.add(`team|${r.round_id}|${r.team}|${r.hole}`); applyTeamHole(r.round_id, Number(r.team), r.hole, r.gross); }
  for (const r of pd.data) { seen.add(`pair|${r.round_id}`); S.pairs[r.round_id] = { pairs: r.pairs, revealed: r.revealed }; }
  // Push anything this phone has that the server doesn't (first phone to connect seeds it).
  for (const [rid, byP] of Object.entries(S.scores)) for (const [pid, arr] of Object.entries(byP))
    arr.forEach((g, i) => { if (g !== null && !seen.has(`hole|${rid}|${pid}|${i + 1}`)) pushOp('hole', [rid, pid, i + 1], g); });
  for (const [rid, byT] of Object.entries(S.scramble)) for (const [t, arr] of Object.entries(byT))
    arr.forEach((g, i) => { if (g !== null && !seen.has(`team|${rid}|${t}|${i + 1}`)) pushOp('team', [rid, Number(t), i + 1], g); });
  for (const [rid, pr] of Object.entries(S.pairs))
    if (!seen.has(`pair|${rid}`)) pushOp('pair', [rid], pr);
  save(); render();
}

function initSync() {
  if (!hasSync) { renderSyncPill(); return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  renderSyncPill();
  const hydrate = () => hydrateFromServer()
    .then(() => { setSyncStatus('live'); flushOutbox(); })
    .catch(() => { setSyncStatus('offline'); setTimeout(hydrate, 5000); });
  hydrate();
  sb.channel('yg-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, (p) => onRowChange('hole_scores', p.eventType, p.new?.round_id ? p.new : p.old))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_scores' }, (p) => onRowChange('team_scores', p.eventType, p.new?.round_id ? p.new : p.old))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pair_draws' }, (p) => onRowChange('pair_draws', p.eventType, p.new?.round_id ? p.new : p.old))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') { setSyncStatus('live'); flushOutbox(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('offline');
    });
  window.addEventListener('online', flushOutbox);
}

// ---------- Handicap maths ----------
function courseHandicap(index, rid) { const c = R(rid); return Math.round(index * (c.slope / 113) + (c.cr - c.par)); }
function playingHandicap(index, rid) { return Math.round(courseHandicap(index, rid) * (RULES.allowance / 100)); }
// Shots received on a hole of stroke index si for playing handicap ph.
function shotsOn(ph, si) {
  if (ph >= 0) return Math.floor(ph / 18) + (si <= ph % 18 ? 1 : 0);
  const give = -ph; return -(Math.floor(give / 18) + (si > 18 - (give % 18) ? 1 : 0));
}
const holePoints = (gross, par, shots) => gross === null ? null : Math.max(0, 2 + par + shots - gross);
// Per-hole breakdown for a set of 18 gross scores.
function tally(rid, gross, ph) {
  const r = R(rid);
  const rows = r.holes.map((h, i) => { const shots = shotsOn(ph, h.si); const g = gross[i]; return { ...h, shots, gross: g, pts: holePoints(g, h.par, shots) }; });
  const played = rows.filter((x) => x.gross !== null).length;
  const pts = rows.reduce((a, x) => a + (x.pts ?? 0), 0);
  const strokes = rows.reduce((a, x) => a + (x.gross ?? 0), 0);
  return { rows, played, pts, strokes, complete: played === 18 };
}
// Index entering each round: −0.5 per point over 32 for every completed stableford round before it.
function indexHistory(pid) {
  const p = PL(pid); const out = []; let idx = p.start;
  for (const r of ROUNDS) {
    const before = idx; let after = idx, applied = false;
    if (r.format === 'stableford') {
      const t = tally(r.id, holesOf(r.id, pid), playingHandicap(idx, r.id));
      if (t.complete) { after = idx - 0.5 * (t.pts - RULES.par); applied = true; }
    }
    out.push({ round: r, before, after, applied });
    idx = after;
  }
  return out;
}
const currentIndex = (pid) => { const h = indexHistory(pid); return h[h.length - 1].after; };
const indexBefore = (pid, rid) => indexHistory(pid).find((h) => h.round.id === rid).before;
const phFor = (pid, rid) => playingHandicap(indexBefore(pid, rid), rid);
const playerTally = (rid, pid) => tally(rid, holesOf(rid, pid), phFor(pid, rid));
// Scramble team playing handicap: 25/20/15/10 % of the members' course handicaps, lowest first.
function teamHandicap(rid, t) {
  const g = R(rid).groups[t];
  const chs = g.players.map((pid) => courseHandicap(indexBefore(pid, rid), rid)).sort((a, b) => a - b);
  return Math.round(chs.reduce((a, ch, i) => a + ch * (RULES.scrambleAllowance[i] ?? 0) / 100, 0));
}
const teamTally = (rid, t) => tally(rid, teamHoles(rid, t), teamHandicap(rid, t));

// ---------- Results ----------
function stablefordResults(rid) {
  const rows = PLAYERS.map((p) => ({ pid: p.id, ...playerTally(rid, p.id) })).filter((r) => r.played > 0);
  rows.sort((a, b) => b.pts - a.pts);
  const pp = RULES.placePoints; let i = 0;
  while (i < rows.length) {
    let j = i; while (j + 1 < rows.length && rows[j + 1].pts === rows[i].pts) j++;
    let sum = 0; for (let k = i; k <= j; k++) sum += pp[k] || 0;
    for (let k = i; k <= j; k++) { rows[k].place = i + 1; rows[k].points = sum / (j - i + 1); rows[k].tied = j > i; }
    i = j + 1;
  }
  return rows;
}
function scrambleResults(rid) {
  const r = R(rid); const out = {};
  const ts = r.groups.map((_, t) => teamTally(rid, t));
  const decided = ts.every((t) => t.complete);
  if (!decided) return { rows: out, decided, ts };
  const best = Math.max(...ts.map((t) => t.pts));
  const winners = ts.map((t, i) => t.pts === best ? i : -1).filter((i) => i >= 0);
  const tie = winners.length > 1;
  const { scrambleWin: W, scrambleLose: L } = RULES;
  r.groups.forEach((g, t) => g.players.forEach((pid) => { const won = winners.includes(t); out[pid] = { points: tie ? (W + L) / 2 : won ? W : L, won: won && !tie, tie }; }));
  return { rows: out, decided, ts, winner: tie ? null : winners[0] };
}
function roundPoints(rid, pid) {
  if (R(rid).format === 'scramble') return scrambleResults(rid).rows[pid]?.points ?? null;
  return stablefordResults(rid).find((x) => x.pid === pid)?.points ?? null;
}
const roundPlace = (rid, pid) => stablefordResults(rid).find((x) => x.pid === pid)?.place ?? null;
function standings() {
  const rows = PLAYERS.map((p, i) => {
    let pts = 0, stab = 0, played = 0;
    for (const r of ROUNDS) {
      const rp = roundPoints(r.id, p.id); if (rp !== null) { pts += rp; played++; }
      if (r.format === 'stableford') stab += playerTally(r.id, p.id).pts;
    }
    return { pid: p.id, i, pts, stab, played };
  });
  rows.sort((a, b) => b.pts - a.pts || b.stab - a.stab || a.i - b.i);
  let rank = 0;
  rows.forEach((r, k) => { if (k === 0 || r.pts !== rows[k - 1].pts || r.stab !== rows[k - 1].stab) rank = k + 1; r.rank = rank; });
  return rows;
}
function roundStatus(rid) {
  const r = R(rid);
  const ts = r.format === 'scramble' ? r.groups.map((_, t) => teamTally(rid, t)) : PLAYERS.map((p) => playerTally(rid, p.id));
  if (ts.every((t) => t.complete)) return 'done';
  return ts.some((t) => t.played > 0) ? 'partial' : 'none';
}
function pairTotals(rid) {
  const pr = S.pairs[rid]; if (!pr) return [];
  const rows = pr.pairs.map((pair) => {
    const ts = pair.map((pid) => playerTally(rid, pid));
    return { pair, total: ts.reduce((a, t) => a + t.pts, 0), complete: ts.every((t) => t.complete) };
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

// ---------- Rendering ----------
let tab = 'trip';
let openRound = null;          // rid when a round page is open
let scoringOpen = false;       // true when the score-entry page is open (within a round)
let selGroup = 0;              // group / team being scored
let selHole = 1;               // hole being scored

// ---------- Router ----------
// Every page has a URL: #/trip, #/players, #/standings, #/round/d2,
// #/round/d2/score/7. Refresh restores the page; browser back goes up a level.
function firstUnfinishedHole(rid) {
  const r = R(rid);
  const done = (n) => r.format === 'scramble' ? teamHoles(rid, selGroup)[n - 1] !== null : r.groups[selGroup].players.every((pid) => holesOf(rid, pid)[n - 1] !== null);
  for (let n = 1; n <= 18; n++) if (!done(n)) return n;
  return 18;
}
function parseRoute() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  tab = 'trip'; openRound = null; scoringOpen = false;
  if (p[0] === 'players' || p[0] === 'standings') { tab = p[0]; return; }
  if (p[0] === 'round' && R(p[1])) {
    openRound = p[1];
    selGroup = Math.max(0, R(p[1]).groups.findIndex((g) => g.players.includes(me)));
    if (p[2] === 'score') {
      scoringOpen = true;
      const n = Number(p[3]);
      selHole = n >= 1 && n <= 18 ? n : firstUnfinishedHole(p[1]);
    }
  }
}
function nav(hash) {
  if (location.hash !== hash) history.pushState(null, '', hash);
  parseRoute(); render(); window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', () => {
  if (/^#s=/.test(location.hash)) { checkHashImport(); }
  parseRoute(); render(); window.scrollTo({ top: 0 });
});
// Swiping / tapping between holes rewrites the hole in the URL without
// stacking a history entry per hole.
function replaceHoleInUrl() {
  if (scoringOpen && openRound) history.replaceState(null, '', `#/round/${openRound}/score/${selHole}`);
}

function formatChips(r) {
  if (r.format === 'scramble') return `<span class="chip gorse">2-team scramble</span>`;
  return `<span class="chip">Stableford</span>${r.pairs ? `<span class="chip heather">Hidden pairs</span>` : ''}`;
}
function avatar(p, badge, size) {
  const i = playerIdx(p.id);
  return `<span class="avatar${size ? ' ' + size : ''}" style="background:${colour(i)}">${esc(initials(p))}${badge ?? ''}</span>`;
}
// --- Trip ---
function renderTrip() {
  const pp = RULES.placePoints;
  return `
    <div class="section-title"><h2>Rounds</h2><span class="eyebrow">tap a round for details</span></div>
    <div class="itin">${ROUNDS.map((r) => `<button class="itin-day" data-open="${r.id}">
        <div class="itin-date"><span class="n">${r.dnum}</span><span class="m">${r.dow}</span><span class="st ${roundStatus(r.id)}"></span></div>
        <div class="itin-body">
          <h3>${esc(r.club)}</h3>
          <div class="itin-meta"><span class="chip">Par ${r.par}</span>${formatChips(r)}</div>
          <div class="itin-groups">${r.groups.map((g, t) => `<div class="itin-group"><b>${esc(g.tee)}</b><span>${g.name ? `<i>${esc(g.name)}</i> · ` : ''}${g.players.map(first).map(esc).join(', ')}</span></div>`).join('')}</div>
        </div>
        <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>`).join('')}</div>
    <p class="small muted rules-note">Week points ${pp.join(' · ')} for 1st–4th each round (ties share); scramble winners ${RULES.scrambleWin} each. Handicap index moves ±0.5 per stableford point either side of ${RULES.par} after every completed round.</p>`;
}

const gname = (grp, t) => grp.name || `Group ${t + 1}`;
const backBtn = (label) => `<button class="back" data-back><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>${label}</button>`;
function roundHead(r) {
  const status = roundStatus(r.id);
  return `<div class="round-head">
      <span class="eyebrow">Round ${r.n} · ${r.dow} ${r.dnum} ${r.mon} · ${esc(r.town)}</span>
      <h2>${esc(r.club)}</h2>
      <div class="itin-meta"><span class="chip">Par ${r.par}</span>${formatChips(r)}<span class="chip ghost">${status === 'done' ? 'Round complete' : status === 'partial' ? 'In progress' : 'Not started'}</span></div>
    </div>`;
}

// --- Round info page ---
function renderRound(rid) {
  const r = R(rid);
  const scramble = r.format === 'scramble';
  const yardsKnown = r.holes.every((h) => h.yds);
  const totalYds = yardsKnown ? r.holes.reduce((a, h) => a + h.yds, 0) : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.club + ', ' + (r.address || r.town))}`;

  // My course handicap, big and obvious
  const mine = me && me !== 'watcher' && r.groups.some((g) => g.players.includes(me))
    ? `<div class="my-ch"><div><span class="eyebrow">Your course handicap here</span><div class="v">${courseHandicap(indexBefore(me, rid), rid)}</div></div><div class="my-ch-sub">off a ${fmt1(indexBefore(me, rid))} index${scramble ? '' : ` · playing hcp ${phFor(me, rid)}`}</div></div>`
    : '';

  const facts = `<div class="course-facts card">
      <div class="cf"><span class="l">Par</span><b>${r.par}</b></div>
      ${totalYds ? `<div class="cf"><span class="l">${esc(r.tees || 'Yellow')} tees</span><b>${totalYds.toLocaleString()} yds</b></div>` : ''}
      <div class="cf"><span class="l">Rating</span><b>${r.cr}</b></div>
      <div class="cf"><span class="l">Slope</span><b>${r.slope}</b></div>
      <a class="cf maplink" href="${mapsUrl}" target="_blank" rel="noopener"><span class="l">Getting there</span><b>Map ↗</b></a>
    </div>`;

  const groups = `<div class="section-title"><h2>${scramble ? 'Teams' : 'Groups'}</h2><span class="eyebrow">tee times · course hcp</span></div>
    <div class="groups">${r.groups.map((grp, t) => `<div class="group-card">
      <div class="tee">${esc(grp.tee)}</div>
      <div class="gbody"><div class="gname">${esc(gname(grp, t))}${scramble ? ` <span class="chip gorse">team hcp ${teamHandicap(rid, t)}</span>` : ''}</div>
        <div class="gmembers">${grp.players.map((pid) => `<span class="gm ${pid === me ? 'me' : ''}">${avatar(PL(pid), '', 'sm')}<span><b>${esc(first(pid))}</b> <small>${courseHandicap(indexBefore(pid, rid), rid)}</small></span></span>`).join('')}</div>
      </div></div>`).join('')}</div>`;

  // Course scorecard: par, yards, SI
  const nine = (label, from, to) => `<tr class="sum"><td>${label}</td><td>${r.holes.slice(from, to).reduce((a, x) => a + x.par, 0)}</td><td>${yardsKnown ? r.holes.slice(from, to).reduce((a, x) => a + x.yds, 0).toLocaleString() : ''}</td><td></td></tr>`;
  const courseCard = `<div class="section-title"><h2>Course</h2><span class="eyebrow">${yardsKnown ? esc(r.tees || 'yellow') + ' tees' : 'par · stroke index'}</span></div>
    <div class="sc-wrap"><table class="sc course-sc">
      <thead><tr><th>Hole</th><th>Par</th><th>${yardsKnown ? 'Yards' : ''}</th><th>SI</th></tr></thead>
      <tbody>${r.holes.map((h, i) => `<tr><td>${h.n}</td><td>${h.par}</td><td>${h.yds ? h.yds : ''}</td><td>${h.si}</td></tr>${i === 8 ? nine('Out', 0, 9) : ''}`).join('')}
      ${nine('In', 9, 18)}${nine('Total', 0, 18)}</tbody>
    </table></div>`;

  let extra = '';
  if (r.pairs) extra += renderPairsBox(r);
  if (scramble) extra += renderScrambleResult(r);

  return `
    ${backBtn('Trip')}
    ${roundHead(r)}
    <div class="btn-row" style="margin:14px 0 4px"><button class="btn primary block" data-action="open-scoring">Enter scores</button></div>
    ${mine}
    ${facts}
    ${groups}${courseCard}${extra}`;
}

// --- Score entry page (swipe between holes, England Golf style) ---
function relPar(diff) {
  if (diff <= -3) return ['albatross', 'under'];
  if (diff === -2) return ['eagle', 'under'];
  if (diff === -1) return ['birdie', 'under'];
  if (diff === 0) return ['par', 'level'];
  if (diff === 1) return ['bogey', 'over'];
  return ['+' + diff, 'over'];
}
function renderScoring(rid) {
  const r = R(rid);
  const scramble = r.format === 'scramble';
  const g = r.groups[selGroup] || r.groups[0];

  const holeChips = r.holes.map((hh) => {
    const filled = scramble ? teamHoles(rid, selGroup)[hh.n - 1] !== null : g.players.every((pid) => holesOf(rid, pid)[hh.n - 1] !== null);
    const some = scramble ? filled : g.players.some((pid) => holesOf(rid, pid)[hh.n - 1] !== null);
    return `<button class="hole-chip ${hh.n === selHole ? 'on' : ''} ${filled ? 'done' : some ? 'part' : ''}" data-hole="${hh.n}">${hh.n}</button>`;
  }).join('');

  const slide = (h) => {
    const i = h.n - 1;
    const rows = scramble
      ? (() => { const t = teamTally(rid, selGroup); const row = t.rows[i]; const gross = row.gross;
          const rel = gross === null ? null : relPar(gross - h.par);
          return `<div class="score-row">
            <div class="who"><div class="team-dot t${selGroup}">${selGroup === 0 ? 'A' : 'B'}</div><div style="min-width:0"><div class="n">${esc(gname(g, selGroup))}</div><div class="h">${rel ? `<b class="rel ${rel[1]}">${rel[0]}</b> · ` : ''}${row.shots ? `<b>${row.shots} shot${row.shots > 1 ? 's' : ''}</b> · ` : ''}${t.pts} pts thru ${t.played}</div></div></div>
            ${stepper('team', selGroup, gross, h.par, i)}
            <div class="hp ${gross === null ? 'off' : ''}">${gross === null ? '–' : row.pts}<small>pts</small></div>
          </div>`; })()
      : g.players.map((pid) => { const t = playerTally(rid, pid); const row = t.rows[i]; const gross = row.gross;
          const rel = gross === null ? null : relPar(gross - h.par);
          return `<div class="score-row">
            <div class="who">${avatar(PL(pid))}<div style="min-width:0"><div class="n">${esc(first(pid))}</div><div class="h">${rel ? `<b class="rel ${rel[1]}">${rel[0]}</b> · ` : ''}${row.shots ? `<b>${row.shots} shot${row.shots > 1 ? 's' : ''}</b> · ` : 'no shot · '}${t.pts} pts thru ${t.played}</div></div></div>
            ${stepper('player', pid, gross, h.par, i)}
            <div class="hp ${gross === null ? 'off' : ''}">${gross === null ? '–' : row.pts}<small>pts</small></div>
          </div>`; }).join('');
    return `<section class="slide" data-slide="${h.n}">
      <div class="hole-head"><div><span class="eyebrow">Hole</span><div class="hn">${h.n}</div></div>
        <div class="hf"><span>Par <b>${h.par}</b></span>${h.yds ? `<span><b>${h.yds}</b> yds</span>` : ''}<span>SI <b>${h.si}</b></span></div>
        <div class="hnav"><button class="btn ghost sm" data-hole="${h.n - 1}" ${h.n === 1 ? 'disabled' : ''} aria-label="Previous hole">‹</button><button class="btn ghost sm" data-hole="${h.n + 1}" ${h.n === 18 ? 'disabled' : ''} aria-label="Next hole">›</button></div></div>
      <div class="score-list">${rows}</div>
    </section>`;
  };

  // Live scorecard for the selected group
  const cols = scramble ? r.groups.map((grp, t) => ({ label: gname(grp, t).replace('Team ', ''), tally: teamTally(rid, t) })) : g.players.map((pid) => ({ label: first(pid), tally: playerTally(rid, pid) }));
  const cell = (row) => row.gross === null ? '<td class="e">·</td>' : `<td class="${row.pts === 0 ? 'z' : row.pts >= 3 ? 'g' : ''}">${row.gross}<sup>${row.pts}</sup></td>`;
  const sumRow = (label, from, to) => `<tr class="sum"><td>${label}</td><td>${r.holes.slice(from, to).reduce((a, x) => a + x.par, 0)}</td><td></td>${cols.map((c) => { const rs = c.tally.rows.slice(from, to); const pl = rs.filter((x) => x.gross !== null); return `<td>${pl.length ? `${pl.reduce((a, x) => a + x.gross, 0)}<sup>${pl.reduce((a, x) => a + x.pts, 0)}</sup>` : '·'}</td>`; }).join('')}</tr>`;
  const scorecard = `<div class="section-title"><h2>Scorecard</h2><span class="eyebrow">${scramble ? 'team gross · points' : esc(gname(g, selGroup)) + ' · gross · points'}</span></div>
    <div class="sc-wrap"><table class="sc">
      <thead><tr><th>Hole</th><th>Par</th><th>SI</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>
      ${scramble ? '' : `<tr class="ph"><td colspan="3">playing hcp</td>${g.players.map((pid) => `<td>${phFor(pid, rid)}</td>`).join('')}</tr>`}</thead>
      <tbody>${r.holes.map((hh, i) => `<tr class="${hh.n === selHole ? 'cur' : ''}" data-hole="${hh.n}"><td>${hh.n}</td><td>${hh.par}</td><td>${hh.si}</td>${cols.map((c) => cell(c.tally.rows[i])).join('')}</tr>${i === 8 ? sumRow('Out', 0, 9) : ''}`).join('')}
      ${sumRow('In', 9, 18)}${sumRow('Total', 0, 18)}</tbody>
    </table></div>`;

  return `
    ${backBtn(esc(r.short))}
    <div class="score-page-head"><h2>Enter scores</h2>
      ${r.groups.length < 2 ? '' : `<div class="seg">${r.groups.map((grp, t) => `<button class="${t === selGroup ? 'on' : ''}" data-group="${t}">${esc(gname(grp, t))}</button>`).join('')}</div>`}
    </div>
    <div class="hole-chips">${holeChips}</div>
    <p class="swipe-hint small muted">Swipe between holes · − and + set the score against par</p>
    <div class="swipe" id="swipe">${r.holes.map(slide).join('')}</div>
    ${scorecard}`;
}
function stepper(kind, key, gross, defaultVal, holeIdx) {
  const attr = `${kind === 'team' ? `data-team="${key}"` : `data-player="${key}"`} data-h="${holeIdx}"`;
  return `<div class="stepper" aria-label="Strokes">
    <button data-step="-1" ${attr} aria-label="One stroke fewer">−</button>
    <input type="number" inputmode="numeric" min="1" max="20" placeholder="${defaultVal}" value="${gross ?? ''}" data-gross ${attr}>
    <button data-step="1" ${attr} aria-label="One stroke more">+</button>
  </div>`;
}

// --- Players ---
function renderPlayers() {
  const nextRound = ROUNDS.find((r) => roundStatus(r.id) !== 'done') || ROUNDS[ROUNDS.length - 1];
  return `
    <div class="section-title"><h2>Players</h2><span class="eyebrow">${PLAYERS.length} on tour</span></div>
    <div class="player-list">${PLAYERS.map((p) => {
      const cur = currentIndex(p.id), d = cur - p.start;
      const ch = courseHandicap(cur, nextRound.id);
      return `<div class="player-row">
        ${avatar(p)}
        <div style="min-width:0">
          <div class="pname">${esc(p.name)}${p.id === me ? ' <span class="chip you">you</span>' : ''}</div>
          <div class="sub">Started ${fmt1(p.start)} <span class="delta ${d < 0 ? 'down' : d > 0 ? 'up' : 'flat'}">${signed(d)}</span> · CH ${ch} at ${esc(nextRound.short)}</div>
        </div>
        <div class="index-now"><div class="v">${fmt1(cur)}</div><div class="l">index</div></div>
      </div>`;
    }).join('')}</div>`;
}

function renderPairsBox(r) {
  const pr = S.pairs[r.id];
  let inner;
  if (!pr) {
    inner = `<p class="small muted" style="margin-top:6px">Draw the pairs before tee-off. They stay sealed until you reveal them after the round.</p>
      <div class="btn-row"><button class="btn heather" data-action="draw-pairs">Draw hidden pairs</button></div>`;
  } else if (!pr.revealed) {
    inner = `<div class="pair-hidden"><span class="lock"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
        <span><b>${pr.pairs.length} pairs drawn and sealed.</b> Enter everyone's scores, then reveal.</span></div>
      <div class="btn-row"><button class="btn heather" data-action="reveal-pairs">Reveal pairs</button><button class="btn ghost sm" data-action="redraw-pairs">Redraw</button></div>`;
  } else {
    const rows = pairTotals(r.id);
    inner = `<div class="pair-list">${rows.map((row, k) => `<div class="pair-item">
        <div><span class="rank">${k + 1}</span><span class="names">${esc(pName(row.pair[0]))}<span>&amp;</span>${esc(pName(row.pair[1]))}</span></div>
        <span class="pts">${row.complete ? row.total : `<span class="muted">${row.total}…</span>`}</span></div>`).join('')}</div>
      <div class="btn-row"><button class="btn ghost sm" data-action="redraw-pairs">Redraw</button></div>`;
  }
  return `<div class="pairs-box"><h3>Hidden pairs</h3>${inner}</div>`;
}
function renderScrambleResult(r) {
  const res = scrambleResults(r.id);
  return `<div class="scramble-box"><h3>Result</h3>
    <div class="team-grid">${r.groups.map((grp, t) => { const tt = res.ts[t]; return `<div class="team ${res.decided && res.winner === t ? 'won' : ''}">
      <h4>${esc(grp.name || 'Team ' + (t + 1))} ${res.decided && res.winner === t ? '<span class="chip gorse">Winners</span>' : ''}</h4>
      <div class="big">${tt.pts}<small>pts thru ${tt.played}</small></div>
      <div class="members">${grp.players.map((pid) => `<div class="m">${esc(pName(pid))}</div>`).join('')}</div>
    </div>`; }).join('')}</div>
    <p class="small muted" style="margin-top:8px">Team handicap is ${RULES.scrambleAllowance.join('/')}% of the four course handicaps, lowest first. Winners take ${RULES.scrambleWin} week points each${res.decided && res.winner === null ? ' — tied, so shared' : ''}.</p>
  </div>`;
}

// --- Standings ---
function renderStandings() {
  const st = standings();
  const anyPts = st.some((r) => r.pts > 0);
  const doneCount = ROUNDS.filter((r) => roundStatus(r.id) === 'done').length;
  return `
    <div class="section-title"><h2>Standings</h2><span class="eyebrow">${doneCount} of 5 rounds in</span></div>
    ${!anyPts ? '<div class="empty">No results yet. Once a round\'s scores are in, week points appear here.</div>' : ''}
    <div class="lb">${st.map((r) => {
      const p = PL(r.pid); const cur = currentIndex(r.pid); const d = cur - p.start;
      const dots = ROUNDS.map((rd) => {
        if (rd.format === 'scramble') { const sr = scrambleResults(rd.id).rows[r.pid]; return `<i class="${sr ? (sr.won ? 'win' : '') : ''}" title="Round ${rd.n}">${sr ? (sr.won ? 'W' : sr.tie ? '=' : 'L') : ''}</i>`; }
        const pl = roundPlace(rd.id, r.pid); return `<i class="${pl ? 'p' + Math.min(pl, 4) : ''}" title="Round ${rd.n}">${pl ?? ''}</i>`;
      }).join('');
      return `<div class="lb-row">
        ${avatar(p, `<em class="${r.rank === 1 && anyPts ? 'lead' : ''}">${r.rank}</em>`)}
        <div style="min-width:0">
          <div class="nm">${esc(pName(r.pid))}${r.pid === me ? ' <span class="chip you">you</span>' : ''}</div>
          <div class="meta"><span class="dots">${dots}</span>
            <span class="idx-cell"><span class="v">index ${fmt1(cur)} <small class="${d < 0 ? 'delta down' : d > 0 ? 'delta up' : ''}">${d !== 0 ? signed(d) : ''}</small></span></span></div>
        </div>
        <div class="pts">${trim(r.pts)}<small>pts</small></div>
      </div>`;
    }).join('')}</div>

    <div class="section-title"><h2>Round by round</h2><span class="eyebrow">stableford (week pts)</span></div>
    <div class="card table-wrap"><table class="rounds-table">
      <thead><tr><th>Player</th>${ROUNDS.map((r) => `<th>${esc(r.short)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${st.map((row) => `<tr><td>${esc(pName(row.pid))}</td>${ROUNDS.map((rd) => {
        if (rd.format === 'scramble') { const sr = scrambleResults(rd.id).rows[row.pid]; return `<td>${sr ? `<span class="${sr.won ? 'win' : ''}">${sr.won ? 'W' : sr.tie ? '=' : 'L'}</span> <span class="pt">(${trim(sr.points)})</span>` : '·'}</td>`; }
        const t = playerTally(rd.id, row.pid); const rp = roundPoints(rd.id, row.pid);
        return `<td>${t.played === 0 ? '·' : `${t.pts}${t.complete ? '' : '*'} <span class="pt">(${trim(rp)})</span>`}</td>`;
      }).join('')}<td><b>${trim(row.pts)}</b></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="small muted" style="margin-top:6px">* round in progress</p>

    ${ROUNDS.filter((r) => r.pairs && S.pairs[r.id]?.revealed).map((r) => `
      <div class="section-title"><h2>Pairs · ${esc(r.short)}</h2><span class="eyebrow">combined points</span></div>
      <div class="pairs-box" style="margin-top:0"><div class="pair-list" style="margin-top:0">${pairTotals(r.id).map((row, k) => `<div class="pair-item"><div><span class="rank">${k + 1}</span><span class="names">${esc(pName(row.pair[0]))}<span>&amp;</span>${esc(pName(row.pair[1]))}</span></div><span class="pts">${row.total}</span></div>`).join('')}</div></div>`).join('')}`;
}

// --- Settings sheet ---
function renderSettings() {
  const whoami = me && me !== 'watcher'
    ? `You're scoring as <b>${esc(pName(me))}</b> on this phone.`
    : `You're <b>just watching</b> on this phone.`;
  const syncLine = hasSync
    ? (syncStatus === 'live' ? 'Scores sync live between every phone through the trip database.'
      : 'Offline right now — scores save here and send to the other phones when signal returns.')
    : 'Scores live on this phone only. Send the share link and whoever opens it gets an exact copy.';
  return `<h2 id="sheet-title">You &amp; sharing</h2>
    <p class="small muted">${whoami} <button class="linklike" data-action="switch-player">Switch</button></p>
    <p class="small muted">${syncLine}</p>
    <div class="btn-row"><button class="btn primary" data-action="share">Copy ${hasSync ? 'app' : 'share'} link</button><button class="btn secondary" data-action="export">Copy JSON</button></div>
    <div class="field"><span class="lbl">Paste JSON to restore</span><textarea id="import-box" placeholder="{ … }"></textarea><div class="btn-row"><button class="btn ghost sm" data-action="import">Restore from JSON</button></div></div>
    <div class="course-edit">
      <h3>Rules in play</h3>
      <p class="help">Week points ${RULES.placePoints.join(' · ')} for 1st–4th (ties share) · index ±0.5 per point from ${RULES.par} · scramble winners ${RULES.scrambleWin} pts each · ${RULES.allowance}% allowance. Change these in the code.</p>
    </div>
    <div class="course-edit">
      <div class="btn-row"><button class="btn danger sm" data-action="reset">Clear all scores</button><button class="btn ghost sm" data-action="close-sheet" style="margin-left:auto">Done</button></div>
    </div>`;
}

function render() {
  const view = $('#view');
  const wc = $('#wm-count'); if (wc) wc.textContent = PLAYERS.length;
  view.innerHTML = tab === 'trip' ? (openRound ? (scoringOpen ? renderScoring(openRound) : renderRound(openRound)) : renderTrip()) : tab === 'players' ? renderPlayers() : renderStandings();
  document.querySelectorAll('.tab').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const chip = $('.hole-chip.on'); if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
  const sw = $('#swipe'); if (sw) sw.scrollLeft = (selHole - 1) * sw.clientWidth;
  const r = openRound && R(openRound);
  document.title = (tab === 'players' ? 'Players' : tab === 'standings' ? 'Standings' : r ? (scoringOpen ? 'Scores · ' + r.short : r.short) : 'Trip') + ' · Yorkshire 2026';
}

// Swiping the hole carousel updates the selected hole once the scroll settles.
let swipeT = null;
document.addEventListener('scroll', (e) => {
  if (!e.target || e.target.id !== 'swipe') return;
  clearTimeout(swipeT);
  swipeT = setTimeout(() => {
    const el = e.target;
    const n = Math.round(el.scrollLeft / el.clientWidth) + 1;
    if (n >= 1 && n <= 18 && n !== selHole) { selHole = n; render(); replaceHoleInUrl(); }
  }, 120);
}, true);
function showWelcome() {
  if ($('#welcome')) return;
  const el = document.createElement('div');
  el.className = 'welcome'; el.id = 'welcome';
  el.innerHTML = `<div class="welcome-card">
    <span class="eyebrow">Yorkshire 2026 · Mon 7 – Fri 11 Sept</span>
    <h2>Who's this?</h2>
    <p class="small muted">Pick your name once — score entry opens on your group each day, and this phone remembers you.</p>
    <div class="welcome-list">${PLAYERS.map((p) => `<button data-me="${p.id}">${avatar(p, '', 'sm')}<span><b>${esc(p.name)}</b><small>index ${fmt1(p.start)}</small></span></button>`).join('')}</div>
    <div class="btn-row"><button class="btn ghost sm" data-me="watcher">I'm just watching</button></div>
  </div>`;
  document.body.appendChild(el);
}
function openSheet() { $('#sheet').innerHTML = renderSettings(); $('#sheet-backdrop').hidden = false; }
function closeSheet() { $('#sheet-backdrop').hidden = true; render(); }
const openRoundPage = (rid) => nav(`#/round/${rid}`);
const openScoring = () => nav(`#/round/${openRound}/score`); // route parse lands on first unfinished hole

// ---------- Share / import ----------
function encodeState() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeState(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return JSON.parse(decodeURIComponent(escape(atob(str)))); }
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('Copy this:', text); }
}
function checkHashImport() {
  const m = location.hash.match(/^#s=(.+)$/);
  if (!m) return;
  try {
    const incoming = migrate(decodeState(m[1]));
    const has = localStorage.getItem(STORE_KEY);
    if (!has || confirm('This link carries trip data. Replace what\'s on this phone with it?')) { S = incoming; save(); toast('Trip data loaded'); }
  } catch { toast('That share link didn\'t work'); }
  history.replaceState(null, '', location.pathname + location.search);
}

// ---------- Events ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function num(v) { const n = parseFloat(v); return Number.isNaN(n) ? null : n; }
function setGross(el, value) {
  const rid = openRound;
  const i = el.dataset.h !== undefined ? Number(el.dataset.h) : selHole - 1;
  const v = value === null ? null : Math.min(20, Math.max(1, Math.round(value)));
  if (el.dataset.team !== undefined) {
    const t = Number(el.dataset.team);
    S.scramble[rid] = S.scramble[rid] || {}; const arr = S.scramble[rid][t] || blank18(); arr[i] = v; S.scramble[rid][t] = arr;
    pushOp('team', [rid, t, i + 1], v);
  } else {
    const pid = el.dataset.player;
    S.scores[rid] = S.scores[rid] || {}; const arr = S.scores[rid][pid] || blank18(); arr[i] = v; S.scores[rid][pid] = arr;
    pushOp('hole', [rid, pid, i + 1], v);
  }
  save();
}
function grossOf(el) {
  const i = el.dataset.h !== undefined ? Number(el.dataset.h) : selHole - 1;
  return el.dataset.team !== undefined ? teamHoles(openRound, Number(el.dataset.team))[i] : holesOf(openRound, el.dataset.player)[i];
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  nav('#/' + b.dataset.tab);
});
$('#btn-settings').addEventListener('click', openSheet);
$('#sheet-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet-backdrop').hidden) closeSheet(); });

document.body.addEventListener('input', (e) => { const t = e.target; if (t.dataset.gross !== undefined) setGross(t, num(t.value)); });
document.body.addEventListener('change', (e) => { const t = e.target; if (t.dataset.gross !== undefined) { setGross(t, num(t.value)); render(); } });

document.body.addEventListener('click', async (e) => {
  const op = e.target.closest('[data-open]'); if (op) { openRoundPage(op.dataset.open); return; }
  if (e.target.closest('[data-back]')) { nav(scoringOpen ? `#/round/${openRound}` : '#/trip'); return; }
  const gb = e.target.closest('[data-group]'); if (gb) { selGroup = Number(gb.dataset.group); render(); return; }
  const hb = e.target.closest('[data-hole]'); if (hb && !hb.disabled) { const n = Number(hb.dataset.hole); if (n >= 1 && n <= 18) { selHole = n; render(); replaceHoleInUrl(); if (hb.tagName === 'TR') $('.hole-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
  const st = e.target.closest('[data-step]');
  if (st) {
    const cur = grossOf(st);
    const def = Number(st.parentElement.querySelector('input').placeholder) || R(openRound).holes[selHole - 1].par;
    const step = Number(st.dataset.step);
    // from empty: + records par, − records a birdie; then ±1 per tap
    let next = cur === null ? (step > 0 ? def : def - 1) : cur + step;
    if (next !== null && next < 1) next = null;
    setGross(st, next); render(); return;
  }
  const a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'open-scoring': openScoring(); break;
    case 'draw-pairs': { const ids = shuffle(PLAYERS.map((p) => p.id)); const pairs = []; for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]); S.pairs[openRound] = { pairs, revealed: false }; pushOp('pair', [openRound], S.pairs[openRound]); save(); render(); toast('Pairs drawn and sealed'); break; }
    case 'redraw-pairs': { if (confirm('Redraw the pairs for this round?')) { delete S.pairs[openRound]; pushOp('pair', [openRound], null); save(); render(); } break; }
    case 'reveal-pairs': { S.pairs[openRound].revealed = true; pushOp('pair', [openRound], S.pairs[openRound]); save(); render(); toast('Pairs revealed'); break; }
    case 'share': { const url = hasSync ? location.origin + location.pathname : location.origin + location.pathname + '#s=' + encodeState(); await copy(url, hasSync ? 'App link copied — anyone who opens it joins the live scores' : 'Share link copied'); break; }
    case 'export': { await copy(JSON.stringify(S, null, 2), 'JSON copied'); break; }
    case 'import': { try { S = migrate(JSON.parse($('#import-box').value)); save(); closeSheet(); toast('Restored'); } catch { toast('That JSON didn\'t parse'); } break; }
    case 'reset': {
      const msg = hasSync ? 'Clear every score, pair draw and scramble result for EVERYONE — this wipes the shared database, not just this phone. Sure?' : 'Clear every score, pair draw and scramble result on this phone?';
      if (!confirm(msg)) break;
      S = defaultState(); outbox = []; saveOutbox(); save();
      if (sb) {
        try {
          await Promise.all([
            sb.from('hole_scores').delete().neq('round_id', ''),
            sb.from('team_scores').delete().neq('round_id', ''),
            sb.from('pair_draws').delete().neq('round_id', ''),
          ]);
        } catch { toast('Cleared here, but the shared database didn\'t respond — try again with signal'); }
      }
      closeSheet(); toast('Reset'); break;
    }
    case 'switch-player': { localStorage.removeItem(ME_KEY); me = null; closeSheet(); showWelcome(); break; }
    case 'close-sheet': closeSheet(); break;
  }
});

document.body.addEventListener('click', (e) => {
  const mb = e.target.closest('[data-me]'); if (!mb) return;
  me = mb.dataset.me; localStorage.setItem(ME_KEY, me);
  $('#welcome')?.remove(); render();
  toast(me === 'watcher' ? 'Welcome — enjoy the golf' : `Welcome, ${first(me)}`);
});

// ---------- Boot ----------
checkHashImport();
parseRoute();
render();
renderSyncPill();
if (!me) showWelcome();
initSync();
})();
