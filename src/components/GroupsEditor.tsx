// Group selection: pick names into groups the way you'd read out a tee sheet.
// Tap a name in the pool to drop it into the highlighted slot; tap a placed
// name to send it back. Saved groups are shared to every phone.
import { useState } from 'react';
import { PL, first, gname, playerIdx, type Round } from '../data/trip';
import { groupsFor } from '../lib/scoring';
import { setGroupDraw } from '../lib/store';
import { toast } from '../lib/toast';
import { useStore } from '../lib/useStore';
import { Avatar } from './Avatar';

export function GroupsTools({ r }: { r: Round }) {
  const { S } = useStore();
  const [editing, setEditing] = useState(false);
  const set = !!S.groups[r.id];
  const label = r.format === 'scramble' ? 'teams' : 'groups';
  const clear = () => {
    if (!confirm(`Clear the ${label} for this round?`)) return;
    setGroupDraw(r.id, null);
    toast(`${label[0].toUpperCase() + label.slice(1)} cleared`);
  };
  return (
    <>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn primary sm" onClick={() => setEditing(true)}>{set ? `Change ${label}` : `Set ${label}`}</button>
        {set && <button className="btn ghost sm" onClick={clear}>Clear</button>}
      </div>
      {editing && <EditSheet r={r} onClose={() => setEditing(false)} />}
    </>
  );
}

function EditSheet({ r, onClose }: { r: Round; onClose: () => void }) {
  const { S } = useStore();
  const template = groupsFor(S, r.id);
  const everyone = template.flatMap((g) => g.players).sort((a, b) => playerIdx(a) - playerIdx(b));
  const scramble = r.format === 'scramble';
  const label = scramble ? 'teams' : 'groups';

  // Slots per group; groups already saved open as they stand, otherwise empty.
  const [placed, setPlaced] = useState<(string | null)[][]>(() =>
    S.groups[r.id]
      ? template.map((g) => [...g.players])
      : template.map((g) => g.players.map(() => null)));
  // Which group fills next. Auto-advances, but tapping a group aims at it.
  const [aim, setAim] = useState<number | null>(null);

  const pool = everyone.filter((pid) => !placed.some((g) => g.includes(pid)));
  const targetG = (from: number | null) => {
    if (from !== null && placed[from].includes(null)) return from;
    const i = placed.findIndex((g) => g.includes(null));
    return i < 0 ? null : i;
  };
  const target = targetG(aim);
  const done = pool.length === 0;

  const place = (pid: string) => {
    if (target === null) return;
    const next = placed.map((g) => [...g]);
    next[target][next[target].indexOf(null)] = pid;
    setPlaced(next);
    // Stay on the aimed group while it has room, then fall back to auto.
    if (aim !== null && !next[aim].includes(null)) setAim(null);
  };
  const unplace = (gi: number, pi: number) => {
    const next = placed.map((g) => [...g]);
    next[gi].splice(pi, 1);
    next[gi].push(null);
    setPlaced(next);
  };
  const startOver = () => { setPlaced(template.map((g) => g.players.map(() => null))); setAim(null); };
  const save = () => {
    setGroupDraw(r.id, placed as string[][]);
    toast(`${scramble ? 'Teams' : 'Groups'} saved — on every phone now`);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>Pick the {label}</h2>
        <p className="small muted">
          {done ? 'Tap a name to take them back out.' : 'Tap names to fill the highlighted spot. Tap a group to aim at it.'}
        </p>

        <div className={`pool${done ? ' done' : ''}`}>
          {pool.length > 0
            ? pool.map((pid) => (
                <button className="pool-chip" onClick={() => place(pid)} key={pid}>
                  <Avatar p={PL(pid)} size="sm" /><b>{first(pid)}</b>
                </button>
              ))
            : <span className="small muted">Everyone's in — check it over, then save.</span>}
        </div>

        <div className="draw-groups">
          {placed.map((grp, gi) => (
            <div
              className={`draw-group${gi === target ? ' aimed' : ''}`}
              onClick={() => { if (placed[gi].includes(null)) setAim(gi); }}
              key={gi}
            >
              <div className="eyebrow">{gname(template[gi], gi)} · {template[gi].tee}</div>
              <div className="draw-slots">
                {grp.map((pid, pi) =>
                  pid ? (
                    <button className="draw-slot pick" onClick={(e) => { e.stopPropagation(); unplace(gi, pi); }} key={pid}>
                      <Avatar p={PL(pid)} size="sm" /><b>{first(pid)}</b><span className="x" aria-hidden>×</span>
                    </button>
                  ) : (
                    <div className={`draw-slot empty${gi === target && pi === grp.indexOf(null) ? ' next' : ''}`} key={`e${pi}`}>
                      {gi === target && pi === grp.indexOf(null) ? 'next up' : '·'}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn primary grow" onClick={save} disabled={!done}>
            {done ? `Save ${label}` : `${everyone.length - pool.length} of ${everyone.length} placed`}
          </button>
          {placed.flat().some(Boolean) && <button className="btn ghost" onClick={startOver}>Start over</button>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
