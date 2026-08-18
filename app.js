/* Yorkshire Golf Week 2026 — single-file app, no build step.
   State lives in localStorage; a share link carries the whole state in the URL hash. */
(() => {
'use strict';

const STORE_KEY = 'yorkshire-golf-2026';

// ---------- Fixed trip structure ----------
const ROUNDS = [
  { id: 'd1', n: 1, dow: 'Mon', dnum: 7,  mon: 'Sept', club: 'Brough Golf Club',      short: 'Brough',      town: 'Brough, East Riding',  format: 'stableford', pairs: true  },
  { id: 'd2', n: 2, dow: 'Tue', dnum: 8,  mon: 'Sept', club: 'Ganton Golf Club',      short: 'Ganton',      town: 'Ganton, near Scarborough', format: 'stableford', pairs: false },
  { id: 'd3', n: 3, dow: 'Wed', dnum: 9,  mon: 'Sept', club: 'Cave Castle Golf Club', short: 'Cave Castle', town: 'South Cave, East Riding', format: 'scramble',   pairs: false },
  { id: 'd4', n: 4, dow: 'Thu', dnum: 10, mon: 'Sept', club: 'Hessle Golf Club',      short: 'Hessle',      town: 'Cottingham, Hull',   format: 'stableford', pairs: true  },
  { id: 'd5', n: 5, dow: 'Fri', dnum: 11, mon: 'Sept', club: 'York Golf Club',        short: 'York',        town: 'Strensall, York',    format: 'stableford', pairs: false },
];

// Course figures are placeholders — check against the scorecard on the day (editable in Settings).
const DEFAULT_COURSES = {
  d1: { par: 68, cr: 67.7, slope: 120, tee: 'White', teeTime: '', notes: '' },
  d2: { par: 71, cr: 73.2, slope: 135, tee: 'White', teeTime: '', notes: '' },
  d3: { par: 72, cr: 71.8, slope: 128, tee: 'White', teeTime: '', notes: '' },
  d4: { par: 72, cr: 71.6, slope: 129, tee: 'White', teeTime: '', notes: '' },
  d5: { par: 70, cr: 70.9, slope: 128, tee: 'White', teeTime: '', notes: '' },
};

const AVATAR_COLOURS = ['#1E5B3A', '#6B4C9A', '#B8452F', '#2C6E91', '#D99A1E', '#4E8B67', '#8C3B6E', '#3F5C7A'];

// ---------- State ----------
function defaultState() {
  return {
    v: 1,
    players: Array.from({ length: 8 }, (_, i) => ({ id: 'p' + (i + 1), name: '', start: 18 })),
    settings: { placePoints: [8, 6, 4, 2], allowance: 100, scrambleWin: 4, scrambleLose: 0, par: 32 },
    courses: JSON.parse(JSON.stringify(DEFAULT_COURSES)),
    scores: {},      // roundId -> { playerId: points }
    pairs: {},       // roundId -> { pairs: [[a,b],...], revealed: bool }
    scramble: {},    // roundId -> { teams: {playerId:'A'|'B'}, scoreA: n|null, scoreB: n|null }
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch { return defaultState(); }
}
function migrate(s) {
  const d = defaultState();
  s = Object.assign(d, s);
  s.settings = Object.assign(d.settings, s.settings || {});
  for (const r of ROUNDS) s.courses[r.id] = Object.assign({}, DEFAULT_COURSES[r.id], s.courses[r.id] || {});
  return s;
}
let S = loadState();
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt1(Math.abs(n));
const playerName = (p, i) => p.name.trim() || `Player ${i + 1}`;
const initials = (p, i) => {
  const n = p.name.trim();
  if (!n) return String(i + 1);
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};
const colour = (i) => AVATAR_COLOURS[i % AVATAR_COLOURS.length];
const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
const scoreOf = (rid, pid) => { const v = S.scores[rid]?.[pid]; return isNum(v) ? v : null; };
const playerIdx = (pid) => S.players.findIndex((p) => p.id === pid);
const P = (pid) => S.players[playerIdx(pid)];
const pName = (pid) => { const i = playerIdx(pid); return i < 0 ? '?' : playerName(S.players[i], i); };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- Handicap maths ----------
// Index entering round k = start − 0.5 × Σ (points − 32) over earlier stableford rounds with a score.
function indexHistory(pid) {
  const p = P(pid); const out = []; let idx = p.start;
  for (const r of ROUNDS) {
    const before = idx;
    let after = idx, applied = false;
    if (r.format === 'stableford') {
      const s = scoreOf(r.id, pid);
      if (s !== null) { after = idx - 0.5 * (s - S.settings.par); applied = true; }
    }
    out.push({ round: r, before, after, applied });
    idx = after;
  }
  return out;
}
const currentIndex = (pid) => { const h = indexHistory(pid); return h[h.length - 1].after; };
const indexBefore = (pid, rid) => indexHistory(pid).find((h) => h.round.id === rid).before;
function courseHandicap(index, rid) {
  const c = S.courses[rid];
  return Math.round(index * (c.slope / 113) + (c.cr - c.par));
}
function playingHandicap(index, rid) {
  return Math.round(courseHandicap(index, rid) * (S.settings.allowance / 100));
}

// ---------- Results ----------
// Stableford: rank by points; ties share the place points for the positions they occupy.
function stablefordResults(rid) {
  const rows = S.players.map((p) => ({ pid: p.id, score: scoreOf(rid, p.id) })).filter((r) => r.score !== null);
  rows.sort((a, b) => b.score - a.score);
  const pp = S.settings.placePoints;
  let i = 0;
  while (i < rows.length) {
    let j = i; while (j + 1 < rows.length && rows[j + 1].score === rows[i].score) j++;
    let sum = 0; for (let k = i; k <= j; k++) sum += pp[k] || 0;
    const share = sum / (j - i + 1);
    for (let k = i; k <= j; k++) { rows[k].place = i + 1; rows[k].points = share; rows[k].tied = j > i; }
    i = j + 1;
  }
  return rows;
}
function scrambleResults(rid) {
  const sc = S.scramble[rid] || { teams: {}, scoreA: null, scoreB: null };
  const out = {};
  if (!isNum(sc.scoreA) || !isNum(sc.scoreB)) return { rows: out, decided: false, sc };
  const { scrambleWin: W, scrambleLose: L } = S.settings;
  const tie = sc.scoreA === sc.scoreB;
  for (const p of S.players) {
    const t = sc.teams[p.id]; if (!t) continue;
    const won = (t === 'A' && sc.scoreA > sc.scoreB) || (t === 'B' && sc.scoreB > sc.scoreA);
    out[p.id] = { points: tie ? (W + L) / 2 : won ? W : L, won, tie };
  }
  return { rows: out, decided: true, sc, winner: tie ? null : sc.scoreA > sc.scoreB ? 'A' : 'B' };
}
function roundPoints(rid, pid) {
  const r = ROUNDS.find((x) => x.id === rid);
  if (r.format === 'scramble') return scrambleResults(rid).rows[pid]?.points ?? null;
  const row = stablefordResults(rid).find((x) => x.pid === pid);
  return row ? row.points : null;
}
function roundPlace(rid, pid) {
  const row = stablefordResults(rid).find((x) => x.pid === pid);
  return row ? row.place : null;
}
function standings() {
  const rows = S.players.map((p, i) => {
    let pts = 0, stab = 0, played = 0;
    for (const r of ROUNDS) {
      const rp = roundPoints(r.id, p.id); if (rp !== null) { pts += rp; played++; }
      const s = scoreOf(r.id, p.id); if (s !== null) stab += s;
    }
    return { pid: p.id, i, pts, stab, played };
  });
  rows.sort((a, b) => b.pts - a.pts || b.stab - a.stab || a.i - b.i);
  let rank = 0;
  rows.forEach((r, k) => { if (k === 0 || r.pts !== rows[k - 1].pts || r.stab !== rows[k - 1].stab) rank = k + 1; r.rank = rank; });
  return rows;
}
function roundStatus(rid) {
  const r = ROUNDS.find((x) => x.id === rid);
  if (r.format === 'scramble') {
    const sc = S.scramble[rid]; if (!sc) return 'none';
    const both = isNum(sc.scoreA) && isNum(sc.scoreB);
    return both ? 'done' : (Object.keys(sc.teams || {}).length || isNum(sc.scoreA) || isNum(sc.scoreB)) ? 'partial' : 'none';
  }
  const n = S.players.filter((p) => scoreOf(rid, p.id) !== null).length;
  return n === 0 ? 'none' : n === S.players.length ? 'done' : 'partial';
}
function pairTotals(rid) {
  const pr = S.pairs[rid]; if (!pr) return [];
  const rows = pr.pairs.map((pair) => {
    const scores = pair.map((pid) => scoreOf(rid, pid));
    const complete = scores.every((s) => s !== null);
    return { pair, total: scores.reduce((a, s) => a + (s ?? 0), 0), complete };
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

// ---------- Rendering ----------
let tab = 'trip';
let selectedRound = (() => {
  // default to today's round during the trip, else the first round without full scores
  const now = new Date();
  if (now.getFullYear() === 2026 && now.getMonth() === 8) { const r = ROUNDS.find((x) => x.dnum === now.getDate()); if (r) return r.id; }
  return (ROUNDS.find((r) => roundStatus(r.id) !== 'done') || ROUNDS[0]).id;
})();

function formatChips(r) {
  if (r.format === 'scramble') return `<span class="chip gorse">2-team scramble</span>`;
  return `<span class="chip">Stableford</span>${r.pairs ? `<span class="chip heather">Hidden pairs</span>` : ''}`;
}
function dayRail(activeId, onSelect) {
  return `<div class="day-rail" role="tablist">${ROUNDS.map((r) => `
    <button class="day-tile" role="tab" aria-pressed="${r.id === activeId}" data-round="${r.id}" aria-label="Day ${r.n}, ${r.club}">
      <span class="dot ${roundStatus(r.id)}"></span>
      <span class="w">${r.dow}</span>
      <span class="d">${r.dnum}</span>
      <span class="c">${esc(r.short)}</span>
    </button>`).join('')}</div>`;
}
function unnamedNotice() {
  const unnamed = S.players.filter((p) => !p.name.trim()).length;
  return unnamed ? `<div class="notice green">${unnamed === S.players.length ? 'Start by adding the eight names and starting handicap indexes' : `${unnamed} player${unnamed > 1 ? 's' : ''} still unnamed`} — go to <b>Players</b>.</div>` : '';
}

// --- Trip ---
function renderTrip() {
  const pp = S.settings.placePoints;
  return `
    ${unnamedNotice()}
    <div class="section-title"><h2>Itinerary</h2><span class="eyebrow">5 rounds · 5 days</span></div>
    <div class="itin">${ROUNDS.map((r) => {
      const c = S.courses[r.id];
      return `<article class="card itin-day">
        <div class="itin-date"><span class="n">${r.dnum}</span><span class="m">${r.dow} ${r.mon}</span></div>
        <div class="itin-body">
          <h3>${esc(r.club)}</h3>
          <div class="itin-meta">${formatChips(r)}</div>
          <div class="itin-course">${esc(r.town)} · par ${c.par} · CR ${c.cr} · slope ${c.slope}</div>
          <div class="itin-notes">
            <div class="itin-row">
              <label><span class="lbl">Tee time</span><input type="text" inputmode="numeric" placeholder="e.g. 10:20" value="${esc(c.teeTime)}" data-course="${r.id}" data-field="teeTime"></label>
              <label style="grid-column:2 / span 1"><span class="lbl">Notes</span><textarea rows="1" placeholder="Meeting point, food, lifts…" data-course="${r.id}" data-field="notes">${esc(c.notes)}</textarea></label>
            </div>
          </div>
        </div>
      </article>`;
    }).join('')}</div>

    <div class="section-title"><h2>How the week works</h2></div>
    <div class="card rules">
      <div class="rule"><span class="k">HI</span><p class="t">Everyone starts on their <b>current handicap index</b>. Course handicaps are worked out each morning from that day's slope and rating.</p></div>
      <div class="rule"><span class="k">32</span><p class="t">After each stableford round your index moves: <b>−0.5 for every point above 32</b>, +0.5 for every point below. Scramble day doesn't move it.</p></div>
      <div class="rule"><span class="k">${pp[0]}</span><p class="t">Week points each round: <b>${pp[0]} · ${pp[1]} · ${pp[2]} · ${pp[3]}</b> for 1st to 4th. Ties share the points. Scramble winners take ${S.settings.scrambleWin} each.</p></div>
      <div class="rule"><span class="k" style="color:var(--heather)">2×</span><p class="t">Brough and Hessle carry a <b>hidden pairs</b> side-game: pairs are drawn and locked away until the round is in, then combined points decide it.</p></div>
    </div>`;
}

// --- Players ---
function driftTrack(pid) {
  const h = indexHistory(pid);
  const vals = [h[0].before, ...h.map((x) => x.after)];
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(max - min, 1);
  return `<span class="track" aria-hidden="true">${h.map((x) => {
    const hgt = 4 + Math.round(((x.after - min) / span) * 14);
    const cls = !x.applied ? (x.round.format === 'scramble' && x.round.n <= 5 ? 'pending' : 'pending') : x.after < x.before ? 'down' : x.after > x.before ? 'up' : 'same';
    return `<b class="${cls}" style="height:${x.applied ? hgt : 4}px"></b>`;
  }).join('')}</span>`;
}
function renderPlayers() {
  const nextRound = ROUNDS.find((r) => roundStatus(r.id) !== 'done') || ROUNDS[ROUNDS.length - 1];
  return `
    <div class="section-title"><h2>Players</h2><span class="eyebrow">${S.players.length} on tour</span></div>
    <div class="notice green">Tap a name or index to edit. Index shown is <b>now</b>; the number underneath is the starting index and its move so far.</div>
    <div class="player-list">${S.players.map((p, i) => {
      const cur = currentIndex(p.id), d = cur - p.start;
      const ch = courseHandicap(cur, nextRound.id);
      return `<div class="card player-row">
        <span class="avatar" style="background:${colour(i)}">${esc(initials(p, i))}</span>
        <div style="min-width:0">
          <input class="name" type="text" placeholder="Player ${i + 1}" value="${esc(p.name)}" data-player="${p.id}" data-field="name" aria-label="Name of player ${i + 1}">
          <div class="sub">Start <span class="index-edit" style="display:inline-flex;vertical-align:middle"><input type="number" step="0.1" inputmode="decimal" value="${p.start}" data-player="${p.id}" data-field="start" aria-label="Starting index" style="width:58px;padding:2px 6px;font-size:13px"></span>
            <span class="delta ${d < 0 ? 'down' : d > 0 ? 'up' : 'flat'}">${signed(d)}</span></div>
          <div class="sub" style="margin-top:2px">CH ${ch} at ${esc(nextRound.short)}</div>
        </div>
        <div class="index-now">
          <div class="v">${fmt1(cur)}</div>
          <div class="l">index</div>
          ${driftTrack(p.id)}
        </div>
      </div>`;
    }).join('')}</div>
    <div class="btn-row">
      <button class="btn secondary sm" data-action="add-player">Add player</button>
      ${S.players.length > 2 ? `<button class="btn ghost sm" data-action="remove-player">Remove last player</button>` : ''}
    </div>`;
}

// --- Scores ---
function renderScores() {
  const r = ROUNDS.find((x) => x.id === selectedRound);
  const c = S.courses[r.id];
  let body = '';
  if (r.format === 'stableford') {
    const res = stablefordResults(r.id);
    body += `<div class="score-list">${S.players.map((p, i) => {
      const idx = indexBefore(p.id, r.id), ch = courseHandicap(idx, r.id), ph = playingHandicap(idx, r.id);
      const s = scoreOf(r.id, p.id);
      const row = res.find((x) => x.pid === p.id);
      return `<div class="card score-row">
        <div class="who">
          <div class="n"><span class="avatar" style="background:${colour(i)};width:22px;height:22px;font-size:10px;display:inline-grid;vertical-align:-5px;margin-right:6px">${esc(initials(p, i))}</span>${esc(playerName(p, i))}</div>
          <div class="h">HI ${fmt1(idx)} · <b>CH ${ch}</b>${S.settings.allowance !== 100 ? ` · PH ${ph}` : ''}${row ? ` · ${row.tied ? 'T' : ''}${row.place}${ordinal(row.place)} ${row.points ? `+${trim(row.points)}` : ''}` : ''}</div>
        </div>
        <div class="stepper" aria-label="Stableford points for ${esc(playerName(p, i))}">
          <button data-step="-1" data-player="${p.id}" aria-label="Minus one">−</button>
          <input type="number" inputmode="numeric" min="0" max="60" placeholder="–" value="${s ?? ''}" data-score="${p.id}">
          <button data-step="1" data-player="${p.id}" aria-label="Plus one">+</button>
        </div>
      </div>`;
    }).join('')}</div>`;
    if (r.pairs) body += renderPairsBox(r);
  } else {
    body += renderScrambleBox(r);
  }
  return `
    ${dayRail(selectedRound)}
    <div class="score-head">
      <div><span class="eyebrow">Round ${r.n} · ${r.dow} ${r.dnum} ${r.mon}</span><h2>${esc(r.club)}</h2></div>
      <div style="text-align:right;flex:none"><div class="mono small">par ${c.par} · slope ${c.slope}</div><div style="margin-top:4px">${formatChips(r)}</div></div>
    </div>
    ${body}`;
}
function ordinal(n) { return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'; }
function trim(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

function renderPairsBox(r) {
  const pr = S.pairs[r.id];
  const even = S.players.length % 2 === 0;
  let inner;
  if (!pr) {
    inner = `<p class="small muted" style="margin-top:6px">Draw the pairs before tee-off. They stay sealed until you reveal them after the round.</p>
      <div class="btn-row"><button class="btn heather" data-action="draw-pairs" ${even ? '' : 'disabled'}>Draw hidden pairs</button></div>
      ${even ? '' : '<p class="small muted" style="margin-top:6px">Needs an even number of players.</p>'}`;
  } else if (!pr.revealed) {
    inner = `<div class="pair-hidden"><span class="lock"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
        <span><b>${pr.pairs.length} pairs drawn and sealed.</b> Enter everyone's points, then reveal.</span></div>
      <div class="btn-row"><button class="btn heather" data-action="reveal-pairs">Reveal pairs</button><button class="btn ghost sm" data-action="redraw-pairs">Redraw</button></div>`;
  } else {
    const rows = pairTotals(r.id);
    inner = `<div class="pair-list">${rows.map((row, k) => `<div class="pair-item">
        <div><span class="rank">${k + 1}</span><span class="names">${esc(pName(row.pair[0]))}<span>&amp;</span>${esc(pName(row.pair[1]))}</span></div>
        <span class="pts">${row.complete ? row.total : `<span class="muted">${row.total}…</span>`}</span></div>`).join('')}</div>
      <div class="btn-row"><button class="btn ghost sm" data-action="redraw-pairs">Redraw</button></div>`;
  }
  return `<div class="card pairs-box" style="margin-top:14px"><h3>Hidden pairs</h3>${inner}</div>`;
}

function renderScrambleBox(r) {
  const sc = S.scramble[r.id] || { teams: {}, scoreA: null, scoreB: null };
  const res = scrambleResults(r.id);
  const members = (t) => S.players.filter((p) => sc.teams[p.id] === t);
  const team = (t, label) => `<div class="team">
    <h4>${label} ${res.decided && res.winner === t ? '<span class="chip gorse">Winners</span>' : ''}</h4>
    <div class="members">${members(t).length ? members(t).map((p) => `<div class="m">${esc(pName(p.id))}</div>`).join('') : '<div class="m empty">No one yet</div>'}</div>
    <div class="team-score"><input type="number" inputmode="numeric" placeholder="pts" value="${isNum(sc['score' + t]) ? sc['score' + t] : ''}" data-team-score="${t}" aria-label="Team ${label} points"></div>
  </div>`;
  return `<div class="card scramble-box">
    <h3 style="font-size:17px">Two-team scramble</h3>
    <p class="small muted" style="margin-top:4px">Tap a name to move it between teams, then enter each team's stableford points. Winning team members each get ${S.settings.scrambleWin} week points${res.decided && res.tie ? ' — tied, so shared' : ''}.</p>
    <div class="team-grid">${team('A', 'Team A')}${team('B', 'Team B')}</div>
    <div class="assign">${S.players.map((p, i) => `<button data-assign="${p.id}" class="${sc.teams[p.id] || ''}"><span>${esc(playerName(p, i))}</span><span class="t">${sc.teams[p.id] || '—'}</span></button>`).join('')}</div>
    <div class="btn-row"><button class="btn ghost sm" data-action="auto-teams">Split teams by index</button></div>
  </div>`;
}

// --- Standings ---
function renderStandings() {
  const st = standings();
  const anyPts = st.some((r) => r.pts > 0);
  const top3 = st.slice(0, 3);
  const podium = anyPts ? `<div class="podium">${top3.map((r) => `<div class="pod">
      <div class="place">${r.rank}${ordinal(r.rank)}</div>
      <div class="nm">${esc(pName(r.pid))}</div>
      <div class="pts">${trim(r.pts)}</div>
      <div class="pl">pts · ${r.stab} stab</div></div>`).join('')}</div>` : '';
  const doneCount = ROUNDS.filter((r) => roundStatus(r.id) === 'done').length;
  return `
    <div class="section-title"><h2>Week standings</h2><span class="eyebrow">${doneCount} of 5 rounds in</span></div>
    ${podium}
    ${!anyPts ? '<div class="empty">No results yet. Once a round\'s scores are in, week points appear here.</div>' : ''}
    <div class="lb">${st.map((r) => {
      const p = P(r.pid), i = playerIdx(r.pid); const cur = currentIndex(r.pid); const d = cur - p.start;
      const dots = ROUNDS.map((rd) => {
        if (rd.format === 'scramble') { const sr = scrambleResults(rd.id).rows[r.pid]; return `<i class="${sr ? (sr.won ? 'win' : '') : ''}" title="Round ${rd.n}">${sr ? (sr.won ? 'W' : sr.tie ? '=' : 'L') : ''}</i>`; }
        const pl = roundPlace(rd.id, r.pid); return `<i class="${pl ? 'p' + Math.min(pl, 4) : ''}" title="Round ${rd.n}">${pl ?? ''}</i>`;
      }).join('');
      return `<div class="card lb-row">
        <div class="rk">${r.rank}</div>
        <div style="min-width:0">
          <div class="nm">${esc(pName(r.pid))}</div>
          <div class="meta"><span class="dots">${dots}</span>
            <span class="idx-cell">${driftTrack(r.pid)}<span class="v">${fmt1(cur)} <small class="${d < 0 ? 'delta down' : d > 0 ? 'delta up' : ''}">${signed(d)}</small></span></span></div>
        </div>
        <div class="pts">${trim(r.pts)}<small>${r.stab} stab</small></div>
      </div>`;
    }).join('')}</div>

    <div class="section-title"><h2>Round by round</h2><span class="eyebrow">stableford · (week pts)</span></div>
    <div class="card table-wrap"><table class="rounds-table">
      <thead><tr><th>Player</th>${ROUNDS.map((r) => `<th>${esc(r.short)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${st.map((row) => `<tr><td>${esc(pName(row.pid))}</td>${ROUNDS.map((rd) => {
        if (rd.format === 'scramble') { const sr = scrambleResults(rd.id).rows[row.pid]; return `<td>${sr ? `<span class="${sr.won ? 'win' : ''}">${sr.won ? 'W' : sr.tie ? '=' : 'L'}</span> <span class="pt">(${trim(sr.points)})</span>` : '·'}</td>`; }
        const s = scoreOf(rd.id, row.pid); const rp = roundPoints(rd.id, row.pid);
        return `<td>${s === null ? '·' : `${s} <span class="pt">(${trim(rp)})</span>`}</td>`;
      }).join('')}<td><b>${trim(row.pts)}</b></td></tr>`).join('')}</tbody>
    </table></div>

    ${ROUNDS.filter((r) => r.pairs && S.pairs[r.id]?.revealed).map((r) => `
      <div class="section-title"><h2>Pairs · ${esc(r.short)}</h2><span class="eyebrow">combined points</span></div>
      <div class="card pairs-box"><div class="pair-list" style="margin-top:0">${pairTotals(r.id).map((row, k) => `<div class="pair-item"><div><span class="rank">${k + 1}</span><span class="names">${esc(pName(row.pair[0]))}<span>&amp;</span>${esc(pName(row.pair[1]))}</span></div><span class="pts">${row.total}</span></div>`).join('')}</div></div>`).join('')}`;
}

// --- Settings sheet ---
function renderSettings() {
  const s = S.settings;
  return `<h2 id="sheet-title">Settings</h2>
    <p class="small muted">Rules and course figures. Everything recalculates immediately.</p>
    <div class="field"><span class="lbl">Week points for 1st · 2nd · 3rd · 4th</span>
      <div class="grid4">${[0, 1, 2, 3].map((i) => `<div class="field"><input type="number" inputmode="numeric" value="${s.placePoints[i]}" data-setting="pp${i}"></div>`).join('')}</div>
      <p class="help">Ties share the points of the places they cover.</p></div>
    <div class="grid3" style="margin-top:12px">
      <div class="field"><span class="lbl">Par score</span><input type="number" value="${s.par}" data-setting="par"><p class="help">Index moves ±0.5 per point from this.</p></div>
      <div class="field"><span class="lbl">Allowance %</span><input type="number" value="${s.allowance}" data-setting="allowance"><p class="help">100 = full course handicap.</p></div>
      <div class="field"><span class="lbl">Scramble win / lose</span><div style="display:flex;gap:6px"><input type="number" value="${s.scrambleWin}" data-setting="scrambleWin"><input type="number" value="${s.scrambleLose}" data-setting="scrambleLose"></div><p class="help">Week points per player.</p></div>
    </div>
    <div class="course-edit">
      <h3>Courses</h3><p class="help">Par, course rating and slope from the tees you're playing. Defaults are approximate — check the scorecard.</p>
      ${ROUNDS.map((r) => { const c = S.courses[r.id]; return `<div class="grid4" style="margin-top:8px;align-items:end">
        <div class="field" style="grid-column:span 4"><span class="lbl">Round ${r.n} · ${esc(r.club)}</span></div>
        <div class="field"><span class="lbl">Tees</span><input type="text" value="${esc(c.tee)}" data-course="${r.id}" data-field="tee"></div>
        <div class="field"><span class="lbl">Par</span><input type="number" value="${c.par}" data-course="${r.id}" data-field="par"></div>
        <div class="field"><span class="lbl">CR</span><input type="number" step="0.1" value="${c.cr}" data-course="${r.id}" data-field="cr"></div>
        <div class="field"><span class="lbl">Slope</span><input type="number" value="${c.slope}" data-course="${r.id}" data-field="slope"></div>
      </div>`; }).join('')}
    </div>
    <div class="course-edit share-box">
      <h3>Share &amp; back up</h3>
      <p class="help">The app keeps everything on this phone. Send the share link and whoever opens it gets an exact copy of the current scores.</p>
      <div class="btn-row"><button class="btn" data-action="share">Copy share link</button><button class="btn secondary" data-action="export">Copy JSON</button></div>
      <div class="field"><span class="lbl">Paste JSON to restore</span><textarea id="import-box" placeholder="{ … }"></textarea><div class="btn-row"><button class="btn ghost sm" data-action="import">Restore from JSON</button></div></div>
    </div>
    <div class="course-edit">
      <div class="btn-row"><button class="btn danger sm" data-action="reset">Reset everything</button><button class="btn ghost sm" data-action="close-sheet" style="margin-left:auto">Done</button></div>
    </div>`;
}

function render() {
  const view = $('#view');
  view.innerHTML = tab === 'trip' ? renderTrip() : tab === 'players' ? renderPlayers() : tab === 'scores' ? renderScores() : renderStandings();
  document.querySelectorAll('.tab').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
function openSheet() { $('#sheet').innerHTML = renderSettings(); $('#sheet-backdrop').hidden = false; }
function closeSheet() { $('#sheet-backdrop').hidden = true; render(); }

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

document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  tab = b.dataset.tab; render(); window.scrollTo({ top: 0 });
});
$('#btn-settings').addEventListener('click', openSheet);
$('#sheet-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet-backdrop').hidden) closeSheet(); });

// live typing → update state without re-render; blur/change → re-render
function handleInput(e, commit) {
  const t = e.target;
  if (t.dataset.player && t.dataset.field) {
    const p = P(t.dataset.player);
    if (t.dataset.field === 'name') p.name = t.value;
    else if (t.dataset.field === 'start') { const n = num(t.value); if (n !== null) p.start = Math.round(n * 10) / 10; }
    save(); if (commit) render(); return;
  }
  if (t.dataset.course && t.dataset.field) {
    const c = S.courses[t.dataset.course], f = t.dataset.field;
    if (f === 'teeTime' || f === 'notes' || f === 'tee') c[f] = t.value;
    else { const n = num(t.value); if (n !== null) c[f] = n; }
    save(); return; // itinerary re-renders on tab change; the sheet re-renders on close
  }
  if (t.dataset.score) {
    const n = num(t.value);
    S.scores[selectedRound] = S.scores[selectedRound] || {};
    if (n === null) delete S.scores[selectedRound][t.dataset.score]; else S.scores[selectedRound][t.dataset.score] = Math.max(0, Math.round(n));
    save(); if (commit) render(); return;
  }
  if (t.dataset.teamScore) {
    const sc = (S.scramble[selectedRound] = S.scramble[selectedRound] || { teams: {}, scoreA: null, scoreB: null });
    const n = num(t.value); sc['score' + t.dataset.teamScore] = n === null ? null : Math.round(n);
    save(); if (commit) render(); return;
  }
  if (t.dataset.setting) {
    const k = t.dataset.setting, n = num(t.value); if (n === null) return;
    if (k.startsWith('pp')) S.settings.placePoints[+k[2]] = n; else S.settings[k] = n;
    save(); return;
  }
}
document.body.addEventListener('input', (e) => handleInput(e, false));
document.body.addEventListener('change', (e) => handleInput(e, true));

document.body.addEventListener('click', async (e) => {
  const rt = e.target.closest('[data-round]'); if (rt) { selectedRound = rt.dataset.round; render(); return; }
  const st = e.target.closest('[data-step]');
  if (st) {
    const pid = st.dataset.player, cur = scoreOf(selectedRound, pid);
    const next = Math.max(0, (cur ?? (st.dataset.step === '1' ? 31 : 33)) + Number(st.dataset.step));
    S.scores[selectedRound] = S.scores[selectedRound] || {}; S.scores[selectedRound][pid] = next; save(); render(); return;
  }
  const as = e.target.closest('[data-assign]');
  if (as) {
    const sc = (S.scramble[selectedRound] = S.scramble[selectedRound] || { teams: {}, scoreA: null, scoreB: null });
    const cur = sc.teams[as.dataset.assign]; sc.teams[as.dataset.assign] = cur === 'A' ? 'B' : cur === 'B' ? undefined : 'A';
    if (!sc.teams[as.dataset.assign]) delete sc.teams[as.dataset.assign];
    save(); render(); return;
  }
  const a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'add-player': { const n = S.players.length + 1; S.players.push({ id: 'p' + Date.now().toString(36), name: '', start: 18 }); save(); render(); toast(`Player ${n} added`); break; }
    case 'remove-player': { const p = S.players[S.players.length - 1]; if (confirm(`Remove ${pName(p.id)}? Their scores go too.`)) { S.players.pop(); for (const r of ROUNDS) { delete S.scores[r.id]?.[p.id]; delete S.scramble[r.id]?.teams?.[p.id]; if (S.pairs[r.id]?.pairs.some((pr) => pr.includes(p.id))) delete S.pairs[r.id]; } save(); render(); } break; }
    case 'draw-pairs': { const ids = shuffle(S.players.map((p) => p.id)); const pairs = []; for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]); S.pairs[selectedRound] = { pairs, revealed: false }; save(); render(); toast('Pairs drawn and sealed'); break; }
    case 'redraw-pairs': { if (confirm('Redraw the pairs for this round?')) { delete S.pairs[selectedRound]; save(); render(); } break; }
    case 'reveal-pairs': { S.pairs[selectedRound].revealed = true; save(); render(); toast('Pairs revealed'); break; }
    case 'auto-teams': {
      // snake draft by index so teams are balanced
      const sc = (S.scramble[selectedRound] = S.scramble[selectedRound] || { teams: {}, scoreA: null, scoreB: null });
      const sorted = [...S.players].sort((x, y) => indexBefore(x.id, selectedRound) - indexBefore(y.id, selectedRound));
      sc.teams = {}; sorted.forEach((p, i) => { sc.teams[p.id] = (i % 4 === 0 || i % 4 === 3) ? 'A' : 'B'; });
      save(); render(); toast('Teams split by handicap'); break;
    }
    case 'share': { const url = location.origin + location.pathname + '#s=' + encodeState(); await copy(url, 'Share link copied'); break; }
    case 'export': { await copy(JSON.stringify(S, null, 2), 'JSON copied'); break; }
    case 'import': { try { S = migrate(JSON.parse($('#import-box').value)); save(); closeSheet(); toast('Restored'); } catch { toast('That JSON didn\'t parse'); } break; }
    case 'reset': { if (confirm('Wipe all players, scores and settings on this phone?')) { S = defaultState(); save(); closeSheet(); toast('Reset'); } break; }
    case 'close-sheet': closeSheet(); break;
  }
});

// ---------- Boot ----------
checkHashImport();
render();
})();
