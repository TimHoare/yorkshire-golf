// Side bets across the week: what everyone put into the group bets each day,
// then a table per kind — cuckoos, camels, fish… — counted per person per day
// with the weekend total. Biggest offender at the top of each.
import { Link } from 'react-router-dom';
import { BITS, PLAYERS, ROUNDS, first, pName } from '../data/trip';
import { BIT_KINDS, type BitKind } from '../lib/state';
import { fmtMoney, playerBetPaid, playerBitCount } from '../lib/scoring';
import { useStore } from '../lib/useStore';

interface Row { pid: string; byDay: number[]; total: number }

// Rows per player, weekend total first; ties keep the player order.
function rowsFor(cell: (pid: string, rid: string) => number): Row[] {
  return PLAYERS
    .map((p) => {
      const byDay = ROUNDS.map((r) => cell(p.id, r.id));
      return { pid: p.id, byDay, total: byDay.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.total - a.total);
}

function Table({ rows, me, fmt, title, eyebrow }: {
  rows: Row[]; me: string | null; fmt: (n: number) => string; title: React.ReactNode; eyebrow: string;
}) {
  const dayTotals = ROUNDS.map((_, i) => rows.reduce((a, r) => a + r.byDay[i], 0));
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const show = (n: number) => (n ? fmt(n) : '·');
  return (
    <div className="card table-wrap bets-card">
      <div className="bets-head"><h3>{title}</h3><span className="eyebrow">{eyebrow}</span></div>
      <table className={`rounds-table bets-table${fmt === fmtMoney ? " money" : ""}`}>
        <thead>
          <tr><th>Player</th>{ROUNDS.map((r) => <th key={r.id} title={r.club}>{r.dow}</th>)}<th>Total</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pid} className={row.pid === me ? 'me' : undefined}>
              <td><Link to={`/player/${row.pid}`} title={pName(row.pid)}>{first(row.pid)}</Link></td>
              {row.byDay.map((n, i) => <td key={ROUNDS[i].id} className={n ? '' : 'z'}>{show(n)}</td>)}
              <td className="tot"><b>{show(row.total)}</b></td>
            </tr>
          ))}
          <tr className="sum">
            <td>All</td>
            {dayTotals.map((n, i) => <td key={ROUNDS[i].id} className={n ? '' : 'z'}>{show(n)}</td>)}
            <td className="tot"><b>{show(total)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function BetsPage() {
  const { S, me } = useStore();
  const logged = Object.values(S.bits).some((byG) => Object.values(byG).some((sheet) => Object.values(sheet).some((arr) => arr.some(Boolean))));
  const count = (n: number) => String(n);

  return (
    <>
      <div className="section-title"><h2>Side bets</h2><span className="eyebrow">{logged ? 'by day · the week' : 'nothing logged yet'}</span></div>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Whoever has the last one of each kind in their group at the end of a round pays the group's total into the bet, at that day's stakes. The tables below count every offence, whoever ended up paying.
      </p>
      <Table
        rows={rowsFor((pid, rid) => playerBetPaid(S, rid, pid))} me={me} fmt={fmtMoney}
        title={<><span aria-hidden>💷</span> Paid in</>} eyebrow="into the group bets"
      />
      {BIT_KINDS.map((k: BitKind) => (
        <Table
          key={k} rows={rowsFor((pid, rid) => playerBitCount(S, rid, pid, k))} me={me} fmt={count}
          title={<><span aria-hidden>{BITS[k].icon}</span> {BITS[k].label}</>} eyebrow={BITS[k].desc}
        />
      ))}
    </>
  );
}
