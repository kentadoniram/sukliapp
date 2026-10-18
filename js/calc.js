// Tiny safe calculator: numbers, + - × ÷ * / ( ) and a trailing % (no eval).
export function evalExpr(src) {
  const s = String(src ?? '').replace(/,/g, '').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (!s) return NaN;
  if (/^-?\d*\.?\d+$/.test(s) || /^-?\d+\.$/.test(s)) return parseFloat(s);   // plain number: the common, fast path
  let i = 0;
  const peek = () => s[i];
  function num() {
    const m = s.slice(i).match(/^\d*\.?\d+|^\d+\./);
    if (!m) throw 0;
    i += m[0].length;
    let v = parseFloat(m[0]);
    while (peek() === '%') { v /= 100; i++; }
    return v;
  }
  function atom() {
    if (peek() === '-') { i++; return -atom(); }
    if (peek() === '+') { i++; return atom(); }
    if (peek() === '(') { i++; const v = sum(); if (peek() !== ')') throw 0; i++; let r = v; while (peek() === '%') { r /= 100; i++; } return r; }
    return num();
  }
  function prod() {
    let v = atom();
    while (peek() === '*' || peek() === '/') { const o = s[i++]; const r = atom(); v = o === '*' ? v * r : v / r; }
    return v;
  }
  function sum() {
    let v = prod();
    while (peek() === '+' || peek() === '-') { const o = s[i++]; const st = i; let r = prod(); if (/^\d*\.?\d+%+$/.test(s.slice(st, i))) r = v * r; v = o === '+' ? v + r : v - r; }   // 200-10% = 180
    return v;
  }
  try { const v = sum(); return i === s.length && isFinite(v) ? v : NaN; } catch { return NaN; }
}
export const isExpr = (s) => /[+\-*/×÷()%xX−]/.test(String(s).replace(/^\s*-/, ''));
export const tidy = (v) => String(Number(Number(v).toFixed(6)));
