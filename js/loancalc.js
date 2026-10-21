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

