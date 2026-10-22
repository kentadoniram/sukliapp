# Sukli prototype: status and decisions (updated 2026-10-22, after v12o = 12.39.1.1022)

## What exists
Local-first PWA (plain HTML/CSS/ES modules, no build step, no server of our own). Data in IndexedDB as one JSON database; every record has id + updatedAt so devices can merge.

Sync, two options (both optional, untouched since v6):
- **Supabase (recommended).** Free project, plain fetch to the REST API. One row per record in `records(user_id, coll, id, data jsonb, updated_at, synced_at)`, row-level security, trigger stamps server time and ignores older writes. Setup script `supabase.sql`. Sign-in: email + password, and Google through Supabase's OAuth redirect. `config.js` can hold the project URL and public key.
- Google Drive backup into the hidden appDataFolder, daily snapshot kept 14 days.

## v12n / v12o (2026-10-22): "Mini Update" 16-item list (done in easy-to-hard order)
Done:
- **Import safety (item 4):** `previewImport` (importer.js) runs the import on a copy and lists only NEW accounts; `confirmImport` (screens.js) lets the user fix each new account's type and merge a similar name into an existing account. `importBluecoins(db, text, {types, into})`. Existing accounts are never retyped. Assets/Liabilities grouping in accpage.js now uses account type, not balance sign.
- **Shared pick list (items 1, 5, 7):** `js/picker.js`. `enhanceSelect(select, {title, onAdd, addLabel})` hides a `<select>` behind a button; the list has search when more than 5 options, "Add new" under search, optgroups as headings. `pickAll(root, perField)` enhances every named select. Used in Trade, investment Income, add-asset, predictions, loans, account form (type list with "Add a new account type"). Setting `select.value` in code repaints the button.
- **Platform-first Trade (item 1/2):** platform -> asset -> money account (that platform's accounts first, other platforms and accounts below); remembers `settings.lastPlat`. `addAsset({platform, onDone})` is exported.
- **Entry menu (items 2, 12):** `invEntryMenu` in invest.js: Trade, Transfer, Expense, Income, in that order. Reached from Investments "+ Entry", each platform's "+ Entry on X", and the account-page "+" for investment/crypto accounts (accpage.js `inInvestAcct`).
- **Income (items 5, 12):** Kind combines investment kinds (`inv:`) and the user's income categories (`cat:`); "Cash into an account" lists platform accounts first, with Add.
- **Trade maths and fees (items 10, 11):** units x price = total both ways; fee fixed or %, charged in the money currency or the asset; fee booked as its own expense (Financial loss > Trading fees) on the account of the fee currency; the trade record keeps `feeCur`, `feeAmt`, `feeHome`.
- **Price history (item 13):** `pushHistory` keeps every manual/trade update as its own record (with `ts`); live prices keep one "daily close" record per day (rates.js too).
- **UI (items 14, 15, 16):** History period buttons highlighted via `st.preset`; header wraps on small phones; `sliceLabel` draws % inside pie slices.
- Extras: `run-all-tests.sh` (one SUMMARY line), README "What's new" and "How to check the app", `tests/pkhelp.py` (choose/open_menu helpers for hidden selects), `import-preserve-test.mjs`.
- Version: js/version.js change 39, sw.js `sukli-v12o`.

Still to build (as of this note):
1. Item 8 finish: clearer "change classification" on the Account page (type is editable in the account form; needs a shortcut and a real-account check, e.g. BDO bank -> crypto exchange).
2. Item 6: custom names for subcategories and platforms (categories and account types can already be renamed).
3. Item 3: a test that trades, fees and investment income export in a Bluecoins-readable form (plain export already round-trips 2779 rows, 0 differences).
4. Item 12: trade fee is a separate expense entry; decide whether to show it joined to its trade.
5. Item 9: React not adopted; no-build stays, shared components (picker.js) are the approach unless the user decides otherwise.
6. Visual check of Investments and Account tabs at 320-360px; pie label contrast.
7. More tests: predictions card, investment income card.
8. Known test noise: ui_test5 "hidden mode masks calendar" showed a 3-digit number ("112") in one run and could not be reproduced on a fresh run; the "no console errors" check fails on sandbox network tunnel errors. Neither is from the new code as far as known.

## v12e (2026-10-21): arrangement, calendar, transport, interest tax
- **Settings > Tabs and Home cards:** `settings.tabs` (up to 4 of home, ledger, calendar, accounts, budget, cashflow, outlook, analytics; + stays centre) and `settings.homeLayout {order, hidden}`. Home sections are a list in screens.js (`HOME_SECTIONS`, `homeSection`); heavy ones (insights, outlook) are drawn by `fillDeferred` right after the first paint.
- **Back keeps scroll:** app.js remembers scroll per hash and restores it when going back.
- **Where it went:** Bars/Pie toggle, pie legend with %, daily bars (30 days) under the rolling average.
- **Typed transport words** (`transportWord` in route.js); blank label -> "From - To" or the usual trip for the hour.
- **Entries multi-select delete**, transfer colour, calendar month strip/heat shading.
- **Interest tax:** `a.taxPct` in `postInterest`; net credited, `gross`/`tax` kept.
- **Account page +** with `transferPreset`, and a swap button in the transfer form.
- Open question to user: which screen feels slow after editing (point 9).

## v12f to v12m (2026-10-21/22)
Collapsible bordered cards (`.coll`), account views (group by class/currency/type/platform, compact filters), loans (planner, charges, `loancalc.js`), investments tab (`invest.js`: platforms, tickers `settings.tickers[sym]`, asset types, markets, live prices via CoinGecko, performance, income, predictions kept apart from actual prices), `trades.js`/`tradecalc.js` (realized gains by average cost), Bluecoins export fidelity fixes (`openRow`, original names), offline note: data is on-device, app is cached by the service worker, OCR files are not in the offline cache; advise home-screen install and monthly CSV backup.

## v12b (2026-10-21): long receipts, service worker
- Long LIFE receipts: tiled reading, one wrong price solved from the subtotal, multi-photo receipts. The user's real long receipt photo has NOT been seen yet.
- sw.js is network-first (cache only offline).

## v12 (2026-10-20) and earlier
Receipts: 支払合計 primary total, per-item categories (`itemcat.js`), trips (`route.js`), rolling 7-day average. v11 name comparison card; v9 name graph + Tesseract scanner; v6-v8, v10 import, currencies, entry sheet, accounts/cards/analytics/bin, insights, settings.

## Decisions
- Original design and code. No paid AI/LLM; guesser = exact-name lookup + naive Bayes + keywords + name graph.
- Bluecoins CSV is the import/export format. Cloud: Supabase. Do not change Google sign-in / sync / Supabase unless asked.
- Stay a PWA, no build step. Deliver zips of modified files only (never vendor/ocr) because the user's storage is nearly full.
- Imports must never reclassify existing accounts without confirmation.

## Test status
`./run-all-tests.sh` (Node suites + Chromium phone-size UI suites). Last full run: 38 passed, 1 failed (ui_test5, see above).

## Not done / next (older)
OCR correction memory; Japanese item glossary; Philippine receipt fixes; importers for Maya, BDO Gold Visa, PASMO (waiting on samples); OCR engine comparison; paste route (iOS Live Text / Google Lens).
