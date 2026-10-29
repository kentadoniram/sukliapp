// A short glossary for beginners: words used in Sukli, plus the Japanese words on receipts (kanji, romaji, English).
import { ACT, sheet, esc } from './ui.js';

export const GLOSSARY = [
  // money basics
  ['Money basics', 'Account', 'A place where money sits: cash, a bank, an e-wallet, a card or a loan. Every entry belongs to an account.'],
  ['Money basics', 'Expense / Income', 'Money going out (spending) or coming in (salary, interest). Both change the balance of one account.'],
  ['Money basics', 'Transfer', 'Moving your own money from one account to another. It is not spending or income, so it never counts twice.'],
  ['Money basics', 'Opening balance', 'What the account held on the day you started tracking it. Sukli adds your entries on top of it.'],
  ['Money basics', 'Home currency', 'The currency Sukli adds everything up in (for example PHP). Other currencies are converted at an exchange rate.'],
  ['Money basics', 'Exchange rate', 'How much one unit of a currency is worth in another. Sukli keeps the rate you used on each entry.'],
  ['Debts', 'Minimum payment', 'The smallest amount the lender wants each month. Paying less counts as late and adds fees.'],
  ['Debts', 'Highest interest first', 'Pay every minimum, then put all extra money on the debt with the highest interest. It costs the least in total. Also called the avalanche way.'],
  ['Debts', 'Smallest debt first', 'Pay every minimum, then put all extra money on the smallest debt. You finish one sooner, which keeps many people going. It can cost a little more interest. Also called the snowball way.'],
  ['Debts', 'Add-on interest', 'A fixed charge worked out on the original amount you borrowed, not on what is left. Paying early may save little or nothing.'],
  ['Debts', 'Interest a year and a month', '3% a month is about 36% a year (about 42.6% if it compounds). Always compare debts in the same unit.'],
  ['Money basics', 'Simple and Advanced', 'Simple shows just the basics. Advanced shows everything (interest, loans, investments, tags, exports). Switching in Settings never deletes anything you entered.'],
  ['Money basics', 'Merchant', 'Where you bought something (Shopee, Lazada, wet market, mall). The category says what it was, so a Shopee order can be Food or Clothing.'],
  ['Money basics', 'Net worth', 'Everything you own minus everything you owe.'],
  ['Money basics', 'Category group', 'A heading that holds several categories, such as Food holding Groceries and Eating out.'],
  ['Money basics', 'Tag / event', 'A free label on an entry, such as “Okinawa trip”, to see everything about one trip or occasion together.'],
  // cards
  ['Credit cards', 'Statement date', 'The day the card company closes the month and adds up your charges.'],
  ['Credit cards', 'Billing period', 'From the day after one statement date up to the next statement date. Charges in it appear on one statement.'],
  ['Credit cards', 'Due date', 'The last day to pay that statement without a late fee.'],
  ['Credit cards', 'Posted date', 'The day the bank records a charge. A purchase on the statement date may be posted the next day and then belongs to the next statement. Sukli lets you set it (optional).'],
  ['Credit cards', 'Credit limit', 'The most the card lets you owe at one time.'],
  // interest and savings
  ['Interest and savings', 'Interest rate (% a year)', 'What the account pays in a year, as a percent of the balance. Sukli adds a small amount every day.'],
  ['Interest and savings', 'Tax on interest', 'Banks in some countries keep part of the interest (often 20%) before crediting it. You only receive the rest.'],
  ['Interest and savings', 'Compounding', 'When interest is added to the balance and starts earning interest itself: daily, monthly and so on.'],
  ['Interest and savings', 'Promotional rate', 'A higher rate for a limited time or for money deposited in a certain period, often with a lock.'],
  ['Interest and savings', 'Locked money', 'Money you cannot take out until a date or a number of days after the deposit.'],
  // investments
  ['Investments', 'Platform', 'The exchange, broker or app that holds your coins or shares (for example Binance or Moomoo).'],
  ['Investments', 'Wallet', 'A section inside a platform: Spot, Earn, Margin, Futures.'],
  ['Investments', 'Spot', 'Plain buying and selling of coins. Spot balances do not earn interest on most platforms.'],
  ['Investments', 'Earn', 'The part of an exchange where coins are lent or staked to earn interest. Move a coin here to earn.'],
  ['Investments', 'Margin / Futures', 'Trading with borrowed money or on price bets. Gains and losses can be larger than what you put in.'],
  ['Investments', 'Stablecoin', 'A coin meant to stay at one price, such as USDT or USDC (about 1 US dollar).'],
  ['Investments', 'APY', 'Yearly return including interest on interest.'],
  ['Investments', 'Market value', 'What everything you hold is worth today at current prices.'],
  ['Investments', 'Cost basis', 'What you paid for what you still hold, including fees. Gain or loss is value minus cost.'],
  ['Investments', 'Realized / unrealized gain', 'Realized: profit or loss you locked in by selling. Unrealized: on paper, from what you still hold.'],
  // receipts
  ['Japanese receipts', '合計 (gōkei) · Total', 'The amount you pay.'],
  ['Japanese receipts', '小計 (shōkei) · Subtotal', 'The sum of items before tax or discounts at the bottom.'],
  ['Japanese receipts', '税込 (zeikomi) · Tax included', 'The price already contains tax.'],
  ['Japanese receipts', '税抜 (zeinuki) · Before tax', 'The price does not yet contain tax.'],
  ['Japanese receipts', '消費税 (shōhizei) · Consumption tax', 'Japan’s sales tax: 8% for most food, 10% otherwise.'],
  ['Japanese receipts', '軽減税率 (keigen zeiritsu) · Reduced tax rate', 'The 8% rate, marked with * or ※ on receipts.'],
  ['Japanese receipts', '領収書 (ryōshūsho) · Receipt', 'A formal receipt, often handwritten on request.'],
  ['Japanese receipts', 'お釣り (otsuri) · Change', 'The money you get back after paying.'],
  ['Japanese receipts', '割引 (waribiki) · Discount', 'An amount taken off, shown with a minus sign.'],
  ['Japanese receipts', 'ポイント (pointo) · Points', 'Store points used or earned.'],
  ['Japanese receipts', 'レジ袋 (rejibukuro) · Plastic bag', 'A small paid bag, usually 2 to 5 yen.'],
];

ACT.glossary = () => {
  const s = sheet(`<label class="field"><span>Search</span><input id="gl-q" type="search" placeholder="Type a word, for example statement" autocomplete="off"></label><div id="gl-list"></div><div class="btnrow"><button type="button" class="btn" data-x>Close</button></div>`, { title: 'Glossary', wide: true });
  const list = s.el.querySelector('#gl-list'), q = s.el.querySelector('#gl-q');
  const draw = () => {
    const t = q.value.trim().toLowerCase(), rows = GLOSSARY.filter(([, w, d]) => !t || (w + ' ' + d).toLowerCase().includes(t));
    const groups = [...new Set(rows.map((r) => r[0]))];
    list.innerHTML = groups.length ? groups.map((g) => `<h3>${esc(g)}</h3><dl class="gloss">${rows.filter((r) => r[0] === g).map(([, w, d]) => `<dt>${esc(w)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`).join('') : '<p class="empty">No word like that yet.</p>';
  };
  q.addEventListener('input', draw); draw(); s.el.querySelector('[data-x]').onclick = () => s.close();
};
