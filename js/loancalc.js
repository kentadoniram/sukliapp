// Loan arithmetic and label words, kept free of the page so they can be tested.
// monthly payment of a standard instalment loan; interest-free loans just divide
export function loanCalc({ principal, rate, months, fees = 0, lateFee = 0 }) {
  const P = +principal || 0, n = Math.max(1, Math.round(months) || 1), r = (+rate || 0) / 100 / 12;
  const monthly = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
  const totalPaid = monthly * n, interest = totalPaid - P, net = P - fees, cost = interest + fees;
  const lateEach = monthly * (+lateFee || 0) / 100;
  return { monthly, totalPaid, interest, fees, net, cost, costPct: net > 0 ? (cost / net) * 100 : 0, overBorrowed: P > 0 ? (totalPaid + fees) / P : 0, lateEach, lateAll: lateEach * n, n };
}
// words that tell a loan-related entry: label -> what it probably is
export const smartKind = (text) => {
  const t = String(text || '').toLowerCase().trim();
  if (/(credit to cash|cash advance|c2c|cash2go|cash 2 go)/.test(t)) return 'cash';
  if (/(credit card payment|cc payment|card payment|pay card|クレジット.*支払)/.test(t)) return 'cardpay';
  if (/(loan payment|loan pay|amortization|amortisation|monthly amort|ローン.*返済|返済)/.test(t)) return 'loanpay';
  if (/^loan\b|\bloan (proceeds|release)|borrow/.test(t)) return 'loan';
  return '';
};


// How a loan's payments split into interest and principal. Each payment first covers the interest of the month on what is still owed,
// the rest reduces the principal. payments = [{ date, amount }] oldest first. An estimate: the real schedule is the lender's.
export function loanProgress(L, payments) {
  const r = (+L.rate || 0) / 100 / 12; let bal = +L.principal || 0, interest = 0, paid = 0; const rows = [];
  for (const p of payments) {
    const i = Math.min(bal * r, p.amount), pr = Math.min(bal, p.amount - i);
    bal = Math.max(0, bal - pr); interest += i; paid += p.amount; rows.push({ date: p.date, amount: p.amount, interest: i, principal: pr });
  }
  const left = L.monthly > 0 && bal > 0 ? Math.min(L.months, Math.ceil((r > 0 ? -Math.log(1 - (bal * r) / L.monthly) / Math.log(1 + r) : bal / L.monthly) - 0.02)) : 0;
  return { rows, paid, interest, principal: paid - interest, balance: bal, paymentsLeft: Number.isFinite(left) ? left : 0, count: payments.length };
}
