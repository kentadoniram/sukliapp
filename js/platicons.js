// One recognisable symbol per exchange or broker, used everywhere a platform is named in Investments.
// These are Sukli's own symbols (a shape and a colour per platform), not the companies' trademarked logos. Anyone can put their own
// logo on a platform: Platform Settings > Icon > Upload logo (kept on this device inside settings.platformIcons).
import { get } from './core.js';
import { esc } from './ui.js';
import { button } from './components.js';
import { look } from './appearance.js';

const SHAPES = {
  diamond: 'M12 3 21 12 12 21 3 12Z', hex: 'M12 3 20 7.5V16.5L12 21 4 16.5V7.5Z', tri: 'M12 4 21 19H3Z', down: 'M3 6H21L12 20Z',
  star: 'M12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5Z', ring: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18ZM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 1 1 0-9Z',
  bars: 'M4 13h4v7H4ZM10 8h4v12h-4ZM16 4h4v16h-4Z', plus: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7Z', bolt: 'M13 2 5 13H11L10 22 19 10H13Z',
  shield: 'M12 2 20 5V12C20 17 16 20.5 12 22 8 20.5 4 17 4 12V5Z', moon: 'M15 3a9 9 0 1 0 6 11 7 7 0 0 1-6-11Z',
  wave: 'M2 12Q7 4 12 12T22 12V17Q17 9 12 17T2 17Z', leaf: 'M20 4C10 4 4 9 4 16 4 18 5 20 5 20 6 14 10 11 15 10 10 13 8 16 8 20 16 20 20 14 20 4Z',
  hash: 'M8 3 6.5 21H9L10.5 3ZM15 3 13.5 21H16L17.5 3ZM3 9H21V11.5H3ZM3 15H21V17.5H3Z', drop: 'M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2Z',
  cross: 'M5 7 7 5 12 10 17 5 19 7 14 12 19 17 17 19 12 14 7 19 5 17 10 12Z', arrow: 'M12 3 20 12H15V21H9V12H4Z', pent: 'M12 3 21 10 17.5 20.5H6.5L3 10Z',
  half: 'M12 3a9 9 0 0 1 0 18Z', grid: 'M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z', stack: 'M3 6h18v3H3ZM3 11h18v3H3ZM3 16h18v3H3Z',
  crown: 'M3 18V7L8 12 12 5 16 12 21 7V18Z', chev: 'M4 6 12 14 20 6V10L12 18 4 10ZM4 12 12 20 20 12V16L12 24 4 16Z', square: 'M5 5h14v14H5Z',
};
const KEYS = Object.keys(SHAPES);
// name (letters and digits only, lower case) -> [shape, colour]. Matching is by "starts with", so "Binance Japan" finds "binance".
const KNOWN = [
  ['binance', 'diamond', '#F0B90B'], ['bybit', 'bars', '#F7A600'], ['bitget', 'hex', '#0E9AA7'], ['okx', 'plus', '#000000'], ['kucoin', 'ring', '#23AF91'],
  ['coinbase', 'moon', '#0052FF'], ['kraken', 'wave', '#5741D9'], ['bitfinex', 'leaf', '#4E9A2F'], ['gate', 'shield', '#2354E6'], ['mexc', 'tri', '#1972E2'],
  ['htx', 'drop', '#1B67C2'], ['huobi', 'drop', '#1C9CC2'], ['cryptocom', 'half', '#1E3A8A'], ['upbit', 'star', '#0891B2'], ['bithumb', 'chev', '#EA6A12'],
  ['bitflyer', 'bolt', '#2563EB'], ['coincheck', 'arrow', '#0F766E'], ['bitbank', 'stack', '#0369A1'], ['gemini', 'hash', '#0E7490'], ['bitstamp', 'down', '#15803D'],
  ['moomoo', 'crown', '#E8590C'], ['futu', 'crown', '#E8590C'], ['tiger', 'grid', '#C2410C'], ['interactivebrokers', 'pent', '#B91C1C'], ['ibkr', 'pent', '#B91C1C'],
  ['webull', 'cross', '#2B6CB0'], ['rakuten', 'square', '#BF0000'], ['sbi', 'square', '#1D4ED8'], ['matsui', 'square', '#7C3AED'], ['monex', 'square', '#0F766E'],
  ['gcash', 'square', '#007CFF'], ['maya', 'square', '#00B36B'], ['paymaya', 'square', '#00B36B'], ['paypay', 'square', '#FF0033'], ['paypal', 'square', '#003087'], ['wise', 'square', '#9FE870'], ['revolut', 'square', '#191C1F'], ['seabank', 'square', '#F26B21'], ['gotyme', 'square', '#1BB6C7'], ['bdo', 'square', '#0B3C8C'], ['bpi', 'square', '#B3282D'], ['unionbank', 'square', '#F58220'], ['metrobank', 'square', '#0A3D91'], ['landbank', 'square', '#0B7A3E'],
  ['phemex', 'star', '#4D7C0F'], ['bingx', 'wave', '#2563EB'], ['bitmart', 'grid', '#0D9488'], ['lbank', 'stack', '#7E22CE'], ['poloniex', 'moon', '#047857'], ['bitmex', 'bars', '#B45309'],
];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function platSymbol(ex) {
  const n = norm(ex), k = KNOWN.find(([p]) => n.startsWith(p));
  if (k) return { shape: k[1], color: k[2], known: true };
  const h = hash(n || 'x'); return { shape: KEYS[h % KEYS.length], color: `hsl(${(h >> 3) % 360} 52% 38%)`, known: false };   // an unknown platform gets the same symbol every time
}
export const customIcon = (ex) => { const m = ((get() || {}).settings || {}).platformIcons || {}; return m[ex] || m[Object.keys(m).find((x) => x.toLowerCase() === String(ex).toLowerCase())] || ''; };
// html for a small square badge. size: 'sm' (28px, rows), 'xs' (22px, headings)
// letters for the 'initials' badge: a short name (OKX, HTX, BDO) is shown whole, a long one by its first letters
export const platLetters = (ex) => { const w = String(ex).trim().split(/\s+/).filter(Boolean), n = norm(ex); if (!n) return '?'; if (w.length === 1) return (n.length <= 3 ? n : w[0][0]).toUpperCase(); return (w[0][0] + w[1][0]).toUpperCase(); };
const darkText = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return false; const n = parseInt(m[1], 16), l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150; };
export function platIcon(ex, size = 'sm') {
  if (!ex || ex === 'Wallets and other') return '';
  const c = customIcon(ex);
  if (c) return `<i class="pbadge ${size} pimg" aria-hidden="true"><img alt="" src="${esc(c)}"></i>`;
  const s = platSymbol(ex);
  if (look().logo !== 'symbol') return `<i class="pbadge ${size} pletters l${platLetters(ex).length > 2 ? 3 : 2}${s.known ? '' : ' own'}${darkText(s.color) ? ' dk' : ''}" style="background:${s.color}" aria-hidden="true"><b>${esc(platLetters(ex))}</b></i>`;
  return `<i class="pbadge ${size}" style="background:${s.color}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path fill="#fff" fill-rule="evenodd" d="${SHAPES[s.shape]}"/></svg></i>`;
}

// Style Guide > Platform logos: every platform Sukli knows from your accounts, with upload / remove. Files are resized to 96px and kept on this device only.
export function platLogoRows(names) {
  return names.map((n) => `<div class="sglogo">${platIcon(n)}<span>${esc(n)}</span>${customIcon(n) ? `${button({ label: 'Remove', kind: 'ghost', size: 'sm', act: 'sg-logo-reset', data: 'ex', v: n })}` : ''}<label class="btn sm ghost sglogo-up">Upload<input type="file" accept="image/*" hidden data-sg-logo="${esc(n)}"></label></div>`).join('');
}
