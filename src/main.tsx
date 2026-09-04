import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { importState, initSync } from './lib/store';
import { ROUTE_KEY, STORE_KEY } from './lib/state';
import './styles.css';

// Legacy share links carry the whole state in the hash (#s=...): import once.
(() => {
  const m = location.hash.match(/^#s=(.+)$/);
  if (!m) return;
  try {
    let str = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const json = decodeURIComponent(escape(atob(str)));
    if (!localStorage.getItem(STORE_KEY) || confirm("This link carries trip data. Replace what's on this phone with it?")) {
      importState(json);
    }
  } catch { /* bad link — ignore */ }
  history.replaceState(null, '', location.pathname + location.search);
})();

// PWA cold start opens the start_url with no hash — restore the last page so
// relaunching mid-round lands back on the hole you were scoring.
if (!location.hash || location.hash === '#/' || location.hash === '#') {
  const saved = localStorage.getItem(ROUTE_KEY);
  if (saved && saved !== '/') history.replaceState(null, '', '#' + saved);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

initSync();

// Installable PWA: register the offline-shell service worker (production only —
// in dev it would cache Vite's transient module URLs).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => { /* not fatal */ });
  });
}
