// App shell: routing, tab bar, first-run screen, service worker, auto-backup hook.
import { load, get, subscribe, commit, seedCategories, balances, reviewCount, latestMonth, thisMonth, monthOf, priv } from './core.js';
import { importBluecoins } from './importer.js';
import { scheduleSync, onStatus } from './drive.js';
import { cloudSchedule, cloudInit, onCloudStatus, handleOAuthReturn, signedIn, cloudSync } from './cloud.js';
import { home, ledger, review, accounts, reports, settings, bindLedger, bindSettings, openAccountSetup, ui } from './screens.js';
import { openEntry } from './entry.js';
import { calendar, budget, cashflow, categories, outlook } from './views.js';
import { ACT, ic, toast, $ } from './ui.js';
import { bin, runPurge } from './bin.js';
import { refreshRates } from './rates.js';
import { analytics } from './analytics.js';
import { initAppearance, applyHide, applyLook } from './appearance.js';
import { postInterest } from './finance.js';
import { commitQuiet, addStarterCats } from './core.js';

const routes = { analytics, bin, home, ledger, review, accounts, reports, settings, calendar, budget, cashflow, categories, outlook };
let lastRoute = null, pending = false;

function firstRun() {
  return `<section class="welcome">
    <h1>Sukli</h1>
    <p class="lede">A private money tracker for your phone. Your data stays on this device, with an optional backup to your own Google Drive.</p>
    <label class="btn wide filebtn">Import my Bluecoins export (CSV)<input type="file" id="first-file" accept=".csv,text/csv" hidden></label>
    <button class="btn ghost wide" data-act="start-empty">Start with an empty ledger</button>
    <a class="btn ghost wide" href="#/settings">Already use Sukli on another device? Sign in to sync</a>
    <p class="hint">Importing keeps your accounts, balances, categories and every entry, including transfers between currencies.</p></section>`;
}
ACT['start-empty'] = async () => {
  // signed in already: fetch your data first, so starter categories are not created twice
  if (signedIn()) { try { await cloudSync(); } catch { /* offline: carry on */ } }
  const d0 = get();
  if (d0.accounts.length || d0.txs.length) { toast('Your data arrived from the cloud.'); return; }
  commit((d) => { if (!d.categories.length) seedCategories(d); });
  ACT['acct-new']();
};

function tabs(route) {
  const t = [['home', 'Home', 'home'], ['ledger', 'Entries', 'list'], null, ['calendar', 'Calendar', 'calendar'], ['accounts', 'Accounts', 'wallet']];
  const n = reviewCount(get());
  return t.map((x) => x === null
    ? `<button class="fab" data-act="add" aria-label="Add an entry">${ic('plus')}</button>`
    : `<a href="#/${x[0]}" class="${route === x[0] ? 'on' : ''}" ${route === x[0] ? 'aria-current="page"' : ''}>${ic(x[2])}<span>${x[1]}</span>${x[0] === 'home' && n ? `<em class="dot" aria-label="${n} to check"></em>` : ''}</a>`).join('');
}

function render() {
  pending = false;
  applyHide();
  const db = get();
  const route = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  const fn = routes[route] || home;
  const empty = !db.accounts.length && !db.txs.length;
  const y = window.scrollY;
  const ae = document.activeElement;
  if (route === lastRoute && route === 'settings' && ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && document.getElementById('view').contains(ae)) return;
  document.getElementById('view').innerHTML = empty && route !== 'settings' ? firstRun() : fn(db);
  document.getElementById('tabs').innerHTML = tabs(route);
  document.getElementById('tabs').hidden = empty && route !== 'settings';
  if (route === 'ledger') bindLedger();
  if (route === 'settings') bindSettings();
  const ff = document.getElementById('first-file');
  if (ff) ff.onchange = async () => {
    const file = ff.files[0]; if (!file) return;
    try {
      let st; const text = await file.text();
      commit((d) => { seedCategories(d); st = importBluecoins(d, text); });
      showLatest();
      toast(`Imported ${st.added} entries and ${st.accounts} accounts.`, { ms: 7000 });
      openAccountSetup();
    } catch (e) { toast(e.message, { ms: 9000 }); }
  };
  if (route !== lastRoute) { window.scrollTo(0, 0); lastRoute = route; document.title = 'Sukli'; } else window.scrollTo(0, y);
}
// if this month has nothing yet (for example right after importing an older export), open the latest month with data
export function showLatest() {
  const db = get();
  if (!db.txs.some((t) => !t.deleted && monthOf(t.date) === thisMonth())) ui.month = latestMonth(db);
}
// post any interest days that have passed (no-op unless an account has a rate)
function runInterest() {
  if (!get().accounts.some((a) => !a.deleted && a.apy > 0)) return;
  let n = 0;
  commitQuiet((d) => { n = postInterest(d).length; });
  return n;
}
const queue = () => { if (!pending) { pending = true; requestAnimationFrame(render); } };

// easier menu: a floating button after a short upward scroll, and a swipe in from the left edge
(function menuAccess() {
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'menufab'; fab.hidden = true; fab.setAttribute('aria-label', 'Open menu'); fab.innerHTML = ic('menu');
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(fab));
  if (document.body) document.body.appendChild(fab);
  const open = () => { if (!document.body.classList.contains('noscroll') && ACT.menu) { fab.hidden = true; ACT.menu(fab, null); } };
  fab.addEventListener('click', open);
  let last = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY, up = last - y;
    if (y < 120 || document.body.classList.contains('noscroll')) fab.hidden = true;
    else if (up > 14) fab.hidden = false;
    else if (up < -6) fab.hidden = true;
    last = y;
  }, { passive: true });
  let sx = 0, sy = 0, live = false;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    live = e.touches.length === 1 && t.clientX < 24 && !e.target.closest('svg, canvas, input, textarea, [data-noswipe], .scrim');
    sx = t.clientX; sy = t.clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!live) return;
    const t = e.touches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy > 40) live = false;
    else if (dx > 70 && dx > dy * 2) { live = false; open(); }
  }, { passive: true });
})();

(async function boot() {
  initAppearance();
  await load();
  const oauthMsg = await handleOAuthReturn();
  runInterest();
  runPurge();
  refreshRates().then((r) => { if (r && !r.skipped) window.dispatchEvent(new Event('sukli-render')); }).catch(() => {});
  commitQuiet((d) => { addStarterCats(d); });
  showLatest();
  subscribe(() => { queue(); scheduleSync(); cloudSchedule(); });
  window.addEventListener('hashchange', queue);
  window.addEventListener('sukli-render', queue);
  window.addEventListener('sukli-latest', () => { showLatest(); queue(); });
  onStatus((s) => { const el = document.getElementById('syncstatus'); if (el) el.textContent = s.text; });
  onCloudStatus((s) => { const el = document.getElementById('cloudstatus'); if (el) el.textContent = s.text; });
  render();
  if (oauthMsg) toast(oauthMsg, { ms: 9000 });
  cloudInit();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && runInterest()) queue(); });
  window.sukli = { get, commit, openEntry, ui, balancesNow: () => balances(get()) };
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
