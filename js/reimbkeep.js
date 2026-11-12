// Reimbursable expenses (the company pays you back). Pure, no imports, so the maths files can use it.
// t.reimb = { co: 'Company name', st: 'pending' | 'paid', got: amount paid back (in the entry's currency), on: date }
// While waiting, the expense is NOT your spending. Once paid, only the part the company did not pay counts.
export const reimbKeep = (t) => (!t || !t.reimb ? 1 : t.reimb.st === 'paid' ? Math.max(0, (+t.amount || 0) - (+t.reimb.got || 0)) / ((+t.amount) || 1) : 0);
