import { ROUNDS, pName, PL } from '../data/trip';
import {
  currentIndex, fmt1, playerTally, roundPlace, roundPoints, roundStatus,
  scrambleResults, signed, standings, trim,
} from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { Avatar } from '../components/Avatar';
import { PairList } from '../components/RoundBits';

export function StandingsPage() {
  const { S, me } = useStore();
  const st = standings(S);
  const anyPts = st.some((r) => r.pts > 0);
  const doneCount = ROUNDS.filter((r) => roundStatus(S, r.id) === 'done').length;

  return (
    <>
      <div className="section-title"><h2>Standings</h2><span className="eyebrow">{doneCount} of {ROUNDS.length} rounds in</span></div>
      {!anyPts && <div className="empty">No results yet. Once a round's scores are in, week points appear here.</div>}
      <div className="lb">
        {st.map((row) => {
          const p = PL(row.pid);
          const cur = currentIndex(S, row.pid);
          const d = cur - p.start;
          return (
            <div className="lb-row" key={row.pid}>
              <Avatar p={p} badge={<em className={row.rank === 1 && anyPts ? 'lead' : ''}>{row.rank}</em>} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{pName(row.pid)}{row.pid === me && <> <span className="chip you">you</span></>}</div>
                <div className="meta">
                  <span className="dots">
                    {ROUNDS.map((rd) => {
                      if (rd.format === 'scramble') {
                        const sr = scrambleResults(S, rd.id).rows[row.pid];
                        return <i key={rd.id} className={sr?.won ? 'win' : ''} title={`Round ${rd.n}`}>{sr ? (sr.won ? 'W' : sr.tie ? '=' : 'L') : ''}</i>;
                      }
                      const pl = roundPlace(S, rd.id, row.pid);
                      return <i key={rd.id} className={pl ? 'p' + Math.min(pl, 4) : ''} title={`Round ${rd.n}`}>{pl ?? ''}</i>;
                    })}
                  </span>
                  <span className="idx-cell">
                    <span className="v">index {fmt1(cur)} <small className={d < 0 ? 'delta down' : d > 0 ? 'delta up' : ''}>{d !== 0 ? signed(d) : ''}</small></span>
                  </span>
                </div>
              </div>
              <div className="pts">{trim(row.pts)}<small>pts</small></div>
            </div>
          );
        })}
      </div>

      <div className="section-title"><h2>Round by round</h2><span className="eyebrow">stableford (week pts)</span></div>
      <div className="card table-wrap">
        <table className="rounds-table">
          <thead>
            <tr><th>Player</th>{ROUNDS.map((r) => <th key={r.id}>{r.short}</th>)}<th>Total</th></tr>
          </thead>
          <tbody>
            {st.map((row) => (
              <tr key={row.pid}>
                <td>{pName(row.pid)}</td>
                {ROUNDS.map((rd) => {
                  if (rd.format === 'scramble') {
                    const sr = scrambleResults(S, rd.id).rows[row.pid];
                    return <td key={rd.id}>{sr ? <><span className={sr.won ? 'win' : ''}>{sr.won ? 'W' : sr.tie ? '=' : 'L'}</span> <span className="pt">({trim(sr.points)})</span></> : '·'}</td>;
                  }
                  const t = playerTally(S, rd.id, row.pid);
                  const rp = roundPoints(S, rd.id, row.pid);
                  return <td key={rd.id}>{t.played === 0 ? '·' : <>{t.pts}{t.complete ? '' : '*'} <span className="pt">({trim(rp ?? 0)})</span></>}</td>;
                })}
                <td><b>{trim(row.pts)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>* round in progress</p>

      {ROUNDS.filter((r) => r.pairs && S.pairs[r.id]?.revealed).map((r) => (
        <div key={r.id}>
          <div className="section-title"><h2>Pairs · {r.short}</h2><span className="eyebrow">combined points</span></div>
          <div className="pairs-box" style={{ marginTop: 0 }}><PairList rid={r.id} /></div>
        </div>
      ))}
    </>
  );
}
