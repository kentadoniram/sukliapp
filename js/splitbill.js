// A shared bill is ONE bill with linked shares: your part (the expense) and one "Lent" transfer per person.
// The Entries list shows the bill once (expandable); this window edits the whole bill so every share stays in step with the total.
import { get, commit, stamp, softDelete, fmt, homeFx, homeRate, HOME } from './core.js';
import { esc, ACT, sheet, toast, confirmDialog } from './ui.js';
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
  const st = { name: g.name, total: g.total, shares: g.people.map((p) => ({ ...p })), msg: '' };
  const s = sheet('<div id="sb"></div>', { title: 'Shared Bill', wide: true }), root = s.el.querySelector('#sb');
  const mineOf = () => r2(st.total - st.shares.reduce((q, x) => q + x.amt, 0));
  const draw = () => { const m = mineOf(), hasMine = !!g.mine;
    root.innerHTML = `<p class="hint">One bill, saved in linked parts. Change the name or the total here and every part follows. The parts must always add up to the bill.</p>
      <label class="field"><span>What Is It?</span><input data-sb="name" value="${esc(st.name)}"></label>
      <label class="field"><span>Whole Bill (${esc(g.cur)})</span><input data-sb="total" inputmode="decimal" value="${st.total}"></label>
      <h3>Who Owes What</h3>
      ${st.shares.map((x, i) => `<label class="field"><span>${esc(x.who)}</span><input data-sb="share" data-i="${i}" inputmode="decimal" value="${x.amt}"></label>`).join('')}
      <div class="facts"><div><span>${hasMine ? 'Your Part (the rest)' : 'Left to Divide'}</span><b class="${m < -0.005 || (!hasMine && Math.abs(m) > 0.005) ? 'neg' : ''}">${fmt(m, g.cur)}</b></div><div><span>Whole Bill</span><b>${fmt(st.total, g.cur)}</b></div></div>
      ${st.msg ? `<p class="hint warnline">${esc(st.msg)}</p>` : ''}
      <div class="btnrow"><button class="btn" data-sb="save">Save</button><button class="btn ghost" data-sb="del">Delete the Whole Bill</button></div>`; };
  draw();
  root.addEventListener('change', (e) => { const k = e.target.dataset.sb, v = e.target.value;
    if (k === 'name') st.name = v;
    if (k === 'total') { const nt = r2(num(v)); if (nt > 0 && st.total > 0) { const ratio = nt / st.total; st.shares = st.shares.map((x) => ({ ...x, amt: r2(x.amt * ratio) })); let over = r2(st.shares.reduce((q, x) => q + x.amt, 0) - nt); if (!g.mine && st.shares.length) st.shares[st.shares.length - 1].amt = r2(st.shares[st.shares.length - 1].amt - over); st.total = nt; } }
    if (k === 'share') st.shares[+e.target.dataset.i].amt = Math.max(0, r2(num(v)));
    st.msg = ''; draw(); });
  root.addEventListener('click', async (e) => { const b = e.target.closest('[data-sb]'); if (!b) return;
    if (b.dataset.sb === 'del') { if (!(await confirmDialog('Delete this whole bill and all of its parts?', 'Delete', true))) return; commit((d) => { for (const t of d.txs) if (g.byId.has(t.id)) softDelete(t); }); toast('Deleted'); s.close(); return; }
    if (b.dataset.sb !== 'save') return;
    const m = mineOf(), name = st.name.trim() || 'Shared bill', sum = r2(st.shares.reduce((q, x) => q + x.amt, 0));
    if (!(st.total > 0)) { st.msg = 'Type the whole bill.'; return draw(); }
    if (m < -0.005) { st.msg = `The parts are ${fmt(-m, g.cur)} more than the whole bill.`; return draw(); }
    if (!g.mine && Math.abs(m) > 0.005) { st.msg = `The parts must add up to the whole bill (${fmt(m, g.cur)} left).`; return draw(); }
    commit((d) => {
      const hx = (c) => homeFx(d, c) || 1, accts = new Map(d.accounts.map((a) => [a.id, a]));
      for (const x of st.shares) { const t = d.txs.find((q) => q.id === x.id); if (!t) continue; const pp = accts.get(t.toAcct);
        t.amount = x.amt; t.toAmount = pp && pp.cur !== t.cur ? r2(x.amt * (t.cur === HOME ? 1 : (t.fx || hx(t.cur)) / (homeRate(d, t.date) || 1)) / hx(pp.cur)) : x.amt; t.name = `Paid for ${x.who}: ${name}`; t.autoName = false; stamp(t); }
      if (g.mine) { const t = d.txs.find((q) => q.id === g.mine.id); t.name = name; t.autoName = false; t.paidFor = { ...t.paidFor, total: st.total }; if (m > 0.004) t.amount = m; else softDelete(t); stamp(t); }
    });
    toast('Saved'); s.close(); });
  return true;
}
ACT['split-open'] = (el) => openSplit(el.dataset.id);
