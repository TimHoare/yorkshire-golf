// Group selection: a manual editor. Tap two names to swap them; saved groups
// are shared to every phone.
import { useState } from 'react';
import { PL, first, gname, type Round } from '../data/trip';
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
  const [groups, setGroups] = useState(() => groupsFor(S, r.id).map((g) => [...g.players]));
  const [sel, setSel] = useState<[number, number] | null>(null);

  const tap = (gi: number, pi: number) => {
    if (!sel) { setSel([gi, pi]); return; }
    const [sgi, spi] = sel;
    if (sgi === gi && spi === pi) { setSel(null); return; }
    const next = groups.map((g) => [...g]);
    [next[sgi][spi], next[gi][pi]] = [next[gi][pi], next[sgi][spi]];
    setGroups(next);
    setSel(null);
  };
  const save = () => { setGroupDraw(r.id, groups); toast('Groups saved — on every phone now'); onClose(); };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>Set the {r.format === 'scramble' ? 'teams' : 'groups'}</h2>
        <p className="small muted">Tap two names to swap them.</p>
        <div className="draw-groups">
          {groups.map((grp, gi) => (
            <div className="draw-group" key={gi}>
              <div className="eyebrow">{gname(groupsFor(S, r.id)[gi], gi)} · {groupsFor(S, r.id)[gi].tee}</div>
              <div className="draw-slots">
                {grp.map((pid, pi) => (
                  <button
                    className={`draw-slot pick${sel && sel[0] === gi && sel[1] === pi ? ' sel' : ''}`}
                    onClick={() => tap(gi, pi)} key={pid}
                  >
                    <Avatar p={PL(pid)} size="sm" /><b>{first(pid)}</b>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn primary grow" onClick={save}>Save</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
