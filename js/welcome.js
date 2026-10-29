// First screen: "I am new" (five easy questions, one at a time) or "I've used a budget app before" (the old welcome), plus restoring your own Sukli backup.
import { get, commit, seedCategories, findOrAddCategory, stamp, uid, HOME, CUR, replaceAll, emptyDb } from './core.js';
import { ACT, esc, toast } from './ui.js';

const KINDS = { cash: ['Cash', 'cash'], bank: ['Bank or debit card', 'bank'], ewallet: ['E-wallet (GCash, PayPay…)', 'ewallet'], card: ['Credit card', 'card'] };
const FOODS = ['Lunch', 'Coffee', 'Groceries', 'Train', 'Snack'];
const STEPS = 5;
const wz = { mode: '', lvl: '', step: 0, what: '', amount: '', pay: '', now: '', whenKind: '', whenAt: '' };
const rerender = () => window.dispatchEvent(new Event('sukli-render'));
const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : NaN; };
const sym = () => (CUR[HOME] || { sym: HOME + ' ' }).sym;
const p2 = (n) => String(n).padStart(2, '0');
const stampOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const WHEN = [['0', 'Just now'], ['1', '1 hour ago'], ['6', '6 hours ago'], ['y', 'Yesterday']];
export const whenDate = (kind, at = '', now = new Date()) => {
  if (kind === 'custom' && at) return at;
  if (kind === 'y') { const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return stampOf(d); }
  return stampOf(new Date(now.getTime() - (num(kind) || 0) * 3600e3));
};
const whenText = () => (wz.whenKind === 'custom' ? wz.whenAt.slice(0, 16) : (WHEN.find((w) => w[0] === wz.whenKind) || [])[1] || '');
// a plain-words guess of the category from what the person typed
export const guessCat = (text) => {
  const t = (text || '').toLowerCase();
  const m = [[/breakfast/, ['Food & Drinks', 'Breakfast']], [/coffee|cafe|café|tea\b|latte/, ['Food & Drinks', 'Coffee']], [/grocer|supermarket|market/, ['Food & Drinks', 'Groceries']], [/snack|candy|sweet|chips/, ['Food & Drinks', 'Snacks']],
    [/lunch|dinner|meal|eat|food|ramen|restaurant|bento|pizza|burger/, ['Food & Drinks', 'Dining out']], [/train|metro|subway|suica|pasmo|ic card/, ['Transportation', 'Train']], [/bus\b|jeep/, ['Transportation', 'Bus']], [/taxi|grab|uber/, ['Transportation', 'Taxi']], [/fuel|gas\b|gasoline|petrol/, ['Transportation', 'Fuel']]];
  const hit = m.find(([re]) => re.test(t)); return hit ? hit[1] : null;
};

// make the account, its starting balance and the first entry. The "now" figure is what the account holds AFTER this payment, so the starting balance is now + amount.
export function createFirst({ what, amount, pay, now, date }) {
  const [label, type] = KINDS[pay] || KINDS.cash, day = date.slice(0, 10), isCard = type === 'card';
  const open = isCard ? amount - now : now + amount;     // card: "now" is what you owe
  const aid = uid();
  commit((d) => {
    seedCategories(d);
    d.accounts.push(stamp({ id: aid, name: label.replace(/ \(.*\)/, '').replace('Bank or debit card', 'Bank'), cur: HOME, type, open: Math.round(open * 100) / 100, openDate: day, include: true, archived: false }));
    const g = guessCat(what); let cat, flag = null;
    if (g) cat = findOrAddCategory(d, g[0], g[1], 'expense').id; else { cat = findOrAddCategory(d, 'Others', 'Uncategorized', 'expense').id; flag = 'review'; }
    d.txs.push(stamp({ id: uid(), kind: 'expense', date, name: what, amount, cur: HOME, fx: 1, cat, acct: aid, notes: '', items: [], flag }));
    d.settings.lastAcct = aid;
  });
  return aid;
}
// restore a backup file made by Sukli (Settings, Back up), for example after reinstalling the app
export function restoreFromText(text) {
  const obj = JSON.parse(text);
  if (!obj || !obj.v || !Array.isArray(obj.txs)) throw new Error('That does not look like a Sukli backup file.');
  obj.settings = { ...emptyDb().settings, ...obj.settings };
  replaceAll(obj);
  return { entries: obj.txs.filter((t) => !t.deleted).length, accounts: (obj.accounts || []).filter((a) => !a.deleted).length };
}

const restoreBtn = (id) => `<label class="btn ghost wide filebtn">I already use Sukli: restore my backup file<input type="file" id="${id}" class="first-json" accept=".json,application/json" hidden></label>
  <p class="hint center">The .json file you saved from Settings. Use it after reinstalling.</p>`;
const bar = () => `<p class="wzstep">Question ${wz.step + 1} of ${STEPS}</p><div class="wzbar" aria-hidden="true"><i style="width:${(wz.step + 1) / STEPS * 100}%"></i></div>`;
const nav = (ok, last) => `<div class="btnrow wznav"><button type="button" class="btn ghost" data-act="wz-back">Back</button><button type="button" class="btn" id="wz-next" data-act="wz-next" ${ok ? '' : 'disabled'}>${last ? 'Save my first entry' : 'Next'}</button></div>`;
const chips = (items, cur, act, attr) => `<div class="chips wzchips">${items.map(([v, l]) => `<button type="button" class="chip ${cur === v ? 'on' : ''}" data-act="${act}" data-${attr}="${esc(v)}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('')}</div>`;
const valid = () => [!!wz.what.trim(), num(wz.amount) > 0, !!wz.pay, num(wz.now) >= 0, !!wz.whenKind][wz.step];

export function welcomeHtml(oldHtml) {
  if (wz.mode === 'old') return `${oldHtml}<p class="hint center"><button type="button" class="linkbtn" data-act="wz-home">Back</button></p>${restoreBtn('first-json2')}`;
  if (wz.mode !== 'new') return `<section class="welcome">
    <h1>Welcome to Sukli</h1>
    <p class="lede">See where your money goes. Your data stays on this phone.</p>
    <button type="button" class="btn wide" data-act="wz-new">I am new</button>
    <button type="button" class="btn ghost wide" data-act="wz-old">I’ve used a budget app before</button>
    <div class="or"><span>or</span></div>${restoreBtn('first-json')}<input type="file" id="first-file" accept=".csv,text/csv" hidden aria-hidden="true" tabindex="-1"></section>`;
  if (!wz.lvl) return `<section class="welcome wz"><h1>How do you want Sukli?</h1><p class="hint">You can change this any time in Settings. Nothing you enter is ever deleted when you switch.</p>
    <button type="button" class="btn wide lvlbtn" data-act="wz-lvl" data-v="simple">Simple<small class="btnsub">Just the basics: add what you spend, see where it went. Other options stay hidden until you want them.</small></button>
    <button type="button" class="btn ghost wide lvlbtn" data-act="wz-lvl" data-v="advanced">Advanced<small class="btnsub">Everything: interest, loans, investments, tags, merchants, exports.</small></button>
    <p class="hint center"><button type="button" class="linkbtn" data-act="wz-home">Back</button></p></section>`;
  const s = wz.step, last = s === STEPS - 1;
  const q = [
    () => `<h1>What did you spend?</h1><p class="hint">Anything you paid for today or lately. A word is enough.</p>
      <input id="wz-what" class="wzin" data-wz="what" type="text" role="combobox" aria-autocomplete="list" autocomplete="off" autocapitalize="sentences" placeholder="e.g. lunch" value="${esc(wz.what)}">${chips(FOODS.map((x) => [x, x]), wz.what, 'wz-pick', 'v')}`,
    () => `<h1>How much?</h1><p class="hint">A rough number is fine.</p>
      <label class="amtwrap wzamt"><b>${esc(sym())}</b><input id="wz-amt" class="wzin" data-wz="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(wz.amount)}"></label>`,
    () => `<h1>How did you pay?</h1><p class="hint">Sukli makes this account for you. You can rename it later.</p>${chips(Object.entries(KINDS).map(([k, v]) => [k, v[0]]), wz.pay, 'wz-pay', 'v')}`,
    () => { const card = wz.pay === 'card'; return `<h1>${card ? 'How much do you owe on the card now?' : 'How much is in it now?'}</h1>
      <p class="hint">${card ? 'Type the amount owed after this payment.' : 'Type what it holds right now, after this payment.'} Sukli will <b>not</b> take the ${esc(sym())}${esc(wz.amount || '0')} off again. A rough number is fine.</p>
      <label class="amtwrap wzamt"><b>${esc(sym())}</b><input id="wz-now" class="wzin" data-wz="now" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(wz.now)}"></label>`; },
    () => `<h1>When was it?</h1><p class="hint">A guess is fine.</p>${chips([...WHEN, ['custom', wz.whenKind === 'custom' && wz.whenAt ? wz.whenAt.slice(0, 16) : 'Pick a date and time']], wz.whenKind, 'wz-when', 'v')}`,
  ][s]();
  return `<section class="welcome wz">${bar()}${q}${nav(valid(), last)}<p class="hint center"><button type="button" class="linkbtn" data-act="wz-home">Start over</button></p></section>`;
}

ACT['wz-new'] = () => { Object.assign(wz, { mode: 'new', lvl: '', step: 0, what: '', amount: '', pay: '', now: '', whenKind: '', whenAt: '' }); rerender(); };
ACT['wz-lvl'] = (el) => { wz.lvl = el.dataset.v === 'simple' ? 'simple' : 'advanced'; rerender(); };
ACT['wz-old'] = () => { wz.mode = 'old'; rerender(); };
ACT['wz-home'] = () => { wz.mode = ''; rerender(); };
ACT['wz-back'] = () => { if (wz.step > 0) wz.step--; else wz.lvl = ''; rerender(); };
ACT['wz-pick'] = (el) => { wz.what = el.dataset.v; rerender(); };
ACT['wz-pay'] = (el) => { wz.pay = el.dataset.v; rerender(); };
ACT['wz-when'] = async (el) => {
  const v = el.dataset.v;
  if (v !== 'custom') { wz.whenKind = v; wz.whenAt = ''; rerender(); return; }
  const { openDatePicker } = await import('./datepicker.js');
  openDatePicker(stampOf(new Date()), (val) => { wz.whenKind = 'custom'; wz.whenAt = String(val).replace('T', ' ').padEnd(19, ':00').slice(0, 19); rerender(); }, { title: 'When was it?' });
};
ACT['wz-next'] = () => {
  if (!valid()) return;
  if (wz.step < STEPS - 1) { wz.step++; rerender(); setTimeout(() => { const i = document.querySelector('.wzin'); if (i) i.focus(); }, 60); return; }
  createFirst({ what: wz.what.trim(), amount: num(wz.amount), pay: wz.pay, now: num(wz.now), date: whenDate(wz.whenKind, wz.whenAt) });
  commit((d) => { d.settings.mode = wz.lvl === 'simple' ? 'simple' : 'advanced'; });
  wz.mode = ''; location.hash = '#/home';
  toast('Saved. Tap the round + button to add the next one.', { ms: 6000 });
};
// typing: keep the answer and the Next button in step without redrawing (the keyboard stays open)
document.addEventListener('input', (e) => { const k = e.target && e.target.dataset && e.target.dataset.wz; if (!k) return; wz[k] = e.target.value; const b = document.getElementById('wz-next'); if (b) b.disabled = !valid(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.wz) { e.preventDefault(); ACT['wz-next'](); } });
document.addEventListener('change', async (e) => {
  const t = e.target; if (!t || !t.classList || !t.classList.contains('first-json')) return;
  const file = t.files[0]; if (!file) return;
  try { const st = restoreFromText(await file.text()); toast(`Restored ${st.entries} entries and ${st.accounts} accounts.`, { ms: 7000 }); location.hash = '#/home'; }
  catch (err) { toast(err.message || 'Could not read that file.', { ms: 8000 }); }
  t.value = '';
});
