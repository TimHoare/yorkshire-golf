// Side bets, one screen per day: every player down the side, the six kinds
// across the top — cuckoos, camels, fish, three-putts, lost balls, equipment
// abuse — plus what they put into the group bets at that day's stakes. A
// switch at the top flicks between the days and the whole week.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BITS, PLAYERS, ROUNDS, R, first, pName } from '../data/trip';
import { BIT_KINDS, stakesFor } from '../lib/state';
import { fmtMoney, playerBetPaid, playerBitCount } from '../lib/scoring';
import { useStore } from '../lib/useStore';

const WEEK = 'week';

export function BetsPage() {
  const { S, me } = useStore();
  const logged = (rid: string) => Object.values(S.bits[rid] || {}).some((sheet) => Object.values(sheet).some((arr) => arr.some(Boolean)));
  // Open on the latest day with anything logged — today's, once the first
  // cuckoo's in — and the week when nothing is.
  const [view, setView] = useState(() => [...ROUNDS].reverse().find((r) => logged(r.id))?.id ?? WEEK);
  const rids = view === WEEK ? ROUNDS.map((r) => r.id) : [view];
  const sum = (f: (rid: string) => number) => rids.reduce((a, rid) => a + f(rid), 0);

  const rows = PLAYERS
    .map((p) => ({
      pid: p.id,
      counts: BIT_KINDS.map((k) => sum((rid) => playerBitCount(S, rid, p.id, k))),
      paid: sum((rid) => playerBetPaid(S, rid, p.id)),
    }))
    .map((row) => ({ ...row, total: row.counts.reduce((a, b) => a + b, 0) }))
    // Biggest offender at the top; ties by what they paid, then player order.
    .sort((a, b) => b.total - a.total || b.paid - a.paid);
  const colTotals = BIT_KINDS.map((_, i) => rows.reduce((a, r) => a + r.counts[i], 0));
  const pot = rows.reduce((a, r) => a + r.paid, 0);
  const show = (n: number) => (n ? String(n) : '·');
  const r = view === WEEK ? null : R(view)!;
  const stakes = r ? stakesFor(S, r.id) : null;

  return (
    <>
      <div className="section-title"><h2>Side bets</h2><span className="eyebrow">{r ? `${r.dow} · ${r.short}` : 'the whole week'}</span></div>
      <div className="seg bets-seg" role="tablist" aria-label="Day">
        {ROUNDS.map((rd) => (
          <button key={rd.id} role="tab" aria-selected={view === rd.id} className={view === rd.id ? 'on' : ''} onClick={() => setView(rd.id)}>{rd.dow}</button>
        ))}
        <button role="tab" aria-selected={view === WEEK} className={view === WEEK ? 'on' : ''} onClick={() => setView(WEEK)}>Week</button>
      </div>
      <div className="card table-wrap bets-card">
        <table className="bets-table">
          <thead>
            <tr>
              <th>Player</th>
              {BIT_KINDS.map((k) => <th key={k} title={`${BITS[k].label} · ${BITS[k].desc}`}><span aria-hidden>{BITS[k].icon}</span><span className="sr">{BITS[k].label}</span></th>)}
              <th className="paid">Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pid} className={row.pid === me ? 'me' : undefined}>
                <td><Link to={`/player/${row.pid}`} title={pName(row.pid)}>{first(row.pid)}</Link></td>
                {row.counts.map((n, i) => <td key={BIT_KINDS[i]} className={n ? '' : 'z'}>{show(n)}</td>)}
                <td className={`paid${row.paid ? '' : ' z'}`}>{row.paid ? fmtMoney(row.paid) : '·'}</td>
              </tr>
            ))}
            <tr className="sum">
              <td>All</td>
              {colTotals.map((n, i) => <td key={BIT_KINDS[i]} className={n ? '' : 'z'}>{show(n)}</td>)}
              <td className={`paid${pot ? '' : ' z'}`}>{pot ? fmtMoney(pot) : '·'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted bets-key">
        {BIT_KINDS.map((k) => (
          <span className="lg" key={k}><span aria-hidden>{BITS[k].icon}</span> {BITS[k].label.toLowerCase()}{stakes ? ` ${fmtMoney(stakes[k])}` : ''}</span>
        ))}
      </p>
      <p className="small muted">
        Paid is what went into the group bets{r ? ' at the day’s stakes above' : ', each day at its own stakes'}: whoever has the last one of a kind in their group at the end of the round pays the group’s total. The counts are every offence, whoever paid.
      </p>
    </>
  );
}
