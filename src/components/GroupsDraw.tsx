// Group selection: a dramatic in-app draw (random day 1, repeat-avoiding after
// that, standings-seeded on scramble day) or a manual editor. Draws are shared
// to every phone once sealed.
import { useEffect, useRef, useState } from 'react';
import { PL, first, gname, type Round } from '../data/trip';
import { drawGroups } from '../lib/draw';
import { groupsFor } from '../lib/scoring';
import { setGroupDraw } from '../lib/store';
import { toast } from '../lib/toast';
import { useStore } from '../lib/useStore';
import { Avatar } from './Avatar';

export function GroupsTools({ r }: { r: Round }) {
  const { S } = useStore();
  const [mode, setMode] = useState<'draw' | 'edit' | null>(null);
  const drawn = !!S.groups[r.id];
  const label = r.format === 'scramble' ? 'teams' : 'groups';
  const clear = () => {
    if (!confirm(`Clear the ${label} for this round?`)) return;
    setGroupDraw(r.id, null);
    toast(`${label[0].toUpperCase() + label.slice(1)} cleared`);
  };
  return (
    <>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn primary sm" onClick={() => setMode('draw')}>{drawn ? `Redraw ${label}` : `Draw ${label}`}</button>
        <button className="btn ghost sm" onClick={() => setMode('edit')}>Set manually</button>
        {drawn && <button className="btn ghost sm" onClick={clear}>Clear</button>}
      </div>
      {mode === 'draw' && <DrawSheet r={r} onClose={() => setMode(null)} />}
      {mode === 'edit' && <EditSheet r={r} onClose={() => setMode(null)} />}
    </>
  );
}

// ---------- The dramatic draw ----------
const SPIN_MS = 1600;   // per name, before it locks
const TICK0 = 60;       // flicker interval at full speed

function DrawSheet({ r, onClose }: { r: Round; onClose: () => void }) {
  const { S } = useStore();
  const [result] = useState(() => drawGroups(S, r.id));
  const slots = result.flat();
  const [locked, setLocked] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [flick, setFlick] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const scramble = r.format === 'scramble';

  // One press, one name: flicker through the names still in the hat, slowing
  // until the next one lands.
  const drawNext = () => {
    if (spinning || locked >= slots.length) return;
    setSpinning(true);
    const pool = slots.slice(locked);
    let i = 0, elapsed = 0;
    const tick = () => {
      const speed = TICK0 + Math.pow(elapsed / SPIN_MS, 2) * 260;
      setFlick(first(pool[i++ % pool.length]));
      elapsed += speed;
      if (elapsed < SPIN_MS) timer.current = setTimeout(tick, speed);
      else timer.current = setTimeout(() => { setFlick(''); setSpinning(false); setLocked((n) => n + 1); }, 160);
    };
    tick();
  };

  const done = locked >= slots.length;
  const seal = () => { setGroupDraw(r.id, result); toast(`${scramble ? 'Teams' : 'Groups'} drawn — on every phone now`); onClose(); };

  let n = 0;
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>The draw</h2>
        <p className="small muted">
          {scramble
            ? 'Seeded off the standings — 1st plays with 8th, 2nd with 7th…'
            : r.n === 1 ? 'Straight out of the hat.' : 'Weighted so nobody keeps getting the same faces.'}
        </p>
        <div className="draw-groups">
          {result.map((grp, t) => (
            <div className="draw-group" key={t}>
              <div className="eyebrow">{gname(groupsFor(S, r.id)[t], t)} · {groupsFor(S, r.id)[t].tee}</div>
              <div className="draw-slots">
                {grp.map((pid) => {
                  const k = n++;
                  const isLocked = k < locked;
                  const isSpinning = k === locked && spinning;
                  return (
                    <div className={`draw-slot${isLocked ? ' locked' : ''}${isSpinning ? ' spinning' : ''}`} key={pid}>
                      {isLocked ? <><Avatar p={PL(pid)} size="sm" /><b>{first(pid)}</b></>
                        : isSpinning ? <span className="flick">{flick || '…'}</span>
                        : <span className="tbd">?</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          {done
            ? <>
                <button className="btn primary grow" onClick={seal}>Seal the draw</button>
                <button className="btn ghost" onClick={onClose}>Discard</button>
              </>
            : <>
                <button className="btn primary grow" onClick={drawNext} disabled={spinning}>
                  {spinning ? 'Drawing…' : locked === 0 ? 'Draw the first name' : 'Draw the next name'}
                </button>
                <button className="btn ghost" onClick={onClose}>Cancel</button>
              </>}
        </div>
      </div>
    </div>
  );
}

// ---------- Manual entry ----------
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
