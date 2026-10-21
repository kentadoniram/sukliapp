// App shell: routing, tab bar, first-run screen, service worker, auto-backup hook.
import { applyTypes } from './accpage.js';
import { setNameRules } from './merchants.js';
import { initBackup } from './backup.js';
import { load, get, subscribe, commit, seedCategories, balances, reviewCount, latestMonth, thisMonth, monthOf, priv } from './core.js';
import { importBluecoins } from './importer.js';
import { scheduleSync, onStatus } from './drive.js';
import { cloudSchedule, cloudInit, onCloudStatus, handleOAuthReturn } from './cloud.js';
import { home, ledger, review, accounts, reports, settings, bindLedger, bindSettings, openAccountSetup, ui, fillDeferred, tabIds, TAB_DEFS } from './screens.js';
import { openEntry } from './entry.js';
import { calendar, budget, cashflow, categories, outlook } from './views.js';
import { ACT, ic, toast, $ } from './ui.js';
import { initAppearance, applyHide, applyLook } from './appearance.js';
import { postInterest } from './finance.js';
import { ratesInit } from './rates.js';
import { initGestures } from './gestures.js';
import { bin, autoPurge } from './bin.js';
import { analytics } from './analytics.js';
import './scan.js';
import './compare.js';
import './loans.js';
import { commitQuiet } from './core.js';

const routes = { home, ledger, review, accounts, reports, settings, calendar, budget, cashflow, categories, outlook, bin, analytics };
let lastRoute = null, pending = false;
// remember where you were on each screen so Back returns there instead of the top
const seen = new Map(), stack = []; let curKey = '', backTo = null;
window.addEventListener('scroll', () => { if (curKey) seen.set(curKey, window.scrollY); }, { passive: true });
window.addEventListener('hashchange', () => { const k = location.hash || '#/home'; if (k === stack[stack.length - 2]) { stack.pop(); backTo = seen.get(k) ?? 0; } else { if (stack[stack.length - 1] !== k) stack.push(k); backTo = null; } });

function firstRun() {
  return `<section class="welcome">
    <h1>Sukli</h1>
    <p class="lede">A private money tracker for your phone. Your data stays on this device, with an optional backup to your own Google Drive.</p>
    <label class="btn wide filebtn">Import my Bluecoins export (CSV)<input type="file" id="first-file" accept=".csv,text/csv" hidden></label>
    <button class="btn ghost wide" data-act="start-empty">Start with an empty ledger</button>
    <p class="hint">Importing keeps your accounts, balances, categories and every entry, including transfers between currencies.</p></section>`;
}
ACT['start-empty'] = () => { commit((d) => seedCategories(d)); ACT['acct-new'](); };

function tabs(route) {
  const ids = tabIds(get()), half = Math.ceil(ids.length / 2);
  const t = ids.map((id) => [id, TAB_DEFS[id][0], TAB_DEFS[id][1]]); t.splice(half, 0, null);
  const n = reviewCount(get());
  return t.map((x) => x === null
    ? `<button class="fab" data-act="add" aria-label="Add an entry">${ic('plus')}</button>`
    : `<a href="#/${x[0]}" class="${route === x[0] ? 'on' : ''}" ${route === x[0] ? 'aria-current="page"' : ''}>${ic(x[2])}<span>${x[1]}</span>${x[0] === 'home' && n ? `<em class="dot" aria-label="${n} to check"></em>` : ''}</a>`).join('');
}

function render() {
  applyTypes(get().settings);
  setNameRules(get().settings.nameRules);
  pending = false;
  applyHide();
  const db = get();
  const route = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  const fn = routes[route] || home;
  const empty = !db.accounts.length && !db.txs.length;
  const key = location.hash || '#/home';
  if (!stack.length) stack.push(key);
  const y = key === curKey ? window.scrollY : 0;
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
  const changed = route !== lastRoute || key !== curKey;
  const target = changed ? (backTo ?? 0) : y;
  curKey = key; backTo = null;
  if (changed) { lastRoute = route; document.title = 'Sukli'; }
  window.scrollTo(0, target);
  // cards drawn a moment later change the page height, so put the scroll position back once they are in
  if (route === 'home' && !(empty)) fillDeferred(db, () => { if (curKey === key) window.scrollTo(0, target); });
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

(async function boot() {
  initAppearance();
  await load();
  const oauthMsg = await handleOAuthReturn();
  runInterest();
  initBackup();
  showLatest();
  subscribe(() => { queue(); scheduleSync(); cloudSchedule(); });
  window.addEventListener('hashchange', queue);
  window.addEventListener('sukli-render', queue);
  window.addEventListener('sukli-latest', () => { showLatest(); queue(); });
  onStatus((s) => { const el = document.getElementById('syncstatus'); if (el) el.textContent = s.text; });
  onCloudStatus((s) => { const el = document.getElementById('cloudstatus'); if (el) el.textContent = s.text; });
  // Android: the keyboard covers the bottom of the screen. Follow the visible area so a sheet and its Save button stay above the keyboard.
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement;
    const fit = () => { const kb = window.innerHeight - vv.height > 120; root.classList.toggle('kb', kb); root.style.setProperty('--vvh', vv.height + 'px'); root.style.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
    document.addEventListener('focusin', (e) => { if (e.target && e.target.closest && e.target.closest('.sheet')) setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* old browser */ } }, 250); });
  }
  render();
  if (oauthMsg) toast(oauthMsg, { ms: 9000 });
  cloudInit();
  ratesInit(); initGestures(); autoPurge();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && runInterest()) queue(); });
  window.sukli = { get, commit, openEntry, ui, balancesNow: () => balances(get()) };
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
