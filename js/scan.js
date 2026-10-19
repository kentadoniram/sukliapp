// Receipt scanner: photo -> text (Tesseract in the browser, nothing uploaded) -> parseReceipt -> you confirm -> new entry.
import { get } from './core.js';
import { esc, ic, ACT, sheet, toast } from './ui.js';
import { modelFor, openEntry } from './entry.js';
import { predict } from './predict.js';
import { parseReceipt, linesFromOcr, bestLines } from './receipt.js';
import { prepareReceipt } from './receiptimg.js';
import { buildGraph, matches } from './simgraph.js';

const OCR = () => ({ base: 'vendor/ocr/', cdn: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/', ...(window.__ocrPaths || {}) });
let worker = null, loading = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
}
async function engine(onStatus) {
  if (worker) return worker;
  if (loading) return loading;
  loading = (async () => {
    const o = OCR();
    onStatus('Loading the reader…');
    if (!window.Tesseract) { try { await loadScript(o.base + 'tesseract.min.js'); } catch { await loadScript(o.cdn + 'tesseract.min.js'); } }
    const local = !!(window.Tesseract && o.base);
    const w = await window.Tesseract.createWorker(['jpn', 'eng'], 1, {
      workerPath: o.base + 'worker.min.js', corePath: o.base + 'tesseract-core-simd-lstm.wasm.js', langPath: o.base, gzip: true,
      logger: (m) => { if (m.status === 'recognizing text') onStatus(`Reading… ${Math.round(m.progress * 100)}%`, m.progress); else if (m.status) onStatus(String(m.status).replace(/_/g, ' ') + '…'); },
    }).catch(async () => window.Tesseract.createWorker(['jpn', 'eng'], 1, { logger: () => {} }));   // last resort: the library's own download
    try { await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch { /* keep the default */ }   // one block of lines suits a receipt
    worker = w; return w;
  })();
  try { return await loading; } finally { loading = null; }
}

// grayscale, stretch the contrast, keep the width between 1000 and 1800 px (bigger is slower, smaller loses the digits)
async function prepare(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const k = bmp.width > 1800 ? 1800 / bmp.width : bmp.width < 1000 ? 1000 / bmp.width : 1;
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = d[i + 1] = d[i + 2] = y; hist[y]++; }
  const n = c.width * c.height; let lo = 0, hi = 255, a = 0;
  for (; lo < 255; lo++) { a += hist[lo]; if (a > n * 0.01) break; }
  a = 0; for (; hi > 0; hi--) { a += hist[hi]; if (a > n * 0.2) break; }          // paper is the bright majority: anchor it near white
  const span = Math.max(40, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(im, 0, 0);
  return c;
}

const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);
const badge = (c) => `<span class="conf ${c >= 0.8 ? 'hi' : c >= 0.6 ? 'mid' : 'lo'}" title="How sure the reader and the rules are. A guide, not a probability.">${pct(c)}%</span>`;
const yen = (n) => (n < 0 ? '−' : '') + '¥' + Math.abs(n).toLocaleString('en-US');

let S = null;                                                           // the scan being confirmed
function knownNames(db) { const m = new Map(); for (const t of db.txs) if (!t.deleted && t.kind === 'expense' && t.name) m.set(t.name.trim(), (m.get(t.name.trim()) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 400); }

function analyse(lines) {
  const db = get(), known = knownNames(db);
  const r = parseReceipt(lines, { known });
  let name = r.merchant ? r.merchant.value : '', matched = null, nameConf = r.merchant ? r.merchant.conf : 0;
  if (r.merchant) {
    const g = buildGraph(db), q = `${r.merchant.value} ${r.merchant.branch || ''}`.trim();
    const hit = matches(g, q, 3).concat(matches(g, r.merchant.value, 1)).sort((a, b) => b.score - a.score)[0];
    if (hit && hit.score >= 0.6) { matched = hit; name = hit.name; nameConf = Math.min(1, (nameConf + hit.score) / 2 + 0.1); }
    else if (r.merchant.branch) name = `${r.merchant.value} ${r.merchant.branch}`;
  }
  const model = modelFor('expense'), total = r.total ? r.total.value : 0;
  const p = predict(model, name, total, {});
  const cats = db.categories.filter((c) => !c.deleted && c.kind === 'expense');
  const top = p.cats.slice(0, 3).filter((x) => cats.some((c) => c.id === x.id));
  return { r, name, nameConf, matched, cat: top[0] ? top[0].id : '', catConf: top[0] ? top[0].p : 0, guess: top[0] ? top[0].id : '', alts: top,
    date: r.date ? r.date.value : '', time: r.date ? r.date.time : '', dateConf: r.date ? r.date.conf : 0, total, totalConf: r.total ? r.total.conf : 0,
    items: r.items.map((i) => ({ n: i.name, amt: String(i.amt), conf: i.conf, was: i.was })), check: r.check };
}

function render(api) {
  const db = get(), cats = db.categories.filter((c) => !c.deleted && c.kind === 'expense'), a = S, sum = a.items.reduce((s, i) => s + (parseFloat(i.amt) || 0), 0);
  const tot = parseFloat(a.total) || 0, ok = a.items.length && Math.abs(sum - tot) <= 1;
  api.el.innerHTML = `<form id="scanform" novalidate>
    ${a.previewUrl ? `<img class="rcpt" src="${a.previewUrl}" alt="Your receipt">` : ''}
    <p class="hint">Check each box before continuing. Percentages show how sure the reader is (not a guarantee); anything under 60% is worth a look.</p>
    <div class="field"><span>Shop ${a.r.merchant ? badge(a.nameConf) : ''}</span><input id="sc-name" value="${esc(a.name)}" autocomplete="off">
      ${a.matched ? `<small class="muted">Matched to “${esc(a.matched.name)}” in your history (${pct(a.matched.score)}%, ${a.matched.cat ? esc(a.matched.cat) : 'no category yet'})</small>` : ''}</div>
    <div class="row2"><div class="field"><span>Date ${a.date ? badge(a.dateConf) : '<span class="conf lo">not found</span>'}</span><input id="sc-date" type="date" value="${esc(a.date)}"></div>
      <div class="field"><span>Time</span><input id="sc-time" type="time" value="${esc(a.time)}"></div></div>
    <div class="field"><span>Total ${a.r.total ? badge(a.totalConf) : '<span class="conf lo">not found</span>'}</span><input id="sc-total" inputmode="decimal" value="${a.total || ''}" autocomplete="off">
      ${a.r.total && a.r.total.how !== 'labelled total' ? '<small class="muted">No “合計/Total” line was found; this is the largest amount, so check it.</small>' : ''}</div>
    <div class="field"><span>Items ${a.items.length ? `<small class="muted">(${a.items.length})</small>` : ''}</span>
      <div id="sc-items">${a.items.map((it, i) => `<div class="item" data-i="${i}"><input class="in-n" value="${esc(it.n)}" aria-label="Item name"><input class="in-a" inputmode="decimal" value="${esc(it.amt)}" aria-label="Item amount">${it.conf != null ? badge(it.conf) : ''}<button type="button" class="iconbtn" data-act="sc-del" data-i="${i}" aria-label="Remove item">${ic('x')}</button></div>`).join('') || '<p class="muted">No item lines were read. You can still save the total.</p>'}</div>
      <button type="button" class="linkbtn" data-act="sc-add">+ Add an item</button>
      ${a.items.length ? `<p class="${ok ? 'okline' : 'warnline'}">${ok ? '✓ The items add up to the total.' : `Items add up to ${yen(Math.round(sum))}, total says ${yen(Math.round(tot))} (difference ${yen(Math.round(tot - sum))}). One of them is probably misread.`}${a.check && a.check.repaired ? ' A trailing 8 was removed from some prices (the 軽 mark is often read as 8); please verify.' : ''}</p>` : ''}</div>
    <div class="field"><span>Category ${a.alts.length ? badge(a.alts.find((x) => x.id === a.cat) ? a.alts.find((x) => x.id === a.cat).p : 0) : '<span class="conf lo">no guess</span>'}</span>
      <select id="sc-cat"><option value="">Choose…</option>${cats.map((c) => `<option value="${c.id}" ${c.id === a.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      ${a.alts.length ? `<div class="chips">${a.alts.map((x) => `<button type="button" class="chip ${x.id === a.cat ? 'on' : ''}" data-act="sc-cat" data-id="${x.id}">${esc((cats.find((c) => c.id === x.id) || {}).name || '')} ${pct(x.p)}%</button>`).join('')}</div>` : ''}</div>
    <div class="btnrow"><button type="button" class="btn ghost" data-act="sc-again">Scan another</button><button type="button" class="btn" data-act="sc-use">Continue to entry</button></div></form>`;
  const f = api.el;
  const sync = () => { a.name = f.querySelector('#sc-name').value; a.date = f.querySelector('#sc-date').value; a.time = f.querySelector('#sc-time').value; a.total = f.querySelector('#sc-total').value; a.cat = f.querySelector('#sc-cat').value;
    f.querySelectorAll('#sc-items .item').forEach((row, i) => { if (a.items[i]) { a.items[i].n = row.querySelector('.in-n').value; a.items[i].amt = row.querySelector('.in-a').value; } }); };
  api.sync = sync;
  f.querySelector('#scanform').addEventListener('change', (e) => { sync(); if (e.target.id === 'sc-total' || e.target.classList.contains('in-a') || e.target.id === 'sc-cat') render(api); });
}

function start(api) {
  api.el.innerHTML = `<p class="hint">Photograph the receipt flat, in good light, filling the frame. Reading happens on this device; the photo is not uploaded or saved.</p>
    <div class="btnrow"><label class="btn wide"><input type="file" id="rc-cam" accept="image/*" capture="environment" hidden>${ic('camera')} Take a photo</label>
    <label class="btn ghost wide"><input type="file" id="rc-file" accept="image/*" hidden>Choose a picture</label></div>
    <div id="rc-status" class="hint" aria-live="polite"></div><div class="bar" id="rc-bar" hidden><i></i></div>
    <details><summary>Or paste the receipt text</summary><textarea id="rc-text" rows="6" placeholder="Paste text copied from a receipt scan or e-receipt"></textarea><button type="button" class="btn ghost" data-act="sc-text">Read this text</button></details>`;
  const status = (t, p) => { const s = api.el.querySelector('#rc-status'); if (s) s.textContent = t; const b = api.el.querySelector('#rc-bar'); if (b && p != null) { b.hidden = false; b.firstElementChild.style.width = Math.round(p * 100) + '%'; } };
  const go = async (file) => {
    if (!file) return;
    try {
      status('Preparing the picture…');
      const canvas = await prepareReceipt(file), grey = await prepareReceipt(file, { binarise: false }), url = grey.toDataURL('image/jpeg', 0.5);
      const w = await engine(status);
      status('Reading', 0.02);
      const { data } = await w.recognize(canvas, {}, { blocks: true, text: true });
      status('Second look at the picture', 0.6);
      const second = await w.recognize(grey, {}, { blocks: true, text: true }).then((r) => r.data).catch(() => null);
      const la = linesFromOcr(data), lines = second ? bestLines(la, linesFromOcr(second)) : la;
      S = analyse(lines); S.previewUrl = url; S.ocrConf = data.confidence;
      render(api);
    } catch (err) { status('Could not read the picture here (' + (err && err.message ? err.message : 'error') + '). You can paste the text below, or add the entry by hand.'); }
  };
  api.el.querySelector('#rc-cam').onchange = (e) => go(e.target.files[0]);
  api.el.querySelector('#rc-file').onchange = (e) => go(e.target.files[0]);
}

let cur = null;
export function openScan() {
  S = null;
  cur = sheet('', { title: 'Scan a receipt', wide: true, onClose: () => { cur = null; } });
  start(cur);
}
ACT.scan = () => setTimeout(openScan, 90);   // lets the menu finish closing first
ACT['sc-text'] = () => { const t = cur && cur.el.querySelector('#rc-text'); if (!t || !t.value.trim()) return; S = analyse(t.value.split('\n').map((x) => ({ text: x }))); render(cur); };
ACT['sc-again'] = () => { S = null; if (cur) start(cur); };
ACT['sc-cat'] = (el) => { if (!cur) return; cur.sync && cur.sync(); S.cat = el.dataset.id; render(cur); };
ACT['sc-del'] = (el) => { cur.sync(); S.items.splice(+el.dataset.i, 1); render(cur); };
ACT['sc-add'] = () => { cur.sync(); S.items.push({ n: '', amt: '' }); render(cur); };
ACT['sc-use'] = () => {
  if (!cur || !S) return;
  cur.sync();
  const a = S, total = parseFloat(a.total) || 0;
  if (!(total > 0)) { toast('Enter the total first.'); return; }
  const preset = { name: a.name.trim(), amount: String(total), notes: 'Scanned receipt', cat: a.cat || '', catTouched: !!a.cat, guessed: a.guess && a.guess !== a.cat ? a.guess : undefined,
    items: a.items.filter((i) => i.n.trim() || parseFloat(i.amt)).map((i) => ({ n: i.n.trim(), amt: String(parseFloat(i.amt) || 0), cat: '' })) };
  preset.showItems = preset.items.length > 0;
  if (a.date) preset.date = `${a.date} ${a.time || '12:00'}:00`;
  const api = cur; api.close();
  setTimeout(() => openEntry({ preset }), 60);
};
