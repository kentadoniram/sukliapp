// Quantity parsing for item lists: exact, never rounded.
// (The shop-price solver that used to live here was never wired into any screen, so it was removed in v16.9.)

// ---------- quantities: exact, never rounded ----------
// pieces: whole numbers only. kg / g / L / ml: real decimals, up to 3 places, "." or ",".
const UNITS = { pc: { weight: false, base: 1 }, kg: { weight: true, base: 1 }, g: { weight: true, base: 0.001 }, L: { weight: true, base: 1 }, ml: { weight: true, base: 0.001 } };
export function parseQty(text, unit = 'pc') {
  const u = UNITS[unit]; if (!u) return { ok: false, error: 'Unknown unit.' };
  let s = String(text ?? '').normalize('NFKC').trim().replace(/\s+/g, '');
  if (!s) return { ok: false, error: 'Type how many.' };
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');          // 1,200 is twelve hundred
  else s = s.replace(',', '.');                                       // 0,35 is 0.35
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'Use numbers only, like 2 or 0.35.' };
  const [w, f = ''] = s.split('.');
  if (!u.weight && f) return { ok: false, error: 'Pieces must be whole numbers. Use kg, g, L or ml for a decimal.' };
  if (f.length > 3) return { ok: false, error: 'At most 3 decimal places.' };
  const exact = parseInt(w, 10) * 1000 + (u.weight && f ? parseInt(f.padEnd(3, '0'), 10) : 0);   // thousandths as a whole number: 0.35 is exactly 350
  if (!(exact > 0)) return { ok: false, error: 'The amount must be more than zero.' };
  return { ok: true, milli: exact, text: u.weight ? (exact / 1000).toString() : String(exact / 1000), qty: exact / 1000 };
}
