// Side bets: cuckoos (trees), camels (bunkers), fish (water), three-putts.
// Logged hole by hole per tee group — a count per player plus who had the
// last one, so the round ends with a total of each and a payer: the player
// holding the last one puts total × stake into the group bet.
import { useState } from 'react';
import { BITS, PL, first, gname, type Round } from '../data/trip';
import { BIT_KINDS, type BitKind } from '../lib/state';
import { bitsOf, fmtMoney, groupBitTallies, groupsFor, holeBitTotal } from '../lib/scoring';
import { setHoleBits } from '../lib/store';
import { useStore } from '../lib/useStore';
import { Avatar } from './Avatar';

// Per-hole editor shown on each scoring slide: four collapsible rows, one per
// kind. Tap a row to open per-player − / + steppers; + marks that player as
// having the last one, so entering them in the order they happened just works.
export function HoleBitsPanel({ rid, group, holeIdx, players, readOnly }: {
  rid: string; group: number; holeIdx: number; players: string[]; readOnly: boolean;
}) {
  const { S } = useStore();
  const [open, setOpen] = useState<BitKind | null>(null);

  const bump = (kind: BitKind, pid: string, d: number) => {
    const hb = bitsOf(S, rid, group, kind)[holeIdx] || { counts: {}, last: null };
    const c = Math.max(0, (hb.counts[pid] || 0) + d);
    const counts = { ...hb.counts };
    if (c) counts[pid] = c; else delete counts[pid];
    let last = d > 0 ? pid : hb.last;
    if (last && !counts[last]) last = Object.keys(counts)[0] ?? null;
    setHoleBits(rid, group, kind, holeIdx, { counts, last });
  };

  return (
    <div className="bits">
      <div className="bits-head">
        <span className="eyebrow">Group bet · this hole</span>
      </div>
      {BIT_KINDS.map((kind) => {
        const hb = bitsOf(S, rid, group, kind)[holeIdx];
        const total = holeBitTotal(hb);
        const isOpen = open === kind;
        const summary = hb
          ? players.filter((pid) => hb.counts[pid]).map((pid) =>
              first(pid) + (hb.counts[pid] > 1 ? ` ×${hb.counts[pid]}` : '')).join(' · ')
          : '';
        return (
          <div className="bit" key={kind}>
            <button className="bit-row" onClick={() => setOpen(isOpen ? null : kind)} aria-expanded={isOpen}>
              <span className="bit-ic" aria-hidden>{BITS[kind].icon}</span>
              <span className="bit-l"><b>{BITS[kind].label}</b><small>{BITS[kind].desc}</small></span>
              <span className="bit-sum">{summary}</span>
              <span className={`bit-n${total ? '' : ' off'}`}>{total || '–'}</span>
            </button>
            {isOpen && (
              <div className="bit-edit">
                {players.map((pid) => {
                  const n = hb?.counts[pid] || 0;
                  return (
                    <div className="bit-p" key={pid}>
                      <Avatar p={PL(pid)} size="sm" />
                      <span className="bit-pn">
                        {first(pid)}
                        {hb?.last === pid && total > 0 && <span className="chip gorse">Last</span>}
                      </span>
                      {readOnly
                        ? <span className={`bit-n${n ? '' : ' off'}`}>{n || '–'}</span>
                        : (
                          <span className="stepper sm">
                            <button onClick={() => bump(kind, pid, -1)} aria-label={`One ${BITS[kind].one} fewer for ${first(pid)}`}>−</button>
                            <span className={`v${n ? '' : ' off'}`}>{n}</span>
                            <button onClick={() => bump(kind, pid, 1)} aria-label={`One ${BITS[kind].one} more for ${first(pid)}`}>+</button>
                          </span>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Running round tally for one group: totals per kind, who has the last one,
// and what they'd put into the pot at current stakes.
export function GroupBet({ r, group, title }: { r: Round; group: number; title?: string }) {
  const { S } = useStore();
  const rows = groupBitTallies(S, r.id, group).filter((x) => x.total > 0);
  if (!rows.length) return null;

  const owed = new Map<string, number>();
  rows.forEach((x) => {
    if (x.last) owed.set(x.last, (owed.get(x.last) || 0) + x.total * S.stakes[x.kind]);
  });
  const pot = rows.reduce((a, x) => a + x.total * S.stakes[x.kind], 0);

  return (
    <div className="bet-card card">
      <div className="bet-head">
        <h3>{title ? `${title} · group bet` : 'Group bet'}</h3>
      </div>
      {rows.map((x) => (
        <div className="bet-row" key={x.kind}>
          <span className="bit-ic" aria-hidden>{BITS[x.kind].icon}</span>
          <span className="bet-what"><b>{x.total}</b> {x.total === 1 ? BITS[x.kind].one : BITS[x.kind].label.toLowerCase()} <small>@ {fmtMoney(S.stakes[x.kind])}</small></span>
          <span className="bet-last">{x.last ? <>Last: <b>{first(x.last)}</b></> : '—'}</span>
          <b className="bet-amt">{fmtMoney(x.total * S.stakes[x.kind])}</b>
        </div>
      ))}
      <div className="bet-foot">
        <span>
          {[...owed.entries()].map(([pid, p], k) => (
            <span key={pid}>{k > 0 && ' · '}<b>{first(pid)}</b> puts in {fmtMoney(p)}</span>
          ))}
        </span>
        <span className="bet-pot">Pot <b>{fmtMoney(pot)}</b></span>
      </div>
    </div>
  );
}

// Round-page section: one bet card per group, only once something's been logged.
export function BetsSection({ r }: { r: Round }) {
  const { S } = useStore();
  const groups = groupsFor(S, r.id);
  const any = groups.some((_, t) => groupBitTallies(S, r.id, t).some((x) => x.total > 0));
  if (!any) return null;
  return (
    <>
      <div className="section-title"><h2>Side bets</h2><span className="eyebrow">cuckoos · camels · fish · three-putts</span></div>
      {groups.map((g, t) => <GroupBet key={t} r={r} group={t} title={gname(g, t)} />)}
    </>
  );
}
