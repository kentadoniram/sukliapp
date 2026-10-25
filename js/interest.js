// Interest helpers shared by savings, debts and the loan planner: the maths, the tap-to-open explanations and a small calculator.
// Pure functions only (no imports) so finance.js and the screens can both use them.
export const PER_YEAR = { daily: 365, monthly: 12, quarterly: 4, yearly: 1 };
export const COMP_LABEL = { daily: 'Daily', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
const n = (c) => PER_YEAR[c] || 365;
// effective yearly rate (%) from a nominal rate (%) that is compounded `comp`
export const earFromNominal = (r, comp) => ((1 + r / 100 / n(comp)) ** n(comp) - 1) * 100;
export const nominalFromEar = (e, comp) => n(comp) * ((1 + e / 100) ** (1 / n(comp)) - 1) * 100;
// interest earned or charged on principal P over `months`, nominal rate r (%), compounded `comp`
export const compInterest = (P, r, comp, months) => P * ((1 + r / 100 / n(comp)) ** (n(comp) * months / 12) - 1);
export const nominalFromInterest = (P, I, comp, months) => (P > 0 && months > 0 && I >= 0 ? n(comp) * ((1 + I / P) ** (12 / (months * n(comp))) - 1) * 100 : NaN);
// add-on: a flat % a year on the original amount for the whole term, paid back in equal monthly instalments
export const addonInterest = (P, a, months) => P * a / 100 * months / 12;
function pmt(P, rm, m) { return rm === 0 ? P / m : P * rm / (1 - (1 + rm) ** -m); }
// the real (effective) yearly rate of an add-on loan: the monthly rate that makes the instalments fit, as a nominal yearly % (monthly compounding)
export function addonToNominal(P, a, months) {
  const m = Math.round(months); if (!(P > 0 && a >= 0 && m >= 1)) return NaN;
  const pay = (P + addonInterest(P, a, m)) / m; let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (pmt(P, mid, m) < pay) lo = mid; else hi = mid; }
  return (lo + hi) / 2 * 12 * 100;
}
export const round = (v, d = 4) => (Number.isFinite(v) ? +v.toFixed(d) : '');

// the rate that applies on a day: the account's starting rate, then each change from its date on
export function rateAt(a, d) {
  let r = +a.apy || 0;
  for (const c of [...(a.rates || [])].filter((x) => x && x.from && +x.rate >= 0).sort((p, q) => (p.from < q.from ? -1 : 1))) if (c.from <= d) r = +c.rate;
  return r;
}
// promotional rates apply to money deposited in a window, until the promo ends
export const activePromos = (a, d) => (a.promos || []).filter((p) => p && +p.rate > 0 && p.depFrom && p.depTo && d >= p.depFrom && (!p.until || d <= p.until));
export const hasRate = (a) => (+a.apy || 0) > 0 || (a.rates || []).some((r) => +r.rate > 0) || (a.promos || []).some((p) => +p.rate > 0);
export const isPeriodEnd = (d, comp) => {
  const [y, m, day] = d.split('-').map(Number), last = new Date(y, m, 0).getDate();
  if (comp === 'monthly') return day === last;
  if (comp === 'quarterly') return day === last && m % 3 === 0;
  if (comp === 'yearly') return day === last && m === 12;
  return true;
};

// ---- the "?" buttons: tap to open a short explanation, tap again to close ----
export const TIPS = {
  principal: ['Principal', 'The starting amount that interest is worked out on: what you put in, or what you borrowed or still owe.'],
  rate: ['Yearly rate', 'The percentage per year printed by your bank or lender, before the effect of compounding. Also called the nominal rate.'],
  compounding: ['Compounding', 'How often interest is added to the balance so that it earns interest too. Daily adds it every day, monthly at each month end, quarterly every 3 months. More often means slightly more over a year.'],
  effective: ['Effective rate', 'What you really earn or pay over a full year once compounding is counted (also called EAR or APY). It is a bit higher than the yearly rate when interest compounds more than once a year.'],
  addon: ['Add-on interest', 'A flat percentage charged on the original amount for the whole term, even though you pay the loan back little by little. It looks cheaper than it is: the effective rate is usually about double.'],
  term: ['Term', 'How many months the money is saved or borrowed for.'],
  interest: ['Interest amount', 'The total interest over the term, in money.'],
  tax: ['Tax on interest', 'Some banks keep a part of the interest for tax before they credit it. Only the rest reaches your balance.'],
  start: ['Interest starts on', 'The date interest begins. For a debt this is the deadline: if the amount is still owed on that day, interest starts to be charged from then.'],
  ratechange: ['Rate changes', 'When your bank changes the rate (for example 5% today and 2% from next week), add the date and the new rate here. Interest before that date keeps the old rate.'],
  promo: ['Promotional rate', 'A special rate for money deposited during a set period. Money put in between the two deposit dates earns the promo rate until the promo ends. Other money earns the normal rate. If the bank locks the money (a term deposit), say for how many days after each deposit, or until which date: the promo rate then runs for that time, and Sukli warns when you take out locked money.'],
  debt: ['Interest on a debt', 'When this is on, Sukli adds an interest charge to what you owe once the deadline is reached and the amount is still unpaid. Each charge also counts as a financial loss.'],
};
export const tipBtn = (k) => (TIPS[k] ? `<button type="button" class="tipbtn" data-tip="${k}" aria-label="What is ${TIPS[k][0]}?" aria-expanded="false">?</button>` : '');
if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.tipbtn'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const anchor = b.closest('label.check') || b.closest('.field > span') || b.closest('.tiprow') || b.closest('label') || b.parentElement, on = b.getAttribute('aria-expanded') === 'true';
  const old = anchor.nextElementSibling; if (old && old.classList.contains('tipbox')) old.remove();
  document.querySelectorAll('.tipbtn[aria-expanded=true]').forEach((x) => { if (x !== b && x.closest('form, .sheet') === b.closest('form, .sheet')) { x.setAttribute('aria-expanded', 'false'); const a2 = x.closest('label.check') || x.closest('.field > span') || x.closest('.tiprow') || x.closest('label') || x.parentElement; const n2 = a2 && a2.nextElementSibling; if (n2 && n2.classList.contains('tipbox')) n2.remove(); } });
  b.setAttribute('aria-expanded', String(!on));
  if (!on) { const t = TIPS[b.dataset.tip], d = document.createElement('div'); d.className = 'tipbox'; d.setAttribute('role', 'note'); d.innerHTML = '<b></b><span></span>'; d.firstChild.textContent = t[0]; d.lastChild.textContent = ' ' + t[1]; anchor.after(d); }
}, true);

// ---- small calculator: fill in any box and the others follow; missing pieces are named ----
export function calcHtml(comp = 'monthly') {
  const f = (id, label, tip, ph, mode = 'decimal') => `<label class="field"><span>${label} ${tipBtn(tip)}</span><input data-ic="${id}" inputmode="${mode}" placeholder="${ph}" autocomplete="off"></label>`;
  return `<details class="icalc"><summary>Interest calculator</summary>
    <p class="hint">Fill in any box and the others are worked out. Boxes that cannot be worked out yet are named below.</p>
    ${f('P', 'Principal', 'principal', 'e.g. 100000')}
    <div class="two">${f('nom', 'Yearly rate %', 'rate', 'e.g. 6')}${f('ear', 'Effective rate %', 'effective', 'worked out')}</div>
    <label class="field"><span>Compounding ${tipBtn('compounding')}</span><select data-ic="comp">${Object.entries(COMP_LABEL).map(([v, l]) => `<option value="${v}" ${v === comp ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="two">${f('add', 'Add-on rate % a year', 'addon', 'flat rate')}${f('term', 'Term (months)', 'term', 'e.g. 12')}</div>
    ${f('int', 'Interest for the whole term', 'interest', 'worked out')}
    <p class="hint icnote" data-ic-note aria-live="polite"></p>
    <button type="button" class="linkbtn" data-ic-use>Use the yearly rate in this form</button></details>`;
}
export function bindCalc(root, { onUse } = {}) {
  const box = root.querySelector('.icalc'); if (!box) return;
  const el = (k) => box.querySelector(`[data-ic="${k}"]`), v = (k) => { const x = parseFloat(String(el(k).value).replace(/,/g, '')); return Number.isFinite(x) ? x : NaN; };
  const set = (k, val) => { el(k).value = val === '' || !Number.isFinite(+val) ? '' : String(round(+val, k === 'int' || k === 'P' ? 2 : 4)); };
  let last = 'nom';
  const run = (from) => {
    if (from && ['nom', 'ear', 'add', 'int'].includes(from)) last = from;
    const P = v('P'), t = v('term'), comp = el('comp').value, miss = [];
    if (last === 'nom' && Number.isFinite(v('nom'))) set('ear', earFromNominal(v('nom'), comp));
    else if (last === 'ear' && Number.isFinite(v('ear'))) set('nom', nominalFromEar(v('ear'), comp));
    else if (last === 'add' && Number.isFinite(v('add'))) {
      if (P > 0 && t >= 1) { const nm = addonToNominal(P, v('add'), t); set('nom', nm); set('ear', earFromNominal(nm, 'monthly')); set('int', addonInterest(P, v('add'), t)); } else { if (!(P > 0)) miss.push('Principal'); if (!(t >= 1)) miss.push('Term (months)'); }
    } else if (last === 'int' && Number.isFinite(v('int'))) {
      if (P > 0 && t > 0) { const nm = nominalFromInterest(P, v('int'), comp, t); set('nom', nm); set('ear', earFromNominal(nm, comp)); set('add', v('int') / P / (t / 12) * 100); } else { if (!(P > 0)) miss.push('Principal'); if (!(t > 0)) miss.push('Term (months)'); }
    }
    if (last !== 'int' && last !== 'add') {
      const nm = v('nom'); if (Number.isFinite(nm)) { if (P > 0 && t > 0) { const i = compInterest(P, nm, comp, t); set('int', i); set('add', i / P / (t / 12) * 100); } else { if (!(P > 0)) miss.push('Principal'); if (!(t > 0)) miss.push('Term (months)'); } }
    }
    const none = ['nom', 'ear', 'add', 'int'].every((k) => !Number.isFinite(v(k)));
    box.querySelector('[data-ic-note]').textContent = none ? 'Start with a rate, an add-on rate or an interest amount.' : miss.length ? `To work out the rest, also fill in: ${[...new Set(miss)].join(' and ')}.` : '';
  };
  box.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.ic; if (k) run(k); });
  box.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.ic === 'comp') run(); });
  box.querySelector('[data-ic-use]').onclick = () => { const nm = v('nom'); if (Number.isFinite(nm) && onUse) onUse(nm, el('comp').value); else box.querySelector('[data-ic-note]').textContent = 'Fill in a yearly rate first.'; };
}
