# Sukli prototype: status and decisions (updated 2026-10-28, after v13b = 13.2)

## v13 direction (user, 2026-10-28)
- Version 13 helps people manage debt (many Filipinos borrow to pay other loans) and later splits Investments into its own window. Planned order: 13.1 Debts tab (done), 13.2 Pay debt (done), then income/spending learning checks, borrowing-to-pay-loans flag with a monthly "borrowed vs paid vs interest" line, separate Investments window with user-added market tabs, comparison page (MP2, deposits, crypto, with sources and dates) and a "buying check" that checks the USER (emergency money, higher-interest debt, size of the purchase, past swings), never a buy/sell verdict. Crypto part: user is still thinking.
- The app learns income and spending from entries and quietly compares it with typed figures: it plans with what it sees, says so politely, never calls the user a liar; show lower confidence when entries are thin; irregular income should use the lowest recent month.

## v13b (2026-10-28): Pay debt (change 2 of v13)
- Entry form (`js/entry.js`): segment has 4 buttons Expense / Income / Transfer / Pay debt (`#seg` is a 4-column grid). Pay debt = `f.kind === 'transfer'` plus `f.debt = true`; saved as a normal transfer with `debtPay: true` (deleted again if the entry is edited into another type; travels in the Sukli CSV "Extra (JSON)"). Never an expense, so nothing is double counted; card statement `paid`, `loanPayments`/`loanProgress`, `loanBox` and the Debts tab count it automatically.
- Form (`debtFix(f)`, `owedOf(id)`): "What will you pay?" (only liability accounts, shows "You owe X"; default = the debt owing most) then "Paid from" (only non-liability accounts; default prefers the debt's currency while the user has not touched it), amount (chips `data-e=debtamt`: Minimum from `a.dm.min` or `a.loan.monthly`, All I owe, same currency only), date row, notes/tags. No swap button, no "All" button, no fee row (fee ignored when `f.debt`). Different currencies still use the transfer convert row. Blank label becomes "Paid <debt name>". The label hint "credit card payment" / "loan payment" now offers Use Pay debt (`smartAct` clicks the Pay debt button). Quick chips show usual routes into debts.
- `openAccountPicker({ only: 'debt' | 'pay' })` filters liabilities / non-liabilities (`js/acctpicker.js`).
- Entries list (`screens.js`): sub line "Pay debt · A → B", effect line "Debt payment: lowers what you owe, not counted as spending"; filter chips unchanged (these rows appear under Transfer). Editing reopens in Pay debt mode. Debts tab: "Pay this debt" button per debt (`ACT['debt-pay']` opens the form with the debt chosen). Tests ui_test62 (ui_test21 updated: the smart chip now lands in Pay debt). ui_test5 (reports 12 months) can flake under load.

## v13a (2026-10-28): Debts tab (change 1 of v13)
- Files: `js/debtplan.js` (pure maths: `monthlyRate`, `rankRate`, `orderDebts`, `allocate`, `simulate`, `light`, `learnBudget`), `js/debts.js` (page `debts(db)`, `debtList`, `budgetInfo`, ACT `debt-mode`, `debt-budget`, `debt-budget-clear`, `debt-edit`, `debt-pay`). Route `#/debts`, `TAB_DEFS.debts` (icon calc; not in the bottom bar by default, in the menu and Settings > arrange tabs), menu item, glossary words (Debts group). CSS "v13" block at the end of styles.css. Test ui_test61.
- Debts = non-archived liability accounts (card, loan, other liabilities) owing at least 0.5 in home currency. Rate: typed `a.dm.rate` (yearly, treated as effective) > `a.loan.rate` (nominal/12) > `a.debtInt` (add-on is a fixed monthly charge on the principal). Minimum: `a.dm.min` > `a.loan.monthly` > estimate 5% of owed (marked). Due: `cardBilling` for cards, next due day for loans (`loanDue`). `a.dm = {rate, min}` is used ONLY for the plan and never posts entries (`debtInt` would post interest).
- Money for debts each month: `settings.debtBudget` (typed, Change/Remove) else learned = average (income minus spending) of up to the last 3 whole months, ignoring auto-posted debt interest; if that is zero the page says so and asks for a figure. Light: green when budget >= 1.25x minimums, yellow when it covers them, red when short (says by how much, suggests talking to the lender). Order: `settings.debtMode` avalanche (highest interest, default) or snowball (smallest debt); minimums first, extra to the first in line; simulation shows debt-free month and total interest for both ways and minimums only. Debts with no rate are flagged and counted as 0%.
- Not built yet: borrowing-to-pay-loans flag, per-loan setup wizard (type/term/minimum), notifications, cross-check of typed vs learned income.
- Research (2026-10-28, from news, check before relying): BSP credit card interest ceiling 3% a month (36% a year), kept in Aug 2023 (Circular 1165, Jan 2023) subject to review; cash advance fee at most 200 pesos; card instalment add-on rate at most 1% a month. SEC Memorandum Circular 14 (Dec 10, 2025): loans up to 10,000 pesos and up to 4 months, taken/renewed from April 1, 2026: nominal interest at most 6% a month (0.2% a day), effective at most 12% a month (0.4% a day), late penalty at most 5% a month, plus a cap on total cost. MP2 declared dividend by year (sweldoph.com): 2014 4.69, 2015 5.34, 2016 7.43, 2017 8.11, 2018 7.41, 2019 7.23, 2020 6.12, 2021 6.00, 2022 7.03, 2023 7.05, 2024 7.10, 2025 7.12 percent; no contractual rate, not guaranteed, tax-free, average-balance method; term and minimum not confirmed (the 5-year term still needs checking with Pag-IBIG).

## v12av (2026-10-28): bulk edit, bigger market graph, aligned interest boxes (change 72)
- Entries select mode: `Edit (n)` (`ACT['sel-edit']`, `js/bulkedit.js` `openBulkEdit(ids,onDone)`) changes name, category (only entries of the matching kind), tags (add/replace/remove), notes, account (same currency, not transfers) and day (time kept) for all selected. Amounts never change. Each field shows "All N are the same" or "Not the same: K different values. Changing it sets all N" (`.mixed`). Change disabled until a field is touched; one `commit`, `t.rev` and `stamp`, skipped counts in the toast, Undo restores old values. Test ui_test60.
- Investments Market value card: graph (`.ivgraph`, `miniSvg` 160x64) much larger (about 44% of card width), "Value over time" text removed (aria-label kept, still `data-act=inv-graph`).
- Account form: labels in `#acct-form .field > span` have equal min-height and a smaller `?` button so "Tax on interest (%)" and "Added to balance" line up. Selects are replaced by `.pkbtn` picker buttons (native select hidden), so tests measure `.pkbtn`.

## v12au (2026-10-28): own cost figure can be changed or removed (change 71)
- Performance card (`performanceCard` in invest.js): a typed figure ("In total, how much did you pay", `account.costHome`) shows "paid X (your figure)" with Change (`ACT['inv-cost']`) and Remove (`ACT['inv-cost-clear']`); empty box also removes it. Ignored once real trades give a cost; does not affect prices or `valueSeries`. Test ui_test59.

## v12at (2026-10-28): price delete, account form UI, statements, glossary, buzz (change 70)
- Saved prices: ticker sheet (`ACT['inv-ticker']`) lists each price with Delete (`data-hdel`); `oddPrices(h)` flags prices > 4x or < 1/4 of neighbours; Investments `.warnline`. Test ui_test57.
- Header currency chip `.curchip` (`data-act=inv-cur`) on the Record activity / Add asset row.
- Account form (accpage.js + CSS "v12at"): inputs 46px; Rate + Starts on; Tax on interest + compounding; rate change one row (`.rcline`); promo rows 3 rows of 2 fields.
- Card statement: `statementSummary(db, a, per, asOf)` (finance.js), `.cardbox.stmt`. Test ui_test54.
- Glossary: `js/glossary.js`, `ACT.glossary`; Settings > Help and Investments footer. Test ui_test58.
- Buzz: hidden-switch trick works on iOS 17.4-26.4, reportedly patched in 26.5; Settings has a real switch `#fb-realsw[switch]`; `iosVersion()`. Unverified on device.

## v12as and earlier
v12as: platform actions one row, Market value card split (`.nwsplit`), pie symbol `.piebtn` (`ACT['inv-pie']`); ui_test56. v12ar: Sukli CSV (`js/sukliCsv.js`); ui_test55. v12aq: card billing periods (`periodFor`, `billingPeriods`, `postedDay`), `tx.posted`; ui_test54. v12ap: entry layout, Investments colours, `valueSeries`; ui_test53. v12ao: hidden empty assets (`sukli-invempty`), Spot/Earn rules, trade `All`. v12an: receipt photo handling, `settings.ocrFixes`, `js/jpgloss.js`; PaddleOCR plan: add beside Tesseract. v12am: platforms, `settings.invCur`. v12al: tags, Share backup, Test the buzz; Google Drive hidden (needs OAuth client ID). v12ak: `js/welcome.js`. v12aj: `f-what`, floating Save row. v12ai: `fileStamp()`. v12ag: `js/fxview.js`. v12af and earlier: wallets, interest, `js/features.js`.

## Decision: React dropped
Plain HTML/CSS/ES modules, no build step; later wrap for Android (TWA or Capacitor).

## Still to build
1. Check on a real iPhone 16 Pro: real switch tick, buzz message, first screen, tabs, tags, platforms, Investments chip/colours/bigger graph/pie, Performance Change/Remove, scan screen, entry rows, All in amount box, Spot/Earn moves, card billing period/posted date/statement box, account form (aligned interest boxes), glossary, Sukli CSV, bulk edit, Debts tab, Pay debt (4 buttons fit on one row).
2. If the real switch ticks but taps do not: overlay real switches on keypad/Save/+ (experimental).
3. Android receipt scan low-memory check (ask the phone model if it still fails).
4. No-setup sync (Share backup stopgap); Supabase sign-up check; Google Drive needs OAuth client ID.
5. Scanner stage 2: number repair, discounts/coupons/points/tax lines, per-shop layouts, "report a bad scan", Philippine receipts, bigger glossary.
6. PaddleOCR comparison (10-20 sample receipts).
7. v13 next: borrowing-to-pay-loans flag and monthly line; loan setup wizard (type, term, minimum, due day); typed vs learned income cross-check; separate Investments window with market tabs; comparison page (MP2, deposits, crypto); buying check.
8. Group local-bank currency accounts under one bank name.
9. Per-token performance on the holding page.
10. Tests: predictions card; loan fee in Home loss card; UI tests independent of the blocked rates request (ui_test39, ui_test44 and ui_test5 flake under load).
11. Pick list in export screen (accounts/dates/columns for the Sukli CSV).
12. Beginner help: per-tab help and a sample-data tour (glossary done, Debts words added).
13. Optional budget-alert notifications; due-date reminders for debts; a "Pay debt" filter chip in Entries.
14. Later: Android wrap; `.fydb`.
15. Older: Maya/BDO Gold Visa/PASMO importers (need samples); paste route.
16. Optional: daily snapshot of the real Investments total; pie mode remembered / pie on Home.
17. Optional: general Undo for edits (bulk edit has its own Undo).

## Decisions
- Original design and code; no paid AI. Bluecoins CSV stays for Bluecoins; the Sukli CSV is Sukli's own lossless file.
- PWA, no build step, no React. Deliver zips of modified files only (never vendor/ocr).
- Imports never reclassify existing accounts without confirmation.
- Financial-loss info belongs in Investments; Entries shows fees inside their row.
- Budget alerts never shame needs. New-user wording: plain words, short; extra explanation behind a "?" tap.
- Debt help is arithmetic on the user's own figures, worded as "costs least by your numbers", never "you should"; the app plans with what entries show; interest-limit facts carry a "check the current rule" note.
- Paying a card or loan is its own "Pay debt" option (plain questions), stored as a transfer so it is never spending; plain Transfer stays for moving money between your own accounts.
- Investments: platform > wallet > asset; own display currency; zero-balance crypto hidden; graph uses recorded values only, large, no caption; saved prices deletable and odd ones flagged; typed cost figures changeable; pie from a symbol on the group row; platform actions on one line.
- Anything the user types by hand that feeds a total needs a way to change or remove it (they cannot undo): applies to the Debts monthly figure and each debt's typed rate/minimum.
- Selecting several entries allows Delete or Edit (never amounts); mixed values are flagged first.
- Crypto interest only on Earn; move coins by transfer. "All" buttons fill the whole balance.
- Card billing period = day after the statement date through the next statement date; entries count on their posted date when set; the statement box follows the selected period.
- Account form fields share one size (46px) and spacing; related pairs on one row; labels share one height.
- Questions such as "Did you mean…" always give two real answers (Yes/No).
- Google backup, Cloud sync, Supabase, sign-up hidden for new users (kept in code).
- Interest help: "?" buttons open on click only.
- Entry form: nothing above or inside the calculator may move while typing; guesses must not depend on the amount; currency selector right-most and as tall as the amount box.
- Exchange rates: clickable "Exchange Rate" with three-line summary; converter is the one place to edit a rate.
- Exported files carry date and HHMM.
- Input ids/names must avoid words iOS autofill reads ("name"); entry text box is `f-what`.
- Save row floats and shrinks while the keyboard is open.
- First run: five easy questions; the "now" figure is after the payment.
- Tags/events are free-text labels (Bluecoins Labels column).
- Japanese text shown to the user: kanji, then romaji, then English (user is about JLPT N4).
- Receipt photos decoded once, scaled down; reader released when Scan closes; low memory means retry smaller.
- The scanner remembers corrections; it does not learn by itself.
- The sandbox cannot test real Safari or haptics; 320-360px layouts are no longer a goal.
