// Round info page: course facts, map link, your course handicap, groups with
// everyone's course handicaps, the course card, and pairs/scramble widgets.
import { Link, Navigate, useParams } from 'react-router-dom';
import { R, PL, first, gname } from '../data/trip';
import { courseHandicap, groupsFor, indexBefore, phFor, roundStatus, shotsOn, teamHandicap, fmt1 } from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { Leaderboard, PairsBox, RoundHead, ScrambleResult } from '../components/RoundBits';
import { GroupsTools } from '../components/GroupsEditor';
import { BetsSection } from '../components/Bits';

export function RoundPage() {
  const { rid } = useParams();
  const { S, me } = useStore();
  const r = rid ? R(rid) : undefined;
  if (!r) return <Navigate to="/trip" replace />;

  const scramble = r.format === 'scramble';
  const yardsKnown = r.holes.every((h) => h.yds);
  const totalYds = yardsKnown ? r.holes.reduce((a, h) => a + (h.yds ?? 0), 0) : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.club + ', ' + r.address)}`;
  const groups = groupsFor(S, r.id);
  const drawn = !!S.groups[r.id];
  const status = roundStatus(S, r.id);
  const playing = me && me !== 'watcher' && groups.some((g) => g.players.includes(me));

  // Your playing handicap here, for marking shot holes on the course card
  // (individual formats only — the scramble plays off a team handicap).
  const myPh = playing && !scramble ? phFor(S, me!, r.id) : null;

  const nine = (label: string, from: number, to: number) => (
    <tr className="sum" key={label}>
      <td>{label}</td>
      <td>{r.holes.slice(from, to).reduce((a, x) => a + x.par, 0)}</td>
      <td>{yardsKnown ? r.holes.slice(from, to).reduce((a, x) => a + (x.yds ?? 0), 0).toLocaleString() : ''}</td>
      <td />
      {myPh !== null && <td>{r.holes.slice(from, to).reduce((a, x) => a + Math.max(0, shotsOn(myPh, x.si)), 0)}</td>}
    </tr>
  );

  return (
    <>
      <BackButton to="/trip" label="Trip" />
      <RoundHead r={r} status={roundStatus(S, r.id)} />
      <div className="btn-row" style={{ margin: '14px 0 4px' }}>
        {drawn
          ? <Link className="btn primary grow" to={`/round/${r.id}/score`}>Enter scores</Link>
          : <button className="btn primary grow" disabled title={`Set the ${scramble ? 'teams' : 'groups'} first`}>Enter scores</button>}
        <a className="btn ghost" href={mapsUrl} target="_blank" rel="noopener noreferrer">Map ↗</a>
      </div>
      {!drawn && <p className="small muted" style={{ margin: '0 0 4px' }}>Scoring opens once the {scramble ? 'teams' : 'groups'} are set below.</p>}

      {playing && (
        <div className="my-ch card">
          <div className="v">{courseHandicap(indexBefore(S, me!, r.id), r.id)}</div>
          <div>
            <span className="eyebrow">Your course handicap here</span>
            <div className="my-ch-sub">
              Off a {fmt1(indexBefore(S, me!, r.id))} index{!scramble && <> · PH {phFor(S, me!, r.id)}</>}
            </div>
          </div>
        </div>
      )}

      <Leaderboard r={r} />

      <div className="course-facts card">
        <div className="cf"><span className="l">Par</span><b>{r.par}</b></div>
        {totalYds && <div className="cf"><span className="l">{r.tees} tees</span><b>{totalYds.toLocaleString()} yds</b></div>}
        <div className="cf"><span className="l">Rating</span><b>{r.cr}</b></div>
        <div className="cf"><span className="l">Slope</span><b>{r.slope}</b></div>
      </div>

      <div className="section-title"><h2>{scramble ? 'Teams' : 'Groups'}</h2><span className="eyebrow">tee times · course hcp</span></div>
      <div className="groups">
        {groups.map((grp, t) => (
          <div className="group-card" key={t}>
            <div className="tee">{grp.tee}</div>
            <div className="gbody">
              <div className="gname">
                {gname(grp, t)}{scramble && drawn && <> <span className="chip gorse">team hcp {teamHandicap(S, r.id, t)}</span></>}
              </div>
              {drawn ? (
                <div className="gmembers">
                  {grp.players.map((pid) => (
                    <span className={`gm${pid === me ? ' me' : ''}`} key={pid}>
                      <Avatar p={PL(pid)} size="sm" />
                      <span><b>{first(pid)}</b> <small>{courseHandicap(indexBefore(S, pid, r.id), r.id)}</small></span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="small muted" style={{ marginTop: 4 }}>To be set</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {status === 'none' && <GroupsTools r={r} />}

      <div className="section-title"><h2>Course</h2><span className="eyebrow">{yardsKnown ? r.tees + ' tees' : 'par · stroke index'}{myPh !== null ? ` · your shots off PH ${myPh}` : ''}</span></div>
      <div className="sc-wrap">
        <table className="sc course-sc">
          <thead><tr><th>Hole</th><th>Par</th><th>{yardsKnown ? 'Yards' : ''}</th><th>SI</th>{myPh !== null && <th>Shots</th>}</tr></thead>
          <tbody>
            {r.holes.flatMap((h, i) => {
              const shots = myPh !== null ? Math.max(0, shotsOn(myPh, h.si)) : 0;
              const tr = (
                <tr key={h.n} className={shots ? 'shot-hole' : ''}>
                  <td>{h.n}</td><td>{h.par}</td><td>{h.yds ?? ''}</td><td>{h.si}</td>
                  {myPh !== null && <td className="shot-dots">{'●'.repeat(shots)}</td>}
                </tr>
              );
              return i === 8 ? [tr, nine('Out', 0, 9)] : [tr];
            })}
            {nine('In', 9, 18)}
            {nine('Total', 0, 18)}
          </tbody>
        </table>
      </div>

      <BetsSection r={r} />
      {r.pairs && <PairsBox r={r} />}
      {scramble && <ScrambleResult r={r} />}
    </>
  );
}
