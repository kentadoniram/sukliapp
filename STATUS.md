# Sukli prototype: status and decisions (updated 2026-10-18, after v5.1)

## What exists
Local-first PWA (plain HTML/CSS/JS, no build step, no server of our own). Data in IndexedDB as one JSON database; every record has id + updatedAt so devices can merge.

Sync, two options (both optional):
- **Supabase (recommended).** Free project, plain fetch to the REST API. One row per record in `records(user_id, coll, id, data jsonb, updated_at, synced_at)`, row-level security, trigger stamps server time and ignores older writes. Setup script `supabase.sql`. Sign-in: email + password, and Google through Supabase's OAuth redirect. `config.js` can hold the project URL and public key.
- Google Drive backup into the hidden appDataFolder, daily snapshot kept 14 days.

## v5.1 (2026-10-18)
- First-run screen has "Already use Sukli on another device? Sign in to sync" (it opens Settings, where Google / email sign-in lives).
- "Start with an empty ledger" while signed in fetches cloud data first and only seeds starter categories if the ledger is still empty (avoids duplicate categories).
- CSV export writes each amount with its currency's decimals (at least 2): BTC keeps 6 places, unknown currencies keep up to 8. Round-trip tested with BTC, JPY and an unlisted coin.
- Service worker cache renamed `sukli-v5.1`. Removed a dead line in net worth.

## v5 (2026-10-18)
- Graphs interactive: tooltips on bars and donut slices, scrub cursor on line charts (Pace, account balance).
- Accounts: group by currency / category / none; sort high-low, low-high, A-Z; account detail (balance chart with ranges, month in/out, history); net worth card + sheet (12 month bars, by kind); Asset/Investment types with "Update value" (kept out of income/spending).
- Daily interest per account from a user-set yearly rate: deterministic ids, categories Interest / Crypto earned, posts when the app opens.
- Credit cards: limit, statement day, due day; banner on Home/Outlook (due within N days, or 80%+ used); downloadable .ics reminders (a web page cannot push alerts when closed).
- Outlook window: next-month forecast (average of up to 3 months), warnings, tips, reward budget, repeating items; short card on Home.
- Entry sheet: currency selector in the amount box, calculator keypad and typed expressions, category chips that follow every letter with "add new" when none fits, transfer fee (type, sender/receiver, predicted from history, counted as an expense in its category).
- Appearance (per device): colour, theme, five text sizes, hide style dots or blur; fonts smaller by default; inputs stay at 16px to avoid iOS zoom. Full style customisation still planned for later.

## Windows (v4, still current)
Burger menu: Home, Entries, Calendar, Budget, Cash flow, Outlook, Reports, Accounts, Review, categories, Settings. Bottom bar: Home, Entries, +, Calendar, Accounts. Labels: Expense / Income / Transfer; Cash inflow / Cash outflow / Net income (tappable). Calendar colour-coded days; interactive budget donut with warnings; cash flow page; category pages with keywords; two-way exchange rate; eye button hides amounts.

## Earlier versions
- v4: windows above, Google sign-in. v3: group breakdowns, own categories, eye button, home analysis, peso equivalents. v2: Supabase sync. v1: tracker, importer, predictor.

## Decisions
- Original design and code; only generic budget-app concepts are shared with Bluecoins.
- No paid AI/LLM. Guesser = exact-name lookup + naive Bayes (trigrams, account, currency, hour, amount) + category keywords; category candidates also from names, keywords and recent similar entries.
- Bluecoins CSV is the import/export format. Transfers are paired rows; transfer fees export as their own expense row.
- Cloud: Supabase over Firebase. Home currency fixed to PHP.
- The corner badge on Netlify sites is the "Powered by Netlify" badge, removable in Project configuration, General.
- Stay a web app (PWA) for now; native wrapper later only if needed.
- Import the CSV on one device only; other devices sign in and pull.

## Test results (real export, 2,779 rows)
- Import balances 47/47, re-import adds nothing, CSV round-trips. Guess accuracy about 92% seen names, about 15% new names.
- Phone-size Chromium suites all pass: earlier suites, v4 (53), Google return (9), v5 entry (18), v5 accounts (17), v5 outlook/appearance/blur (22).
- v5.1: syntax check of all modules; Node logic tests for import, re-import, balances, merge, interest and predictor; export/import round-trip with BTC, JPY and an unlisted currency. The new first-run link and sign-in-first seeding guard were NOT run in a browser yet.
- Supabase, Drive and Google sign-in tested only against simulated servers; SQL syntax checked only; not tried on a real iPhone/Android.

## Known issues / next
- Sync compares device clocks (`updated_at`); a phone with a wrong clock can override or lose edits, and the SQL trigger drops older writes silently. Idea: show an "ignored" count, or compare against server time.
- Rates, excluded groups, appearance and hide style do not sync between devices (idea: one `settings` record in `records`). Interest is an estimate and only posts when the app is opened.
- Updates reach the phone one visit late (cache first, refresh in background); idea: "Update ready, reload" prompt.
- Google sign-in uses the implicit flow (tokens in the URL hash); PKCE is the current Supabase recommendation.
- Receipt photo reading (OCR), item categorisation: needs 3-5 sample receipts.
- Importers for GCash, Maya, banks, exchanges, PASMO; PASMO convenience purchases as food.
- Starter keywords for common merchants to lift the ~15% accuracy on new names.
- Full overall style customisation.
