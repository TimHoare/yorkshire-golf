import { BITS, FINAL, ORGANISER, R, ROUNDS, pName } from '../data/trip';
import { hasSync, setMe, setStakes, setTeeChoice, resetAll } from '../lib/store';
import { useStore } from '../lib/useStore';
import { RULES } from '../data/trip';
import { BIT_KINDS, stakesFor } from '../lib/state';
import { trim } from '../lib/scoring';
import { toast } from '../lib/toast';
import { useState } from 'react';

async function copy(text: string, msg: string) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('Copy this:', text); }
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { S, me, syncStatus } = useStore();
  // Which day's stakes are on show: '' = the defaults every day falls back to.
  const [stakeDay, setStakeDay] = useState('');
  const dayStakes = stakeDay ? stakesFor(S, stakeDay) : S.stakes;
  const ownStakes = !!stakeDay && !!S.roundStakes[stakeDay];

  const syncLine = hasSync
    ? (syncStatus === 'live'
      ? 'Scores sync live between every phone through the trip database.'
      : 'Offline right now — scores save here and send to the other phones when signal returns.')
    : 'Scores live on this phone only.';

  const share = () => copy(location.origin + location.pathname, 'App link copied — anyone who opens it joins the live scores');
  const doReset = () => {
    if (!confirm('Clear every score, pair draw and scramble result on this phone?')) return;
    resetAll(); onClose(); toast('Reset');
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">You &amp; sharing</h2>
        <p className="small muted">
          {me && me !== 'watcher' ? <>{FINAL ? "You're" : "You're scoring as"} <b>{pName(me)}</b> on this phone.</> : <>You're <b>just watching</b> on this phone.</>}{' '}
          <button className="linklike" onClick={() => { setMe(null); onClose(); }}>Switch</button>
        </p>
        {FINAL && <p className="notice">The week is over — <b>every score, side bet, stake and tee choice is final</b> and can't be changed from any phone.</p>}
        <p className="small muted">{syncLine}</p>
        <div className="btn-row">
          <button className="btn primary" onClick={share}>Copy app link</button>
        </div>
        <div className="course-edit">
          <h3>Side bets</h3>
          <p className="help">Pence per offence — Cuckoo (tree), Camel (bunker), Fish (water), Three-putt, Lost ball, Equipment abuse. Whoever has the last one of each at the end of the round pays the total into the group bet — except three-putts on scramble day, which are the team's: both members are logged, and each pays the stake per one. Every day uses the defaults unless it's given its own.</p>
          <div className="stakes stake-day">
            <label>
              <span>Stakes for</span>
              <select value={stakeDay} onChange={(e) => setStakeDay(e.target.value)}>
                <option value="">Default (every day)</option>
                {ROUNDS.map((r) => <option key={r.id} value={r.id}>{r.dow} · {r.short}{S.roundStakes[r.id] ? ' (own)' : ''}</option>)}
              </select>
            </label>
          </div>
          <div className="stakes">
            {BIT_KINDS.map((k) => (
              <label key={k}>
                <span><span aria-hidden>{BITS[k].icon}</span> {BITS[k].label}</span>
                <span className="stake-in">
                  <input
                    type="number" inputMode="numeric" min={0} max={1000} value={dayStakes[k]} disabled={FINAL}
                    // Tapping in selects the whole value, so typing replaces it.
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const n = Math.round(parseFloat(e.target.value));
                      setStakes({ ...dayStakes, [k]: Number.isNaN(n) ? 0 : Math.min(1000, Math.max(0, n)) }, stakeDay || undefined);
                    }}
                  />p
                </span>
              </label>
            ))}
          </div>
          {stakeDay && (
            <p className="help">
              {ownStakes
                ? <>{R(stakeDay)!.short} has its own stakes.{!FINAL && <> <button className="linklike" onClick={() => setStakes(null, stakeDay)}>Use the defaults</button></>}</>
                : <>{R(stakeDay)!.short} uses the defaults{FINAL ? '.' : ' — change a number to give it its own.'}</>}
            </p>
          )}
        </div>
        <div className="course-edit">
          <h3>Tees</h3>
          <p className="help">Which tees each course is played off. Changing this moves everyone's course handicaps for that round, on every phone.</p>
          <div className="stakes">
            {ROUNDS.filter((r) => r.altTees?.length).map((r) => (
              <label key={r.id}>
                <span>{r.short}</span>
                <select
                  value={S.teeChoice[r.id] ?? ''} disabled={FINAL}
                  onChange={(e) => setTeeChoice(r.id, e.target.value || null)}
                >
                  <option value="">{r.tees} (booked)</option>
                  {r.altTees!.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        <div className="course-edit">
          <h3>Rules in play</h3>
          <p className="help">Week points {RULES.placePoints.join(' · ')} for 1st–8th, ties on the back 9/6/3 · pairs &amp; scramble add {RULES.pairPoints.join(' · ')} each (ties share) · scramble is net strokes off a team hcp of {RULES.scrambleAllowance[0]}% of the lower CH + {RULES.scrambleAllowance[1]}% of the higher, to one decimal, {RULES.scrambleDrives} drives each · bonus ball 2× one hole every round (the 18th if not called), a mulligan on scramble day, +{RULES.bonusKeep} if kept all trip · index ±0.5 per point from {RULES.par}, and on scramble day {RULES.scrambleDrift.map((d) => (d > 0 ? '+' : '−') + trim(Math.abs(d))).join(' · ')} for 1st–4th · {RULES.allowance}% allowance. Change these in the code.</p>
        </div>
        <div className="course-edit">
          <div className="btn-row">
            {!hasSync && !FINAL && me === ORGANISER && <button className="btn danger sm" onClick={doReset}>Clear all scores</button>}
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
