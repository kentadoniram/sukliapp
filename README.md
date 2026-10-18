# Sukli (working title)

A private money tracker that runs entirely in the browser. Your data stays on your device, with an optional backup to a hidden folder in your own Google Drive. No server, no subscription, no AI service: the category guesser is a small model that learns from your own entries and runs on the phone.

## What's new in v6

- **CSV import accepts newer and older Bluecoins exports.** Columns are matched by meaning (for example "Parent Category" or "(5)Parent Category" for Category Group, "Item or Payee" for Name). Only Type, Date, Amount and Account are required; a missing Currency becomes PHP, a missing group uses the category name, and dates like 10/21/2026 are understood. If a file is still rejected, the message lists the column names found.
- **All currencies** in the entry sheet: USD, USDT, JPY, PHP and your account currencies first, then every other currency. The picker is smaller.
- **Back button** closes the open sheet instead of leaving the screen underneath.
- **Clear button (x)** on text boxes.
- **Entry sheet:** amount, calculator, then a smaller currency picker on the far right; "Usual ⓘ" is a button that explains itself; "When" opens a calendar card with a time box.
- CSV export keeps each currency's own decimals (BTC no longer rounds to 2).

## v5.1

- **Sign in from the first screen.** A new device now shows "Already use Sukli on another device? Sign in to sync" next to the import button, so you no longer have to know the Settings address.
- **No doubled categories.** If you are already signed in, "Start with an empty ledger" first fetches your cloud data and only creates starter categories when there is nothing to fetch.
- **CSV export keeps crypto precision.** Amounts are written with the currency's own decimals (0.000123 BTC stays 0.000123 instead of 0.00).

## What's new in v5

- **Graphs are interactive**: tap or hover any bar or ring slice for its numbers; drag along a line chart (Pace, account balance) to read each day.
- **Accounts**: group by Currency, Category (type) or None; sort High to low, Low to high or A to Z. Tap an account for its balance chart, in/out this month and full history.
- **Net worth**: card at the top of Accounts, with assets, debts, 12-month bars and a breakdown. Houses, cars and investments are accounts of type Asset or Investment; use "Update value" (it is kept out of income and spending).
- **Daily interest**: on an account, set a yearly rate (Edit). One entry a day is added using that day's balance (category Interest, or Crypto earned for crypto accounts). It is an estimate, and each entry can be edited or deleted.
- **Credit cards**: set limit, statement day and due day. Home and Outlook show a banner when payment is near or the limit is 80% used. For phone alerts, use "Add reminders to my calendar (.ics)" on the card's account page; a web page cannot notify you while closed.
- **Outlook** (menu): next-month forecast from your recent months, warnings, tips and a reward budget.
- **Entry sheet**: currency selector inside the amount box, calculator (keypad, or type 120+45*2), category chips that follow every letter typed with "No category fits, add it", and a transfer fee box (transfer / bank service / network fee) predicted from earlier transfers, taken from the sender or the receiver.
- **Appearance** (Settings): colour, light/dark, five text sizes, and hide style (dots or blur). Appearance is stored per device.
- Smaller default text and smaller name suggestions.

## What it does

Open the menu (top left) for every window.

- **Home**: Cash inflow / Cash outflow / Net income (tap any for the detail), spendable now, a few plain observations, pace against last month, where it went, where it came from, last 6 months (tap a month). Every section folds away.
- **Entries**: search and filter (Expense, Income, Transfer). Typing a name suggests recent matches with the account you usually use; the guess is highlighted until you choose.
- **Calendar**: each day colour coded (red outflow, green inflow, blue transfer). Tap a day for its entries, or add one on that date.
- **Budget**: interactive donut by group or category, percentages, expandable rows, budget bars and warnings (close, over, runs out early).
- **Cash flow**: inflow, outflow, net, kept %, net by month (tap a month), biggest inflows and outflows, per-account flow.
- **Reports**: last 12 months (tap a month) and spending grouped by group, category, account or weekday.
- **Categories** (menu): add, rename, regroup, delete, with keywords so new categories are guessed straight away. Separate pages for expense and income.
- **Exchange rates** work both ways: type the rate, or type what the bill says in pesos. Settings also lets you edit 1 JPY = x PHP or 1 PHP = y JPY.
- **Eye button** hides every amount and masks what you type. Remembered on this device only.

## Hosting without the Netlify badge

The corner badge is Netlify's "Powered by Netlify" badge. In the Netlify project go to Project configuration, General, Powered by Netlify badge, and turn it off. No redeploy needed. Or host elsewhere for free (GitHub Pages, Cloudflare Pages): the app is plain files, so any static host works.

## Put it online (free)

1. Unzip this folder.
2. Go to https://app.netlify.com/drop and drag the whole folder onto the page. You get an address like `https://something.netlify.app`.
   (GitHub Pages also works: upload the folder to a repository and turn on Pages.)
3. Open that address on your phone.
   - iPhone: Safari, Share, Add to Home Screen. **Do this before importing**, because the Home Screen app keeps its own separate storage from Safari tabs, as far as I know.
   - Android: browser menu, Install app.

## First run

- Choose **Import my Bluecoins export (CSV)**. Accounts, balances, categories and all entries come across. Importing the same file again skips entries that are already here.
- A sheet then asks you to confirm which accounts count toward "Spendable now". Crypto, loans and people are off by default.

## Sign in on every device (no export or import)

1. Do the Supabase steps below once.
2. Put your Supabase URL and public key into `config.js` before you deploy. Then no device needs anything pasted.
3. On each phone or computer open the app and press **Continue with Google** (needs Google switched on in Supabase, see Settings, Cloud sync, How) or sign in with email. Your entries arrive by themselves.

## Cloud sync with Supabase (free, recommended)

Keeps your phone and your Mac in step. Each entry is one row in a database that only you can read; only changed rows are sent.

1. Create a free project at supabase.com. Open **SQL Editor**, paste the contents of `supabase.sql` (also shown in the app under Settings, Set up Supabase), press Run.
2. **Project Settings, API**: copy the Project URL and the *anon public* key.
3. In the app: Settings, Cloud sync. Paste both, enter your email and a password, press **Create account**. (If Supabase asks for email confirmation, confirm it, or turn off *Confirm email* under Authentication, Providers, Email.)
4. **Import the Bluecoins CSV on one device only**, then sign in on the other devices, which pull everything. Importing separately on two devices would create duplicate entries.

Free projects pause after a week with no use; press Restore in the Supabase dashboard. Entries also live on each device, so nothing is lost while it is paused.

## Google backup (optional)

Settings, then **How to get a client ID** (also written out in the app). In short: create a free Google Cloud project, enable the Drive API, create a Web OAuth client with your Netlify address as the authorised origin, add yourself as a test user, paste the client ID into Settings, tap **Back up now**.
The app asks only for its own hidden folder (`drive.appdata`) and keeps one snapshot per day for 14 days. Both phones sync through the same file and merge by entry.

## Files

- `index.html`, `styles.css`, `sw.js` (offline), `manifest.webmanifest`, `supabase.sql`, `config.js` (your Supabase details)
- `js/core.js` data and maths, `js/importer.js` CSV in and out, `js/predict.js` category guesser, `js/cloud.js` Supabase sync, `js/drive.js` Google backup
- `js/entry.js` add/edit sheet, `js/screens.js` and `js/views.js` screens, `js/insights.js` home analysis, `js/app.js` shell
- `fonts/` Schibsted Grotesk (SIL Open Font License, see `LICENSE-font.txt`)

## Known limits

- Interest is approximate and only posts when the app is opened (it catches up on missed days).
- Appearance, exchange rates and hide style are per device and do not sync.


- Cloud sync and Google backup have only been tested against simulated servers, not the real services. The Supabase setup script was checked with PostgreSQL's own parser for syntax only.
- Google sign-in has only been tested against a simulated Supabase redirect, not real Google. Rates, the "left out" list and display choices do not sync between devices yet.
- Google sign-in has only been tested against a simulated Drive, not real Google. Sign-in tokens are short-lived, so auto-backup may sometimes ask you to tap **Back up now**.
- Receipts are entered by hand for now (split into items on the entry sheet). Photo reading is the next piece.
- Crypto balances are shown as money moved in and out, not market value.
