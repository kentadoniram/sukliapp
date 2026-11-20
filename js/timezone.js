// One place for "what time is it THERE". Every platform and market keeps its own clock, so a stamp that belongs to a platform
// (a price day, an income date, an Earn payout, a market being open) is read on that platform's clock, never the phone's.
// The phone's clock is only used for things that belong to the person (when they typed an entry, their own calendar).
//
// A zone is either a whole-hour offset from UTC (number, what the person picks in Platform Settings) or an IANA name
// (a market's own rule, so daylight saving is followed: New York moves, Manila and Tokyo do not).

// Defaults when the person has not chosen a timezone for a platform. First match wins.
//  crypto: Binance and Bybit report on UTC, most other exchanges (Bitget, OKX, KuCoin, Gate...) on UTC+8.
//  stock markets: the exchange's own city, with its normal trading sessions (local time, Monday to Friday).
export const ZONES = [
  { re: /nasdaq|nyse|amex|\bus\b|new york|\bots\b/i, zone: 'America/New_York', market: true, sessions: [['09:30', '16:00']] },
  { re: /\bpse\b|psei|philippine|manila/i, zone: 'Asia/Manila', market: true, sessions: [['09:30', '12:00'], ['13:30', '15:30']] },
  { re: /\btse\b|tokyo|jpx|nikkei|\bjp\b/i, zone: 'Asia/Tokyo', market: true, sessions: [['09:00', '11:30'], ['12:30', '15:30']] },
  { re: /hkex|hong kong|\bhk\b/i, zone: 'Asia/Hong_Kong', market: true, sessions: [['09:30', '12:00'], ['13:00', '16:00']] },
  { re: /\bkrx\b|korea|kospi/i, zone: 'Asia/Seoul', market: true, sessions: [['09:00', '15:30']] },
  { re: /\bsgx\b|singapore/i, zone: 'Asia/Singapore', market: true, sessions: [['09:00', '17:00']] },
  { re: /\blse\b|london/i, zone: 'Europe/London', market: true, sessions: [['08:00', '16:30']] },
  { re: /\basx\b|sydney|australia/i, zone: 'Australia/Sydney', market: true, sessions: [['10:00', '16:00']] },
  { re: /binance|bybit/i, zone: 0 },
];
export const DEFAULT_ZONE = 8;   // any other platform: UTC+8, the same default Earn has always used
export const UTC = 0;            // a price from a worldwide feed (CoinGecko) belongs to the UTC day

const rule = (name) => ZONES.find((z) => z.re.test(String(name || '')));
// the person's own choice (Platform Settings) wins over the default; names compare without case
export function zoneFor(db, name) {
  const m = (db && db.settings && db.settings.platformTz) || {}, k = Object.keys(m).find((x) => x.toLowerCase() === String(name || '').toLowerCase());
  if (k != null && Number.isFinite(+m[k])) return +m[k];
  const r = rule(name); return r ? r.zone : DEFAULT_ZONE;
}
export const isMarket = (name) => !!(rule(name) && rule(name).market);

const p2 = (n) => String(n).padStart(2, '0');
// the clock of an instant in a zone, using UTC getters (or Intl for an IANA name) so the phone's timezone can never leak in
export function clockIn(ms, zone) {
  if (typeof zone === 'number') { const d = new Date(ms + zone * 36e5); return { day: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`, hm: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`, dow: d.getUTCDay() }; }
  const o = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, hm: `${o.hour}:${o.minute}`, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}
export const dayIn = (ms, zone) => clockIn(ms, zone).day;
// "today" on a platform or market (db + its name), now by default
export const platformDay = (db, name, ms = Date.now()) => dayIn(ms, zoneFor(db, name));
export const zoneLabel = (zone, ms = Date.now()) => {
  if (typeof zone === 'number') return `UTC${zone < 0 ? '−' : '+'}${Math.abs(zone)}`;
  const c = clockIn(ms, zone), u = clockIn(ms, 0), diff = (Date.parse(`${c.day}T${c.hm}:00Z`) - Date.parse(`${u.day}T${u.hm}:00Z`)) / 36e5;
  return `UTC${diff < 0 ? '−' : '+'}${Math.abs(diff)}`;
};

// Is a market open right now? Only for exchanges with sessions in ZONES; a crypto exchange never closes.
export function marketState(db, name, ms = Date.now()) {
  const r = rule(name); if (!r || !r.sessions) return { open: true, always: true };
  const zone = zoneFor(db, name), c = clockIn(ms, zone), weekday = c.dow >= 1 && c.dow <= 5;
  const open = weekday && r.sessions.some(([a, b]) => c.hm >= a && c.hm < b);
  return { open, always: false, local: `${c.day} ${c.hm}`, zone: zoneLabel(zone, ms) };
}

// The day a price belongs to. A ticker with a market is priced on that market's day (the NASDAQ day for NVDA, the PSE day for a PSEI stock);
// a coin or token is priced on the day of the platform it is held on, and on the UTC day when no platform is known.
export function priceDay(db, tk, acct, ms = Date.now()) {
  const m = tk && tk.market;
  if (m && isMarket(m)) return platformDay(db, m, ms);
  if (acct && acct.exchange) return platformDay(db, acct.exchange, ms);
  return dayIn(ms, UTC);
}
