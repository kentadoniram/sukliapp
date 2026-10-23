# Sukli (working title)

A private money tracker that runs entirely in the browser. Your data stays on your device, with an optional backup to a hidden folder in your own Google Drive. No server, no subscription, no AI service: the category guesser is a small model that learns from your own entries and runs on the phone.

## What's new in v12

- **Opening balance, round 3 (12.45).** If an account's opening date is later than its first transaction, the opening is counted from that first transaction (your saved date is untouched). Bluecoins files that call the group column "Category Type" are now read correctly, and the export reuses the same title. Importing fills a blank opening on existing accounts, and the import message tells you how many accounts have no Starting Balance row in the file.
- **Investments, round 2.** *Performance* card: for every asset, what you paid against what it is worth now (two bars, gain or loss in money and %), with an "I paid…" button for assets bought before Sukli. *Investment income* (Income button): staking rewards, airdrops, dividends, yield or other distributions, with amount, date, asset, and whether it arrived as more of the asset or as cash into an account. *My predictions*: your own price estimates with a date, always labelled "Your estimate" and shown beside the "Actual" price and how far it is. Tap a ticker in *Tickers and prices* for its price history (each update with the % change from the one before) and to update its price.
- **Prices and when they were updated.** Coins with a price feed (the built-in list plus any token you give a CoinGecko id, for example `bitget-token` for BGB) refresh on their own when you are online (every 12 hours, on opening the app); the time of the last update is shown on top of Investments and next to each ticker, and a daily history is kept. Shares have no free live feed, so enter the price now and then (or trade): each entry is dated and kept so you can see how it moved.
- **Platforms stand out:** platform names are bold, and the platform field offers tap-to-fill chips: the ones you already use first, then popular exchanges and brokers.
- **Layout fixes:** the Investments "Market value" box was missing its layout (it looked cramped); fixed and made larger. Accounts: the Group and Sort controls are now two small dropdowns.
- **Your own tickers (stocks, ETFs, funds, bonds, tokens).** Investments > Add > "Add an asset": asset type (Cryptocurrency, Stocks, ETFs, Funds, Bonds, Other), platform or broker (Binance, Bybit, Bitget, Moomoo, SBI, Kiwoom… or type your own), ticker (BNB, BGB, NVDA, 7203 for Tokyo, 005930 for Korea), name, market (NASDAQ, NYSE, TSE, KRX, PSE, HKEX, Other), price currency and optional price. Each asset is its own balance, kept apart from PHP, JPY or USDT. A ticker with a manual price is valued as price × the price currency's rate; a buy or sell updates its price to the trade price; "Tickers and prices" lists them with a Change button.
- **Buy by paying or converting:** the holding row reads like "0.5 BNB · paid 370 USDT · price ₱46,620", with the home-currency value on the right and the cost, gain or loss underneath. What you paid is remembered in the currency you used (USDT, PHP, JPY…), also after partial sales. Fees are saved as a financial loss.
- **Group Investments by platform or by asset type** (one tap).
- **Bordered cards and Assets / Liabilities.** Every group is a bordered card, and groups inside a group are nested cards. Accounts now opens as two big cards, **Assets** (green: cash and bank, investments and crypto, property and other assets) and **Liabilities** (red: credit cards, loans and money owed, other debts), each with its total. The other groupings (Currency, Category, Exchange) are still one tap away.
- **Investments tab** (menu, and you can put it in the bottom bar): crypto grouped by exchange, every coin its own balance with its own market value (price in your home currency, share of the exchange), "+ Add a coin to <exchange>", plus investments and other products such as MP2. Tick "show in Investments" on any account to include it.
- **Buy / sell / convert** (`js/trades.js`, `js/tradecalc.js`): recorded between your cash account and the holding, marked as a trade (not ordinary spending or a plain transfer). Fees are saved as a financial loss; realized gains and losses use average cost (units you held before Sukli have no known cost, so they never inflate a gain). The holding page lists its trades.
- **Loan payments split into interest and principal** on the loan's account page (estimate from the rate: each payment first covers that month's interest), with total paid, what is still owed and about how many payments are left. Estimated loan interest also appears in "Money lost to fees and interest".
- **Bluecoins export now matches the import field by field:** all 2,779 rows of your CSV come back identical (accounts that Bluecoins had in two currencies get their original name back, starting-balance rows keep their date and category, each half of a transfer keeps its own exchange rate, coin amounts keep their decimals). Test: `node tests/export-compat-test.mjs your.csv`.
- **Loans (rough first version).** *Loan planner* (menu, and Accounts page): amount, rate, length, upfront fees, late fee. Shows monthly payment, total interest, total repaid, what you actually receive after fees, the real cost, and warnings (home/car interest, heavy cost, late-payment consequences). *Record this loan* asks you to confirm the fees, creates a loan account, moves the money to your account, and saves the fees as a financial loss. Loan account pages show the plan, next due date and an overdue warning, and **Add charge** (interest charge, late fee, penalty, annual fee). Debts no longer have an interest field and never earn interest. Home has a new card, *Money lost to fees and interest* (last 12 months by kind, plus tax taken from interest).
- **Smart labels:** typing "Loan Payment" or "Credit Card Payment" offers to record it as a transfer to the loan or card; "Credit to cash" and "Loan" offer the loan planner. Nothing switches by itself.
- **Tax-linked interest:** tap an interest entry to see gross, tax and credited; changing the account's tax rate (there or in the account form) recalculates all its interest entries. **Credit limit history** is kept when a card's limit changes. Accounts can be grouped as **Assets / debts**.
- Account pages now update straight away after you edit the account (before, the open page stayed stale).
- **Spending vs expected income** (new Home card, arrangeable in Settings): a ring of your expected monthly income filled by what you spent, split by group, with the % spent, income came in, spent and left. Expected income = the middle of your last 3 months with income (never less than what already came in), or the amount you set with "Set my own". Pies are larger with smaller side text.
- **Trip labels:** a transport entry saved without From/To is named "Bus Commute" / "Train Commute"; with both stops, "Bus: One Ayala - San Pedro". Trip chains follow the order you entered them, not the clock time, so catching up at night still gives the right starting point.
- **Home cards and tabs are yours to arrange** (Settings, Tabs and Home cards): reorder or hide every Home card, and choose up to 4 bottom tabs from Home, Entries, Calendar, Accounts, Budget, Cash flow, Outlook and Analytics (the + button stays in the middle). Heavy cards now draw a moment after the top of Home so it appears at once.
- **Back returns to where you were** (including after opening Next month outlook): each screen remembers its scroll position (`js/app.js`).
- **Where it went** can be bars or a pie (choice remembered on the device): percentages on the right, tap a slice or a name for the detail. **Daily average** now has a 30-day bar graph of daily spending under it.
- **Typing bus, MRT, jeep, taxi, Grab, train, ferry...** in the label counts as transport: the transport category is chosen and From / To appears. Blank label becomes "From - To", or your usual trip for that hour.
- **Select entries** in Entries to delete several at once (recycle bin, with Undo). Transfers are now purple. Calendar shows month totals, heat shading, busiest day, no-spend days and spending by week.
- **Interest tax:** each account has "% tax on interest" (banks default to 20%); interest is credited after tax, with the gross and tax kept in the entry note. Applies to interest added from now on.
- **Account page "+"** (bottom right): Expense, Income or Transfer with the account and the usual other account filled in; a swap button in the transfer form flips From and To.
- **Receipts: tax, discounts, 支払合計.** 支払合計 (total payment) is now the main total when it can be read; other readings only confirm it. If the total found equals the subtotal while a 外税 line sits on top, the amount paid is subtotal + tax. A discount line (引, 割引, シール割引) is attached to the item above it, so each item shows its final price; a store-wide discount is spread over the items. Tax printed on top (or implied by the total) is shared by rate (軽 = 8%, else 10%) so the item prices add up exactly to what you paid. A small line explains: items, minus discounts, plus tax, equals paid.
- **Receipts: a category for each item** (`js/itemcat.js`). Order: what you chose before for that item, a Japanese and English word list matched to categories you already have (nothing is created), otherwise it follows the receipt's category. Each item has its own category menu; corrections are remembered; the receipt's category becomes the biggest by amount.
- **Trips** (`js/route.js`). "San Pedro - Ayala One" and "Ayala One - San Pedro" are now a **return trip**: linked (same stops, same usual mode and fare) but never "the same", and trips are never asked Same/Different. "One Ayala" and "Ayala One" are the same stop.
- **Optional From / To** appears only when the category is public transport. It fills the name ("From - To"), and suggests trips by hour of day: your **home stop** (Settings, Name matching, or worked out from the first and last trip of each day) is where you leave in the morning and return to in the evening, the stop where your last trip today ended is where you are now, and typing a From lists likely destinations with the usual mode. The "Usual" quick picks drop the impossible direction.
- **Blank labels are filled in.** A transfer left unnamed is saved as "From - To" (the two account names; the name box shows it as a hint). An expense or income left unnamed gets the label you most often use for that category, amount, account and hour (else the category name) and goes to Review, where it says the label was guessed. On Android the entry sheet follows the visible area, so Save stays above the keyboard (`interactive-widget=resizes-content` plus a visualViewport fallback).
- **Version line** at the bottom of Settings (`js/version.js`): major.change.base.MMDD, edited by hand in that one file.
- **Long receipts.** The paper is now found even when it fills only a small part of the photo (before, the table was read too and the cash handed over could be taken as the total). A tall receipt is read in overlapping parts. `¥` misread as y, Y or v, and `外8%` misread as `外89%`, are tolerated. A price that is unreadable in both readings is worked out from the subtotal when only one is missing (flagged, low confidence). For very long receipts take 2 or 3 closer photos from the top down and choose them together, or use "Add the next part" after the first photo; the lines read twice in the overlap are dropped.
- **Daily average is now a rolling 7-day average:** spending over the last 7 consecutive calendar days (days with nothing count as 0) divided by 7, moving forward every day. (Before: month so far divided by the day of the month.) A new card on Home, "Daily average, rolling 7 days", shows the last 12 months of that figure, your typical day (median), usual range, busiest/quietest week, a rising/steady/falling trend (last 3 months against the rest), and a month-by-month list.

## What's new in v11

- **Comparing two names, rebuilt.** The card now shows what Sukli knows about each name (times used, usual category, typical amount, last used), why it thinks they look alike (spelling %, shared words) and three answers with their consequences: **Same** (one thing, guesses are shared), **Related** (same family but its own category, for example coffee beans and coffee matcha; pick *A little / Somewhat / Nearly the same*, stored as 30 / 60 / 85%), **Different** (never compared again). Related pairs never copy a category; they appear as a quiet hint when you type one of the names, in Settings with their closeness, and as dashed links in the Name map.
- **Receipts, tuned on your four photos** (LIFE and three cisca): sideways photos are turned upright by a small trial read; two readings are merged by arithmetic (items, tax and total must add up); digit look-alikes (O/0, l/1) and trailing junk are cleaned; shops are remembered by phone number or invoice number (T + 13 digits), so the next receipt from the same shop is recognised even if the name is misread. Item names that cannot be read show as "(unclear, type the name)" instead of wrong text.

## What's new in v9 (name graph, receipt scanner)

- **Name similarity graph.** Names you have used are nodes; a link between two names has a strength from 0 to 100%: *you said same* (100%), *same chain* (95%), or *similar spelling and shared words* (below 90%). "Different" removes a link for good. A new name is attached to the graph and the strongest path to a known name is found (least-cost path, cost = -ln strength, Dijkstra), so a match through two links is weaker than a direct one. The entry sheet shows "Matched through: …" with the percentages, and Settings, Name matching, **Name map** draws the neighbourhood of any name, lets you try a name and shows the path.
- **Better name matching** (kana/width/branch/receipt-code clean-up, typo matching) and **faster learning from corrections**: a category you change by hand counts three times in the model.
- **Receipt scanner** (Menu, Scan a receipt): take or choose a photo; Japanese and English text is read on the device (Tesseract, bundled in `vendor/ocr`, about 9 MB, works offline, nothing uploaded). It finds the shop, date and time, total and item lines (quantity lines, discounts, 軽 marks, tax on top or included), matches the shop to a name in your history, guesses the category, and shows a confidence for each field. A cross-check tells you whether the items add up to the total. You correct anything, then **Continue to entry** to pick the account and save. Or paste receipt text instead of a photo.
  - Limits: confidence is a guide, not a probability; small, blurry or crumpled thermal prints lose digits (the 軽 mark is often read as 8; this is repaired only when it makes the receipt add up); Japanese item names are the least reliable part.

## What's new in v10

- **Receipt reading, rebuilt around real photos** (tested on three cisca receipts): the photo is cropped to the paper, the table texture and shadows are removed, the reader uses a one-block layout, and it takes two looks (sharp black-and-white and soft grey) and keeps the more consistent one. The parser now finds the total by agreement (a "合計" line, the payment line, or taxable amount plus tax), ignores IC-card balances, card numbers, phone numbers and register codes, reads dates even when 年/月/日 are misread, finds the shop name above the address, and keeps one correct line instead of several wrong items.
- **Settings are grouped:** Look and feel, Money and alerts, Accounts/categories/names, Backup and data, Advanced (folded), Help.
- **Name matching has a middle answer:** Same thing, Related (same family, its own category), Different.

## What's new in v8 (statistics)

- **Name matching helper:** when you type a new name that looks like one you already use ("tennis socks" vs "tennis", "mang inasal antipolo" vs "mang inasal tagaytay"), a small card asks Same or Different and remembers your answer. Settings, Name matching lists what you linked or kept apart (undo any), and has "Review similar names" for the whole history.

- **New account type inside the New account form** (last choice in the Type list): name it, say whether you owe it, and it is selected right away.
- **Merchant matching:** "STARBUCKS TOKYO", "スターバックス" and "Starbucks 渋谷" count as one place (known chains in English and Japanese; other names lose branch words, place names and digits).
- **Regular payments found** (Outlook): subscriptions and bills found from timing and amount. Same-day entries from one merchant count once; weekly habits are not called subscriptions.
- **Correlations:** which weekly habits move together, shown only when the link is strong across 26 weeks. Worded as a pattern, never a cause.

- **Robust forecast:** next month is predicted by whichever simple method (median/average of recent months, weighted recent, trend, same month last year) would have predicted your own past months best. Months with no spending are kept. Outlook shows the method and a rough error range once there are enough test months.
- **Repeats every month** now adds up same-name entries per month and needs a steady amount.
- **Habit insights:** a gap in something you do almost every week is mentioned only when the last 7 days are far outside your own range, and never when you logged very little overall (travel, not logging). Also weekday vs weekend, week after payday vs before, and category trends with a confidence level. These are patterns, not causes.

## What's new in v7

- Merged build: your v7 changes plus these from the earlier build: inverse price line and a Trading-fee hint on crypto trades, "Crypto · exchange" groups in the account lists, a token you gave your own decimals (like MNT as Mantle) never takes the bank rate of the same code, and one clear (x) button instead of two.

- **Searchable account list** in the entry sheet: search by name, type or currency, filter by currency, and picking an account in another currency switches the currency for you.
- **Calculator inside the amount field**; the currency button stays at the far right.
- **Exchange rate on one row** (1 USD = rate = value in your home currency).
- **Analytics, Last month** fixed: it ended on the 31st for every month, giving an invalid date such as 2026-09-31; it now uses the real last day.
- **Save button always on screen** in the entry sheet and the account form (it stays pinned at the bottom while the form scrolls).
- **Account types you can edit and add:** Settings, Account types. Rename any type; add your own (an asset or a liability); delete custom types that no account uses. They appear in the account form's Type list and in the Accounts page.
- **Added back from the earlier build:** your own coins and tokens (unknown currencies in a CSV, or typed in the currency search, get up to 8 decimals; set decimals per coin in Settings), accounts grouped by Exchange, Trade wording and auto-conversion between two crypto accounts (Trading fee category), thousands separators while typing (switch in Appearance), a clear (x) button on text boxes, and Rename or merge a category group.
- **Currency button opens the searchable list straight away** (search box, quick list, then Others A to Z). It narrows as you type, by code, name or country.
- **Backup reminder:** Settings, Backup reminder. Choose daily or weekly and a time; when the app is open after that time a card offers a one-tap download.
- **Currency search by country:** every currency list is searchable by code, currency name or country ("japan", "thai", "peso"), with flags. The account form now uses the same searchable picker instead of a long list.
- **Analytics:** new Category filter on top of the account, currency and group filters.

## What's new in v6
- Bluecoins import accepts any column order, `,` `;` or tab, and a missing Category Group column. If a file still fails, the message lists the columns it found.
- Currency: every ISO currency plus common crypto. The selector sits at the right of the amount (after the calculator) with your favourites and "More…". Settings: change your home currency; saved entries keep their own rate. Live rates (free, about daily) with manual override.
- Entry sheet: calendar date picker, Usual / Recent / "Fits amount" quick picks, accounts grouped by type, transfer label first with usual routes, optional currency conversion (off by default), spending-safety warnings.
- Accounts by type or currency, collapsible; account history with In / Out / Transfers filters and date ranges, opening and closing balance.
- Credit cards: statement and due day, amount due per cycle, Pay card button (a transfer, so no double spending), reminders from 3 days before until midnight on the due day, stopping when paid. A web app cannot push notifications when closed: use the in-app banner and the .ics calendar reminders.
- Analytics replaces Reports: income vs spending, cash flow, net worth, breakdowns, budgets and limit, cards, period comparison. Tap any bar, tile or row to see its entries.
- Recycle bin (Menu): restore or delete forever; kept 30 days by default (Settings in the bin page).
- Back button closes pop-ups first. Clear "×" on fields. Swipe from the left edge, or scroll up a little, to open the menu.

## What was new in v5

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

## What's new (12.38, 22 Oct)
- Import never changes an existing account's type; new accounts are listed first, similar names can be merged.
- Assets/Liabilities grouping follows the account type, not the balance sign.
- Shared searchable pick list (search after 5 options, "Add new" under search, grouped).
- Trade is platform-first; fees can be % or fixed, in any currency; units × price = total both ways.
- Investments "+ Entry": Trade, Transfer, Expense, Income (same on the account page and per platform).
- Income combines investment types and your normal income categories; "Cash into an account" lists the platform's accounts first.
- Manual price updates are each kept; the automatic price keeps one record per day.
- History filters highlighted; header wraps on small phones; pie percentages drawn inside slices.

## What's new (12.43, 23 Oct)
- Entries: filter chips are equal width with centred text, the account filter has its own line; the Account page filters and 30 days / 90 days / 1 year / All sit on one compact row each.
- Every entry has a small line saying what it did ("Expense recorded", "Trade, not counted as spending · fee … recorded as an expense").
- A trade's fee is saved on the trade (like a transfer fee), so balances include it and Entries shows one grouped row. Older separate fee entries are folded into their trade on screen. Fees use the category Fees > Trading fee, not "Financial loss".
- Investments has a "Fees and losses" card (trading fees, realized losses); "By group" view (stable vs volatile); grouped income kinds with "Add a new kind".
- Loans with upfront deductions are one entry: borrowed amount, fees deducted, amount received.
- Platform field on accounts is a pick list; platform names ignore capital letters ("binance" = "Binance").
- Fixed: a hide-amounts (blur) error that appeared when a list was redrawn.

## What's new (12.44, 23 Oct)
- Opening balances keep their date (read from the Bluecoins "Starting Balance" row): shown on the account page, counted in balances and charts only from that day, and writable back on export.
- Input history (Entries tab > "Input history"): entries listed by when you typed them in, "Odd dates" filter for a wrong year, put back the earlier version of an edited entry, restore deleted ones.
- Transfer form: usual routes are one small scrolling line; the swap button lines up with the account buttons.
- Opening or closing a card no longer redraws the whole screen, so pie charts beside it don't flicker.
- Budget setup (Budget tab): tick categories on or off, monthly amount each, mark Need / Want / Luxury (guessed from names), choose the warning percentage (default 80). Alerts on Home and the Budget tab, plus a message when an entry crosses the line. Needs get a gentler message.

## How to check the app
Run `./run-all-tests.sh` (optionally with the path to your Bluecoins CSV). It starts a local server, runs all tests and prints one SUMMARY line.
