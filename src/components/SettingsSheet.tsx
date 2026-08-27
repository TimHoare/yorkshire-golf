import { useState } from 'react';
import { pName } from '../data/trip';
import { hasSync, setMe, importState, exportState, resetAll } from '../lib/store';
import { useStore } from '../lib/useStore';
import { RULES } from '../data/trip';
import { toast } from '../lib/toast';

async function copy(text: string, msg: string) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('Copy this:', text); }
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { me, syncStatus } = useStore();
  const [importText, setImportText] = useState('');

  const syncLine = hasSync
    ? (syncStatus === 'live'
      ? 'Scores sync live between every phone through the trip database.'
      : 'Offline right now — scores save here and send to the other phones when signal returns.')
    : 'Scores live on this phone only.';

  const share = () => copy(location.origin + location.pathname, 'App link copied — anyone who opens it joins the live scores');
  const doImport = () => {
    try { importState(importText); onClose(); toast('Restored'); }
    catch { toast("That JSON didn't parse"); }
  };
  const doReset = async () => {
    const msg = hasSync
      ? 'Clear every score, pair draw and scramble result for EVERYONE — this wipes the shared database, not just this phone. Sure?'
      : 'Clear every score, pair draw and scramble result on this phone?';
    if (!confirm(msg)) return;
    try { await resetAll(); } catch { toast("Cleared here, but the shared database didn't respond — try again with signal"); }
    onClose(); toast('Reset');
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">You &amp; sharing</h2>
        <p className="small muted">
          {me && me !== 'watcher' ? <>You're scoring as <b>{pName(me)}</b> on this phone.</> : <>You're <b>just watching</b> on this phone.</>}{' '}
          <button className="linklike" onClick={() => { setMe(null); onClose(); }}>Switch</button>
        </p>
        <p className="small muted">{syncLine}</p>
        <div className="btn-row">
          <button className="btn primary" onClick={share}>Copy app link</button>
          <button className="btn secondary" onClick={() => copy(exportState(), 'JSON copied')}>Copy JSON</button>
        </div>
        <div className="field">
          <span className="lbl">Paste JSON to restore</span>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="{ … }" />
          <div className="btn-row"><button className="btn ghost sm" onClick={doImport}>Restore from JSON</button></div>
        </div>
        <div className="course-edit">
          <h3>Rules in play</h3>
          <p className="help">Week points {RULES.placePoints.join(' · ')} for 1st–4th (ties share) · index ±0.5 per point from {RULES.par} · scramble winners {RULES.scrambleWin} pts each · {RULES.allowance}% allowance. Change these in the code.</p>
        </div>
        <div className="course-edit">
          <div className="btn-row">
            <button className="btn danger sm" onClick={doReset}>Clear all scores</button>
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
