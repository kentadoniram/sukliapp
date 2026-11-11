// A shared bill is ONE bill with linked shares: your part (the expense) and one "Lent" transfer per person.
// The Entries list shows the bill once (expandable); this window edits the whole bill so every share stays in step with the total.
import { button } from './components.js';
import { get, commit, stamp, softDelete, fmt, homeFx, homeRate, homePer, HOME } from './core.js';
import { esc, ACT, sheet, toast, confirmDialog } from './ui.js';
import { titleCase } from './entry.js';
import { openDatePicker, prettyDate } from './datepicker.js';
import { fxBlockHtml, openConverter } from './fxview.js';
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;
export function splitGroups(db) {
  const g = new Map();
  for (const t of db.txs) { if (t.deleted || !t.splitId) continue; if (!g.has(t.splitId)) g.set(t.splitId, { id: t.splitId, mine: null, lents: [] }); const x = g.get(t.splitId); if (t.paidFor && t.kind === 'expense') x.mine = t; else if (t.lent) x.lents.push(t); }
  const accts = new Map(db.accounts.map((a) => [a.id, a]));
  for (const x of g.values()) {
    x.head = x.mine || x.lents[0]; x.byId = new Set([...(x.mine ? [x.mine.id] : []), ...x.lents.map((l) => l.id)]);
    x.total = x.mine ? x.mine.paidFor.total : r2(x.lents.reduce((s, l) => s + l.amount, 0));
    x.cur = x.head ? x.head.cur : '';
    x.name = x.mine ? (x.mine.name || 'Shared bill') : ((x.lents[0] && x.lents[0].name.match(/^Paid for [^:]*:\s*(.+)$/)) || [0, 'Shared bill'])[1];
    x.people = x.lents.map((l) => ({ id: l.id, who: (accts.get(l.toAcct) || {}).name || '?', amt: l.amount }));
  }
  return g;
}
export const splitOf = (db, txId) => { for (const x of splitGroups(db).values()) if (x.byId.has(txId)) return x; return null; };
// every entry that belongs to the same shared bill as any of these ids (your part and each person's part), plus cashback entries of them
export function withMates(db, ids) {
  const out = new Set(ids);
  for (const x of splitGroups(db).values()) if ([...x.byId].some((i) => out.has(i))) for (const i of x.byId) out.add(i);
  for (const t of db.txs) if (!t.deleted && t.cashbackOf && out.has(t.cashbackOf)) out.add(t.id);
  return out;
}
// delete (to the recycle bin) these entries together with the rest of their shared bill; one Undo brings all of it back
export function deleteWithMates(ids, label = 'Moved to the recycle bin') {
  const all = [...withMates(get(), ids)], gone = [];
  commit((d) => { for (const t of d.txs) if (all.includes(t.id) && !t.deleted) { softDelete(t); gone.push(t.id); } });
  toast(gone.length > ids.length ? `Whole shared bill (${gone.length} entries) moved to the recycle bin` : label, { undo: () => commit((d) => { for (const t of d.txs) if (gone.includes(t.id)) { t.deleted = false; delete t.deletedAt; stamp(t); } }) });
  return gone;
}
export const splitOpen = new Set();
// the small bar under the bill's row, and the shares when it is open
export function splitExtra(g) {
  const open = splitOpen.has(g.id), n = g.people.length + (g.mine ? 1 : 0);
  let h = `<button type="button" class="splitbar" data-act="split-toggle" data-id="${g.id}" aria-expanded="${open}">${open ? '▾' : '▸'} Shared bill: ${n} ${n === 1 ? 'share' : 'shares'}${open ? '' : ' (tap to see who owes what)'}</button>`;
  if (open) h += `<div class="splitkids">${g.mine ? `<button type="button" class="splitkid" data-act="split-open" data-id="${g.mine.id}"><span>You</span><b>${fmt(g.mine.amount, g.cur)}</b></button>` : ''}${g.people.map((p) => `<button type="button" class="splitkid" data-act="split-open" data-id="${p.id}"><span>${esc(p.who)}</span><b>${fmt(p.amt, g.cur)}</b></button>`).join('')}</div>`;
  return h;
}
ACT['split-toggle'] = (el) => { const id = el.dataset.id; if (splitOpen.has(id)) splitOpen.delete(id); else splitOpen.add(id); window.dispatchEvent(new Event('sukli-render')); };
export function openSplit(txId) {
  const g = splitOf(get(), txId); if (!g) return false;
  const hd = g.head, home = (n) => (g.cur !== HOME && st.rate > 0 ? ` <small class="homeeq">≈ ${esc(fmt(n * st.rate, HOME))}</small>` : ''), st = { name: g.name, total: g.total, shares: g.people.map((p) => ({ ...p })), msg: '', rate: hd.cur === HOME ? 1 : homePer(get(), hd), date: String(hd.date), acct: hd.acct, cat: g.mine ? g.mine.cat || '' : '', notes: hd.notes || '', merchant: (g.mine || hd).merchant || hd.merchant || '', branch: (g.mine || hd).branch || hd.branch || '', mode: ((g.mine || hd).paidFor || {}).mode || 'amount', pct: [] };
  const db0 = get(), fromAccts = db0.accounts.filter((a) => !a.deleted && !a.archived && a.type !== 'owed' && (a.cur === g.cur || a.id === hd.acct)), expCats = (db0.categories || []).filter((c) => !c.deleted && c.kind === 'expense');
  const s = sheet('<div id="sb"></div>', { title: 'Shared Bill', wide: true }), root = s.el.querySelector('#sb');
  const mineOf = () => r2(st.total - st.shares.reduce((q, x) => q + x.amt, 0));
  /* split by: Equally / Percentages / Amounts. Equal and Percentages work the amounts out from the whole bill; your own part is what is left */
  const parties = () => st.shares.length + (g.mine ? 1 : 0);
  const pctFromAmt = () => { st.pct = st.shares.map((x) => (st.total > 0 ? Math.round((x.amt / st.total) * 10000) / 100 : 0)); };
  const applyMode = () => {
    if (st.mode === 'equal') { const each = r2(st.total / parties()); st.shares = st.shares.map((x) => ({ ...x, amt: each })); if (!g.mine && st.shares.length) st.shares[st.shares.length - 1].amt = r2(st.total - each * (st.shares.length - 1)); }
    else if (st.mode === 'pct') { if (st.pct.length !== st.shares.length) pctFromAmt(); st.shares = st.shares.map((x, i) => ({ ...x, amt: r2((st.total * (st.pct[i] || 0)) / 100) })); }
  };
  const known = [...new Set(db0.txs.filter((t) => !t.deleted && t.merchant).map((t) => t.merchant))].sort(), knownBr = () => [...new Set(db0.txs.filter((t) => !t.deleted && t.branch && t.merchant === st.merchant).map((t) => t.branch))].sort();
  const draw = () => { const m = mineOf(), hasMine = !!g.mine;
    root.innerHTML = `<p class="hint">One bill, saved in linked parts. Change the name or the total here and every part follows. The parts must always add up to the bill.</p>
      <label class="field"><span>What Is It?</span><input data-sb="name" value="${esc(st.name)}"></label>
      <div class="sbrow2"><label class="field"><span>Whole Bill (${esc(g.cur)})</span><input data-sb="total" inputmode="decimal" value="${st.total}"></label>
      <label class="field"><span>Paid From</span><select data-sb="acct">${fromAccts.map((a) => `<option value="${a.id}" ${a.id === st.acct ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label></div>
      <div class="field"><span>Date and Time</span><button type="button" class="acctbtn sbdate" data-sb="datepick">${esc(prettyDate(st.date))} ▾</button></div>
      <div class="sbrow2"><label class="field"><span>Merchant</span><input data-sb="merchant" list="sb-mer" autocomplete="off" placeholder="Optional" value="${esc(st.merchant)}"><datalist id="sb-mer">${known.map((m) => `<option value="${esc(m)}">`).join('')}</datalist></label>
      <label class="field"><span>Branch</span><input data-sb="branch" list="sb-br" autocomplete="off" placeholder="Optional" value="${esc(st.branch)}"><datalist id="sb-br">${knownBr().map((m) => `<option value="${esc(m)}">`).join('')}</datalist></label></div>
      ${hasMine ? `<label class="field"><span>Category (Your Part)</span><select data-sb="cat"><option value="">None</option>${expCats.map((c) => `<option value="${c.id}" ${c.id === st.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Notes</span><input data-sb="notes" value="${esc(st.notes)}"></label>
      ${g.cur !== HOME ? `<div id="sbfx">${fxBlockHtml({ from: g.cur, to: HOME, amount: st.total, rate: st.rate, open: 'data-sb="fxopen"', always: true })}<p class="hint">This rate is kept with the bill. It is the rate used to show every part in ${esc(HOME)}, and it never changes by itself.</p></div>` : ''}
      <h3>Who Owes What</h3>
      <div class="chips othmode">${[['equal', 'Split Equally'], ['amount', 'Set Each Amount'], ['pct', 'Percentages']].map(([k, l]) => `<button type="button" class="chip ${st.mode === k ? 'on' : ''}" data-sb="mode" data-v="${k}">${l}</button>`).join('')}</div>
      ${st.shares.map((x, i) => (st.mode === 'pct' ? `<label class="field"><span>${esc(x.who)} (%) <small class="homeeq">= ${esc(fmt(x.amt, g.cur))}</small>${home(x.amt)}</span><input data-sb="pct" data-i="${i}" inputmode="decimal" value="${st.pct[i] != null ? st.pct[i] : 0}"></label>` : st.mode === 'equal' ? `<div class="field"><span>${esc(x.who)}${home(x.amt)}</span><b class="sbfixed">${esc(fmt(x.amt, g.cur))}</b></div>` : `<label class="field"><span>${esc(x.who)}${home(x.amt)}</span><input data-sb="share" data-i="${i}" inputmode="decimal" value="${x.amt}"></label>`)).join('')}
      ${hasMine && st.mode === 'amount' ? `<label class="field"><span>Your Part${home(m)}</span><input data-sb="mine" inputmode="decimal" value="${m}"><small class="hint">Type your own share here. The whole bill becomes your share plus what everyone else owes.</small></label>` : ''}
      <div class="facts"><div><span>${hasMine ? 'Your Part (the rest)' : 'Left to Divide'}</span><b class="${m < -0.005 || (!hasMine && Math.abs(m) > 0.005) ? 'neg' : ''}">${fmt(m, g.cur)}${home(m)}</b></div><div><span>Whole Bill</span><b>${fmt(st.total, g.cur)}${home(st.total)}</b></div></div>
      ${st.msg ? `<p class="hint warnline">${esc(st.msg)}</p>` : ''}
      <div class="btnrow">${button({ label: 'Save', kind: 'primary', attr: { 'data-sb': 'save' } })}${button({ label: 'Delete the Whole Bill', kind: 'ghost', attr: { 'data-sb': 'del' } })}</div>`; };
  draw();
  root.addEventListener('change', (e) => { const k = e.target.dataset.sb, v = e.target.value;
    if (k === 'name') st.name = v;
    if (k === 'merchant') st.merchant = v.replace(/\s+/g, ' ').trim();
    if (k === 'branch') st.branch = titleCase(v.replace(/\s+/g, ' ').trim());   /* branch names are kept in Title Case */
    if (k === 'pct') { st.pct[+e.target.dataset.i] = Math.max(0, num(v)); applyMode(); }
    if (k === 'mine') { const mv = Math.max(0, r2(num(v))); st.total = r2(mv + st.shares.reduce((q, x) => q + x.amt, 0)); }
    if (k === 'acct') st.acct = v;
    if (k === 'cat') st.cat = v;
    if (k === 'notes') st.notes = v;
    if (k === 'total' && st.mode !== 'amount') { const nt = r2(num(v)); if (nt > 0) { st.total = nt; applyMode(); } }
    else if (k === 'total') { const nt = r2(num(v)); if (nt > 0 && st.total > 0) { const ratio = nt / st.total; st.shares = st.shares.map((x) => ({ ...x, amt: r2(x.amt * ratio) })); let over = r2(st.shares.reduce((q, x) => q + x.amt, 0) - nt); if (!g.mine && st.shares.length) st.shares[st.shares.length - 1].amt = r2(st.shares[st.shares.length - 1].amt - over); st.total = nt; } }
    if (k === 'share') st.shares[+e.target.dataset.i].amt = Math.max(0, r2(num(v)));
    st.msg = ''; draw(); });
  root.addEventListener('click', async (e) => { const b = e.target.closest('[data-sb]'); if (!b) return;
    if (b.dataset.sb === 'mode') { st.mode = b.dataset.v; if (st.mode === 'pct') pctFromAmt(); applyMode(); st.msg = ''; draw(); return; }
    if (b.dataset.sb === 'datepick') { openDatePicker(st.date, (v) => { st.date = v; st.msg = ''; draw(); }, { title: 'When Was It?' }); return; }
    if (b.dataset.sb === 'fxopen') { openConverter({ from: g.cur, to: HOME, amount: st.total, rate: st.rate, applyLabel: 'Use this rate', onApply: ({ rate }) => { if (rate > 0) { st.rate = rate; st.msg = ''; draw(); } } }); return; }
    if (b.dataset.sb === 'del') { if (!(await confirmDialog('Delete this whole bill and all of its parts?', 'Delete', true))) return; deleteWithMates([...g.byId]); s.close(); return; }
    if (b.dataset.sb !== 'save') return;
    const m = mineOf(), name = st.name.trim() || 'Shared bill', sum = r2(st.shares.reduce((q, x) => q + x.amt, 0));
    if (!(st.total > 0)) { st.msg = 'Type the whole bill.'; return draw(); }
    if (m < -0.005) { st.msg = `The parts are ${fmt(-m, g.cur)} more than the whole bill.`; return draw(); }
    if (!g.mine && Math.abs(m) > 0.005) { st.msg = `The parts must add up to the whole bill (${fmt(m, g.cur)} left).`; return draw(); }
    commit((d) => {
      const hx = (c) => homeFx(d, c) || 1, accts = new Map(d.accounts.map((a) => [a.id, a]));
      for (const id of g.byId) { const t = d.txs.find((q) => q.id === id); if (!t) continue;       // the same date, account and notes on every part of the bill
        if (st.date && st.date !== String(t.date)) t.date = st.date;
        if (st.acct) t.acct = st.acct;
        if (t.cur !== HOME && st.rate > 0) { t.hfx = st.rate; t.fx = st.rate * homeRate(d, t.date); }  /* one rate for the whole bill, kept with it */
        if (st.notes) t.notes = st.notes; else delete t.notes; if (st.merchant) t.merchant = st.merchant; else delete t.merchant; if (st.branch) t.branch = st.branch; else delete t.branch; stamp(t); }
      for (const x of st.shares) { const t = d.txs.find((q) => q.id === x.id); if (!t) continue; const pp = accts.get(t.toAcct);
        t.amount = x.amt; t.toAmount = pp && pp.cur !== t.cur ? r2(x.amt * (t.cur === HOME ? 1 : (t.fx || hx(t.cur)) / (homeRate(d, t.date) || 1)) / hx(pp.cur)) : x.amt; t.name = `Paid for ${x.who}: ${name}`; t.autoName = false; stamp(t); }
      if (g.mine) { const t = d.txs.find((q) => q.id === g.mine.id); if (st.cat !== undefined) t.cat = st.cat; t.name = name; t.autoName = false; t.paidFor = { ...t.paidFor, total: st.total, mode: st.mode }; if (m > 0.004) t.amount = m; else softDelete(t); stamp(t); }
    });
    toast('Saved'); s.close(); });
  return true;
}
ACT['split-open'] = (el) => openSplit(el.dataset.id);
