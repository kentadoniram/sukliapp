// The add / edit sheet, the category picker and the "add many at once" sheet.
import {
  get, commit, uid, stamp, nowStamp, toLocalInput, fromLocalInput, rateFor, fmt, freqNames, accountMap, catMap,
  findOrAddCategory, groupColor, groupLetter, BASE, balances, CUR, priv,
} from './core.js';
import { buildModel, predict, suggest, lookup } from './predict.js';
import { esc, sheet, toast, ic } from './ui.js';

// ---- models are rebuilt only when the data changed ----
const cache = {};
export function modelFor(kind) {
  const db = get();
  const key = db.txs.length + ':' + db.txs.reduce((m, t) => Math.max(m, t.updatedAt || 0), 0) + ':' + db.categories.length + ':' + db.categories.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0);
  if (!cache[kind] || cache[kind].key !== key) cache[kind] = { key, m: buildModel(db.txs, kind, db.categories) };
  return cache[kind].m;
}

const num = (s) => parseFloat(String(s ?? '').replace(/,/g, ''));
const hourOf = (d) => parseInt(String(d).slice(11, 13), 10);
const prec = (x) => String(Number(Number(x).toPrecision(6)));

function blank() {
  const db = get();
  const accts = db.accounts.filter((a) => !a.deleted && !a.archived);
  const last = accts.find((a) => a.id === db.settings.lastAcct) || accts.find((a) => a.include) || accts[0];
  return { kind: 'expense', amount: '', name: '', acct: last ? last.id : '', toAcct: '', toAmount: '', fx: '', cat: '',
    catTouched: false, acctTouched: false, date: nowStamp(), notes: '', items: [], flag: null, id: null, pred: null, showItems: false };
}
function fromTx(t) {
  return { kind: t.kind, amount: String(t.amount), name: t.name || '', acct: t.acct, toAcct: t.toAcct || '',
    toAmount: t.toAmount != null ? String(t.toAmount) : '', fx: t.fx ? prec(t.fx) : '', cat: t.cat || '',
    catTouched: true, acctTouched: true, date: t.date, notes: t.notes || '', flag: t.flag || null, id: t.id, pred: null,
    items: (t.items || []).map((i) => ({ n: i.n, amt: String(i.amt), cat: i.cat || '' })), showItems: !!(t.items && t.items.length) };
}

function acctOptions(sel, skip) {
  const db = get();
  return db.accounts.filter((a) => !a.deleted && a.id !== skip && (!a.archived || a.id === sel))
    .sort((a, b) => (b.include - a.include) || a.name.localeCompare(b.name))
    .map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} · ${a.cur}</option>`).join('');
}
function catOptions(sel, kind) {
  const db = get();
  const groups = new Map();
  for (const c of db.categories) {
    if (c.deleted || !(c.kind === kind || c.kind === 'both')) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) =>
    `<optgroup label="${esc(g)}">${cs.sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
      `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
}

export function openEntry(opts = {}) {
  const db = get();
  const existing = opts.id ? db.txs.find((t) => t.id === opts.id) : null;
  const f = existing ? fromTx(existing) : { ...blank(), ...(opts.preset || {}) };
  if (!db.accounts.some((a) => !a.deleted)) {
    toast('Add an account first (Accounts tab), then you can record entries.');
    location.hash = '#/accounts';
    return;
  }
  const s = sheet('<form id="entry" novalidate></form>', { title: existing ? 'Edit entry' : 'New entry', wide: true });
  const form = s.el.querySelector('form');
  form.innerHTML = `
    <div id="freq" class="chips"></div>
    <div class="seg" id="seg" role="group" aria-label="Entry type"></div>
    <div class="field amount"><span class="amtlabel">Amount <button type="button" class="linkbtn eye" data-e="eye" aria-label="Hide or show amounts">${priv.on ? 'Show' : 'Hide'} amounts</button></span>
      <label class="amtwrap"><b id="sym"></b><input id="f-amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(f.amount)}" ${existing ? '' : 'autofocus'}></label></div>
    <div id="fxline"></div>
    <div class="field" id="namefield"><span id="namelabel">What was it?</span>
      <input id="f-name" autocomplete="off" value="${esc(f.name)}" placeholder="e.g. Life Tsukagoshi, bus, salary">
      <div id="sugg" class="sugg" hidden></div></div>
    <div id="acctrow"></div>
    <div id="catrow"></div>
    <div id="itemsrow"></div>
    <label class="field"><span>When</span><input id="f-date" type="datetime-local" value="${toLocalInput(f.date)}"></label>
    <label class="field"><span>Notes</span><textarea id="f-notes" rows="2" placeholder="Optional">${esc(f.notes)}</textarea></label>
    <p class="err" id="err" role="alert" hidden></p>
    <div class="btnrow" id="btns"></div>`;
  const $f = (id) => form.querySelector('#' + id);
  const acctOf = (id) => get().accounts.find((a) => a.id === id);

  // ---------- renderers ----------
  function renderFreq() {
    const el = $f('freq');
    if (existing || f.kind === 'transfer') { el.innerHTML = ''; return; }
    const names = freqNames(get(), 90, 8, f.kind);
    el.innerHTML = names.length ? `<span class="chiplabel">Usual</span>` + names.map((n) => `<button type="button" class="chip" data-e="pick" data-v="${esc(n)}">${esc(n)}</button>`).join('') : '';
  }
  function renderSeg() {
    const k = [['expense', 'Spent'], ['income', 'Got'], ['transfer', 'Moved']];
    $f('seg').innerHTML = k.map(([v, l]) => `<button type="button" data-e="kind" data-v="${v}" aria-pressed="${f.kind === v}" class="${f.kind === v ? 'on' : ''}">${l}</button>`).join('');
    $f('namelabel').textContent = f.kind === 'transfer' ? 'Label (optional)' : f.kind === 'income' ? 'Where from?' : 'What was it?';
  }
  function renderAccts() {
    const el = $f('acctrow');
    const a = acctOf(f.acct), b = acctOf(f.toAcct);
    $f('sym').textContent = a ? ((CUR[a.cur] || { sym: a.cur + ' ' }).sym) : '';
    if (f.kind !== 'transfer') {
      el.innerHTML = `<label class="field"><span>Account</span><select id="f-acct">${acctOptions(f.acct)}</select></label>`;
    } else {
      if (!f.toAcct) { const o = get().accounts.find((x) => !x.deleted && !x.archived && x.id !== f.acct); f.toAcct = o ? o.id : ''; }
      const b2 = acctOf(f.toAcct);
      const cross = a && b2 && a.cur !== b2.cur;
      el.innerHTML = `<div class="two"><label class="field"><span>From</span><select id="f-acct">${acctOptions(f.acct, f.toAcct)}</select></label>
        <label class="field"><span>To</span><select id="f-to">${acctOptions(f.toAcct, f.acct)}</select></label></div>
        ${cross ? `<label class="field"><span>Amount received (${b2.cur})</span><input id="f-toamt" inputmode="decimal" value="${esc(f.toAmount)}" placeholder="0"></label>` : ''}`;
    }
  }
  function renderFx() {
    const a = acctOf(f.acct);
    const el = $f('fxline');
    if (!a || a.cur === BASE) { el.innerHTML = ''; return; }
    if (!f.fx) { const r = rateFor(get(), a.cur); f.fx = r ? prec(r) : ''; }
    el.innerHTML = `<div class="fxline"><em id="fxval" class="fxbig"></em><span>1 ${a.cur} =</span><input id="f-fx" inputmode="decimal" aria-label="Exchange rate" value="${esc(f.fx)}"><span>${BASE}</span></div>`;
    updateFxVal();
  }
  function updateFxVal() {
    const v = $f('fxval'), a = acctOf(f.acct);
    if (v && a) { const x = num(f.amount) * num(f.fx); v.textContent = x > 0 ? '≈ ' + fmt(x, BASE) : ''; }
    const sh = get().settings.showHome !== false;
    const fl = form.querySelector('.fxline'); if (fl) fl.classList.toggle('quiet', !sh);
  }
  function topCats(kind, n) {
    const m = modelFor(kind);
    return [...m.classes.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, n).map(([id]) => ({ id, p: 0 }));
  }
  function renderCats() {
    const el = $f('catrow');
    if (f.kind === 'transfer') { el.innerHTML = ''; return; }
    const cm = catMap(get());
    let list = (f.pred && f.pred.cats.length && f.name.trim()) ? f.pred.cats.slice() : topCats(f.kind, 4);
    if (f.cat && !list.some((x) => x.id === f.cat)) list.unshift({ id: f.cat, p: 0 });
    list = list.filter((x) => cm.has(x.id)).slice(0, 5);
    const guess = f.pred && f.name.trim() && !f.catTouched && f.pred.cats[0];
    el.innerHTML = `<div class="field"><span>Category ${guess ? `<small class="muted">· guessed from your history, ${Math.round(guess.p * 100)}% sure</small>` : ''}</span>
      <div class="chips">${list.map((x) => { const c = cm.get(x.id); return `<button type="button" class="chip cat ${f.cat === x.id ? 'on' : ''}" data-e="cat" data-v="${x.id}"><i style="background:${groupColor(c.group)}">${groupLetter(c.group)}</i>${esc(c.name)}</button>`; }).join('')}
      <button type="button" class="chip more" data-e="allcats">All</button>
      <button type="button" class="chip more" data-e="newcat">+ New</button></div></div>`;
  }
  function itemSum() { return f.items.reduce((s, i) => s + (num(i.amt) || 0), 0); }
  function renderItems() {
    const el = $f('itemsrow');
    if (f.kind !== 'expense') { el.innerHTML = ''; return; }
    if (!f.showItems) { el.innerHTML = `<button type="button" class="linkbtn split" data-e="items-on">${ic('split')} Split into items (groceries, receipts)</button>`; return; }
    el.innerHTML = `<div class="field items"><span>Items on this receipt</span>
      <div id="itemlist">${f.items.map((it, i) => `<div class="item" data-i="${i}">
        <input class="in-n" placeholder="Item" value="${esc(it.n)}" aria-label="Item name">
        <input class="in-a" inputmode="decimal" placeholder="0.00" value="${esc(it.amt)}" aria-label="Item price">
        <select class="in-c" aria-label="Item category"><option value="">Same as above</option>${catOptions(it.cat, 'expense')}</select>
        <button type="button" class="iconbtn" data-e="item-del" data-v="${i}" aria-label="Remove item">${ic('x')}</button></div>`).join('')}</div>
      <div class="itemfoot"><button type="button" class="linkbtn" data-e="item-add">+ Add item</button><span id="itemleft"></span></div></div>`;
    updateItemLeft();
  }
  function updateItemLeft() {
    const el = $f('itemleft'); if (!el) return;
    const a = acctOf(f.acct); const total = num(f.amount) || 0; const left = total - itemSum();
    const cur = a ? a.cur : BASE;
    el.className = Math.abs(left) < 0.005 ? 'ok' : 'off';
    el.textContent = Math.abs(left) < 0.005 ? 'Items add up to the total' : (left > 0 ? `${fmt(left, cur)} not assigned yet` : `Items are ${fmt(-left, cur)} over the total`);
  }
  function renderBtns() {
    $f('btns').innerHTML = `${existing ? `<button type="button" class="btn danger ghost" data-e="del">Delete</button>` : ''}
      ${existing ? '' : `<button type="button" class="btn ghost" data-e="save-again">Save and add another</button>`}
      <button type="button" class="btn" data-e="save">Save</button>`;
  }

  // ---------- prediction ----------
  function refreshPred() {
    if (f.kind === 'transfer') return;
    const a = acctOf(f.acct);
    f.pred = predict(modelFor(f.kind), f.name, num(f.amount) || 0, { acct: f.acct, cur: a && a.cur, hour: hourOf(f.date) });
    if (!f.catTouched && f.pred.cats.length && f.name.trim()) f.cat = f.pred.cats[0].id;
    renderCats();
  }
  function renderSugg() {
    const el = $f('sugg');
    const list = f.kind === 'transfer' ? [] : suggest(modelFor(f.kind), f.name, 5).filter((x) => x.name.toLowerCase() !== f.name.trim().toLowerCase());
    el.hidden = !list.length;
    el.innerHTML = list.map((x) => `<button type="button" data-e="pick" data-v="${esc(x.name)}">${esc(x.name)} <small>${x.n}×</small></button>`).join('');
  }
  function applyPick(name) {
    f.name = name; $f('f-name').value = name;
    const lk = lookup(modelFor(f.kind), name);
    if (lk) {
      if (!f.catTouched) f.cat = lk.cat;
      if (!f.acctTouched && lk.acct && acctOf(lk.acct) && !acctOf(lk.acct).archived) { f.acct = lk.acct; f.fx = ''; renderAccts(); renderFx(); }
      if (!num(f.amount) && lk.amount) { f.amount = String(lk.amount); $f('f-amount').value = f.amount; }
    }
    refreshPred(); renderSugg(); updateFxVal(); updateItemLeft();
    $f(num(f.amount) ? 'f-name' : 'f-amount').focus();
  }

  // ---------- events ----------
  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'f-amount') { f.amount = e.target.value; updateFxVal(); updateItemLeft(); if (f.name.trim()) refreshPred(); }
    else if (id === 'f-name') { f.name = e.target.value; refreshPred(); renderSugg(); }
    else if (id === 'f-fx') { f.fx = e.target.value; updateFxVal(); }
    else if (id === 'f-toamt') f.toAmount = e.target.value;
    else if (id === 'f-date') f.date = fromLocalInput(e.target.value || toLocalInput(f.date));
    else if (id === 'f-notes') f.notes = e.target.value;
    else if (e.target.closest('.item')) {
      const row = e.target.closest('.item'), i = +row.dataset.i, it = f.items[i];
      if (e.target.classList.contains('in-n')) {
        it.n = e.target.value;
        if (!it.catTouched) {
          const p = predict(modelFor('expense'), it.n, num(it.amt) || 0, {});
          const sel = row.querySelector('.in-c');
          if (p.cats[0] && it.n.trim().length > 2 && p.conf > 0.35) { it.cat = p.cats[0].id; sel.value = it.cat; } else { it.cat = ''; sel.value = ''; }
        }
      } else if (e.target.classList.contains('in-a')) { it.amt = e.target.value; updateItemLeft(); }
    }
  });
  form.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'f-acct') { f.acct = e.target.value; f.acctTouched = true; f.fx = ''; if (f.kind === 'transfer' && f.toAcct === f.acct) f.toAcct = ''; renderAccts(); renderFx(); refreshPred(); updateItemLeft(); }
    else if (id === 'f-to') { f.toAcct = e.target.value; renderAccts(); }
    else if (e.target.classList.contains('in-c')) { const it = f.items[+e.target.closest('.item').dataset.i]; it.cat = e.target.value; it.catTouched = true; }
  });
  form.addEventListener('focusout', () => setTimeout(() => { const el = $f('sugg'); if (el && !el.contains(document.activeElement)) el.hidden = true; }, 150));
  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    const v = b.dataset.v;
    switch (b.dataset.e) {
      case 'kind':
        f.kind = v; if (v !== 'expense') { f.items = []; f.showItems = false; }
        if (!f.catTouched || v === 'transfer') { f.cat = ''; f.catTouched = false; }
        else { const c = catMap(get()).get(f.cat); if (c && !(c.kind === v || c.kind === 'both')) { f.cat = ''; f.catTouched = false; } }
        renderSeg(); renderFreq(); renderAccts(); renderFx(); refreshPred(); renderCats(); renderItems(); renderSugg(); break;
      case 'pick': applyPick(v); break;
      case 'cat': f.cat = v; f.catTouched = true; renderCats(); break;
      case 'eye': priv.set(!priv.on); document.body.classList.toggle('hide-amts', priv.on); b.textContent = (priv.on ? 'Show' : 'Hide') + ' amounts'; updateFxVal(); updateItemLeft(); window.dispatchEvent(new Event('sukli-render')); break;
      case 'newcat': openCategoryForm({ kind: f.kind, keywords: f.name.trim().toLowerCase(), onDone: (c) => { f.cat = c.id; f.catTouched = true; refreshPred(); renderCats(); } }); break;
      case 'allcats': openCategoryPicker(f.kind, (id) => { f.cat = id; f.catTouched = true; renderCats(); }); break;
      case 'items-on': f.showItems = true; if (!f.items.length) f.items.push({ n: '', amt: '', cat: '' }); renderItems(); break;
      case 'item-add': f.items.push({ n: '', amt: '', cat: '' }); renderItems(); form.querySelectorAll('.item .in-n')[f.items.length - 1].focus(); break;
      case 'item-del': f.items.splice(+v, 1); renderItems(); break;
      case 'save': save(false); break;
      case 'save-again': save(true); break;
      case 'del': {
        const t = get().txs.find((x) => x.id === f.id);
        commit(() => { t.deleted = true; stamp(t); });
        s.close();
        toast('Entry deleted', { undo: () => commit(() => { t.deleted = false; stamp(t); }) });
        break;
      }
    }
  });

  function fail(msg) { const el = $f('err'); el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); }

  function save(again) {
    const db = get();
    const a = acctOf(f.acct);
    const amount = num(f.amount);
    if (!(amount > 0)) return fail('Enter an amount greater than zero.');
    if (!a) return fail('Choose an account.');
    let fx = 1;
    if (a.cur !== BASE) { fx = num(f.fx); if (!(fx > 0)) return fail(`Enter the exchange rate (how many ${BASE} one ${a.cur} is worth).`); }
    let toAmount = null;
    if (f.kind === 'transfer') {
      const b = acctOf(f.toAcct);
      if (!b || b.id === a.id) return fail('Choose two different accounts.');
      toAmount = a.cur === b.cur ? amount : num(f.toAmount);
      if (!(toAmount > 0)) return fail(`Enter how much arrived in ${b.name} (${b.cur}).`);
    }
    let cat = f.cat, flag = null, items;
    if (f.kind !== 'transfer') {
      if (!cat) {
        let c; commit((d) => { c = findOrAddCategory(d, 'Others', 'Uncategorized', f.kind); });
        cat = c.id; flag = 'review';
      } else if (!f.catTouched && !existing && f.pred && f.pred.conf < 0.6 && f.name.trim() && modelFor(f.kind).total > 0) flag = 'review';
    } else cat = '';
    if (f.kind === 'expense') {
      items = f.items.filter((i) => i.n.trim() || num(i.amt)).map((i) => ({ n: i.n.trim(), amt: num(i.amt) || 0, cat: i.cat || '' }));
      if (items.length && Math.abs(items.reduce((s2, i) => s2 + i.amt, 0) - amount) >= 0.01) flag = 'review';
    }
    const rec = { kind: f.kind, amount, cur: a.cur, fx, date: f.date, name: f.name.trim(), cat, acct: a.id,
      toAcct: f.kind === 'transfer' ? f.toAcct : '', toAmount, notes: f.notes.trim(), items: items && items.length ? items : [], flag };
    let savedAs;
    commit((d) => {
      if (existing) { const t = d.txs.find((x) => x.id === existing.id); Object.assign(t, rec); stamp(t); savedAs = t; }
      else { savedAs = stamp({ id: uid(), ...rec }); d.txs.push(savedAs); }
      d.settings.lastAcct = a.id;
    });
    s.close();
    toast(rec.flag === 'review' ? 'Saved. It is in Review so you can confirm the category later.' : 'Saved');
    if (again) openEntry({ preset: { acct: a.id, acctTouched: true } });
  }

  renderFreq(); renderSeg(); renderAccts(); renderFx(); renderItems(); renderBtns();
  if (existing) { refreshPred(); f.cat = existing.cat || ''; renderCats(); } else renderCats();
  updateFxVal();
}

export function openCategoryPicker(kind, onPick) {
  const db = get();
  const groups = new Map();
  for (const c of db.categories) {
    if (c.deleted || !(c.kind === kind || c.kind === 'both')) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  const s = sheet(`<input type="search" id="catq" class="search" placeholder="Search categories" autofocus>
    <div id="catlist"></div>
    <div class="newcat"><button type="button" class="btn ghost wide" id="newcat-btn">+ New category</button></div>`, { title: 'All categories' });
  const list = s.el.querySelector('#catlist');
  const draw = (q = '') => {
    q = q.toLowerCase();
    list.innerHTML = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, cs]) => {
      const m = cs.filter((c) => !q || c.name.toLowerCase().includes(q) || g.toLowerCase().includes(q));
      return m.length ? `<div class="catgroup"><h3><i style="background:${groupColor(g)}">${groupLetter(g)}</i>${esc(g)}</h3><div class="chips">${m.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<button type="button" class="chip" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>` : '';
    }).join('') || '<p class="muted">Nothing matches.</p>';
  };
  draw();
  s.el.querySelector('#catq').addEventListener('input', (e) => draw(e.target.value));
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { onPick(b.dataset.id); s.close(); } });
  s.el.querySelector('#newcat-btn').onclick = () => openCategoryForm({ kind, onDone: (c) => { onPick(c.id); s.close(); } });
}

// create or edit a category. Keywords make it predictable straight away: any entry whose name contains one is guessed into it.
export function openCategoryForm({ id = null, kind = 'expense', group = '', keywords = '', onDone } = {}) {
  const db = get();
  const c = id ? db.categories.find((x) => x.id === id) : null;
  const groups = [...new Set(db.categories.filter((x) => !x.deleted && (x.kind === kind || x.kind === 'both')).map((x) => x.group))].sort();
  const isInc = (c ? c.kind : kind) === 'income';
  const s = sheet(`<form id="catform">
    <label class="field"><span>Group (the bigger heading)</span><input name="g" list="grouplist" value="${esc(c ? c.group : group)}" placeholder="${isInc ? 'e.g. Employer, Side income' : 'e.g. Food &amp; Drinks, Health'}" required autocomplete="off"></label>
    <datalist id="grouplist">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>
    <label class="field"><span>Category (the detail)</span><input name="n" value="${esc(c ? c.name : '')}" placeholder="${isInc ? 'e.g. Bonus, Freelance, Refund' : 'e.g. Gym, Vet, Gifts'}" required autocomplete="off" ${id ? '' : 'autofocus'}></label>
    <label class="field"><span>Words that should land here (optional)</span><input name="k" value="${esc(c ? c.keywords || '' : keywords)}" placeholder="${isInc ? 'e.g. bonus, 13th month' : 'e.g. gym, fitness, anytime'}" autocomplete="off" autocapitalize="off"></label>
    <p class="hint">Separate words with commas. Next time a name contains one of them, this category is guessed. It also learns from every entry you put here.</p>
    <div class="btnrow">${c ? '<button type="button" class="btn danger ghost" data-del>Delete</button>' : ''}<button class="btn">${c ? 'Save' : 'Add and use'}</button></div></form>`,
  { title: c ? 'Edit category' : (isInc ? 'New income category' : 'New category') });
  s.el.querySelector('#catform').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const g = fd.get('g').trim(), n = fd.get('n').trim(), k = fd.get('k').trim();
    let out;
    commit((d) => {
      if (c) {
        const x = d.categories.find((q) => q.id === c.id);
        if (x.group !== g) { for (const b of d.budgets) if (!b.deleted && b.group === x.group && !d.categories.some((o) => o !== x && !o.deleted && o.group === x.group)) { b.group = g; stamp(b); } }
        Object.assign(x, { group: g, name: n, keywords: k }); stamp(x); out = x;
      } else {
        out = findOrAddCategory(d, g, n, kind);
        if (k) { out.keywords = [out.keywords, k].filter(Boolean).join(', '); stamp(out); }
      }
    });
    s.close(); if (onDone) onDone(out);
  };
  const del = s.el.querySelector('[data-del]');
  if (del) del.onclick = () => {
    commit((d) => { const x = d.categories.find((q) => q.id === c.id); x.deleted = true; stamp(x); });
    s.close(); toast('Category removed. Old entries keep their label.'); if (onDone) onDone(null);
  };
}

// ---------- add many at once ----------
export function openBulk() {
  const db = get();
  const s = sheet(`<form id="bulk"><p class="hint">One entry per line: a name, then the amount. Start a line with + for money received.
Example:<br><code>bus 30<br>mcdo 358.5<br>+ refund 1200</code>The app guesses categories and puts anything it is unsure about in Review.</p>
    <label class="field"><span>Account for all of them</span><select id="b-acct">${acctOptions(db.settings.lastAcct)}</select></label>
    <label class="field"><span>Date</span><input id="b-date" type="date" value="${nowStamp().slice(0, 10)}"></label>
    <label class="field"><span>Lines</span><textarea id="b-text" rows="8" placeholder="bus 30&#10;pandesal 45" autofocus></textarea></label>
    <p class="err" id="b-err" hidden></p>
    <div class="btnrow"><button class="btn">Add all</button></div></form>`, { title: 'Add many at once' });
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const db2 = get();
    const aid = s.el.querySelector('#b-acct').value, a = db2.accounts.find((x) => x.id === aid);
    const day = s.el.querySelector('#b-date').value || nowStamp().slice(0, 10);
    const lines = s.el.querySelector('#b-text').value.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = [], bad = [];
    for (const l of lines) {
      const income = l.startsWith('+');
      const m = l.replace(/^\+\s*/, '').match(/^(.*?)[\s:]*[₱¥$]?\s*(-?[\d,]+(?:\.\d+)?)\s*$/);
      if (!m || !m[1].trim() || !(num(m[2]) > 0)) { bad.push(l); continue; }
      out.push({ name: m[1].trim(), amount: Math.abs(num(m[2])), kind: income ? 'income' : 'expense' });
    }
    const err = s.el.querySelector('#b-err');
    if (!out.length) { err.textContent = 'No valid lines found. Each line needs a name and an amount, like “bus 30”.'; err.hidden = false; return; }
    const fx = a.cur === BASE ? 1 : (rateFor(db2, a.cur) || 1);
    let flagged = 0;
    commit((d) => {
      out.forEach((o, i) => {
        const m = modelFor(o.kind);
        const p = predict(m, o.name, o.amount, { acct: aid, cur: a.cur, hour: 12 });
        const lk = lookup(m, o.name);
        let cat = p.cats[0] && p.cats[0].id, flag = null;
        if (!cat) { cat = findOrAddCategory(d, 'Others', 'Uncategorized', o.kind).id; flag = 'review'; }
        else if (p.conf < 0.6) flag = 'review';
        if (flag) flagged++;
        d.txs.push(stamp({ id: uid(), kind: o.kind, date: `${day} 12:${String(i % 60).padStart(2, '0')}:00`, name: o.name, amount: o.amount,
          cur: a.cur, fx, cat, acct: aid, notes: '', items: [], flag, pred: { cat, conf: p.conf } }));
      });
      d.settings.lastAcct = aid;
    });
    s.close();
    toast(`Added ${out.length} ${out.length === 1 ? 'entry' : 'entries'}${bad.length ? `, skipped ${bad.length} unreadable ${bad.length === 1 ? 'line' : 'lines'}` : ''}${flagged ? `. ${flagged} to confirm in Review.` : '.'}`);
  };
}
