// The hierarchy in Sukli:  Investment type (Crypto, ETF, Government Bonds) > Exchange (Binance, Bybit, Bitget) > Account (Spot, Margin, Earn, ETF, TradFi, Options…) > Asset (USDT, BTC, BNB…).
// An exchange has accounts; an account holds assets; the SAME list of assets is available in every account of every exchange. A coin is never "added to an exchange":
// pick it where you need it and Sukli makes its (empty) balance in that account the first time.
import { get, commit, commitQuiet, uid, stamp, walletOf, CUR, CRYPTO } from './core.js';

// the 50 biggest coins by market value (a snapshot; rankings move, so any other coin can still be added by its code)
export const TOP_TOKENS = [
  ['BTC', 'Bitcoin', 'bitcoin'], ['ETH', 'Ethereum', 'ethereum'], ['USDT', 'Tether', 'tether'], ['XRP', 'XRP', 'ripple'], ['BNB', 'BNB', 'binancecoin'],
  ['SOL', 'Solana', 'solana'], ['USDC', 'USD Coin', 'usd-coin'], ['TRX', 'TRON', 'tron'], ['DOGE', 'Dogecoin', 'dogecoin'], ['ADA', 'Cardano', 'cardano'],
  ['HYPE', 'Hyperliquid', 'hyperliquid'], ['LINK', 'Chainlink', 'chainlink'], ['BCH', 'Bitcoin Cash', 'bitcoin-cash'], ['XLM', 'Stellar', 'stellar'], ['AVAX', 'Avalanche', 'avalanche-2'],
  ['LTC', 'Litecoin', 'litecoin'], ['SUI', 'Sui', 'sui'], ['HBAR', 'Hedera', 'hedera-hashgraph'], ['SHIB', 'Shiba Inu', 'shiba-inu'], ['TON', 'Toncoin', 'the-open-network'],
  ['DOT', 'Polkadot', 'polkadot'], ['XMR', 'Monero', 'monero'], ['UNI', 'Uniswap', 'uniswap'], ['AAVE', 'Aave', 'aave'], ['DAI', 'Dai', 'dai'],
  ['PEPE', 'Pepe', 'pepe'], ['ETC', 'Ethereum Classic', 'ethereum-classic'], ['NEAR', 'NEAR Protocol', 'near'], ['ICP', 'Internet Computer', 'internet-computer'], ['ONDO', 'Ondo', 'ondo-finance'],
  ['APT', 'Aptos', 'aptos'], ['ARB', 'Arbitrum', 'arbitrum'], ['ATOM', 'Cosmos', 'cosmos'], ['FIL', 'Filecoin', 'filecoin'], ['ALGO', 'Algorand', 'algorand'],
  ['VET', 'VeChain', 'vechain'], ['POL', 'Polygon', 'polygon-ecosystem-token'], ['RENDER', 'Render', 'render-token'], ['INJ', 'Injective', 'injective-protocol'], ['TAO', 'Bittensor', 'bittensor'],
  ['OP', 'Optimism', 'optimism'], ['CRO', 'Cronos', 'crypto-com-chain'], ['USDE', 'Ethena USDe', 'ethena-usde'], ['FDUSD', 'First Digital USD', 'first-digital-usd'], ['WLD', 'Worldcoin', 'worldcoin-wld'],
  ['SEI', 'Sei', 'sei-network'], ['JUP', 'Jupiter', 'jupiter-exchange-solana'], ['BONK', 'Bonk', 'bonk'], ['FET', 'Artificial Superintelligence Alliance', 'artificial-superintelligence-alliance'], ['TIA', 'Celestia', 'celestia'],
].map(([c, n, cg]) => ({ c, n, cg }));
export const TOP_SET = new Set(TOP_TOKENS.map((t) => t.c));

// the kinds of account each exchange offers (they differ by exchange); anything else you already use is added to the list
const DEFAULT_ACCTS = ['Spot', 'Margin', 'Futures', 'Options', 'Earn', 'Funding', 'ETF', 'TradFi'];
const BY_EX = { binance: ['Spot', 'Margin', 'Futures', 'Options', 'Earn', 'Funding', 'ETF'], bybit: ['Spot', 'Margin', 'Futures', 'Options', 'Earn', 'Funding', 'TradFi'], bitget: ['Spot', 'Margin', 'Futures', 'Earn', 'Funding', 'TradFi'], okx: ['Spot', 'Margin', 'Futures', 'Options', 'Earn', 'Funding'], kraken: ['Spot', 'Margin', 'Futures', 'Earn', 'Funding'], coinbase: ['Spot', 'Earn', 'Funding'] };
export function accountTypesOf(db, exchange) {
  const k = String(exchange || '').toLowerCase(), base = BY_EX[k] || DEFAULT_ACCTS;
  const used = db.accounts.filter((a) => !a.deleted && (a.exchange || '').toLowerCase() === k).map(walletOf);
  const mine = ((db.settings.acctTypes || {})[Object.keys(db.settings.acctTypes || {}).find((x) => x.toLowerCase() === k)] || []);   // account types you added for this exchange (new products appear over time)
  return [...new Set([...base, ...mine, ...used])];
}

// every coin you can pick on an exchange: the top 50, plus anything you added anywhere
export function assetChoices(db) {
  const seen = new Map(TOP_TOKENS.map((t) => [t.c, t.n]));
  for (const a of db.accounts) if (!a.deleted && (a.type === 'crypto' || a.invtab) && a.cur && !seen.has(a.cur)) seen.set(a.cur, ((db.settings.tickers || {})[a.cur] || {}).name || '');
  return [...seen].map(([c, n]) => ({ c, n }));
}

// the account for this coin in this account type of this exchange; made (empty) when missing
// every trading wallet (Spot, Margin, Futures, Options) of a crypto platform always has a USDT line, even at zero, so it can be picked in a trade or transfer.
// Earn is left out (passive). A USDT line you deleted yourself is not brought back. Returns how many were made.
export const TRADING_WALLETS = ['Spot', 'Margin', 'Futures', 'Options', 'Other'];
// the empty USDT lines a db is missing: Spot always, and every other trading account type the platform offers (Margin, Futures, Options, Other), so each one can be picked right away
function usdtGaps(db) {
  const made = [], seen = new Map();
  for (const a of db.accounts) if (a.exchange && (a.type === 'crypto' || a.assetType === 'crypto') && !a.archived) { const k = a.exchange.toLowerCase(); if (!seen.has(k)) seen.set(k, { ex: a.exchange, w: new Set(['Spot']) }); if (!a.deleted) seen.get(k).w.add(walletOf(a)); }
  for (const v of seen.values()) for (const wal of accountTypesOf(db, v.ex)) v.w.add(wal);   // every account type this exchange offers (Spot, Margin, Futures, Options, Other ...), not only the ones already used
  for (const { ex, w } of seen.values()) for (const wal of w) {
    if (!TRADING_WALLETS.includes(wal)) continue;
    if (db.accounts.some((x) => x.cur === 'USDT' && (x.exchange || '').toLowerCase() === ex.toLowerCase() && walletOf(x).toLowerCase() === wal.toLowerCase())) continue;
    made.push({ ex, wal });
  }
  return made;
}
const usdtAcct = ({ ex, wal }) => stamp({ id: uid(), name: `${ex}${wal === 'Spot' ? '' : ' ' + wal} USDT`, wallet: wal, cur: 'USDT', type: 'crypto', assetType: 'crypto', exchange: ex, open: 0, include: false, archived: false, invtab: true });
// adds them straight into a db (used by the importer before it saves)
export function addMissingUsdt(db) { const m = usdtGaps(db); for (const g of m) db.accounts.push(usdtAcct(g)); return m.length; }
export function ensureUsdt() {
  const made = usdtGaps(get());
  if (!made.length) return 0;
  commitQuiet((d) => { for (const g of made) d.accounts.push(usdtAcct(g)); });
  return made.length;
}
export function ensureAsset(platform, cur, wallet = 'Spot') {
  const low = platform.toLowerCase(), same = (d) => d.accounts.find((x) => !x.deleted && x.cur === cur && (x.exchange || '').toLowerCase() === low && walletOf(x).toLowerCase() === wallet.toLowerCase());
  const have = same(get()); if (have) return have;
  const sib = get().accounts.find((x) => !x.deleted && (x.exchange || '').toLowerCase() === low), nid = uid(), tk = TOP_TOKENS.find((t) => t.c === cur);
  commit((d) => {
    d.settings.tickers = d.settings.tickers || {};
    if (tk && !d.settings.tickers[cur]) d.settings.tickers[cur] = { ticker: cur, name: tk.n, assetType: 'crypto', market: '', quote: 'USDT', cgId: tk.cg };
    if (!CRYPTO.includes(cur)) { d.settings.curDec = d.settings.curDec || {}; if (!d.settings.curDec[cur]) { d.settings.curDec[cur] = 8; CUR[cur].dec = 8; } }
    d.accounts.push(stamp({ id: nid, name: `${(sib && sib.exchange) || platform}${wallet === 'Spot' ? '' : ' ' + wallet} ${cur}`, wallet, cur, type: 'crypto', assetType: 'crypto', exchange: (sib && sib.exchange) || platform, open: 0, include: false, archived: false, invtab: true }));
  });
  return same(get());
}

// add or remove an account type for one exchange (for products the exchange launches later). Built-in and used types cannot be removed.
export function addAccountType(exchange, name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24); if (!n) return '';
  commit((d) => { const m = (d.settings.acctTypes = d.settings.acctTypes || {}); const k = Object.keys(m).find((x) => x.toLowerCase() === exchange.toLowerCase()) || exchange; m[k] = [...new Set([...(m[k] || []), n])]; });
  return n;
}
export function removeAccountType(exchange, name) {
  commit((d) => { const m = d.settings.acctTypes || {}, k = Object.keys(m).find((x) => x.toLowerCase() === exchange.toLowerCase()); if (k) m[k] = m[k].filter((x) => x !== name); });
}
