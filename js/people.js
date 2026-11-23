// One person, several currencies. A person you lent to or borrowed from can have more than one currency (for example PHP and JPY).
// Each currency is its own account with the same name, so every balance, rate and entry stays in its own currency and nothing is mixed up;
// the accounts share a person name (a.person, or the account name when it was never set) and are shown together as one person.
import { get, commit, uid, stamp } from './core.js';
import { toast } from './ui.js';
import { openCurrencyPicker } from './curpicker.js';

export const personName = (a) => String((a && (a.person || a.name)) || '').trim();
export const personKey = (a) => personName(a).toLowerCase();
// the live accounts of the same kind that belong to the same person (including this one)
export const sameKind = (a) => (b) => !b.deleted && b.type === a.type && !!b.loan === !!a.loan;
export const siblingsOf = (db, a) => db.accounts.filter((b) => sameKind(a)(b) && personKey(b) === personKey(a));
// group a list of rows (each with .key) into people, in the order the first member appears
export function groupPeople(rows, keyOf = (r) => r.key) {
  const by = new Map();
  for (const r of rows) { const k = keyOf(r); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  return [...by.entries()].map(([key, items]) => ({ key, items }));
}
// add another currency for the person who owns account `a`: asks for the currency, then makes a sibling account
export function addCurrencyFor(accountId, { onDone } = {}) {
  const db = get(), a = db.accounts.find((x) => x.id === accountId && !x.deleted); if (!a) return;
  openCurrencyPicker((cur) => {
    const d0 = get(), have = siblingsOf(d0, a).find((b) => b.cur === cur);
    if (have) { toast(have.archived ? `${personName(a)} already has a hidden ${cur} account. Unhide it from Accounts.` : `${personName(a)} already has ${cur}.`); return; }
    const id = uid();
    commit((d) => { d.accounts.push(stamp({ id, name: a.name, person: personName(a), cur, type: a.type, open: 0, include: a.include !== false, archived: false })); });
    toast(`${cur} added for ${personName(a)}.`); if (onDone) onDone(id);
  }, { title: `Add a currency for ${personName(a)}` });
}

// v16.22: make the person's account in another currency without asking again (the caller has already warned the user). Returns the new account id.
// A hidden account of that currency is shown again instead of making a second one.
export function addCurrencyNow(personAcctId, cur) {
  const a = get().accounts.find((x) => x.id === personAcctId && !x.deleted); if (!a) return '';
  const have = siblingsOf(get(), a).find((b) => b.cur === cur);
  if (have) { if (have.archived) commit((d) => { const x = d.accounts.find((y) => y.id === have.id); if (x) { x.archived = false; stamp(x); } }); return have.id; }
  const id = uid();
  commit((d) => { d.accounts.push(stamp({ id, name: a.name, person: personName(a), cur, type: a.type, open: 0, include: a.include !== false, archived: false })); });
  return id;
}
