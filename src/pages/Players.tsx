import { PLAYERS, ROUNDS } from '../data/trip';
import { courseHandicap, currentIndex, fmt1, roundStatus, signed } from '../lib/scoring';
import { useStore } from '../lib/useStore';
import { Avatar } from '../components/Avatar';

export function PlayersPage() {
  const { S, me } = useStore();
  const nextRound = ROUNDS.find((r) => roundStatus(S, r.id) !== 'done') || ROUNDS[ROUNDS.length - 1];
  return (
    <>
      <div className="section-title"><h2>Players</h2><span className="eyebrow">{PLAYERS.length} on tour</span></div>
      <div className="player-list">
        {PLAYERS.map((p) => {
          const cur = currentIndex(S, p.id);
          const d = cur - p.start;
          const ch = courseHandicap(cur, nextRound.id);
          return (
            <div className="player-row" key={p.id}>
              <Avatar p={p} />
              <div style={{ minWidth: 0 }}>
                <div className="pname">{p.name}{p.id === me && <> <span className="chip you">you</span></>}</div>
                <div className="sub">
                  Started {fmt1(p.start)} <span className={`delta ${d < 0 ? 'down' : d > 0 ? 'up' : 'flat'}`}>{signed(d)}</span> · CH {ch} at {nextRound.short}
                </div>
              </div>
              <div className="index-now"><div className="v">{fmt1(cur)}</div><div className="l">index</div></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
