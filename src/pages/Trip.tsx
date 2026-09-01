import { Link } from 'react-router-dom';
import { ROUNDS, RULES, first, gname } from '../data/trip';
import { groupsFor, roundStatus } from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { FormatChips } from '../components/RoundBits';

export function TripPage() {
  const { S } = useStore();
  return (
    <>
      <div className="section-title"><h2>Rounds</h2><span className="eyebrow">tap a round for details</span></div>
      <div className="itin">
        {ROUNDS.map((r) => (
          <Link className="itin-day" to={`/round/${r.id}`} key={r.id}>
            <div className="itin-date">
              <span className="n">{r.dnum}</span>
              <span className="m">{r.dow}</span>
              <span className={`st ${roundStatus(S, r.id)}`} />
            </div>
            <div className="itin-body">
              <h3>{r.club}</h3>
              <div className="itin-meta"><span className="chip">Par {r.par}</span><FormatChips r={r} /></div>
              <div className="itin-groups">
                {groupsFor(S, r.id).map((g, t) => (
                  <div className="itin-group" key={t}>
                    <b>{g.tee}</b>
                    <span>
                      {g.name ? <><i>{gname(g, t)}</i> · </> : null}
                      {S.groups[r.id] ? g.players.map(first).join(', ') : <span className="muted">To be set</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        ))}
      </div>
      <p className="small muted rules-note">
        Week points {RULES.placePoints.join(' · ')} for 1st–4th each round (ties share); scramble winners {RULES.scrambleWin} each.
        Handicap index moves ±0.5 per stableford point either side of {RULES.par} after every completed round.
      </p>
    </>
  );
}
