// Beginner help for a few pages: a small "?" in the header opens a short, plain explanation (what the page is, how to use it, one tip).
import { ACT, sheet, esc } from './ui.js';

export const HELP = {
  home: ['Home', 'Your month at a glance.', ['The top numbers show what came in and what went out this month.', 'Use the arrows at the top to look at other months.', 'Tap the round + to add something you spent or earned.'], 'Add an entry every day, even a small one. A word and a number are enough.'],
  ledger: ['Entries', 'Everything you have recorded, newest first.', ['Tap an entry to change or delete it.', 'Use search to find a shop, a note or an amount.', 'Transfers, debts and lending are shown too, but they are never counted as spending.'], 'Deleted something by mistake? Open Undo in the menu, or the Recycle bin.'],
  calendar: ['Calendar', 'See your money day by day.', ['Each day shows what you spent or earned.', 'Tap a day to see its entries.', 'Use the arrows to move to another month.'], 'Look for the busiest days to see where money goes.'],
  budget: ['Budget', 'A plan for how much to spend on each kind of thing.', ['Set a limit for a category, for example Food.', 'The bar shows how much of the limit you have used.', 'Alerts never shame needs like rent.'], 'Start with two or three categories. You can add more later.'],
  accounts: ['Accounts', 'Where your money sits: cash, bank, e-wallet, card.', ['Each account has a balance. Entries change it.', 'Tap an account to see its history.', 'Net worth is what you own minus what you owe.'], 'If a balance looks wrong, open the account and check the opening balance.'],
  debts: ['Debts', 'Cards and loans you owe, with a plan for paying them.', ['Sukli puts the debt that is due first on top.', 'The plan leaves money for daily living, so it never asks for all your income.', 'Record a payment with + then Debt then “I paid a debt”.'], 'Paying more than the minimum on the highest interest saves the most.'],
  owed: ['Owed to you', 'Money other people owe you.', ['Record lending with + then Lent then “I lent money”.', 'When they pay, use “They paid me back”. It is not income.', 'Lent money is not counted as spending.'], 'Tap Change on a person to set the date you expect it back. It is only a reminder for you.'],
};
const key = () => (location.hash.replace(/^#\/?/, '').split(/[?/]/)[0] || 'home');
export const helpBtn = () => (HELP[key()] ? `<button type="button" class="iconbtn helpbtn" data-act="tab-help" aria-label="Help for this page">?</button>` : '');
ACT['tab-help'] = () => {
  const h = HELP[key()]; if (!h) return;
  sheet(`<p><b>${esc(h[1])}</b></p><ul class="helplist">${h[2].map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="hint"><b>Tip:</b> ${esc(h[3])}</p><div class="btnrow left"><button type="button" class="linkbtn" data-act="glossary">Words explained</button></div>`, { title: h[0] + ': help' });
};
