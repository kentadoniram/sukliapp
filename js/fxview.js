// "Exchange Rate": one compact viewer (three-way summary) and one converter window, used by New entry, Transfer and Settings.
import { get, HOME, BASE, CUR, rateFor, liveRate, priv } from './core.js';
import { sheet, esc, toast } from './ui.js';
import { fetchRates, ratesStatus } from './rates.js';

const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const sym = (c) => (CUR[c] || { sym: c + ' ' }).sym;
const isCoin = (c) => ((CUR[c] || {}).dec || 2) > 2;
// ¥500.00 JPY: symbol, two decimals (coins keep more), then the code
export const moneyCode = (n, c) => {
  if (priv.on) return `${sym(c)}••••• ${c}`;
  const dec = isCoin(c) ? Math.min((CUR[c] || {}).dec || 6, 6) : 2;
  return `${sym(c)}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: Math.min(2, dec), maximumFractionDigits: dec })} ${c}`;
};
export const rateTxt = (x) => !(x > 0) ? '—' : x >= 100 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Number(x.toPrecision(3)));
const ledger = (db, c) => (c === BASE ? 1 : rateFor(db, c) || 0);
export const pairRate = (db, from, to) => { const a = ledger(db, from), b = ledger(db, to); return a > 0 && b > 0 ? a / b : 0; };
export const livePair = (db, from, to) => { const a = from === BASE ? 1 : liveRate(db, from), b = to === BASE ? 1 : liveRate(db, to); return a > 0 && b > 0 ? a / b : 0; };
const ago = (ts) => { const m = Math.round((Date.now() - ts) / 60000); return m < 2 ? 'just now' : m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

// where the rate for a pair comes from: live (fetched online), manual (typed by you), entry (last time you used it)
export function rateSource(db, from, to, rate) {
  const s = db.settings, manual = [from, to].some((c) => c !== BASE && s.rates && s.rates[c] > 0);
  const base = pairRate(db, from, to);
  if (rate > 0 && base > 0 && Math.abs(rate - base) / base > 1e-4) return { kind: 'manual', text: 'Manual rate (typed by you)' };
  if (manual) return { kind: 'manual', text: 'Manual rate (set in Settings)' };
  if (livePair(db, from, to) > 0 && s.live) return { kind: 'live', text: `Live rate · updated ${ago(s.live.ts)}` };
  return { kind: 'entry', text: 'From your latest entry (not live)' };
}

const sumLines = (from, to, amount, rate, always = false) => rate > 0
  ? `${amount > 0 || always ? `<li>${moneyCode(amount || 0, from)} = ${moneyCode((amount || 0) * rate, to)}</li>` : ''}<li>1 ${esc(from)} = ${rateTxt(rate)} ${esc(to)}</li><li>1 ${esc(to)} = ${rateTxt(1 / rate)} ${esc(from)}</li>`
  : `<li class="muted">No rate yet. Tap Exchange Rate to set one.</li>`;
// the compact viewer. `open` is the attribute that makes the text clickable (for example data-e="fxopen")
export function fxBlockHtml({ from, to, amount, rate, open, always = false, db = get() }) {
  const src = rateSource(db, from, to, rate);
  return `<div class="fxblock"><div class="fxtop"><button type="button" class="fxlink" ${open}>Exchange Rate</button><span class="fxsrc ${src.kind}" data-fxsrc>${esc(src.text)}</span></div><ul class="fxsum" data-fxsum aria-live="polite">${sumLines(from, to, amount, rate, always)}</ul></div>`;
}
// refresh an existing viewer without touching the layout
export function fxBlockUpdate(root, { from, to, amount, rate, always = true, db = get() }) {
  const ul = root && root.querySelector('[data-fxsum]'); if (!ul) return;
  const h = sumLines(from, to, amount, rate, always); if (ul.innerHTML !== h) ul.innerHTML = h;
  const s = root.querySelector('[data-fxsrc]'), src = rateSource(db, from, to, rate);
  if (s) { s.textContent = src.text; s.className = `fxsrc ${src.kind}`; }
}

// the converter window. onApply({rate, a, b, billed}) when the person taps the main button; onReset() goes back to the live rate
export function openConverter({ from, to, amount = 0, rate = 0, title = 'Exchange Rate', applyLabel = 'Use this rate', onApply, onReset }) {
  const db0 = get(); let r = rate > 0 ? rate : pairRate(db0, from, to), a = amount > 0 ? amount : 1, b = r > 0 ? a * r : 0, billed = false, aKeep = a;   // aKeep: the amount before the other side was typed, for "this is on my bill"
  const nf = (x) => (x > 0 ? String(Number(x.toPrecision(10))) : '');
  const s = sheet(`<div class="fxconv">
    <p class="fxstat"><span class="fxsrc" id="cv-src"></span> <button type="button" class="btn sm ghost" id="cv-latest">Get latest rate</button></p>
    <p class="status" id="cv-msg" role="status"></p>
    <label class="field"><span>${esc(from)} (${esc(sym(from).trim())})</span><input id="cv-a" inputmode="decimal" autocomplete="off" value="${nf(a)}"></label>
    <label class="field"><span>${esc(to)} (${esc(sym(to).trim())})</span><input id="cv-b" inputmode="decimal" autocomplete="off" value="${nf(b)}"></label>
    <label class="field"><span>Rate: 1 ${esc(from)} = ? ${esc(to)}</span><input id="cv-r" inputmode="decimal" autocomplete="off" value="${nf(r)}"></label>
    <ul class="fxsum" id="cv-sum"></ul>
    <p class="hint" id="cv-bill" hidden></p>
    <div class="btnrow"><button type="button" class="btn ghost" data-close>Close</button>${onReset ? '<button type="button" class="btn ghost" id="cv-reset">Back to live</button>' : ''}${onApply ? `<button type="button" class="btn" id="cv-apply">${esc(applyLabel)}</button>` : ''}</div></div>`, { title });
  const q = (id) => s.el.querySelector('#' + id), A = q('cv-a'), B = q('cv-b'), R = q('cv-r');
  const paint = () => { const db = get(), src = rateSource(db, from, to, r); const e = q('cv-src'); e.textContent = src.text; e.className = `fxsrc ${src.kind}`; q('cv-sum').innerHTML = sumLines(from, to, a, r); };
  const note = (t) => { q('cv-msg').textContent = t || ''; };
  A.oninput = () => { a = num(A.value); aKeep = a; b = a * r; if (document.activeElement !== B) B.value = nf(b); billed = false; q('cv-bill').hidden = true; paint(); };
  B.oninput = () => { b = num(B.value); if (r > 0) { a = b / r; A.value = nf(a); } paint(); const hb = q('cv-bill'); hb.hidden = !(aKeep > 0 && b > 0); hb.innerHTML = hb.hidden ? '' : `Is ${esc(moneyCode(b, to))} the amount on your bill for ${esc(moneyCode(aKeep, from))}? <button type="button" class="linkbtn" id="cv-fromamts">Set the rate from these two amounts</button>`; };
  R.oninput = () => { r = num(R.value); b = a * r; aKeep = a; B.value = nf(b); billed = false; paint(); };
  s.el.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-close')) s.close();
    else if (t.id === 'cv-fromamts') { if (aKeep > 0 && b > 0) { a = aKeep; A.value = nf(a); r = b / a; R.value = nf(r); billed = true; q('cv-bill').hidden = true; paint(); } }
    else if (t.id === 'cv-latest') {
      t.disabled = true; note('Getting the latest rate…');
      try { await fetchRates({ quiet: true }); const lp = livePair(get(), from, to);
        if (lp > 0) { r = lp; R.value = nf(r); b = a * r; B.value = nf(b); billed = false; note('Latest rate loaded. It is live.'); } else note('The service has no rate for this pair. Type one instead.');
      } catch { note(navigator.onLine === false ? 'You are offline. The rate shown is unchanged.' : 'Could not reach the rate service. The rate shown is unchanged.'); }
      t.disabled = false; paint();
    } else if (t.id === 'cv-apply') { if (!(r > 0)) { note('Enter a rate above zero.'); return; } const out = { rate: r, a, b, billed }; s.close(); onApply(out); }
    else if (t.id === 'cv-reset') { s.close(); onReset(); }
  });
  paint();
  return s;
}
