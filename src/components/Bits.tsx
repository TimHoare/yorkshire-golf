// Side bets: cuckoos (trees), camels (bunkers), fish (water), three-putts, lost balls.
// Logged hole by hole per tee group — a count per player plus who had the
// last one, so the round ends with a total of each and a payer: the player
// holding the last one puts total × stake into the group bet.
import { useState } from 'react';
import { BITS, PL, first, gname, type Round } from '../data/trip';
import { BIT_KINDS, type BitKind } from '../lib/state';
import { bitsOf, fmtMoney, flightName, flightsFor, groupBitTallies, groupsFor, holeBitTotal } from '../lib/scoring';
import { setHoleBits } from '../lib/store';
import { useStore } from '../lib/useStore';
import { Avatar } from './Avatar';

// The disclosure arrow on a collapsible row: points down when shut, up when open.
export const Chevron = () => (
  <svg className="bit-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
);

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
    const c = Math.min(BITS[kind].max ?? Infinity, Math.max(0, (hb.counts[pid] || 0) + d));
    if (c === (hb.counts[pid] || 0)) return;
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
        <span className="eyebrow">tap a row to log</span>
      </div>
      {BIT_KINDS.map((kind) => {
        const hb = bitsOf(S, rid, group, kind)[holeIdx];
        const total = holeBitTotal(hb);
        const isOpen = open === kind;
        return (
          <div className={`bit${isOpen ? ' open' : ''}`} key={kind}>
            <button className="bit-row" onClick={() => setOpen(isOpen ? null : kind)} aria-expanded={isOpen}>
              <span className="bit-ic" aria-hidden>{BITS[kind].icon}</span>
              <span className="bit-l"><b>{BITS[kind].label}</b><small>{BITS[kind].desc}</small></span>
              <span className={`bit-n${total ? '' : ' off'}`}>{total || '–'}</span>
              <Chevron />
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
                            <button onClick={() => bump(kind, pid, 1)} disabled={n >= (BITS[kind].max ?? Infinity)}
                              aria-label={n >= (BITS[kind].max ?? Infinity) ? `${first(pid)} already has the ${BITS[kind].one}` : `One ${BITS[kind].one} more for ${first(pid)}`}>+</button>
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

// Round-page section: one bet card per group (per flight on scramble day —
// bits are logged and stored by flight there), only once something's been logged.
export function BetsSection({ r }: { r: Round }) {
  const { S } = useStore();
  const titles = r.format === 'scramble'
    ? flightsFor(S, r.id).map((_, i) => flightName(S, r.id, i))
    : groupsFor(S, r.id).map((g, t) => gname(g, t));
  const any = titles.some((_, t) => groupBitTallies(S, r.id, t).some((x) => x.total > 0));
  if (!any) return null;
  return (
    <>
      <div className="section-title"><h2>Side bets</h2><span className="eyebrow">cuckoos · camels · fish · three-putts · lost balls</span></div>
      {titles.map((title, t) => <GroupBet key={t} r={r} group={t} title={title} />)}
    </>
  );
}
