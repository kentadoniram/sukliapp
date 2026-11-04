// Internal Transfer: move one coin between two wallets (Spot, Earn, Futures, Margin…) of the SAME platform.
// Free, same coin, no fee. Both balances change; the destination account is only made when that wallet has no account for the coin yet.
// Moving between DIFFERENT platforms (Binance to Bybit) is Transfer/Move in the + menu.
import { get, commit, uid, stamp, nowStamp, balances, exactAmt, walletOf, WALLETS, HOME, fmt, rateFor } from './core.js';
import { sheet, esc, toast } from './ui.js';
import { inInvest, exchangeOf } from './invest.js';

const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const live = (l) => l.filter((x) => !x.deleted && !x.archived);
const r8 = (n) => Math.round(n * 1e8) / 1e8;

// the account for this coin in this wallet of this platform (or undefined)
export const findWalletAcct = (db, platform, cur, wallet) => db.accounts.find((x) => !x.deleted && x.cur === cur && (exchangeOf(x) || '').toLowerCase() === platform.toLowerCase() && walletOf(x).toLowerCase() === wallet.toLowerCase());

// does the work without a sheet (also used by tests). Returns { ok, msg, id }
export function internalMove({ platform, cur, from, to, amount, when }) {
  const db = get();
  if (!platform || !cur) return { ok: false, msg: 'Choose the platform and the coin.' };
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return { ok: false, msg: 'Choose two different wallets.' };
  const src = findWalletAcct(db, platform, cur, from); if (!src) return { ok: false, msg: `${platform} has no ${cur} in ${from}.` };
  const amt = r8(num(amount)); if (!(amt > 0)) return { ok: false, msg: 'Enter how much to move.' };
  let dst = findWalletAcct(db, platform, cur, to), made = false;
  const tid = uid(), nid = uid();
  commit((d) => {
    if (!dst) {
      const old = walletOf(src), pre = `${src.exchange || platform}${old === 'Spot' ? '' : ' ' + old} `;
      const name = src.name.startsWith(pre) ? `${src.exchange || platform}${to === 'Spot' ? '' : ' ' + to} ${src.name.slice(pre.length)}` : `${src.name} ${to}`;
      d.accounts.push(stamp({ id: nid, name, wallet: to, cur: src.cur, type: src.type, assetType: src.assetType, market: src.market, exchange: src.exchange, open: 0, include: false, archived: false, invtab: true })); made = true;
    }
    const toId = dst ? dst.id : nid;
    d.txs.push(stamp({ id: tid, kind: 'transfer', internal: true, amount: amt, cur: src.cur, fx: rateFor(d, src.cur) || 1, date: when || nowStamp(), name: `Internal: ${from} to ${to}`, autoName: false, cat: '', acct: src.id, toAcct: toId, toAmount: amt, fee: 0, feeBy: '', notes: `${platform}, ${src.cur}`, labels: '', items: [], counts: [], flag: null, createdAt: Date.now() }));
  });
  return { ok: true, id: tid, made, msg: `Moved ${exactAmt(amt)} ${cur} from ${from} to ${to}${made ? ` (made the ${to} account)` : ''}. No fee.` };
}

export function openInternal({ asset = '', platform = '' } = {}) {
  const db0 = get(), a0 = db0.accounts.find((x) => x.id === asset);
  const plats = [...new Set(live(db0.accounts).filter((x) => inInvest(x) && exchangeOf(x)).map(exchangeOf))].sort();
  if (!plats.length) { toast('Add an asset on a platform first.'); return; }
  // the platform is fixed: it is the card it was opened from (or the account's platform). Only when nothing says which one, it is chosen once.
  let plat = platform || (a0 && exchangeOf(a0)) || '', fixed = !!plat; if (!plat) plat = plats[0];
  let cur = a0 && exchangeOf(a0) === plat ? a0.cur : '', from = a0 && exchangeOf(a0) === plat ? walletOf(a0) : '', to = '', when = nowStamp();
  const s = sheet(`<div id="itf" class="itx">
    ${fixed ? `<p class="hint">Inside <b>${esc(plat)}</b> only, free, no fee. To move between platforms use Transfer/Move.</p>` : `<label class="field"><span>Platform</span><select name="plat">${plats.map((p) => `<option ${p === plat ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><p class="hint">Inside one platform only, free, no fee.</p>`}
    <div class="itrow"><label class="field"><span>From</span><select name="from"></select></label><button type="button" class="btn ghost itrev" id="it-rev" aria-label="Reverse From and To">⇄<small>Reverse</small></button><label class="field"><span>To</span><select name="to"></select></label></div>
    <label class="field"><span>Coin or Asset</span><select name="cur"></select></label>
    <label class="field"><span>Amount</span><div class="itamt"><input name="amt" inputmode="decimal" placeholder="0" autocomplete="off"><b id="it-cur"></b><button type="button" class="btn sm" id="it-all">Max</button></div><small class="muted" id="it-bal"></small></label>
    <button type="button" class="btn ghost" id="it-when"></button>
    <p class="hint" id="it-eff"></p>
    <div class="btnrow"><button type="button" class="btn primary" id="it-save">Move</button></div></div>`, { title: 'Internal Transfer' });
  const q = (n) => s.el.querySelector(`[name=${n}]`), el = (id) => s.el.querySelector('#' + id), whenBtn = el('it-when');
  const opts = (list, v) => list.map((x) => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const wallets = () => { const db = get(); return [...new Set([...WALLETS, ...live(db.accounts).filter((x) => exchangeOf(x) === plat).map(walletOf)])]; };
  const coinsIn = (w) => { const db = get(); return [...new Set(live(db.accounts).filter((x) => inInvest(x) && exchangeOf(x) === plat && walletOf(x).toLowerCase() === w.toLowerCase()).map((x) => x.cur))].sort(); };
  const draw = () => {
    const ws = wallets(), have = ws.filter((w) => coinsIn(w).length);
    if (!have.includes(from)) from = have[0] || '';
    const tos = ws.filter((w) => w !== from); if (!tos.includes(to)) to = (from !== 'Earn' && tos.includes('Earn') ? 'Earn' : tos.includes('Spot') ? 'Spot' : tos[0]) || '';
    q('from').innerHTML = opts(have, from); q('to').innerHTML = opts(tos, to);
    const cs = coinsIn(from); if (!cs.includes(cur)) cur = cs[0] || '';
    q('cur').innerHTML = opts(cs, cur); el('it-cur').textContent = cur; info();
  };
  const bal = () => { const db = get(), a = from && cur && findWalletAcct(db, plat, cur, from); return a ? (balances(db).get(a.id) || 0) : 0; };
  const info = () => {
    el('it-bal').textContent = from && cur ? `${from} has ${exactAmt(r8(bal()))} ${cur}` : '';
    const ex = to && cur && findWalletAcct(get(), plat, cur, to);
    el('it-eff').textContent = `Moved inside ${plat}, free, not counted as spending.${to && cur && !ex ? ` ${to} has no ${cur} yet, so it is made for you.` : ''}`;
  };
  const showWhen = () => { whenBtn.textContent = `When: ${String(when).slice(0, 16)}`; }; showWhen();
  whenBtn.onclick = async () => { const { openDatePicker } = await import('./datepicker.js'); openDatePicker(when, (v) => { when = v; showWhen(); }, { time: true }); };
  if (q('plat')) q('plat').onchange = () => { plat = q('plat').value; from = ''; to = ''; cur = ''; draw(); };
  q('from').onchange = () => { from = q('from').value; draw(); };
  q('to').onchange = () => { to = q('to').value; info(); };
  q('cur').onchange = () => { cur = q('cur').value; el('it-cur').textContent = cur; info(); };
  el('it-rev').onclick = () => { const f = from, t = to; if (!t || !coinsIn(t).length) { toast(`${t || 'That wallet'} has no assets to move yet.`); return; } from = t; to = f; draw(); };
  el('it-all').onclick = () => { q('amt').value = exactAmt(r8(Math.max(0, bal()))); };
  el('it-save').onclick = () => {
    const r = internalMove({ platform: plat, cur, from, to, amount: q('amt').value, when });
    if (!r.ok) { toast(r.msg); return; } s.close(); toast(r.msg);
  };
  draw();
}
