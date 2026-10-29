// App shell: routing, tab bar, first-run screen, service worker, auto-backup hook.
import { load, get, subscribe, commit, seedCategories, reviewCount, latestMonth, thisMonth, monthOf, priv } from './core.js';
import { importBluecoins } from './importer.js';
import { scheduleSync, onStatus } from './drive.js';
import { cloudSchedule, cloudInit, onCloudStatus } from './cloud.js';
import { home, ledger, review, accounts, reports, settings, bindLedger, bindSettings, openAccountSetup, ui } from './screens.js';
import { openEntry } from './entry.js';
import { ACT, ic, toast, $ } from './ui.js';

const routes = { home, ledger, review, accounts, reports, settings };
let lastRoute = null, pending = false;

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
  const t = [['home', 'Home', 'home'], ['ledger', 'Entries', 'list'], null, ['accounts', 'Accounts', 'wallet'], ['reports', 'Reports', 'chart']];
  const n = reviewCount(get());
  return t.map((x) => x === null
    ? `<button class="fab" data-act="add" aria-label="Add an entry">${ic('plus')}</button>`
    : `<a href="#/${x[0]}" class="${route === x[0] ? 'on' : ''}" ${route === x[0] ? 'aria-current="page"' : ''}>${ic(x[2])}<span>${x[1]}</span>${x[0] === 'home' && n ? `<em class="dot" aria-label="${n} to check"></em>` : ''}</a>`).join('');
}

function render() {
  pending = false;
  document.body.classList.toggle('hide-amts', priv.on);
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
const queue = () => { if (!pending) { pending = true; requestAnimationFrame(render); } };

(async function boot() {
  await load();
  showLatest();
  subscribe(() => { queue(); scheduleSync(); cloudSchedule(); });
  window.addEventListener('hashchange', queue);
  window.addEventListener('sukli-render', queue);
  window.addEventListener('sukli-latest', () => { showLatest(); queue(); });
  onStatus((s) => { const el = document.getElementById('syncstatus'); if (el) el.textContent = s.text; });
  onCloudStatus((s) => { const el = document.getElementById('cloudstatus'); if (el) el.textContent = s.text; });
  render();
  cloudInit();
  window.sukli = { get, commit, openEntry, ui };
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
