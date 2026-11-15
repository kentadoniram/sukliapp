// Settings for the + (Add) button and the entry form's coloured type labels (v15.39)
export const KIND_META = {
  expense: { label: 'Expense', hint: 'Money going out', cls: 'k-expense' },
  income: { label: 'Income', hint: 'Money coming in', cls: 'k-income' },
  transfer: { label: 'Transfer', hint: 'Moving money between your own accounts', cls: 'k-transfer' },
};
export const START_CHOICES = [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer'], ['last', 'The type I used last'], ['ask', 'Ask me every time']];
export const addCfg = (db) => { const s = (db && db.settings) || {};
  return { start: START_CHOICES.some((c) => c[0] === s.addStart) ? s.addStart : 'expense', fab: s.addFab || 'plain', banner: s.addBanner !== false, confirmSave: s.addSaveLabel !== false }; };
// the type the + button opens (null = ask first)
export function startKind(db) { const c = addCfg(db).start;
  if (c === 'ask') return null; if (c !== 'last') return c;
  const l = (db.txs || []).filter((t) => !t.deleted && !t.auto && ['expense', 'income', 'transfer'].includes(t.kind)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  return l ? l.kind : 'expense'; }
