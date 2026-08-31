// Score entry, England Golf style: swipe left/right between holes, − / +
// scores against par (first + records par, first − a birdie). The hole lives
// in the URL (replace, not push) so refresh restores it and history stays clean.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { R, PL, first, gname, type Hole, type Round } from '../data/trip';
import {
  firstUnfinishedHole, groupsFor, holesOf, playerTally, relPar, teamHandicap, teamHoles, teamTally,
} from '../lib/scoring';
import { setGross } from '../lib/store';
import { useStore } from '../lib/useStore';
import type { TripState } from '../lib/state';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { LiveScorecard } from '../components/RoundBits';

type Target = { pid: string } | { team: number };

function Stepper({ rid, target, holeIdx, gross, par }: { rid: string; target: Target; holeIdx: number; gross: number | null; par: number }) {
  // from empty: + records par, − records a birdie; then ±1 per tap
  const step = (d: number) => {
    let next: number | null = gross === null ? (d > 0 ? par : par - 1) : gross + d;
    if (next !== null && next < 1) next = null;
    setGross(rid, target, holeIdx, next);
  };
  return (
    <div className="stepper" aria-label="Strokes">
      <button onClick={() => step(-1)} aria-label="One stroke fewer">−</button>
      <input
        type="number" inputMode="numeric" min={1} max={20}
        placeholder={String(par)} value={gross ?? ''}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          setGross(rid, target, holeIdx, Number.isNaN(n) ? null : n);
        }}
      />
      <button onClick={() => step(1)} aria-label="One stroke more">+</button>
    </div>
  );
}

function Slide({ S, r, group, h }: { S: TripState; r: Round; group: number; h: Hole }) {
  const i = h.n - 1;
  const scramble = r.format === 'scramble';
  const g = groupsFor(S, r.id)[group];

  const row = (who: React.ReactNode, name: string, sub: React.ReactNode, target: Target, gross: number | null, pts: number | null) => (
    <div className="score-row" key={name}>
      <div className="who">{who}<div style={{ minWidth: 0 }}><div className="n">{name}</div><div className="h">{sub}</div></div></div>
      <Stepper rid={r.id} target={target} holeIdx={i} gross={gross} par={h.par} />
      <div className={`hp${gross === null ? ' off' : ''}`}>{gross === null ? '–' : pts}<small>pts</small></div>
    </div>
  );

  const relBit = (gross: number | null) => {
    if (gross === null) return null;
    const [label, cls] = relPar(gross - h.par);
    return <><b className={`rel ${cls}`}>{label}</b> · </>;
  };
  const shotsBit = (shots: number) => shots
    ? <><b>{shots} shot{shots > 1 ? 's' : ''}</b> · </>
    : null;

  return (
    <section className="slide" data-slide={h.n}>
      <div className="hole-head">
        <div><span className="eyebrow">Hole</span><div className="hn">{h.n}</div></div>
        <div className="hf">
          <span>Par <b>{h.par}</b></span>
          {h.yds && <span><b>{h.yds}</b> yds</span>}
          <span>SI <b>{h.si}</b></span>
        </div>
        <div className="hnav" />
      </div>
      <div className="score-list">
        {scramble
          ? (() => {
              const t = teamTally(S, r.id, group);
              const tr = t.rows[i];
              return row(
                <div className={`team-dot t${group}`}>{String.fromCharCode(65 + group)}</div>,
                gname(g, group),
                <>{g.players.map(first).join(' · ')}<br />{relBit(tr.gross)}{shotsBit(tr.shots)}team hcp {teamHandicap(S, r.id, group)}</>,
                { team: group }, tr.gross, tr.pts,
              );
            })()
          : g.players.map((pid) => {
              const t = playerTally(S, r.id, pid);
              const tr = t.rows[i];
              return row(
                <Avatar p={PL(pid)} />,
                first(pid),
                <>{relBit(tr.gross)}{tr.shots ? shotsBit(tr.shots) : 'no shot · '}{t.pts} pts thru {t.played}</>,
                { pid }, tr.gross, tr.pts,
              );
            })}
      </div>
    </section>
  );
}

export function ScoringPage() {
  const { rid, hole } = useParams();
  const navigate = useNavigate();
  const { S, me } = useStore();
  const r = rid ? R(rid) : undefined;

  const groups = r ? groupsFor(S, r.id) : [];
  const myGroup = r ? Math.max(0, groups.findIndex((g) => !!me && g.players.includes(me))) : 0;
  const [group, setGroup] = useState(myGroup);
  const scramble = r?.format === 'scramble';
  const g = groups[group] || groups[0];

  const holeN = Number(hole);
  const valid = holeN >= 1 && holeN <= 18;

  // Swipe carousel: keep scroll position in step with the hole in the URL.
  const swipeRef = useRef<HTMLDivElement>(null);
  const settleT = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const el = swipeRef.current;
    if (!el || !valid) return;
    const want = (holeN - 1) * el.clientWidth;
    if (Math.abs(el.scrollLeft - want) > 2) el.scrollLeft = want;
  }, [holeN, valid, group]);

  if (!r || !g) return <Navigate to="/trip" replace />;
  if (!valid) return <Navigate to={`/round/${r.id}/score/${firstUnfinishedHole(S, r.id, myGroup)}`} replace />;

  const goHole = (n: number) => {
    if (n >= 1 && n <= 18) navigate(`/round/${r.id}/score/${n}`, { replace: true });
  };
  const onScroll = () => {
    clearTimeout(settleT.current);
    settleT.current = setTimeout(() => {
      const el = swipeRef.current;
      if (!el) return;
      const n = Math.round(el.scrollLeft / el.clientWidth) + 1;
      if (n !== holeN) goHole(n);
    }, 120);
  };

  const chipState = (h: Hole) => {
    const filled = scramble
      ? teamHoles(S, r.id, group)[h.n - 1] !== null
      : g.players.every((pid) => holesOf(S, r.id, pid)[h.n - 1] !== null);
    const some = scramble ? filled : g.players.some((pid) => holesOf(S, r.id, pid)[h.n - 1] !== null);
    return `hole-chip ${h.n === holeN ? 'on' : ''} ${filled ? 'done' : some ? 'part' : ''}`;
  };

  return (
    <>
      <BackButton to={`/round/${r.id}`} label={r.short} />
      <div className="score-page-head">
        <h2>Enter scores</h2>
        {groups.length > 1 && (
          <div className="seg">
            {groups.map((grp, t) => (
              <button key={t} className={t === group ? 'on' : ''} onClick={() => setGroup(t)}>
                {groups.length > 2 ? gname(grp, t).replace(/^Team /, '') : gname(grp, t)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="hole-chips">
        {r.holes.map((h) => (
          <button key={h.n} className={chipState(h)} onClick={() => goHole(h.n)}>{h.n}</button>
        ))}
      </div>
      <p className="swipe-hint small muted">Swipe between holes · − and + set the score against par</p>
      <div className="swipe" ref={swipeRef} onScroll={onScroll}>
        {r.holes.map((h) => <Slide key={h.n} S={S} r={r} group={group} h={h} />)}
      </div>
      <LiveScorecard r={r} group={group} selHole={holeN} onHole={goHole} />
    </>
  );
}
