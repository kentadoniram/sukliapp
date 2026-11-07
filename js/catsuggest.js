// Suggested groups and categories. Nothing here is added until you tick it and tap Add.
import { get, commit, findOrAddCategory, groupColor } from './core.js';
import { esc, sheet, toast } from './ui.js';
import { catIcon, iconSvg } from './caticons.js';
import { gsvg, guessGroupG } from './pictures.js';

export const SUGGESTED = {
  expense: {
    'Food & Drinks': ['Groceries', 'Dining Out', 'Coffee & Tea', 'Snacks', 'Breakfast', 'Lunch', 'Dinner', 'Convenience Store', 'Bakery', 'Sweets & Desserts', 'Alcohol', 'Food Delivery', 'Fruits & Vegetables', 'Bento'],
    Transportation: ['Bus', 'Train', 'IC Card Top-Up', 'Taxi', 'Ride-Hailing', 'Fuel', 'Parking', 'Toll', 'Bicycle', 'Car Maintenance', 'Car Wash', 'Shinkansen'],
    Household: ['Supplies', 'Laundry', 'Rent', 'Furniture', 'Appliances', 'Cleaning', 'Repairs', 'Kitchenware', 'Garden & Plants', 'Moving', 'Deposit'],
    Utilities: ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Waste'],
    'Personal Care': ['Clothing', 'Shoes', 'Toiletries', 'Haircut', 'Skincare', 'Cosmetics', 'Accessories', 'Dry Cleaning', 'Massage & Spa'],
    Health: ['Doctor', 'Dental', 'Pharmacy', 'Vitamins', 'Eye Care', 'Hospital', 'Check-Up', 'Gym', 'Sports'],
    Entertainment: ['Going Out', 'Movies', 'Games', 'Concerts & Events', 'Karaoke', 'Hobbies', 'Books & Manga', 'Music', 'Sports Events', 'Onsen & Leisure'],
    'Social & Gifts': ['Gifts', 'Treat for Friends', 'Parties', 'Weddings', 'Donations', 'Condolence', 'Souvenirs'],
    Travel: ['Trips', 'Hiking', 'Flights', 'Hotels', 'Tours', 'Travel Insurance', 'Visa & Fees', 'Luggage'],
    Education: ['Tuition', 'Courses', 'Japanese Lessons', 'Exams', 'School Supplies', 'Books'],
    'Family Support': ['Allowance', 'Remittance', 'Parents', 'Siblings', 'School Fees', 'Medical for Family'],
    Kids: ['Diapers', 'Toys', 'Childcare', 'Baby Food', 'Kids Clothing'],
    Pets: ['Pet Food', 'Vet', 'Pet Supplies', 'Grooming'],
    Subscriptions: ['Streaming', 'Music', 'Software', 'Cloud Storage', 'Memberships', 'News & Magazines'],
    Technology: ['Gadgets', 'Apps', 'Accessories', 'Device Repairs'],
    'Work & Business': ['Equipment', 'Software Tools', 'Office Supplies', 'Work Meals', 'Training', 'Business Travel'],
    'Finance & Fees': ['Bank Fees', 'Card Annual Fee', 'ATM Fees', 'Remittance Fees', 'Currency Exchange Fees', 'Interest Paid', 'Late Fees', 'Loan Payment'],
    Insurance: ['Life Insurance', 'Health Insurance', 'Car Insurance', 'Home Insurance'],
    Taxes: ['Income Tax', 'Resident Tax', 'Pension', 'National Health Insurance'],
    Others: ['Uncategorized', 'Miscellaneous', 'Lost or Stolen']
  },
  income: {
    Employment: ['Salary', 'Bonus', '13th Month', 'Overtime', 'Allowance', 'Commission', 'Reimbursement'],
    'Freelance & Business': ['Freelance', 'Side Gig', 'Consulting', 'Business Sales'],
    Investments: ['Dividends', 'Interest', 'Capital Gains', 'Rental Income', 'Crypto Earned'],
    Earn: ['Interest', 'Crypto Earned', 'Staking', 'Airdrops'],
    'Gifts & Support': ['Gifts Received', 'Allowance Received', 'Family Support Received'],
    'Refunds & Cashback': ['Refunds', 'Cashback', 'Rebates', 'Tax Refund', 'Reimbursed Expenses'],
    Government: ['Benefits', 'Pension Received', 'Subsidy'],
    Sales: ['Selling Items', 'Resale'],
    Rewards: ['Prizes', 'Points Cashed Out'],
    Others: ['Other Income']
  }
};
// groups offered as one-tap choices in the category form, even before they have any category
export const suggestedGroups = (kind) => Object.keys(SUGGESTED[kind === 'income' ? 'income' : 'expense']);

export function openSuggestions(kind0 = 'expense') {
  let kind = kind0 === 'income' ? 'income' : 'expense';
  const picked = new Set();   // "Group|Name"
  const s = sheet('<div id="sug"></div>', { title: 'Suggested Categories', wide: true }), root = s.el.querySelector('#sug');
  const have = () => new Set(get().categories.filter((c) => !c.deleted && (c.kind === kind || c.kind === 'both')).map((c) => `${c.group.toLowerCase()}|${c.name.toLowerCase()}`));
  const draw = () => { const h = have();
    root.innerHTML = `<p class="hint">Tick what you want and tap Add. Categories you already have are marked. You can rename, move or delete any of them later.</p>
      <div class="seg two" role="group">${[['expense', 'Expense'], ['income', 'Income']].map(([v, l]) => `<button type="button" data-k="${v}" class="${kind === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${Object.entries(SUGGESTED[kind]).map(([g, names]) => { const free = names.filter((n) => !h.has(`${g.toLowerCase()}|${n.toLowerCase()}`));
        return `<details class="sugg-g" ${free.length ? 'open' : ''}><summary><i class="badge sm" style="background:${groupColor(g)}">${gsvg(guessGroupG(g))}</i> <b>${esc(g)}</b> <small class="muted">${free.length ? `${free.length} new` : 'all added'}</small></summary>
          <div class="sugg-list">${free.length > 1 ? `<button type="button" class="linkbtn sm" data-all="${esc(g)}">Tick all</button>` : ''}${names.map((n) => { const has = h.has(`${g.toLowerCase()}|${n.toLowerCase()}`), key = `${g}|${n}`;
            return `<label class="check sugg-i ${has ? 'have' : ''}"><input type="checkbox" data-k2="${esc(key)}" ${has ? 'checked disabled' : ''} ${picked.has(key) ? 'checked' : ''}> <span class="sugg-ic">${catIcon({ name: n, group: g })}</span> ${esc(n)}${has ? ' <small class="muted">✓</small>' : ''}</label>`; }).join('')}</div></details>`; }).join('')}
      <div class="btnrow"><button type="button" class="btn" data-add ${picked.size ? '' : 'disabled'}>Add ${picked.size || ''} Selected</button></div>`; };
  draw();
  root.addEventListener('change', (e) => { const k = e.target.dataset.k2; if (!k) return; if (e.target.checked) picked.add(k); else picked.delete(k); const b = root.querySelector('[data-add]'); b.disabled = !picked.size; b.textContent = `Add ${picked.size || ''} Selected`; });
  root.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) { kind = b.dataset.k; picked.clear(); draw(); return; }
    if (b.dataset.all) { const h = have(); for (const n of SUGGESTED[kind][b.dataset.all]) if (!h.has(`${b.dataset.all.toLowerCase()}|${n.toLowerCase()}`)) picked.add(`${b.dataset.all}|${n}`); draw(); return; }
    if (b.hasAttribute('data-add') && picked.size) { const items = [...picked].map((k) => k.split('|')); commit((d) => { for (const [g, n] of items) findOrAddCategory(d, g, n, kind); }); toast(`Added ${items.length} ${items.length === 1 ? 'category' : 'categories'}.`); s.close(); } });
}
