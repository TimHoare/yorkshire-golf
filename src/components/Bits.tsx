// Side bets: cuckoos (trees), camels (bunkers), fish (water), three-putts, lost balls, equipment abuse.
// Logged hole by hole per tee group — a count per player plus who had the
// last one, so the round ends with a total of each and a payer: the player
// holding the last one puts total × stake into the group bet. Three-putts on
// scramble day are the team's: logged against both members, each pays the
// stake per one.
import { useState } from 'react';
import { BITS, PL, first, gname, type Round } from '../data/trip';
import { BIT_KINDS, stakesFor, type BitKind } from '../lib/state';
import { bitUnits, bitsOf, fmtMoney, flightName, flightsFor, groupBitOwed, groupBitTallies, groupsFor, holeBitTotal, playerBitCount, teamBit, unitBitCount } from '../lib/scoring';
import { setHoleBits } from '../lib/store';
import { useStore } from '../lib/useStore';
import { Avatar, TeamAvatar } from './Avatar';

// The disclosure arrow on a collapsible row: points down when shut, up when open.
export const Chevron = () => (
  <svg className="bit-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
);

// Per-hole editor shown on each scoring slide: collapsible rows, one per
// kind. Tap a row to open per-player − / + steppers; + marks that player as
// having the last one, so entering them in the order they happened just works.
// A team kind gets one stepper per team, written to both members.
export function HoleBitsPanel({ rid, group, holeIdx, readOnly }: {
  rid: string; group: number; holeIdx: number; readOnly: boolean;
}) {
  const { S } = useStore();
  const [open, setOpen] = useState<BitKind | null>(null);

  const bump = (kind: BitKind, unit: string[], d: number) => {
    const hb = bitsOf(S, rid, group, kind)[holeIdx] || { counts: {}, last: null };
    const c = Math.max(0, unitBitCount(hb, unit) + d);
    if (c === unitBitCount(hb, unit)) return;
    const counts = { ...hb.counts };
    for (const pid of unit) if (c) counts[pid] = c; else delete counts[pid];
    let last = teamBit(rid, kind) ? null : d > 0 ? unit[0] : hb.last;
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
        const team = teamBit(rid, kind);
        const units = bitUnits(S, rid, group, kind);
        const total = team ? units.reduce((a, u) => a + unitBitCount(hb, u), 0) : holeBitTotal(hb);
        const isOpen = open === kind;
        return (
          <div className={`bit${isOpen ? ' open' : ''}`} key={kind}>
            <button className="bit-row" onClick={() => setOpen(isOpen ? null : kind)} aria-expanded={isOpen}>
              <span className="bit-ic" aria-hidden>{BITS[kind].icon}</span>
              <span className="bit-l"><b>{BITS[kind].label}</b><small>{BITS[kind].desc}{team ? " · the team's, each member pays" : ''}</small></span>
              <span className={`bit-n${total ? '' : ' off'}`}>{total || '–'}</span>
              <Chevron />
            </button>
            {isOpen && (
              <div className="bit-edit">
                {units.map((unit) => {
                  const n = unitBitCount(hb, unit);
                  const name = unit.map(first).join(' & ');
                  return (
                    <div className="bit-p" key={unit.join('+')}>
                      {unit.length > 1 ? <TeamAvatar players={unit} size="sm" /> : <Avatar p={PL(unit[0])} size="sm" />}
                      <span className="bit-pn">
                        {name}
                        {!team && hb?.last === unit[0] && total > 0 && <span className="chip gorse">Last</span>}
                      </span>
                      {readOnly
                        ? <span className={`bit-n${n ? '' : ' off'}`}>{n || '–'}</span>
                        : (
                          <span className="stepper sm">
                            <button onClick={() => bump(kind, unit, -1)} aria-label={`One ${BITS[kind].one} fewer for ${name}`}>−</button>
                            <span className={`v${n ? '' : ' off'}`}>{n}</span>
                            <button onClick={() => bump(kind, unit, 1)} aria-label={`One ${BITS[kind].one} more for ${name}`}>+</button>
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
  const stakes = stakesFor(S, r.id);
  if (!rows.length) return null;

  // Who puts in what, per kind and in all; a team kind's row lists each
  // team's count, and both members pay for every one.
  const owedFor = (kind: BitKind) => groupBitOwed(S, r.id, group, kind);
  const owed = new Map<string, number>();
  rows.forEach((x) => Object.entries(owedFor(x.kind)).forEach(([pid, p]) => owed.set(pid, (owed.get(pid) || 0) + p)));
  const amount = (kind: BitKind) => Object.values(owedFor(kind)).reduce((a, p) => a + p, 0);
  const pot = rows.reduce((a, x) => a + amount(x.kind), 0);
  const teamLine = (kind: BitKind) => bitUnits(S, r.id, group, kind)
    .map((u) => ({ u, n: playerBitCount(S, r.id, u[0], kind) }))
    .filter((x) => x.n > 0)
    .map((x, k) => <span key={x.u.join('+')}>{k > 0 && ' · '}<b>{x.u.map(first).join(' & ')}</b> {x.n}</span>);

  return (
    <div className="bet-card card">
      <div className="bet-head">
        <h3>{title ? `${title} · group bet` : 'Group bet'}</h3>
      </div>
      {rows.map((x) => (
        <div className="bet-row" key={x.kind}>
          <span className="bit-ic" aria-hidden>{BITS[x.kind].icon}</span>
          <span className="bet-what"><b>{x.total}</b> {x.total === 1 ? BITS[x.kind].one : BITS[x.kind].label.toLowerCase()} <small>@ {fmtMoney(stakes[x.kind])}{teamBit(r.id, x.kind) ? ' each member' : ''}</small></span>
          <span className="bet-last">{teamBit(r.id, x.kind) ? teamLine(x.kind) : x.last ? <>Last: <b>{first(x.last)}</b></> : '—'}</span>
          <b className="bet-amt">{fmtMoney(amount(x.kind))}</b>
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
      <div className="section-title"><h2>Side bets</h2><span className="eyebrow">cuckoos · camels · fish · three-putts · lost balls · equipment abuse</span></div>
      {titles.map((title, t) => <GroupBet key={t} r={r} group={t} title={title} />)}
    </>
  );
}
