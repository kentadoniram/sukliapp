// Currency picker: favourites on top, search through every currency, pick one to add it to the quick list.
import { get, commit, allCurrencies, curName, ensureCurrency, CUR, CRYPTO, platformOf } from './core.js';
import { esc, sheet } from './ui.js';
import { picHtml, isImg } from './pictures.js';
import { button } from './components.js';

// every fiat currency belongs to a country: search "japan" or "thailand" and flags make the list easy to scan
const REGION = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return { of: () => '' }; } })();
const ISO = (() => { try { return new Set(Intl.supportedValuesOf('currency')); } catch { return new Set(); } })();
const regionOf = (c) => { if (c === 'EUR') return 'EU'; if (!ISO.has(c) || c[0] === 'X') return ''; const r = c.slice(0, 2); return REGION.of(r) === r ? '' : r; };
export const flagOf = (c) => { const r = regionOf(c); return r ? String.fromCodePoint(...[...r].map((ch) => 127397 + ch.charCodeAt(0))) : ''; };
// coins get a small round badge in their own colour, so USDT, USDC, BTC… are easy to tell apart from money (fiat) at a glance
const COIN_LOGOS = new Set(('aave ada algo apt arb atom avax bch bnb btc cro dai doge dot etc eth fdusd fet fil hbar icp jup link ltc matic near op pepe pol render sei shib sol sui tao tia ton trx uni usdc usde usdt vet xlm xmr xrp gt kcs mx ht pyusd tusd usdd dash zec sand mana ape grt rune ldo mkr crv 1inch comp snx imx strk pi xaut paxg wbtc eurc').split(' '));   /* real logos in vendor/coins (open-licence web3icons pack) */
export const isCoin = (c) => COIN_LOGOS.has(String(c || '').toLowerCase()) || CRYPTO.includes(c);
export const coinIcon = (c) => COIN_LOGOS.has(String(c || '').toLowerCase())
  ? `<img class="coin coinimg" src="vendor/coins/${esc(String(c).toLowerCase())}.svg" alt="${esc(c)}" title="${esc(c)}" width="24" height="24" loading="lazy" decoding="async">`
  : /^USD|USD$/i.test(String(c || '')) ? `<i class="coin usdlike" title="${esc(c)}" aria-hidden="true">$</i>`   /* a dollar-pegged coin with no logo on file: a neutral dollar badge, never a country flag */
  : `<i class="coin" title="${esc(c)}" aria-hidden="true">${esc(String(c || '?')[0])}</i>`;   /* no logo on file: a plain grey letter, never a made-up colour */
export const curIcon = (c) => (isCoin(c) ? coinIcon(c) : flagOf(c));
const ALSO = { EUR: 'Europe Eurozone Germany France Italy Spain', USD: 'United States America USA', GBP: 'United Kingdom Britain England UK', USDT: 'tether dollar', USDC: 'circle dollar', CNY: 'China yuan renminbi', JPY: 'Japan yen' };
export const regionName = (c) => { const r = regionOf(c); if (!r) return ''; try { return REGION.of(r) || ''; } catch { return ''; } };
export const countryOf = (c) => { const r = regionOf(c); let n = ''; try { n = r ? REGION.of(r) || '' : ''; } catch { /* ignore */ } return ((ALSO[c] || '') + ' ' + n).trim(); };

export const DEFAULT_FAVS = ['PHP', 'JPY', 'USD', 'USDT'];
export const favCurs = () => { const f = get().settings.favCurs; return Array.isArray(f) && f.length ? f : DEFAULT_FAVS; };
export function addFav(c) { commit((d) => { const f = [...(Array.isArray(d.settings.favCurs) && d.settings.favCurs.length ? d.settings.favCurs : DEFAULT_FAVS)]; if (!f.includes(c)) f.push(c); d.settings.favCurs = f; }); }

export function openCurrencyPicker(onPick, { title = 'Choose a currency', keep = true } = {}) {
  const s = sheet(`<input type="search" id="curq" class="search" data-noclear="1" placeholder="Search currency or country: peso, Japan, THB, bitcoin…" autocomplete="off" autofocus><div id="curlist" class="curlist"></div>`, { title });
  const list = s.el.querySelector('#curlist');
  const row = (c) => `${button({ html: `<i class="badge sm" style="background:var(--tint);color:var(--line)">${isCoin(c) ? coinIcon(c) : flagOf(c) || esc((CUR[c].sym || c).trim().slice(0, 3))}</i><span class="rmain"><strong>${c}</strong><small>${esc(curName(c))}${regionName(c) ? ' · ' + esc(regionName(c)) : ''}</small></span>`, kind: 'plain', cls: 'row cur', attr: { 'data-c': c } })}`;
  const draw = (q = '') => {
    q = q.trim().toLowerCase();
    const favs = favCurs();
    const match = (c) => !q || `${c} ${curName(c)} ${countryOf(c)}`.toLowerCase().includes(q);
    const f = favs.filter(match), rest = allCurrencies().filter((c) => !favs.includes(c) && match(c));
    const letters = [...new Set(rest.map((c) => c[0]))];
    const others = q
      ? (rest.length ? `<h3>Matches</h3><div class="rows plain">${rest.map(row).join('')}</div>` : '')
      : `<h3>Others</h3>${letters.map((L) => `<h4 class="letter">${L}</h4><div class="rows plain">${rest.filter((c) => c[0] === L).map(row).join('')}</div>`).join('')}`;
    list.innerHTML = (f.length ? `<h3>${q ? 'Quick list matches' : 'Quick list'}</h3><div class="rows plain">${f.map(row).join('')}</div>` : '') + others +
      (!f.length && !rest.length ? (/^[A-Za-z0-9]{2,10}$/.test(q) ? `${button({ html: `<i class="badge sm">+</i><span class="rmain"><strong>Add ${esc(q.toUpperCase())}</strong><small>Use it as your own currency or coin</small></span>`, kind: 'plain', cls: 'row cur', attr: { 'data-new': q.toUpperCase() } })}<p class="hint">Not in the list. Add it as your own coin or currency.</p>` : '<p class="empty">Nothing matches. Try the currency name, its code or the country.</p>') : '');
  };
  draw();
  s.el.querySelector('#curq').addEventListener('input', (e) => draw(e.target.value));
  list.addEventListener('click', (e) => {
    const nb = e.target.closest('[data-new]');
    if (nb) { const code = nb.dataset.new; commit((d) => { ensureCurrency(d, code); }); if (keep) addFav(code); s.close(); onPick(code); return; }
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (keep) addFav(b.dataset.c);
    s.close(); onPick(b.dataset.c);
  });
}

// The picture for one investment asset. Order: the picture you chose (never replaced) > the coin logo of its code > of its ticker >
// of a coin word in its name (an imported asset you renamed) > a neutral badge for dollar-pegged names > the flag/letter of the currency.
export function assetIcon(a, tickers = {}) {
  if (!a) return { html: '', coin: false };
  if (a.icon) return { html: picHtml(a.icon, 'wallet'), coin: isImg(a.icon), manual: true };
  const logo = (c) => COIN_LOGOS.has(String(c || '').toLowerCase());
  const tk = (tickers[a.cur] || {}).ticker;
  const ex = platformOf(a), words = String(a.name || '').toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w && w !== ex.toUpperCase());
  const hit = [a.cur, tk, ...words].find(logo);
  if (hit) return { html: coinIcon(hit), coin: true };
  if (CRYPTO.includes(a.cur) || tickers[a.cur] || (ex && !regionOf(a.cur)) || (ex && /^USD/.test(a.cur))) return { html: coinIcon(a.cur), coin: true };
  if (ex && words.some((w) => /^USD|USD$/.test(w))) return { html: coinIcon(words.find((w) => /^USD|USD$/.test(w))), coin: true };
  return isCoin(a.cur) ? { html: coinIcon(a.cur), coin: true } : { html: esc(flagOf(a.cur) || String(a.cur || '?').slice(0, 1)), coin: false };
}
