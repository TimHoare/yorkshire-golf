// Round-level widgets shared by pages: format chips, hidden-pairs box,
// scramble result, the round leaderboard, and the live gross/points scorecard.
import { useEffect, useRef, useState } from 'react';
import { PL, PLAYERS, R, first, pName, gname, type Round } from '../data/trip';
import { RULES } from '../data/trip';
import {
  groupsFor, pairTotals, playerTally, stablefordResults, teamTally, phFor, scrambleResults,
  type Tally,
} from '../lib/scoring';
import { setPairDraw } from '../lib/store';
import { useStore } from '../lib/useStore';
import { toast } from '../lib/toast';
import { Avatar } from './Avatar';

export function FormatChips({ r }: { r: Round }) {
  if (r.format === 'scramble') return <span className="chip gorse">2-man scramble</span>;
  return (
    <>
      <span className="chip">Stableford</span>
      {r.pairs && <span className="chip heather">Hidden pairs</span>}
    </>
  );
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PairsBox({ r }: { r: Round }) {
  const { S } = useStore();
  const pr = S.pairs[r.id];
  const [revealing, setRevealing] = useState(false);

  const draw = () => {
    const ids = shuffle(PLAYERS.map((p) => p.id));
    const pairs: string[][] = [];
    for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
    setPairDraw(r.id, { pairs, revealed: false });
    toast('Pairs drawn and sealed');
  };
  const redraw = () => { if (confirm('Redraw the pairs for this round?')) setPairDraw(r.id, null); };

  return (
    <div className="pairs-box">
      <h3>Hidden pairs</h3>
      {!pr ? (
        <>
          <p className="small muted" style={{ marginTop: 6 }}>Draw the pairs before tee-off. They stay sealed until you reveal them after the round.</p>
          <div className="btn-row"><button className="btn heather" onClick={draw}>Draw hidden pairs</button></div>
        </>
      ) : !pr.revealed ? (
        <>
          <div className="pair-hidden">
            <span className="lock"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
            <span><b>{pr.pairs.length} pairs drawn and sealed.</b> Enter everyone's scores, then reveal.</span>
          </div>
          <div className="btn-row">
            <button className="btn heather" onClick={() => setRevealing(true)}>Reveal pairs</button>
            <button className="btn ghost sm" onClick={redraw}>Redraw</button>
          </div>
          {revealing && <RevealSheet r={r} onClose={() => setRevealing(false)} />}
        </>
      ) : (
        <>
          <PairList rid={r.id} />
          <div className="btn-row"><button className="btn ghost sm" onClick={redraw}>Redraw</button></div>
        </>
      )}
    </div>
  );
}

const ordinal = (n: number) => `${n}${['st', 'nd', 'rd'][n - 1] || 'th'}`;

// The reveal ceremony: pairs come out one press at a time from last place up
// to the winners, names flickering before they land — the same theatre the
// old group draw had. Sealing shares the reveal to every phone.
const SPIN_MS = 1400;   // per pair, before it locks
const TICK0 = 60;       // flicker interval at full speed

function RevealSheet({ r, onClose }: { r: Round; onClose: () => void }) {
  const { S } = useStore();
  const rows = pairTotals(S, r.id);            // best first
  const n = rows.length;
  const [shown, setShown] = useState(0);       // pairs revealed, counted from the bottom
  const [spinning, setSpinning] = useState(false);
  const [flick, setFlick] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const names = PLAYERS.map((p) => first(p.id));
  const revealNext = () => {
    if (spinning || shown >= n) return;
    setSpinning(true);
    let elapsed = 0;
    const tick = () => {
      const speed = TICK0 + Math.pow(elapsed / SPIN_MS, 2) * 240;
      const a = names[Math.floor(Math.random() * names.length)];
      let b = a;
      while (b === a) b = names[Math.floor(Math.random() * names.length)];
      setFlick(`${a} & ${b}`);
      elapsed += speed;
      if (elapsed < SPIN_MS) timer.current = setTimeout(tick, speed);
      else timer.current = setTimeout(() => { setFlick(''); setSpinning(false); setShown((x) => x + 1); }, 150);
    };
    tick();
  };

  const done = shown >= n;
  const seal = () => {
    setPairDraw(r.id, { ...S.pairs[r.id]!, revealed: true });
    toast('Pairs revealed — on every phone now');
    onClose();
  };
  const nextPlace = n - shown;

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>The reveal</h2>
        <p className="small muted">Last place first, winners last. Nobody else sees a thing until you seal it.</p>
        <div className="pair-list">
          {rows.map((row, k) => {
            const revealed = k >= n - shown;
            const isSpinning = spinning && k === n - shown - 1;
            return (
              <div className={`pair-item${revealed ? '' : isSpinning ? ' spin' : ' sealed'}`} key={k}>
                <div className="pair-names">
                  <span className="rank">{k + 1}</span>
                  {revealed
                    ? <span className="names">{first(row.pair[0])}<span>&amp;</span>{first(row.pair[1])}</span>
                    : isSpinning
                      ? <span className="flick">{flick || '…'}</span>
                      : <span className="names tbd">? &amp; ?</span>}
                </div>
                {revealed && <span className="pts">{row.total}<small>{row.complete ? 'pts' : 'so far'}</small></span>}
              </div>
            );
          })}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          {done
            ? <>
                <button className="btn heather grow" onClick={seal}>Seal it — show everyone</button>
                <button className="btn ghost" onClick={onClose}>Close without sealing</button>
              </>
            : <>
                <button className="btn heather grow" onClick={revealNext} disabled={spinning}>
                  {spinning ? 'Drum roll…' : nextPlace === 1 ? 'Reveal the winners' : `Reveal ${ordinal(nextPlace)} place`}
                </button>
                <button className="btn ghost" onClick={onClose}>Cancel</button>
              </>}
        </div>
      </div>
    </div>
  );
}

export function PairList({ rid }: { rid: string }) {
  const { S } = useStore();
  return (
    <div className="pair-list">
      {pairTotals(S, rid).map((row, k) => (
        <div className="pair-item" key={k}>
          <div className="pair-names">
            <span className="rank">{k + 1}</span>
            <span className="names">{first(row.pair[0])}<span>&amp;</span>{first(row.pair[1])}</span>
          </div>
          <span className="pts">{row.total}<small>{row.complete ? 'pts' : 'so far'}</small></span>
        </div>
      ))}
    </div>
  );
}

export function ScrambleResult({ r }: { r: Round }) {
  const { S } = useStore();
  const res = scrambleResults(S, r.id);
  return (
    <div className="scramble-box">
      <h3>Result</h3>
      <div className="team-grid">
        {groupsFor(S, r.id).map((grp, t) => {
          const tt = res.ts[t];
          const won = res.decided && res.winner === t;
          return (
            <div className={`team${won ? ' won' : ''}`} key={t}>
              <h4>{grp.name || 'Team ' + (t + 1)} {won && <span className="chip gorse">Winners</span>}</h4>
              <div className="big">{tt.pts}<small>pts thru {tt.played}</small></div>
              <div className="members">{grp.players.map((pid) => <div className="m" key={pid}>{pName(pid)}</div>)}</div>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Team handicap is {RULES.scrambleAllowance.join('/')}% of the two course handicaps, lowest first.
        Winners take {RULES.scrambleWin} week points each{res.decided && res.winner === null ? ' — tied, so shared' : ''}.
      </p>
    </div>
  );
}

// Live leaderboard for one round: every player across every group, ranked by
// stableford points as scores land (teams on scramble day). Nothing to poll —
// it re-renders off the store, which realtime sync keeps current.
export function Leaderboard({ r }: { r: Round }) {
  const { S, me } = useStore();
  const scramble = r.format === 'scramble';

  const teams = scramble
    ? groupsFor(S, r.id)
        .map((grp, t) => ({ key: String(t), t, grp, tally: teamTally(S, r.id, t) }))
        .filter((x) => x.tally.played > 0)
        .sort((a, b) => b.tally.pts - a.tally.pts)
        .map((x, k, all) => {
          const tiedUp = k > 0 && x.tally.pts === all[k - 1].tally.pts;
          const tiedDown = k + 1 < all.length && x.tally.pts === all[k + 1].tally.pts;
          const place = tiedUp ? all.findIndex((y) => y.tally.pts === x.tally.pts) + 1 : k + 1;
          return { ...x, place, tied: tiedUp || tiedDown };
        })
    : [];
  const rows = scramble ? teams : stablefordResults(S, r.id).map((x) => ({ key: x.pid, ...x }));

  if (!rows.length) return null;

  return (
    <>
      <div className="section-title"><h2>Leaderboard</h2><span className="eyebrow">live · all {scramble ? 'teams' : 'groups'}</span></div>
      <div className="lb">
        {rows.map((x) => {
          const t = 'tally' in x ? x.tally : x;
          const place = `${x.place}${x.tied ? '=' : ''}`;
          const mine = 'pid' in x ? x.pid === me : ('grp' in x && !!me && x.grp.players.includes(me));
          return (
            <div className={`lb-row${mine ? ' me' : ''}`} key={x.key}>
              <span className="lb-place">{place}</span>
              {'pid' in x
                ? <Avatar p={PL(x.pid)} size="sm" />
                : <div className={`team-dot sm t${x.t}`}>{gname(x.grp, x.t).replace('Team ', '')}</div>}
              <div className="lb-who">
                <b>{'pid' in x ? first(x.pid) : gname(x.grp, x.t)}</b>
                <small>
                  {'pid' in x ? `PH ${phFor(S, x.pid, r.id)}` : x.grp.players.map(first).join(' · ')}
                  {t.complete ? ` · ${t.strokes} strokes` : ` · thru ${t.played}`}
                </small>
              </div>
              <span className="lb-pts">{t.pts}<small>pts</small></span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Live scorecard: gross + stableford points per hole for the selected group (or teams).
export function LiveScorecard({ r, group, selHole, onHole }: { r: Round; group: number; selHole?: number; onHole?: (n: number) => void }) {
  const { S } = useStore();
  const scramble = r.format === 'scramble';
  const groups = groupsFor(S, r.id);
  const g = groups[group] || groups[0];
  const cols: { label: string; tally: Tally }[] = scramble
    ? groups.map((grp, t) => ({ label: gname(grp, t).replace('Team ', ''), tally: teamTally(S, r.id, t) }))
    : g.players.map((pid) => ({ label: first(pid), tally: playerTally(S, r.id, pid) }));

  const cell = (row: Tally['rows'][number], key: number) =>
    row.gross === null
      ? <td className="e" key={key}>·</td>
      : <td key={key} className={row.pts === 0 ? 'z' : (row.pts ?? 0) >= 3 ? 'g' : ''}>{row.gross}<sup>{row.pts}</sup></td>;

  const sumRow = (label: string, from: number, to: number) => (
    <tr className="sum" key={label}>
      <td>{label}</td>
      <td>{r.holes.slice(from, to).reduce((a, x) => a + x.par, 0)}</td>
      <td />
      {cols.map((c, k) => {
        const pl = c.tally.rows.slice(from, to).filter((x) => x.gross !== null);
        return <td key={k}>{pl.length ? <>{pl.reduce((a, x) => a + (x.gross ?? 0), 0)}<sup>{pl.reduce((a, x) => a + (x.pts ?? 0), 0)}</sup></> : '·'}</td>;
      })}
    </tr>
  );

  return (
    <>
      <div className="section-title"><h2>Scorecard</h2><span className="eyebrow">{scramble ? 'team gross · points' : gname(g, group) + ' · gross · points'}</span></div>
      <div className="sc-wrap">
        <table className="sc">
          <thead>
            <tr>
              <th>Hole</th><th>Par</th><th>SI</th>
              {cols.map((c, k) => (
                <th key={k}>{c.label}{!scramble && <span className="ph">PH {phFor(S, g.players[k], r.id)}</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.holes.flatMap((hh, i) => {
              const tr = (
                <tr key={hh.n} className={hh.n === selHole ? 'cur' : ''} onClick={onHole ? () => onHole(hh.n) : undefined} style={onHole ? { cursor: 'pointer' } : undefined}>
                  <td>{hh.n}</td><td>{hh.par}</td><td>{hh.si}</td>
                  {cols.map((c, k) => cell(c.tally.rows[i], k))}
                </tr>
              );
              return i === 8 ? [tr, sumRow('Out', 0, 9)] : [tr];
            })}
            {sumRow('In', 9, 18)}
            {sumRow('Total', 0, 18)}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function RoundHead({ r, status }: { r: Round; status: 'done' | 'partial' | 'none' }) {
  return (
    <div className="round-head">
      <span className="eyebrow">Round {r.n} · {r.dow} {r.dnum} {r.mon} · {r.town}</span>
      <h2>{r.club}</h2>
      <div className="itin-meta">
        <span className="chip">Par {r.par}</span>
        <FormatChips r={r} />
        <span className="chip ghost">{status === 'done' ? 'Round complete' : status === 'partial' ? 'In progress' : 'Not started'}</span>
      </div>
    </div>
  );
}

export function useRound(rid: string | undefined): Round | undefined {
  return rid ? R(rid) : undefined;
}
