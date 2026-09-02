// Score entry, England Golf style: swipe left/right between holes, − / +
// scores against par (first + records par, first − a birdie). The hole lives
// in the URL (replace, not push) so refresh restores it and history stays clean.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { R, PL, first, gname, type Hole, type Round } from '../data/trip';
import {
  firstUnfinishedHole, flightName, flightsFor, groupsFor, holesOf, playerTally, relPar,
  teamHandicap, teamHoles, teamTally,
} from '../lib/scoring';
import { setGross } from '../lib/store';
import { useStore } from '../lib/useStore';
import type { TripState } from '../lib/state';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { LiveScorecard } from '../components/RoundBits';
import { GroupBet, HoleBitsPanel } from '../components/Bits';

type Target = { pid: string } | { team: number };

function Stepper({ rid, target, holeIdx, gross, par, readOnly }: { rid: string; target: Target; holeIdx: number; gross: number | null; par: number; readOnly: boolean }) {
  const pickup = gross === 0;
  // from empty: + records par, − a birdie; then ±1 per tap. Holding − marks a
  // pickup ✕ (typing 0 does too); once picked up, − clears and + restarts at par.
  const step = (d: number) => {
    let next: number | null;
    if (gross === null) next = d > 0 ? par : par - 1;
    else if (pickup) next = d > 0 ? par : null;
    else next = gross + d < 1 ? null : gross + d;
    setGross(rid, target, holeIdx, next);
  };
  const holdT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);
  const holdStart = () => {
    held.current = false;
    holdT.current = setTimeout(() => { held.current = true; setGross(rid, target, holeIdx, 0); }, 550);
  };
  const holdEnd = () => clearTimeout(holdT.current);
  if (readOnly) {
    return <div className="stepper ro" aria-label="Strokes">{pickup ? '✕' : gross ?? '–'}</div>;
  }
  return (
    <div className="stepper" aria-label="Strokes">
      <button
        onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (held.current) { held.current = false; return; } step(-1); }}
        aria-label={pickup ? 'Undo the X' : 'One stroke fewer — hold for a pickup'}
      >−</button>
      {pickup
        ? <span className="pu" aria-label="No score — picked up">✕</span>
        : (
          <input
            type="number" inputMode="numeric" min={1} max={20}
            placeholder={String(par)} value={gross ?? ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              setGross(rid, target, holeIdx, Number.isNaN(n) ? null : n);
            }}
          />
        )}
      <button onClick={() => step(1)} aria-label="One stroke more">+</button>
    </div>
  );
}

function Slide({ S, r, group, h, readOnly }: { S: TripState; r: Round; group: number; h: Hole; readOnly: boolean }) {
  const i = h.n - 1;
  const scramble = r.format === 'scramble';
  const g = groupsFor(S, r.id)[group];

  const row = (who: React.ReactNode, name: string, sub: React.ReactNode, target: Target, gross: number | null, pts: number | null) => (
    <div className="score-row" key={name}>
      <div className="who">{who}<div style={{ minWidth: 0 }}><div className="n">{name}</div><div className="h">{sub}</div></div></div>
      <Stepper rid={r.id} target={target} holeIdx={i} gross={gross} par={h.par} readOnly={readOnly} />
      <div className={`hp${gross === null ? ' off' : ''}`}>{gross === null ? '–' : pts}<small>pts</small></div>
    </div>
  );

  const relBit = (gross: number | null) => {
    if (gross === null) return null;
    if (gross === 0) return <><b className="rel over">Pickup</b> · </>;
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
          ? flightsFor(S, r.id)[group].teams.map((t) => {
              const grp = groupsFor(S, r.id)[t];
              const tt = teamTally(S, r.id, t);
              const tr = tt.rows[i];
              return row(
                <div className={`team-dot t${t}`}>{String.fromCharCode(65 + t)}</div>,
                gname(grp, t),
                <>{grp.players.map(first).join(' · ')}<br />{relBit(tr.gross)}{shotsBit(tr.shots)}Team HCP {teamHandicap(S, r.id, t)}</>,
                { team: t }, tr.gross, tr.pts,
              );
            })
          : g.players.map((pid) => {
              const t = playerTally(S, r.id, pid);
              const tr = t.rows[i];
              return row(
                <Avatar p={PL(pid)} />,
                first(pid),
                <>{relBit(tr.gross)}{tr.shots ? shotsBit(tr.shots) : 'No shot · '}{t.pts} pts thru {t.played}</>,
                { pid }, tr.gross, tr.pts,
              );
            })}
      </div>
      <HoleBitsPanel rid={r.id} group={group} holeIdx={i}
        players={scramble ? flightsFor(S, r.id)[group].players : g.players} readOnly={readOnly} />
    </section>
  );
}

export function ScoringPage() {
  const { rid, hole } = useParams();
  const navigate = useNavigate();
  const { S, me } = useStore();
  const r = rid ? R(rid) : undefined;

  const groups = r ? groupsFor(S, r.id) : [];
  const scramble = r?.format === 'scramble';
  // On scramble day you flip between flights (both teams off one tee, one
  // scorer for the four); otherwise between tee groups.
  const flights = scramble && r ? flightsFor(S, r.id) : [];
  const units: { tee: string; players: string[] }[] = scramble ? flights : groups;
  // -1 for a watcher (or an unpicked phone): they can look, not score.
  const myGroupIdx = units.findIndex((u) => !!me && me !== 'watcher' && u.players.includes(me));
  const myGroup = Math.max(0, myGroupIdx);
  const [group, setGroup] = useState(myGroup);
  const g = groups[group] || groups[0];
  const canEdit = group === myGroupIdx;
  const uname = (t: number) => (scramble && r ? flightName(S, r.id, t) : gname(groups[t], t));

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
  if (!S.groups[r.id]) return <Navigate to={`/round/${r.id}`} replace />;
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
    const teamIn = (t: number) => teamHoles(S, r.id, t)[h.n - 1] !== null;
    const filled = scramble
      ? flights[group].teams.every(teamIn)
      : g.players.every((pid) => holesOf(S, r.id, pid)[h.n - 1] !== null);
    const some = scramble
      ? flights[group].teams.some(teamIn)
      : g.players.some((pid) => holesOf(S, r.id, pid)[h.n - 1] !== null);
    return `hole-chip ${h.n === holeN ? 'on' : ''} ${filled ? 'done' : some ? 'part' : ''}`;
  };

  return (
    <>
      <BackButton to={`/round/${r.id}`} label={r.short} />
      <div className="score-page-head">
        <h2>Enter scores</h2>
        {units.length > 1 && (
          <div className="seg">
            {units.map((u, t) => (
              <button key={t} className={t === group ? 'on' : ''} onClick={() => setGroup(t)}>
                {scramble ? `${uname(t).replace('Teams ', '')} · ${u.tee}` : gname(groups[t], t)}
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
      <p className="swipe-hint small muted">
        {canEdit
          ? 'Swipe between holes · − and + set the score against par · hold − for a pickup ✕'
          : myGroupIdx < 0
            ? 'Watching only — scores go in on the players’ phones'
            : `${uname(group)}’s card — you enter scores for your own ${scramble ? 'flight' : 'group'}`}
      </p>
      <div className="swipe" ref={swipeRef} onScroll={onScroll}>
        {r.holes.map((h) => <Slide key={h.n} S={S} r={r} group={group} h={h} readOnly={!canEdit} />)}
      </div>
      <LiveScorecard r={r} group={group} selHole={holeN} onHole={goHole} />
      <GroupBet r={r} group={group} title={uname(group)} />
    </>
  );
}
