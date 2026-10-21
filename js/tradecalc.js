// Buy / sell / convert bookkeeping (average cost), kept free of the page so it can be tested.
// A trade is a transfer between your cash account and a holding, marked with t.trade = { side, asset, asset2, qty, qty2, valueHome, feeHome }.
//   buy      asset = holding bought, qty = units, valueHome = what it cost (home currency)
//   sell     asset = holding sold,   qty = units, valueHome = proceeds
//   convert  asset = coin given,     qty given;  asset2 = coin received, qty2 received; valueHome = worth of what was received
// Only units bought through trades have a known cost; what you held before Sukli has none, so it never inflates a gain.
export function tradeBook(txs) {
  const pos = new Map(), realized = [];
  const P = (id) => { if (!pos.has(id)) pos.set(id, { qty: 0, cost: 0 }); return pos.get(id); };
  const list = txs.filter((t) => !t.deleted && t.trade).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sellOut = (t, id, qty, proceeds, fee) => {
    const p = P(id), known = Math.min(qty, p.qty), avg = p.qty > 0 ? p.cost / p.qty : 0, share = qty > 0 ? known / qty : 0;
    const cost = avg * known, got = proceeds * share, gain = got - cost - fee * share;
    p.qty -= known; p.cost -= cost; if (p.qty < 1e-12) { p.qty = 0; p.cost = 0; }
    realized.push({ id: t.id, date: t.date, acct: id, qty, knownQty: known, proceeds: got, cost, fee: fee * share, gain });
  };
  for (const t of list) {
    const x = t.trade, fee = x.feeHome || 0;
    if (x.side === 'buy') { const p = P(x.asset); p.qty += x.qty; p.cost += x.valueHome; }
    else if (x.side === 'sell') sellOut(t, x.asset, x.qty, x.valueHome, fee);
    else if (x.side === 'convert') { sellOut(t, x.asset, x.qty, x.valueHome, fee); const p = P(x.asset2); p.qty += x.qty2; p.cost += x.valueHome; }
  }
  const total = realized.reduce((s, r) => s + r.gain, 0);
  return { pos, realized, total };
}
