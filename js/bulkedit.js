// Change several entries at once (Entries > Select entries > Edit). Only the boxes you fill in are changed; amounts are never touched.
import { get, commit, stamp, accLabel, catMap, dayLabel } from './core.js';
import { sheet, esc, toast } from './ui.js';
import { parseTags, joinTags } from './tags.js';
import { openDatePicker } from './datepicker.js';

const BEFORE = ['kind', 'date', 'name', 'amount', 'cur', 'fx', 'acct', 'toAcct', 'toAmount', 'cat', 'notes', 'fee', 'feeCat', 'feeBy'];
const distinct = (l) => [...new Set(l)];

export function openBulkEdit(ids, onDone) {
  const db = get(), set = new Set(ids), txs = db.txs.filter((t) => set.has(t.id) && !t.deleted), n = txs.length; if (!n) return;
  const cm = catMap(db), am = new Map(db.accounts.map((a) => [a.id, a])), nonT = txs.filter((t) => t.kind !== 'transfer');
  // what the selection looks like now: one value, or a note that they differ
  const info = (vals, show) => { const d = distinct(vals); return d.length <= 1 ? `<small class="muted">All ${vals.length} are the same${d.length && d[0] !== '' ? `: ${esc(show(d[0]))}` : ' (empty)'}.</small>` : `<small class="mixed">Not the same: ${d.length} different values. Changing it sets all ${vals.length} to your new value.</small>`; };
  const kinds = distinct(nonT.map((t) => t.kind)), cats = db.categories.filter((c) => !c.deleted && (kinds.length !== 1 || c.kind === kinds[0] || c.kind === 'both'));
  const groups = [...new Set(cats.map((c) => c.group))].sort();
  const accts = db.accounts.filter((a) => !a.deleted && !a.archived);
  const tagCount = new Map(); for (const t of txs) for (const x of parseTags(t.labels)) tagCount.set(x, (tagCount.get(x) || 0) + 1);
  const s = sheet(`<form id="be"><p class="hint">Changing <b>${n}</b> ${n === 1 ? 'entry' : 'entries'}. Only the boxes you change are applied, to all of them. Amounts are not changed here.</p>
    <label class="field"><span>Name</span><input id="be-name" placeholder="Keep as is" autocomplete="off">${info(txs.map((t) => t.name || ''), (v) => v)}</label>
    <label class="field"><span>Category (group and name)</span><select id="be-cat"><option value="">Keep as is</option>${groups.map((g) => `<optgroup label="${esc(g)}">${cats.filter((c) => c.group === g).sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select>${nonT.length ? info(nonT.map((t) => t.cat || ''), (v) => { const c = cm.get(v); return c ? `${c.group} · ${c.name}` : 'none'; }) : '<small class="muted">Transfers have no category.</small>'}</label>
    <div class="field"><span>Tags</span><div class="seg sm three" role="group" aria-label="Tag action">${[['add', 'Add'], ['replace', 'Replace all'], ['remove', 'Remove']].map(([v, l], i) => `<button type="button" data-tm="${v}" class="${i ? '' : 'on'}" aria-pressed="${i ? 'false' : 'true'}">${l}</button>`).join('')}</div>
      <input id="be-tags" placeholder="Keep as is, or type tags separated by commas" autocomplete="off">
      <small class="muted">${tagCount.size ? `In the selection: ${[...tagCount].map(([k, c]) => `#${esc(k)} (${c})`).join(', ')}` : 'No tags on these entries yet.'}</small></div>
    <label class="field"><span>Notes</span><input id="be-notes" placeholder="Keep as is" autocomplete="off">${info(txs.map((t) => t.notes || ''), (v) => v)}</label>
    <label class="field"><span>Account (not for transfers)</span><select id="be-acct"><option value="">Keep as is</option>${accts.map((a) => `<option value="${a.id}">${esc(accLabel(a))} · ${esc(a.cur)}</option>`).join('')}</select>${nonT.length ? info(nonT.map((t) => t.acct), (v) => (am.get(v) ? accLabel(am.get(v)) : '?')) : ''}<small class="muted">Only entries in the same currency as that account are moved.</small></label>
    <div class="field"><span>Day</span><button type="button" class="whenbtn" id="be-date">Keep as is</button>${info(txs.map((t) => String(t.date).slice(0, 10)), (v) => dayLabel(v + ' 00:00:00'))}<small class="muted">Each entry keeps its own time of day.</small></div>
    <p class="err" id="be-err" hidden></p>
    <div class="btnrow"><button type="button" class="btn ghost" data-x>Cancel</button><button type="submit" class="btn" id="be-go" disabled>Change ${n}</button></div></form>`, { title: `Edit ${n} ${n === 1 ? 'entry' : 'entries'}` });
  const q = (id) => s.el.querySelector('#' + id); let mode = 'add', day = '';
  const touched = () => { const any = q('be-name').value.trim() || q('be-cat').value || q('be-tags').value.trim() || q('be-notes').value.trim() || q('be-acct').value || day; q('be-go').disabled = !any; };
  s.el.querySelectorAll('input,select').forEach((e) => e.addEventListener('input', touched)); s.el.querySelectorAll('select').forEach((e) => e.addEventListener('change', touched));
  s.el.querySelectorAll('[data-tm]').forEach((b) => { b.onclick = () => { mode = b.dataset.tm; s.el.querySelectorAll('[data-tm]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); }; });
  q('be-date').onclick = () => openDatePicker(`${day || String(txs[0].date).slice(0, 10)} 12:00:00`, (v) => { day = v.slice(0, 10); q('be-date').textContent = dayLabel(day + ' 00:00:00'); touched(); }, { time: false, title: 'New day for all' });
  s.el.querySelector('[data-x]').onclick = () => s.close();
  s.el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const name = q('be-name').value.trim(), catId = q('be-cat').value, tagsIn = parseTags(q('be-tags').value), notes = q('be-notes').value.trim(), acctId = q('be-acct').value, cat = catId ? cm.get(catId) : null, acct = acctId ? am.get(acctId) : null;
    const prev = new Map(); let skippedCat = 0, skippedAcct = 0, changed = 0;
    commit((d) => {
      for (const t of d.txs) {
        if (!set.has(t.id) || t.deleted) continue;
        const old = {}; for (const k of [...BEFORE, 'labels', 'flag', 'corrected', 'autoRoute']) old[k] = t[k];
        const was = JSON.stringify(old);
        if (name) { t.name = name; delete t.autoRoute; }
        if (cat) { if (t.kind !== 'transfer' && (cat.kind === t.kind || cat.kind === 'both')) { if (t.cat !== cat.id) t.corrected = true; t.cat = cat.id; if (t.flag === 'review') delete t.flag; } else skippedCat++; }
        if (tagsIn.length) { const cur = parseTags(t.labels); t.labels = joinTags(mode === 'replace' ? tagsIn : mode === 'remove' ? cur.filter((x) => !tagsIn.some((y) => y.toLowerCase() === x.toLowerCase())) : [...cur, ...tagsIn]); }
        if (notes) t.notes = notes;
        if (acct) { if (t.kind !== 'transfer' && acct.cur === t.cur) t.acct = acct.id; else skippedAcct++; }
        if (day) t.date = `${day} ${String(t.date).slice(11) || '12:00:00'}`;
        if (JSON.stringify(Object.fromEntries(Object.keys(old).map((k) => [k, t[k]]))) !== was) { prev.set(t.id, old); const before = {}; for (const k of BEFORE) if (old[k] !== undefined) before[k] = old[k]; t.rev = [{ at: Date.now(), ...before }, ...(t.rev || [])].slice(0, 5); stamp(t); changed++; }
      }
    });
    s.close(); if (onDone) onDone();
    const skip = [skippedCat ? `${skippedCat} not given the category (wrong kind)` : '', skippedAcct ? `${skippedAcct} not moved (other currency or a transfer)` : ''].filter(Boolean).join(', ');
    toast(`Changed ${changed} ${changed === 1 ? 'entry' : 'entries'}${skip ? '. ' + skip : ''}`, { ms: 7000, undo: () => commit((d) => { for (const t of d.txs) { const o = prev.get(t.id); if (!o) continue; for (const [k, v] of Object.entries(o)) { if (v === undefined) delete t[k]; else t[k] = v; } stamp(t); } }) });
  };
}
