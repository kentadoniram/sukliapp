// Tags (the "Labels" of Bluecoins): a trip or an event that groups entries from any category, for example #Okinawa trip.
// Stored on each entry as one text, tags separated by commas, so Bluecoins CSV import and export keep working.
export const parseTags = (s) => [...new Set(String(s || '').split(/[,;，]/).map((x) => x.trim().replace(/^#+/, '').trim()).filter(Boolean))];
export const joinTags = (a) => [...new Set(a.map((x) => String(x).trim().replace(/^#+/, '').trim()).filter(Boolean))].join(', ');
export const hasTag = (t, tag) => !!tag && parseTags(t.labels).some((x) => x.toLowerCase() === tag.toLowerCase());
// every tag in use, most recently used first: [{ tag, n, last }]
export function tagCounts(db) {
  const m = new Map();
  for (const t of db.txs) { if (t.deleted || !t.labels) continue;
    for (const g of parseTags(t.labels)) { const k = g.toLowerCase(), e = m.get(k) || { tag: g, n: 0, last: '' }; e.n++; if ((t.date || '') > e.last) { e.last = t.date || ''; e.tag = g; } m.set(k, e); } }
  return [...m.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : b.n - a.n));
}
