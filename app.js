/* Yorkshire Golf Week 2026 — single-file app, no build step.
   State lives in localStorage; a share link carries the whole state in the URL hash. */
(() => {
'use strict';

const STORE_KEY = 'yorkshire-golf-2026';

// ---------- Fixed trip structure ----------
// Edit these to change the trip. Course figures are placeholders — check the scorecards.
const ROUNDS = [
  { id: 'd1', n: 1, dow: 'Mon', dnum: 7,  mon: 'Sept', club: 'Brough Golf Club',      short: 'Brough',      town: 'Brough, East Riding',      format: 'stableford', pairs: true,  par: 68, cr: 67.7, slope: 120, teeTime: '10:00', notes: 'Meet in the car park 9:15. Bacon rolls in the clubhouse.' },
  { id: 'd2', n: 2, dow: 'Tue', dnum: 8,  mon: 'Sept', club: 'Ganton Golf Club',      short: 'Ganton',      town: 'Ganton, near Scarborough', format: 'stableford', pairs: false, par: 71, cr: 73.2, slope: 135, teeTime: '11:20', notes: 'Jacket and tie for lunch. Leave the hotel by 9:30.' },
  { id: 'd3', n: 3, dow: 'Wed', dnum: 9,  mon: 'Sept', club: 'Cave Castle Golf Club', short: 'Cave Castle', town: 'South Cave, East Riding',   format: 'scramble',   pairs: false, par: 72, cr: 71.8, slope: 128, teeTime: '12:00', notes: 'Two teams of four. Losing team buys the first round.' },
  { id: 'd4', n: 4, dow: 'Thu', dnum: 10, mon: 'Sept', club: 'Hessle Golf Club',      short: 'Hessle',      town: 'Cottingham, Hull',         format: 'stableford', pairs: true,  par: 72, cr: 71.6, slope: 129, teeTime: '10:40', notes: 'Pairs drawn on the first tee.' },
  { id: 'd5', n: 5, dow: 'Fri', dnum: 11, mon: 'Sept', club: 'York Golf Club',        short: 'York',        town: 'Strensall, York',          format: 'stableford', pairs: false, par: 70, cr: 70.9, slope: 128, teeTime: '09:30', notes: 'Final round. Prize-giving in the bar afterwards.' },
];

// Players and starting handicap indexes — placeholders, edit before the trip.
const PLAYERS = [
  { id: 'p1', name: 'Tim Hoare',   start: 12.4 },
  { id: 'p2', name: 'Player Two',  start: 18.1 },
  { id: 'p3', name: 'Player Three', start: 7.9 },
  { id: 'p4', name: 'Player Four', start: 22.6 },
  { id: 'p5', name: 'Player Five', start: 15.0 },
  { id: 'p6', name: 'Player Six',  start: 9.3 },
  { id: 'p7', name: 'Player Seven', start: 27.5 },
  { id: 'p8', name: 'Player Eight', start: 20.2 },
];

// Rules
const RULES = { placePoints: [8, 6, 4, 2], allowance: 100, scrambleWin: 4, scrambleLose: 0, par: 32 };

const AVATAR_COLOURS = ['#1E5B3A', '#6B4C9A', '#B8452F', '#2C6E91', '#D99A1E', '#4E8B67', '#8C3B6E', '#3F5C7A'];

// ---------- State ----------
function defaultState() {
  return { v: 2, scores: {}, pairs: {}, scramble: {} };
}
function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? migrate(JSON.parse(raw)) : defaultState(); }
  catch { return defaultState(); }
}
function migrate(s) {
  const d = defaultState();
  return { v: 2, scores: s.scores || d.scores, pairs: s.pairs || d.pairs, scramble: s.scramble || d.scramble };
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
const playerIdx = (pid) => PLAYERS.findIndex((p) => p.id === pid);
const P = (pid) => PLAYERS[playerIdx(pid)];
const pName = (pid) => { const i = playerIdx(pid); return i < 0 ? '?' : playerName(PLAYERS[i], i); };

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
      if (s !== null) { after = idx - 0.5 * (s - RULES.par); applied = true; }
    }
    out.push({ round: r, before, after, applied });
    idx = after;
  }
  return out;
}
const currentIndex = (pid) => { const h = indexHistory(pid); return h[h.length - 1].after; };
const indexBefore = (pid, rid) => indexHistory(pid).find((h) => h.round.id === rid).before;
function courseHandicap(index, rid) {
  const c = ROUNDS.find((x) => x.id === rid);
  return Math.round(index * (c.slope / 113) + (c.cr - c.par));
}
function playingHandicap(index, rid) {
  return Math.round(courseHandicap(index, rid) * (RULES.allowance / 100));
}

// ---------- Results ----------
// Stableford: rank by points; ties share the place points for the positions they occupy.
function stablefordResults(rid) {
  const rows = PLAYERS.map((p) => ({ pid: p.id, score: scoreOf(rid, p.id) })).filter((r) => r.score !== null);
  rows.sort((a, b) => b.score - a.score);
  const pp = RULES.placePoints;
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
  const { scrambleWin: W, scrambleLose: L } = RULES;
  const tie = sc.scoreA === sc.scoreB;
  for (const p of PLAYERS) {
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
  const rows = PLAYERS.map((p, i) => {
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
  const n = PLAYERS.filter((p) => scoreOf(rid, p.id) !== null).length;
  return n === 0 ? 'none' : n === PLAYERS.length ? 'done' : 'partial';
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
function dayRail(activeId) {
  return `<div class="courses" role="tablist">${ROUNDS.map((r, i) => {
    const c = r;
    const sub = r.format === 'scramble' ? 'scramble' : r.pairs ? 'hidden pairs' : 'stableford';
    return `<button class="course-card" role="tab" aria-pressed="${r.id === activeId}" data-round="${r.id}" aria-label="Round ${r.n}, ${r.club}">
      <span class="course-img g${i + 1}"><span class="day">${r.dow} ${r.dnum}</span><span class="st ${roundStatus(r.id)}"></span><span class="nm">${esc(r.short)}</span></span>
      <small>${sub}${c.teeTime ? ` · ${esc(c.teeTime)}` : ''}</small>
    </button>`; }).join('')}</div>`;
}
function avatar(p, i, badge) {
  return `<span class="avatar" style="background:${colour(i)}">${esc(initials(p, i))}${badge ?? ''}</span>`;
}
// --- Trip ---
function renderTrip() {
  const pp = RULES.placePoints;
  return `
    ${dayRail(null)}
    <div class="section-title"><h2>Itinerary</h2><span class="eyebrow">5 rounds · 5 days</span></div>
    <div class="itin">${ROUNDS.map((r) => {
      const c = r;
      return `<article class="itin-day">
        <div class="itin-date"><span class="n">${r.dnum}</span><span class="m">${r.dow}</span></div>
        <div class="itin-body">
          <h3>${esc(r.club)}</h3>
          <div class="itin-meta">${formatChips(r)}</div>
          <div class="itin-course">${esc(r.town)} · par ${c.par} · slope ${c.slope}</div>
          <div class="itin-facts"><span><b>${esc(r.teeTime)}</b> tee</span><span>${r.format === 'scramble' ? '2 teams of 4' : r.pairs ? 'Pairs drawn before tee-off' : 'Individual'}</span></div>
          <p class="itin-note">${esc(r.notes)}</p>
        </div>
      </article>`;
    }).join('')}</div>

    <div class="section-title"><h2>How the week works</h2></div>
    <div class="card rules">
      <div class="rule"><span class="k">HI</span><p class="t">Everyone starts on their <b>current handicap index</b>. Course handicaps are worked out each morning from that day's slope and rating.</p></div>
      <div class="rule"><span class="k">32</span><p class="t">After each stableford round your index moves: <b>−0.5 for every point above 32</b>, +0.5 for every point below. Scramble day doesn't move it.</p></div>
      <div class="rule"><span class="k">${pp[0]}</span><p class="t">Week points each round: <b>${pp[0]} · ${pp[1]} · ${pp[2]} · ${pp[3]}</b> for 1st to 4th. Ties share the points. Scramble winners take ${RULES.scrambleWin} each.</p></div>
      <div class="rule"><span class="k">2×</span><p class="t">Brough and Hessle carry a <b>hidden pairs</b> side-game: pairs are drawn and locked away until the round is in, then combined points decide it.</p></div>
    </div>`;
}

// --- Players ---
function renderPlayers() {
  const nextRound = ROUNDS.find((r) => roundStatus(r.id) !== 'done') || ROUNDS[ROUNDS.length - 1];
  return `
    <div class="section-title"><h2>Players</h2><span class="eyebrow">${PLAYERS.length} on tour</span></div>
    <div class="player-list">${PLAYERS.map((p, i) => {
      const cur = currentIndex(p.id), d = cur - p.start;
      const ch = courseHandicap(cur, nextRound.id);
      return `<div class="player-row">
        ${avatar(p, i)}
        <div style="min-width:0">
          <div class="pname">${esc(playerName(p, i))}</div>
          <div class="sub">Started ${fmt1(p.start)} <span class="delta ${d < 0 ? 'down' : d > 0 ? 'up' : 'flat'}">${signed(d)}</span> · CH ${ch} at ${esc(nextRound.short)}</div>
        </div>
        <div class="index-now"><div class="v">${fmt1(cur)}</div><div class="l">index</div></div>
      </div>`;
    }).join('')}</div>
    <p class="small muted" style="margin-top:14px">Names and starting indexes are set in the app's code before the trip.</p>`;
}

// --- Scores ---
function renderScores() {
  const r = ROUNDS.find((x) => x.id === selectedRound);
  const c = r;
  let body = '';
  if (r.format === 'stableford') {
    const res = stablefordResults(r.id);
    body += `<div class="score-list">${PLAYERS.map((p, i) => {
      const idx = indexBefore(p.id, r.id), ch = courseHandicap(idx, r.id), ph = playingHandicap(idx, r.id);
      const s = scoreOf(r.id, p.id);
      const row = res.find((x) => x.pid === p.id);
      return `<div class="score-row">
        <div class="who">
          ${avatar(p, i, row ? `<em class="${row.place === 1 ? 'lead' : ''}">${row.place}</em>` : '')}
          <div style="min-width:0">
            <div class="n">${esc(playerName(p, i))}</div>
            <div class="h">HI ${fmt1(idx)} · <b>CH ${ch}</b>${RULES.allowance !== 100 ? ` · PH ${ph}` : ''}${row && row.points ? ` · +${trim(row.points)} pts` : ''}</div>
          </div>
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
      <div style="text-align:right;flex:none"><div class="small muted">par ${c.par} · slope ${c.slope}</div><div style="margin-top:4px">${formatChips(r)}</div></div>
    </div>
    ${body}`;
}
function ordinal(n) { return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'; }
function trim(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

function renderPairsBox(r) {
  const pr = S.pairs[r.id];
  const even = PLAYERS.length % 2 === 0;
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
  return `<div class="pairs-box"><h3>Hidden pairs</h3>${inner}</div>`;
}

function renderScrambleBox(r) {
  const sc = S.scramble[r.id] || { teams: {}, scoreA: null, scoreB: null };
  const res = scrambleResults(r.id);
  const members = (t) => PLAYERS.filter((p) => sc.teams[p.id] === t);
  const team = (t, label) => `<div class="team">
    <h4>${label} ${res.decided && res.winner === t ? '<span class="chip gorse">Winners</span>' : ''}</h4>
    <div class="members">${members(t).length ? members(t).map((p) => `<div class="m">${esc(pName(p.id))}</div>`).join('') : '<div class="m empty">No one yet</div>'}</div>
    <div class="team-score"><input type="number" inputmode="numeric" placeholder="pts" value="${isNum(sc['score' + t]) ? sc['score' + t] : ''}" data-team-score="${t}" aria-label="Team ${label} points"></div>
  </div>`;
  return `<div class="scramble-box">
    <h3>Two-team scramble</h3>
    <p class="small muted" style="margin-top:4px">Tap a name to move it between teams, then enter each team's stableford points. Winning team members each get ${RULES.scrambleWin} week points${res.decided && res.tie ? ' — tied, so shared' : ''}.</p>
    <div class="team-grid">${team('A', 'Team A')}${team('B', 'Team B')}</div>
    <div class="assign">${PLAYERS.map((p, i) => `<button data-assign="${p.id}" class="${sc.teams[p.id] || ''}"><span>${esc(playerName(p, i))}</span><span class="t">${sc.teams[p.id] || '—'}</span></button>`).join('')}</div>
    <div class="btn-row"><button class="btn ghost sm" data-action="auto-teams">Split teams by index</button></div>
  </div>`;
}

// --- Standings ---
function renderStandings() {
  const st = standings();
  const anyPts = st.some((r) => r.pts > 0);
  const top3 = st.slice(0, 3);
  const doneCount = ROUNDS.filter((r) => roundStatus(r.id) === 'done').length;
  return `
    <div class="section-title"><h2>Standings</h2><span class="eyebrow">${doneCount} of 5 rounds in</span></div>
    ${!anyPts ? '<div class="empty">No results yet. Once a round\'s scores are in, week points appear here.</div>' : ''}
    <div class="lb">${st.map((r) => {
      const p = P(r.pid), i = playerIdx(r.pid); const cur = currentIndex(r.pid); const d = cur - p.start;
      const dots = ROUNDS.map((rd) => {
        if (rd.format === 'scramble') { const sr = scrambleResults(rd.id).rows[r.pid]; return `<i class="${sr ? (sr.won ? 'win' : '') : ''}" title="Round ${rd.n}">${sr ? (sr.won ? 'W' : sr.tie ? '=' : 'L') : ''}</i>`; }
        const pl = roundPlace(rd.id, r.pid); return `<i class="${pl ? 'p' + Math.min(pl, 4) : ''}" title="Round ${rd.n}">${pl ?? ''}</i>`;
      }).join('');
      return `<div class="lb-row">
        ${avatar(p, i, `<em class="${r.rank === 1 && anyPts ? 'lead' : ''}">${r.rank}</em>`)}
        <div style="min-width:0">
          <div class="nm">${esc(pName(r.pid))}</div>
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
        const s = scoreOf(rd.id, row.pid); const rp = roundPoints(rd.id, row.pid);
        return `<td>${s === null ? '·' : `${s} <span class="pt">(${trim(rp)})</span>`}</td>`;
      }).join('')}<td><b>${trim(row.pts)}</b></td></tr>`).join('')}</tbody>
    </table></div>

    ${ROUNDS.filter((r) => r.pairs && S.pairs[r.id]?.revealed).map((r) => `
      <div class="section-title"><h2>Pairs · ${esc(r.short)}</h2><span class="eyebrow">combined points</span></div>
      <div class="pairs-box" style="margin-top:0"><div class="pair-list" style="margin-top:0">${pairTotals(r.id).map((row, k) => `<div class="pair-item"><div><span class="rank">${k + 1}</span><span class="names">${esc(pName(row.pair[0]))}<span>&amp;</span>${esc(pName(row.pair[1]))}</span></div><span class="pts">${row.total}</span></div>`).join('')}</div></div>`).join('')}`;
}

// --- Settings sheet ---
function renderSettings() {
  return `<h2 id="sheet-title">Share &amp; back up</h2>
    <p class="small muted">Scores live on this phone. Send the share link and whoever opens it gets an exact copy.</p>
    <div class="btn-row"><button class="btn primary" data-action="share">Copy share link</button><button class="btn secondary" data-action="export">Copy JSON</button></div>
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
    case 'draw-pairs': { const ids = shuffle(PLAYERS.map((p) => p.id)); const pairs = []; for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]); S.pairs[selectedRound] = { pairs, revealed: false }; save(); render(); toast('Pairs drawn and sealed'); break; }
    case 'redraw-pairs': { if (confirm('Redraw the pairs for this round?')) { delete S.pairs[selectedRound]; save(); render(); } break; }
    case 'reveal-pairs': { S.pairs[selectedRound].revealed = true; save(); render(); toast('Pairs revealed'); break; }
    case 'auto-teams': {
      // snake draft by index so teams are balanced
      const sc = (S.scramble[selectedRound] = S.scramble[selectedRound] || { teams: {}, scoreA: null, scoreB: null });
      const sorted = [...PLAYERS].sort((x, y) => indexBefore(x.id, selectedRound) - indexBefore(y.id, selectedRound));
      sc.teams = {}; sorted.forEach((p, i) => { sc.teams[p.id] = (i % 4 === 0 || i % 4 === 3) ? 'A' : 'B'; });
      save(); render(); toast('Teams split by handicap'); break;
    }
    case 'share': { const url = location.origin + location.pathname + '#s=' + encodeState(); await copy(url, 'Share link copied'); break; }
    case 'export': { await copy(JSON.stringify(S, null, 2), 'JSON copied'); break; }
    case 'import': { try { S = migrate(JSON.parse($('#import-box').value)); save(); closeSheet(); toast('Restored'); } catch { toast('That JSON didn\'t parse'); } break; }
    case 'reset': { if (confirm('Clear every score, pair draw and scramble result on this phone?')) { S = defaultState(); save(); closeSheet(); toast('Reset'); } break; }
    case 'close-sheet': closeSheet(); break;
  }
});

// ---------- Boot ----------
checkHashImport();
render();
})();
