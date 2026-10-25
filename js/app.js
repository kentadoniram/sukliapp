// App shell: routing, tab bar, first-run screen, service worker, auto-backup hook.
import { applyTypes } from './accpage.js';
import { setNameRules } from './merchants.js';
import { initBackup } from './backup.js';
import { load, get, subscribe, commit, seedCategories, balances, reviewCount, latestMonth, thisMonth, monthOf, priv } from './core.js';
import { importBluecoins } from './importer.js';
import { scheduleSync, onStatus } from './drive.js';
import './feedback.js';
import { cloudSchedule, cloudInit, onCloudStatus, handleOAuthReturn } from './cloud.js';
import { home, ledger, review, accounts, reports, settings, bindLedger, bindSettings, openAccountSetup, ui, fillDeferred, tabIds, TAB_DEFS } from './screens.js';
import { openEntry } from './entry.js';
import { calendar, budget, cashflow, categories, outlook } from './views.js';
import { ACT, ic, toast, $ } from './ui.js';
import { initAppearance, applyHide, applyLook } from './appearance.js';
import { postInterest, postDebtInterest, hasDebtInt } from './finance.js';
import { hasRate } from './interest.js';
import { ratesInit } from './rates.js';
import { initGestures } from './gestures.js';
import { bin, autoPurge } from './bin.js';
import { analytics } from './analytics.js';
import { investments } from './invest.js';
import './scan.js';
import './compare.js';
import './loans.js';
import './trades.js';
import { commitQuiet } from './core.js';

const routes = { home, ledger, review, accounts, reports, settings, calendar, budget, cashflow, categories, outlook, bin, analytics, invest: investments };
let lastRoute = null, pending = false;
// remember where you were on each screen so Back returns there instead of the top
const seen = new Map(), stack = []; let curKey = '', backTo = null;
window.addEventListener('scroll', () => { if (curKey) seen.set(curKey, window.scrollY); }, { passive: true });
window.addEventListener('hashchange', () => { const k = location.hash || '#/home'; if (k === stack[stack.length - 2]) { stack.pop(); backTo = seen.get(k) ?? 0; } else { if (stack[stack.length - 1] !== k) stack.push(k); backTo = null; } });

function firstRun() {
  return `<section class="welcome">
    <h1>Welcome to Sukli</h1>
    <p class="lede">Sukli helps you see where your money goes, so there are fewer surprises at the end of the month. You do not need to know anything about finance. Your data stays on this phone.</p>
    <ol class="steps3">
      <li><b>Say where your money is.</b><span>Your wallet, a bank account, or an e-wallet like GCash or PayPay. Each one is called an <em>account</em>. Type how much is in it today.</span></li>
      <li><b>Write down what you spend and earn.</b><span>Tap the round <b>+</b> button each time you pay for something or get paid. Each one is called an <em>entry</em>. It takes a few seconds.</span></li>
      <li><b>Look at Home.</b><span>You will see what came in, what went out, and which kind of spending is biggest.</span></li></ol>
    <button class="btn wide" data-act="start-empty">Start: add my first account</button>
    <p class="hint center">Takes about a minute. You can change everything later.</p>
    <div class="or"><span>already use another app?</span></div>
    <label class="btn ghost wide filebtn">I use Bluecoins: import my CSV file<input type="file" id="first-file" accept=".csv,text/csv" hidden></label>
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
  if (!get().accounts.some((a) => !a.deleted && (hasRate(a) || hasDebtInt(a)))) return;
  let n = 0;
  commitQuiet((d) => { n = postInterest(d).length + postDebtInterest(d).length; });
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
  // tapping the tab you are already on takes you back to the top of it
  document.getElementById('tabs').addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/"]'); if (!a) return;
    const here = (location.hash || '#/home').split('?')[0], to = a.getAttribute('href').split('?')[0];
    if (here === to || (here === '#/' && to === '#/home')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  window.addEventListener('sukli-render', queue);
  window.addEventListener('sukli-latest', () => { showLatest(); queue(); });
  onStatus((s) => { const el = document.getElementById('syncstatus'); if (el) el.textContent = s.text; });
  onCloudStatus((s) => { const el = document.getElementById('cloudstatus'); if (el) el.textContent = s.text; });
  // Android: the keyboard covers the bottom of the screen. Follow the visible area so a sheet and its Save button stay above the keyboard.
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement;
    const fit = () => { const kb = window.innerHeight - vv.height > 120; root.classList.toggle('kb', kb); root.style.setProperty('--vvh', vv.height + 'px'); root.style.setProperty('--vvt', vv.offsetTop + 'px'); };
    // iPhone: while a field on the page (Settings, filters) has the keyboard open, the bottom tabs would ride up the screen. Hide them until the keyboard is gone, then put the page back at its true position.
    const editable = (el) => !!(el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea,select'));
    let typingTimer = 0;
    const settle = () => { clearTimeout(typingTimer); typingTimer = setTimeout(() => { if (editable(document.activeElement)) return; root.classList.remove('typing'); try { window.scrollTo(window.scrollX, window.scrollY); } catch { /* old browser */ } fit(); const t = document.querySelector('.tabs'); if (t) { t.style.transform = 'translateZ(0)'; requestAnimationFrame(() => { t.style.transform = ''; }); } }, 200); };
    document.addEventListener('focusin', (e) => { if (editable(e.target) && !e.target.closest('.sheet')) { clearTimeout(typingTimer); root.classList.add('typing'); } });
    document.addEventListener('focusout', settle);
    vv.addEventListener('resize', () => { if (!root.classList.contains('typing') || !editable(document.activeElement)) settle(); });
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
    // bring a field into view only when it is really hidden (by the keyboard or the edge), and without animation: a smooth scroll while the iPhone keyboard opens leaves taps landing one row off
    document.addEventListener('focusin', (e) => { if (e.target && e.target.closest && e.target.closest('.sheet')) setTimeout(() => { try { const t = e.target, r = t.getBoundingClientRect(), sb = t.closest('.sheet-body'), sr = sb ? sb.getBoundingClientRect() : { top: 0, bottom: innerHeight };
      const bottom = Math.min(vv.offsetTop + vv.height, sr.bottom) - 64, top = Math.max(sr.top, vv.offsetTop) + 4;
      if (r.top >= top && r.bottom <= bottom) return; t.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } catch { /* old browser */ } }, 250); });
  }
  render();
  if (oauthMsg) toast(oauthMsg, { ms: 9000 });
  cloudInit();
  ratesInit(); initGestures(); autoPurge();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && runInterest()) queue(); });
  setInterval(() => { try { if (document.visibilityState === 'visible' && new Date().getHours() === 23 && new Date().getMinutes() >= 55 && runInterest()) queue(); } catch { /* try again next minute */ } }, 60000);
  window.sukli = { get, commit, openEntry, ui, balancesNow: () => balances(get()) };
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
