// Review of trades that Sukli REBUILT when you imported a Bluecoins file (Bluecoins keeps no "trade" mark, so Sukli guessed buys, sells and converts
// from transfers that touch a crypto platform or investment account). For each guess: Keep as Trade, or Make It a Plain Transfer.
import { button } from './components.js';
import { get, commit, stamp, fmt, HOME, accLabel } from './core.js';
import { ACT, sheet, esc, toast, confirmDialog } from './ui.js';
import { tradeBook } from './tradecalc.js';

// a rebuilt trade has no payment details of its own (trades you record in Sukli always carry paidCur) and has not been kept yet
export const isRebuilt = (t) => !t.deleted && t.kind === 'transfer' && t.trade && !t.trade.paidCur && !t.trade.feeCur;
export const rebuiltList = (db) => db.txs.filter(isRebuilt);
export const pendingReview = (db) => rebuiltList(db).filter((t) => !t.trade.ok);

export function openTradeReview() {
  const s = sheet('<div id="trv"></div>', { title: 'Review Imported Trades', wide: true }), root = s.el.querySelector('#trv');
  let show = 'todo';
  const draw = () => {
    const db = get(), all = rebuiltList(db), todo = all.filter((t) => !t.trade.ok), kept = all.filter((t) => t.trade.ok), book = tradeBook(db.txs);
    const gain = new Map(book.realized.map((r) => [r.id, r.gain])), nm = (id) => { const a = db.accounts.find((x) => x.id === id); return a ? a.name : '?'; };
    const list = (show === 'todo' ? todo : kept).slice().sort((x, y) => (x.date < y.date ? 1 : -1));
    const what = (t) => { const x = t.trade, c = (id) => (db.accounts.find((a) => a.id === id) || {}).cur || ''; return x.side === 'buy' ? `Buy ${x.qty} ${c(x.asset)}` : x.side === 'sell' ? `Sell ${x.qty} ${c(x.asset)}` : `Convert ${x.qty} ${c(x.asset)} to ${x.qty2} ${c(x.asset2)}`; };
    root.innerHTML = `<p class="hint">When you imported your Bluecoins file, Sukli guessed these ${all.length} entries are buys, sells or converts, because one side is a crypto or investment account. A trade changes your <b>realized gain</b>; a plain transfer does not. Check each one.</p>
      <div class="two"><div class="seg sm" role="group" aria-label="Show"><button type="button" class="${show === 'todo' ? 'on' : ''}" data-r="show" data-v="todo">To Review (${todo.length})</button><button type="button" class="${show === 'kept' ? 'on' : ''}" data-r="show" data-v="kept">Kept (${kept.length})</button></div>
      <div class="btnrow tight">${show === 'todo' && todo.length ? '' + button({ label: 'Keep All', kind: 'primary', size: 'sm', attr: { 'data-r': 'keepall' } }) + '' + button({ label: 'All Plain', kind: 'ghost', size: 'sm', attr: { 'data-r': 'plainall' } }) + '' : ''}</div></div>
      <label class="check"><input type="checkbox" data-r="rebuildon" ${db.settings.rebuildTrades === false ? '' : 'checked'}> <span>Guess trades again the next time I import a Bluecoins file</span></label>
      ${list.length ? `<div class="rows plain">${list.map((t) => { const g = gain.get(t.id); return `<div class="trvrow" data-id="${t.id}"><div class="trvtop"><strong>${esc(what(t))}</strong><b>${esc(fmt(t.trade.valueHome, HOME))}</b></div>
        <small class="muted">${esc(String(t.date).slice(0, 10))} · ${esc(nm(t.acct))} → ${esc(nm(t.toAcct))}${g != null ? ` · <span class="${g >= 0 ? 'cg' : 'cr'}">${g >= 0 ? '+' : '−'}${esc(fmt(Math.abs(g), HOME))} gain</span>` : ''}</small>
        <div class="btnrow left tight">${show === 'todo' ? `<button type="button" class="btn sm" data-r="keep" data-id="${t.id}">Keep as Trade</button>` : `<button type="button" class="btn sm ghost" data-r="unkeep" data-id="${t.id}">Back to Review</button>`}<button type="button" class="btn sm ghost" data-r="plain" data-id="${t.id}">Make It a Plain Transfer</button></div></div>`; }).join('')}</div>` : `<p class="empty">${show === 'todo' ? 'Nothing left to review.' : 'Nothing kept yet.'}</p>`}
      <div class="btnrow"><button type="button" class="btn primary" data-r="done">Done</button></div>`;
  };
  const setOk = (ids, ok) => commit((d) => { for (const t of d.txs) if (ids.includes(t.id) && t.trade) { if (ok) t.trade.ok = true; else delete t.trade.ok; stamp(t); } });
  // a plain transfer: the trade mark goes away; a fee that was tied to it becomes an ordinary expense again
  const plain = (ids) => commit((d) => { for (const t of d.txs) { if (ids.includes(t.id) && t.trade) { delete t.trade; stamp(t); } if (t.tradeOf && ids.includes(t.tradeOf)) delete t.tradeOf; } });
  draw();
  root.addEventListener('change', (e) => { if (e.target.dataset.r === 'rebuildon') commit((d) => { d.settings.rebuildTrades = e.target.checked; }); });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]'); if (!b || b.type === 'checkbox') return; const k = b.dataset.r, id = b.dataset.id, db = get();
    if (k === 'show') { show = b.dataset.v; draw(); }
    else if (k === 'keep') { setOk([id], true); draw(); }
    else if (k === 'unkeep') { setOk([id], false); draw(); }
    else if (k === 'plain') { plain([id]); draw(); toast('Now a plain transfer. Undo is in the history.'); }
    else if (k === 'keepall') { if (await confirmDialog(`Keep all ${pendingReview(db).length} as trades?`, 'Keep All')) { setOk(pendingReview(db).map((t) => t.id), true); draw(); } }
    else if (k === 'plainall') { if (await confirmDialog(`Make all ${pendingReview(db).length} plain transfers? Realized gains from them go away.`, 'Make Plain', true)) { plain(pendingReview(db).map((t) => t.id)); draw(); } }
    else if (k === 'done') s.close();
  });
}
ACT['trade-review'] = () => openTradeReview();
