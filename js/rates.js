// Live exchange rates from a free, keyless source (open.er-api.com, updated daily; crypto prices from CoinGecko).
// Rates are only ever used for NEW entries and for today's balances: every saved entry keeps the rate it was made with.
import { get, commitQuiet, allCurrencies, CRYPTO } from './core.js';

const FIAT_URL = 'https://open.er-api.com/v6/latest/USD';
const COINS = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin', TON: 'the-open-network', TRX: 'tron', ADA: 'cardano', LTC: 'litecoin', MATIC: 'matic-network' };
const STABLE = ['USDT', 'USDC', 'DAI', 'FDUSD'];
export const RATE_CREDIT = 'Rates by Exchange Rate API (exchangerate-api.com) and CoinGecko';

export const ratesStatus = { text: '', ok: null };
const say = (text, ok = null) => { ratesStatus.text = text; ratesStatus.ok = ok; const el = document.getElementById('ratesstatus'); if (el) el.textContent = text; };

export async function fetchRates({ quiet = false } = {}) {
  if (!quiet) say('Updating…');
  const usd = {};
  try {
    const r = await fetch(FIAT_URL);
    if (!r.ok) throw new Error('rate service answered ' + r.status);
    const j = await r.json();
    if (j.result !== 'success' || !j.rates) throw new Error('unexpected answer');
    Object.assign(usd, j.rates);
  } catch (e) {
    say(navigator.onLine === false ? 'Offline: keeping the last rates.' : 'Could not reach the rate service. Keeping the last rates.', false);
    throw e;
  }
  for (const c of STABLE) if (!usd[c]) usd[c] = 1;            // stablecoins: treated as 1 USD
  try {                                                         // crypto is best effort; failure is fine
    const ids = Object.values(COINS).join(',');
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    if (r.ok) { const j = await r.json(); for (const [c, id] of Object.entries(COINS)) if (j[id] && j[id].usd > 0) usd[c] = 1 / j[id].usd; }
  } catch { /* keep going without crypto prices */ }
  const prev = get().settings.live;
  if (prev && prev.usd) for (const c of CRYPTO) if (!usd[c] && prev.usd[c]) usd[c] = prev.usd[c];   // keep older crypto price if the call failed
  commitQuiet((d) => { d.settings.live = { ts: Date.now(), usd }; });
  window.dispatchEvent(new Event('sukli-render'));
  say(`Updated ${new Date().toLocaleString()}.`, true);
  return usd;
}

// at start-up and on coming back: refresh if the last update is over 12 hours old
export function ratesInit() {
  const go = () => {
    const s = get().settings;
    if (s.liveRates === false || !navigator.onLine) return;
    if (s.live && Date.now() - s.live.ts < 12 * 3600 * 1000) return;
    fetchRates({ quiet: true }).catch(() => {});
  };
  setTimeout(go, 2500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
  window.addEventListener('online', go);
}
export const hasLive = (c) => { const l = get().settings.live; return !!(l && l.usd && l.usd[c] > 0); };
export const supported = () => allCurrencies();
