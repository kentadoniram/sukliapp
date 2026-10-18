// Live exchange rates from a free public service (open.er-api.com, no key needed).
// Only the rates for currencies you actually use are updated, once a day while you use the app.
// Rates you type yourself are overrides and are never replaced. Saved entries keep the rate they were made with.
import { get, commit, commitQuiet } from './core.js';
import { ACT, toast } from './ui.js';

const MAX_AGE = 12 * 3600e3;
const STABLE = { USDT: 'USD', USDC: 'USD' };   // dollar stablecoins follow the dollar unless you override them

export async function refreshRates(force = false) {
  const s = get().settings;
  if (!force && (s.autoRates === false || (s.ratesAt && Date.now() - s.ratesAt < MAX_AGE))) return { skipped: true };
  const base = s.base;
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('The rate service answered ' + res.status);
  const j = await res.json();
  if (j.result !== 'success' || !j.rates) throw new Error('The rate service sent no rates');
  const used = new Set(get().accounts.filter((a) => !a.deleted).map((a) => a.cur));
  used.delete(base);
  let n = 0;
  commitQuiet((d) => {
    d.settings.rates = d.settings.rates || {};
    const manual = d.settings.manualRates || {};
    for (const c of used) {
      if (manual[c]) continue;
      const per = j.rates[c] || (STABLE[c] && j.rates[STABLE[c]]);
      if (per > 0) { d.settings.rates[c] = 1 / per; n++; }
    }
    d.settings.ratesAt = Date.now();
  });
  return { n };
}

ACT['rates-refresh'] = async () => {
  try { const r = await refreshRates(true); toast(`Rates updated (${r.n} currencies).`, { ms: 4000 }); }
  catch (e) { toast('Could not get live rates: ' + e.message + '. Your saved rates are unchanged.', { ms: 7000 }); }
  window.dispatchEvent(new Event('sukli-render'));
};
ACT['rates-clear'] = () => { commit((d) => { d.settings.manualRates = {}; }); ACT['rates-refresh'](); };
ACT['rates-auto'] = (el) => commit((d) => { d.settings.autoRates = el.checked; });
