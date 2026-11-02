// Read a screenshot of a transit card in Apple Wallet (Pasmo, Suica...): there is no CSV to export, so the picture is read on the phone
// (nothing is uploaded), each ride becomes an entry with its two stations, and a "Purchase" row stays a purchase, not a ride.
import { get, commit, stamp, uid, nowStamp, homeFx } from './core.js';
import { esc, ACT, sheet, toast } from './ui.js';
import { transferLabel } from './label.js';
import { fmt } from './core.js';
import { parseWalletText } from './walletparse.js';
import { isTransportCat, tripLabel } from './route.js';
import { loadSource, releaseSource } from './receiptimg.js';
import { engine, readCanvas, releaseEngine } from './scan.js';

let cur = null, S = null;
const live = (l) => l.filter((x) => !x.deleted);
const p2 = (n) => String(n).padStart(2, '0');
const stampOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:00`;
const yen = (n) => fmt(n, 'JPY');
const cardAccts = (db) => live(db.accounts).filter((a) => !a.archived && a.cur === 'JPY');
const isCard = (a) => /pasmo|suica|icoca|ic card|パスモ|スイカ/i.test(a.name);

// a dark screenshot (white text on black) is turned round to dark text on white, which the reader handles much better
async function readPicture(file, status) {
  status('Preparing the picture…');
  const src = await loadSource(file, { cap: 2600 }), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0); releaseSource(src);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data; let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 64) { sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; n++; }
  const dark = sum / n < 120;
  for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, o = dark ? 255 - v : v; d[i] = d[i + 1] = d[i + 2] = o; }
  g.putImageData(im, 0, 0);
  const w = await engine(status), r = await readCanvas(w, c, status, 'Reading', 0.05, 0.95); c.width = 0; c.height = 0;
  const out = r.lines.map((l) => l.text).join('\n'); window.__lastWalletText = out; return out;
}

// rows that are already in the entries: same amount within about a day and a half, each entry used once
function markKnown(db, rows) {
  const used = new Set();
  for (const r of rows) {
    const hit = live(db.txs).find((t) => (r.kind === 'topup' ? t.kind === 'transfer' : t.kind === 'expense') && !used.has(t.id) && (r.kind === 'topup' ? (Math.abs((t.toAmount || t.amount) - r.amount) < 0.5) : (t.cur === 'JPY' && Math.abs(t.amount - r.amount) < 0.5)) && Math.abs(new Date(String(t.date).replace(' ', 'T')) - r.when) <= 36e5 * 36);
    r.known = !!hit; if (hit) used.add(hit.id);
  }
}
// a top-up is money moving from a bank, wallet or cash into the card: the account it came from last time is offered first
function topupSource(db, card) {
  const last = [...live(db.txs)].filter((t) => t.kind === 'transfer' && t.toAcct === card && t.acct !== card).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (last) return last.acct;
  const other = live(db.accounts).find((a) => !a.archived && a.id !== card && a.cur === 'JPY' && /bank|cash|wallet|ewallet|paypay/i.test(a.type + ' ' + a.name));
  return (other || live(db.accounts).find((a) => !a.archived && a.id !== card) || {}).id || '';
}
const expenseCats = (db) => live(db.categories).filter((c) => c.kind === 'expense' && !c.archived);
function catFor(db, r) {
  const cats = expenseCats(db), isT = isTransportCat(db.categories);
  if (r.kind === 'transit') return (cats.find((c) => /^train$/i.test(c.name)) || cats.find((c) => isT(c.id)) || cats[0] || {}).id || '';
  const mem = (db.settings.walletCats || {})[r.place]; if (mem && cats.some((c) => c.id === mem)) return mem;
  return (cats.find((c) => /^(other|misc|shopping|uncategori)/i.test(c.name)) || cats[0] || {}).id || '';
}

function render() {
  if (!cur) return; const db = get(), body = cur.el;
  if (!S) return;
  const accts = cardAccts(db), rows = S.rows, cats = expenseCats(db);
  const shown = (r) => `${r.exactTime ? 'about ' + p2(r.when.getHours()) + ':' + p2(r.when.getMinutes()) + ' · ' : ''}${r.when.getMonth() + 1}/${r.when.getDate()}${r.exactTime ? '' : ' (time not shown)'}`;
  body.innerHTML = `<p class="hint">Read from your screenshot${S.balance != null ? `. Wallet balance: <b>${yen(S.balance)}</b>` : ''}. Rides become <b>Train</b> entries with both stations. A <b>Purchase</b> is not a ride: pick what it was for. A <b>top-up</b> is a transfer into the card from the account you choose. Entries you already have are left unticked.</p>
    <label class="field"><span>Card account</span><select id="ws-acct">${accts.map((a) => `<option value="${a.id}" ${a.id === S.acct ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <ul class="wslist">${rows.map((r, i) => `<li class="wsrow ${r.known ? 'known' : ''}"><label class="wsl"><input type="checkbox" data-i="${i}" ${r.on ? 'checked' : ''}>
      <span class="wst"><b>${r.kind === 'transit' ? `${esc(r.from)} to ${esc(r.to)}` : r.kind === 'topup' ? `Top-up of the card (a transfer, not spending)` : `Purchase: ${esc(r.place)}`}</b><small class="muted">${yen(r.amount)} · ${esc(shown(r))}${r.known ? ' · already in your entries' : ''}</small></span></label>
      ${r.kind === 'topup' ? `<select class="wssrc" data-i="${i}" aria-label="Where the money came from">${live(db.accounts).filter((a) => !a.archived && a.id !== S.acct).map((a) => `<option value="${a.id}" ${a.id === r.src ? 'selected' : ''}>From ${esc(a.name)}</option>`).join('')}</select>` : ''}
      ${r.kind === 'purchase' ? `<select class="wscat" data-i="${i}" aria-label="Category for ${esc(r.place)}">${cats.map((c) => `<option value="${c.id}" ${c.id === r.cat ? 'selected' : ''}>${esc(c.group ? c.group + ' · ' + c.name : c.name)}</option>`).join('')}</select>` : ''}</li>`).join('')}</ul>
    ${S.skipped ? `<p class="hint">${S.skipped} row${S.skipped === 1 ? '' : 's'} at the edge of the screenshot could not be read fully and ${S.skipped === 1 ? 'was' : 'were'} skipped. Scroll the Wallet a little and take another screenshot to get them.</p>` : ''}
    <div class="btnrow"><button type="button" class="btn ghost" data-act="ws-again">Another screenshot</button><button type="button" class="btn" data-act="ws-add">Add ${rows.filter((r) => r.on).length} ${rows.filter((r) => r.on).length === 1 ? 'entry' : 'entries'}</button></div>`;
  body.querySelector('#ws-acct').onchange = (e) => { S.acct = e.target.value; };
  body.querySelectorAll('.wsl input').forEach((x) => { x.onchange = () => { S.rows[+x.dataset.i].on = x.checked; render(); }; });
  body.querySelectorAll('.wssrc').forEach((x) => { x.onchange = () => { S.rows[+x.dataset.i].src = x.value; }; });
  body.querySelectorAll('.wscat').forEach((x) => { x.onchange = () => { S.rows[+x.dataset.i].cat = x.value; }; });
}
function start() {
  S = null; const body = cur.el;
  body.innerHTML = `<p class="hint">Apple Wallet cannot export a transit card, so take a screenshot of the card's <b>Latest Transactions</b> and choose it here. For a longer history, scroll and take more screenshots, then choose them all together; rides that appear in two of them are counted once. It is read on your phone; nothing is uploaded. Dates come from "2 hours ago" and "Yesterday", so do this soon after the rides.</p>
    <label class="btn wide" for="ws-file">Choose the screenshot(s)</label><input id="ws-file" type="file" accept="image/*" multiple hidden><p class="hint" id="ws-stat" role="status"></p>`;
  const stat = (t) => { const e = cur && cur.el.querySelector('#ws-stat'); if (e) e.textContent = t; };
  body.querySelector('#ws-file').onchange = async (e) => {
    const files = [...(e.target.files || [])]; if (!files.length) return;
    try {
      const all = []; let skipped = 0, balance = null, clock = null;
      for (const [fi, f] of files.entries()) {
        const note = files.length > 1 ? (t) => stat(`Picture ${fi + 1} of ${files.length}: ${t}`) : stat;
        const text = typeof window !== 'undefined' && window.__walletText != null ? window.__walletText : await readPicture(f, note);
      // when it was taken: the file's own time if the phone gives one, else the clock printed at the top of the screenshot (today, or yesterday if that is still ahead), else now
      let ref = f.lastModified && Date.now() - f.lastModified < 6 * 864e5 && f.lastModified <= Date.now() ? new Date(f.lastModified) : null;
      if (!ref) { const ck = parseWalletText(text).clock; ref = new Date(); if (ck) { ref.setHours(ck.h, ck.m, 0, 0); if (ref > new Date()) ref.setDate(ref.getDate() - 1); } }
        const one = parseWalletText(text, ref); skipped += one.skipped; if (balance == null && one.balance != null) balance = one.balance; all.push(...one.rows.map((r) => ({ ...r, pic: fi })));
      }
      // pictures that overlap show the same row twice ("17 hours ago" in one, "Yesterday" in the next): keep one, the one with a time
      const rows = [];
      for (const r of all) { const key = (x) => `${x.kind}|${x.amount}|${x.from || ''}|${x.to || ''}|${x.place || ''}`, dup = rows.find((x) => x.pic !== r.pic && key(x) === key(r) && Math.abs(x.when - r.when) <= 36e5 * 36); if (!dup) rows.push(r); else if (!dup.exactTime && r.exactTime) Object.assign(dup, r); }
      rows.sort((a, b) => b.when - a.when);
      const p = { rows, skipped, balance }, db = get();
      if (!p.rows.length) { stat('No rides found. Is it the Wallet card page showing the list of transactions?'); return; }
      markKnown(db, p.rows);
      const accts = cardAccts(db), acct = (accts.find(isCard) || accts[0] || {}).id || '';
      const src = topupSource(db, acct);
      for (const r of p.rows) { r.on = !r.known; r.cat = r.kind === 'topup' ? '' : catFor(db, r); r.src = src; }
      S = { ...p, acct };
      if (!acct) { stat('Add a card account in yen first (for example "Pasmo"), then try again.'); S = null; return; }
      render();
    } catch (err) { stat('Could not read that picture. ' + (err && err.message ? err.message : '')); }
    finally { releaseEngine(); }
  };
}
export function openWalletScan() { cur = sheet('', { title: 'Read a Pasmo or Suica screenshot', wide: true, onClose: () => { cur = null; S = null; releaseEngine(); } }); start(); }
ACT['wallet-scan'] = () => setTimeout(openWalletScan, 90);
ACT['ws-again'] = () => { if (cur) start(); };
ACT['ws-add'] = () => {
  if (!cur || !S) return; const picked = S.rows.filter((r) => r.on); if (!picked.length) { toast('Nothing ticked.'); return; }
  commit((d) => {
    const fx = homeFx(d, 'JPY') || 1; d.settings.walletCats = { ...(d.settings.walletCats || {}) };
    for (const r of picked) {
      const base = { id: uid(), kind: 'expense', amount: r.amount, cur: 'JPY', fx, date: stampOf(r.when), cat: r.cat, acct: S.acct, notes: 'From a Wallet screenshot', labels: '', items: [], counts: [] };
      if (r.kind === 'topup') { const a = d.accounts.find((x) => x.id === r.src), c = d.accounts.find((x) => x.id === S.acct); d.txs.push(stamp({ id: uid(), kind: 'transfer', amount: r.amount, cur: (a && a.cur) || 'JPY', fx, date: stampOf(r.when), name: transferLabel(a, c), autoName: true, cat: '', acct: r.src, toAcct: S.acct, toAmount: r.amount, fee: 0, feeBy: '', notes: 'From a Wallet screenshot', labels: '', items: [], counts: [] })); continue; }
      if (r.kind === 'transit') d.txs.push(stamp({ ...base, name: tripLabel('Train', r.from, r.to), autoName: true, from: r.from, to: r.to }));
      else { d.txs.push(stamp({ ...base, name: `Purchase: ${r.place}`, flag: 'review' })); d.settings.walletCats[r.place] = r.cat; }
    }
  });
  toast(`Added ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}.`); if (cur) cur.close();
};
