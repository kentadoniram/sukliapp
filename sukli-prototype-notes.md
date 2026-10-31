# Sukli prototype: status and decisions (updated 2026-10-31, after v13s = 13.19)

## v13 direction (user, 2026-10-28)
- Version 13 helps people manage debt (many Filipinos borrow to pay other loans) and later splits Investments into its own window. Done: 13.1 Debts tab, 13.2 Pay debt, 13.3 realistic payment plan, 13.4 Merchant + debt timing refinement, 13.5 mode setting + Merchants in Settings, 13.6 Debt/Lent buttons + Owed to you tab, 13.7 general Undo + folded Look and Feel + first Simple-mode hiding, 13.8 Owed to you fixes, 13.9 tidier entry rows and grouped menu, 13.10 simple "?" help on seven pages (test), 13.11 that help only in Simple mode, 13.12 undo history kept across restarts, 13.13 mode switch animation + a look for each mode, 13.14 six UI fixes, 13.15 Simple mode hides analysing Home cards + faster curtain, 13.16 three small fixes (Pasmo kept as typed, zero earn rows hidden, case-blind suggestions), 13.17 trades rebuilt on Bluecoins CSV re-import, 13.18 item price solver (maths only), 13.19 category spending estimate (maths only). Next: screens for spending without OCR (Advanced only), more Simple-mode hiding (one step at a time), borrowing-to-pay-loans flag with a monthly "borrowed vs paid vs interest" line, separate Investments window with user-added market tabs, comparison page (MP2, deposits, crypto, with sources and dates) and a "buying check" that checks the USER (emergency money, higher-interest debt, size of the purchase, past swings), never a buy/sell verdict. Crypto part: user is still thinking.
- The app learns income and spending from entries and quietly compares it with typed figures: it plans with what it sees, says so politely, never calls the user a liar; show lower confidence when entries are thin; irregular income should use the lowest recent month.

## v13s (2026-10-31): category spending estimate, maths only (change 19 of v13)
- User's goal: know roughly how much went to drinks, outside food (not dining out) and toiletries without detailed entry, OCR being too slow/inaccurate; asked for a model "not just algebra". Answer: regression. `js/catsolve.js` `estimateSpending`; `tests/catsolve-test.mjs` (19 checks, in run-all-tests.sh). Counts per category plus the total per receipt; non-negative robust (Huber) fit, ridge toward typical Japan prices with cross-validated strength, per-shop prices pooled toward the all-shops fit, every receipt split to add up exactly, bootstrap range plus split-misfit term, known amounts kept exact. Simulation: 45 receipts median error 3.3%, worst 10.6%, 80% range holds about 80% of the time, average range width 13%. Categories should be split by price level, not food type. Full design in `claude/sukli-plan-item-prices.md`. No screens; nothing in the app calls it yet.
- Range lesson: the first version's bootstrap range was too narrow (covered 56%); adding the receipt-split misfit term fixed it (80%).

## v13r (2026-10-31): item price solver, maths only (change 18 of v13)
- `js/itemsolve.js` + `tests/itemsolve-test.mjs` (39 checks). API `solveShop`, `parseQty`, `itemKey`, `sameCandidates`, `typicalFor`. Per shop; tax 8% food / 10% other as settings; per-group rounding slack; real decimals (thousandths); typed price and scanned line price are extra clues; newest purchases win if a price changed. Relatedness decided: same item joins (spelling; size is part of identity), same price at a shop only by user link (solver may suggest), merely similar never joined (labelled "about" range). Speed: 10 items/20 purchases 0.1 s, 30/60 about 3 s.

## v13q (2026-10-31): trades rebuilt on Bluecoins CSV re-import (change 17 of v13)
- `importBluecoins` (js/importer.js) `rebuildTrade`: a holding = account type `crypto` or `invtab` or has `exchange`. A transfer pair becomes a trade when one side is a holding AND (units differ OR name starts Buy/Sell/Convert). Cash to holding = buy, holding to cash = sell, holding to holding = convert. valueHome from the row's exchange rate; no value, no trade. Fee expense ("Transfer fee" / "Trading fee…", same date, on one of the two accounts) gets `tradeOf` and the trade `feeHome`. Same coin between own wallets stays a transfer. Re-import adds nothing. `opts.trades === false` switches it off (no screen yet); toast shows `stats.trades`.
- On the user's real Transactions.csv: 64 trades (35 sell, 27 buy, 2 convert), realized about 3,232; many are crypto-platform to GCash/bank moves counted as sells. NOT yet reviewed by the user; consider a confirm step or off switch.
- Tests: export-trade-test.mjs round trip, ui_test29 finds its own trade.

## v13p (2026-10-31): three small fixes (change 16 of v13)
1. `bareMode` (js/route.js) no longer treats Suica / Pasmo / ICOCA / IC card as a bare vehicle word, so a typed "Pasmo" is kept. 2. `ledgerRows` (js/screens.js) hides auto/Earn income rows that display as zero (hidden only). 3. `renderSugg` (js/entry.js) only hides a suggestion that equals the typed text exactly, so "Gu" offers "GU". Test ui_test74.

## v13o (2026-10-31): Simple hides analysing Home cards, faster curtain (change 15 of v13)
- The rolling daily average is hidden IN SIMPLE MODE (anything that analyses), not for everyone. `SIMPLE_HIDDEN` in screens.js = insights, pace, projpie, rolling, outlook, loss, six; the 7 daily bars, Spendable now, reminders, Where it went / came from and Latest entries stay. Curtain: in .22 s, mode committed at 230 ms, out at 900 ms, removed at 1250 ms. Tests ui_test16, 72.

## v13n (2026-10-31): six UI fixes (change 14 of v13)
1. Investments > Performance text wraps inside its card. 2. All crypto platforms inside one `Crypto` header card (`i-crypto`, closed by default when 3+ platforms; other card titled "Bonds, savings and other investments"); tests set `sukli-coll` `{'i-crypto': false}`. 3. Loan planner (`#lp .two`) aligned on the bottom edge; "Upfront fees". 4. Real switches (`js/feedback.js`, iPhone only, cfg `overlay`): transparent `input[switch].hsw` inside each `.keypad button`, `#btns .btn`, `.fab`; NOT verified on a real iPhone. 5. Mode curtain letters rise one by one over CSS-only backgrounds; nothing copyrighted. Test ui_test73.

## v13m (2026-10-30): mode switch animation and a look for each mode
- `ACT['set-mode']` curtain; `body.simple` light: cream paper `#F7F3EA`; Advanced light: cooler paper `#EDF0F5`; dark unchanged. Accent default `auto` (teal Simple, blue Advanced; `setLookMode`); a user-picked colour wins. Test ui_test72.

## v13l (2026-10-30): undo history across restarts
- `js/core.js`: undo and redo stacks saved to IndexedDB key `undo` (capped 6 MB); `undoLoad()` restores only if `sigOf` matches. `js/bin.js`: `#/bin` two cards, `#/bin?v=history`. Test ui_test71.

## v13k / v13j (2026-10-30): "?" page help in Simple mode only
- `js/tabhelp.js` `HELP` map (home, ledger, calendar, budget, accounts, debts, owed). Test ui_test70.

## v13i / v13h (2026-10-30)
- 13i: Debt and Lent entry: person and money-account on one row; "Add a new person" inside the picker; menu folds bottom-bar pages; Owed to you long names wrap. 13h: Accounts page crashed with a "Money owed to me" account (no group in the default grouping); re-typed accounts link their transfers by direction (ui_test69). Lesson: any new account type needs a place in every grouping list in accpage.js.

## v13g (2026-10-30): general Undo, folded Look and Feel, first Simple-mode hiding
- Undo (`js/core.js`, `js/undoui.js`): `commit()` snapshots, max 10 steps, 0.8 s merge, restore by id. Simple hiding (`body.simple`, `.adv-only:not(.keep)`): menu Investments, Cash flow, Outlook, Analytics, Loan planner; entry Merchant row; account interest block; Settings Name matching, Coins and tokens: decimals, Cloud sync. Tests ui_test67, 68.

## v13f (2026-10-29): Debt / Lent buttons and the Owed to you tab
- Combined Debt and Lent buttons; asset type "Money owed to me"; dedicated tab; overpaid extra is "Interest earned" or similar, NOT "gift". Flows pay / borrow / lend / back saved as transfers with `debtPay`, `debtBorrow`, `lent`, `lentBack`; `js/owed.js` + `#/owed`; write-off (category "Money not paid back"). Tests ui_test66, 62, 13.

## v13e / v13d / v13c / v13b / v13a (2026-10-28 and 29)
- 13e: Simple/Advanced mode (`appMode`: simple only when `settings.mode === 'simple'`; first-run choice; never deletes data) and Merchants in Settings. Planned Simple list: tabs Home, Entries, Add, Budget, Accounts; entry basics only; simple Debts; still to hide: loan setup details, trades/crypto, CSV tools, sync, debt parking/extra/early-fee. Rules: hide don't remove, never hide protective warnings, offer "Turn on Advanced mode?" when needed, imports with trades/crypto ask first. Open questions: Investments in Simple; Lent in Simple?
- 13d: Merchant (Sukli CSV only); debt timing (`steady`, `planMonth` v2, `evalExtra`, `suggestExtra`, `parkIdea`, `cashCtx`; `a.dm` = {rate, min, flex, early}). 13c: plan cushion 10%, cap 40% of income. 13b: Pay debt = transfer `debtPay`. 13a: Debts tab (rate `a.dm.rate` > `a.loan.rate` > `a.debtInt`; minimum `a.dm.min` > `a.loan.monthly` > 5% estimate). Tests ui_test61-65.
- Research (2026-10-28, from news, check before relying): BSP credit card interest ceiling 3% a month, kept Aug 2023, under review; cash advance fee at most 200 pesos; card instalment add-on at most 1% a month. SEC Memorandum Circular 14 (Dec 10, 2025): loans up to 10,000 pesos and up to 4 months, from April 1, 2026: nominal interest at most 6% a month, effective at most 12% a month, late penalty at most 5% a month. MP2 declared dividend: 2014 4.69, 2015 5.34, 2016 7.43, 2017 8.11, 2018 7.41, 2019 7.23, 2020 6.12, 2021 6.00, 2022 7.03, 2023 7.05, 2024 7.10, 2025 7.12 percent; not guaranteed, tax-free; term and minimum still to check with Pag-IBIG.

## v12av and earlier
v12av: bulk edit, bigger market graph, `.pkbtn` pickers. v12au: typed cost Change/Remove. v12at: saved price delete, glossary, buzz real switch (unverified). v12as: platform actions, pie. v12ar: Sukli CSV. v12aq: card billing periods, `tx.posted`. v12ap: `valueSeries`. v12ao: hidden empty assets, Spot/Earn. v12an: receipt photos. v12am: platforms. v12al: tags, Share backup. v12ak: `js/welcome.js`. v12aj: `f-what`, floating Save row. v12ag: `js/fxview.js`. Earlier: wallets, interest, `js/features.js`.

## Decision: React dropped
Plain HTML/CSS/ES modules, no build step; later wrap for Android (TWA or Capacitor).

## Still to build
1. Check on a real iPhone 16 Pro (user could not test the last ~16 releases): real switches on keypad/Save/+, buzz message, mode choice and the fast curtain, the two looks, Simple mode (menu, entry, Settings, Home cards), folded Look and Feel, Undo and Undo history after closing the app, entry rows, Debt/Lent flows, Owed to you tab, grouped menu, Crypto header card, Loan planner alignment, "?" help (Simple only), Merchants in Settings, Debts, Investments, scan screen, Sukli CSV, bulk edit, Pasmo label kept, trades rebuilt after re-importing the Bluecoins CSV (check the 64 trades and realized total).
2. More Simple mode, one step at a time: entry basics, Debts simple view, account form details, bulk edit, CSV tools, sync, loan setup, Analytics-style pages; "Turn on Advanced mode?" prompt; decide Investments and Lent in Simple.
3. Owed to you follow-ups: optional interest, due-date reminders, "Lent" filter chip, owed total on Home.
4. Android receipt scan low-memory check.
5. No-setup sync; Supabase sign-up check; Google Drive OAuth client ID.
6. Scanner stage 2.
7. PaddleOCR comparison.
8. v13 next: borrowing-to-pay-loans flag; loan setup wizard; typed vs learned income cross-check; separate Investments window; comparison page; buying check.
9. Optional: confirm or off switch for trade rebuild on the import screen.
10. Group local-bank currency accounts.
11. Per-token performance.
12. Tests: predictions card; loan fee in Home loss card; tests independent of the blocked rates request (ui_test5/39/44 flake); cushion-dip note; make ui_test61 date-independent.
13. Pick list in export screen.
14. Beginner help (Simple mode): extend "?" to the other pages, sample-data tour.
15. Optional budget-alert notifications; debt due-date reminders; "Pay debt" filter chip.
16. Later: Android wrap; `.fydb`.
17. Older Maya/BDO Gold Visa/PASMO importers; paste route.
18. Optional daily snapshot of the Investments total; pie on Home.
19. Screens for spending without OCR (maths done in 13.18 and 13.19; Advanced only): category quick entry (shop, categories with counts, total), spending-by-category page with "about" amounts and ranges, then item list and item prices page, "costs the same as" link, Sukli CSV fields; plan in `claude/sukli-plan-item-prices.md`.

## Decisions
- Original design and code; no paid AI. Bluecoins CSV stays for Bluecoins; the Sukli CSV is Sukli's own lossless file (only place new fields like Merchant go).
- PWA, no build step, no React. Deliver zips of modified files only (never vendor/ocr). Animations and backgrounds are drawn in CSS (no pictures, nothing copyrighted).
- Imports never reclassify existing accounts without confirmation. A Bluecoins re-import sets buys/sells/converts up as trades again (money in and out unchanged).
- Financial-loss info belongs in Investments; Entries shows fees inside their row.
- What the user typed wins over a guess: a typed label (e.g. "Pasmo") is never renamed by the app; suggestions ignore capital letters; interest or earn entries that show zero are not listed in Entries.
- Spending without OCR: counts per category (split by price level) plus the total is the main path; estimates are always "about" with a range, labelled, and never change a saved total or budget; known exact amounts stay exact; per shop; items are joined only when they are the same item (spelling) or the user links them; similar items get only an "about" range; never invented from one equation.
- Budget alerts never shame needs. New-user wording: plain words, short; extra explanation behind a "?" tap; page help is a short "?" sheet in Simple mode only.
- Simple/Advanced: Simple only hides, never deletes; no saved mode counts as Advanced; one switch in Settings; protective warnings never hidden; anything already set up stays visible (`.adv-only` / `.keep`); Settings says what Simple hides. Anything that analyses (trends, pace, forecasts, fee losses) is hidden in Simple, including on Home; the 7 daily bars stay. Build Advanced first, Simple one step at a time. Each mode has its own look (Simple warm and calm, teal; Advanced cooler and crisper, blue); a user-picked accent wins; switching shows a short fast curtain (not with reduced motion).
- Undo covers entries, accounts, categories, budgets, merchant list and custom types; last 10 steps, kept across restarts (6 MB cap), trusted only if the data is unchanged since; imports, restores and sync are not undoable. Undo history lives next to the Recycle bin (two cards).
- Long Settings groups fold their sections; remember what the user opened on this device. Menu keeps pages already in the bottom bar in one folded group. Investments: all crypto platforms under one header card, other products under their own card.
- Haptics: a real transparent switch sits inside keypad keys, Save and + on iPhone (can be turned off); programmatic buzz otherwise.
- Debt help is arithmetic on the user's own figures, worded "costs least by your numbers", never "you should"; interest-limit facts carry a "check the current rule" note.
- Debt plan never suggests more than history leaves after usual spending and a 10% cushion, nor more than 40% of income, unless the user chooses "Use my figure anyway"; due dates first, then habit; no-due-date debts last; steady payers stay at their installment; extra money optional; parking in savings is an idea, never forced; cash check flags cash short of 14 days of dues; shortfalls come with ways to find money (cuts only from wants and luxury).
- Paying a debt, borrowing, lending and being paid back are transfers (never spending or income); only an overpaid extra is income ("Interest earned" or "Other income", never "gift"). Money owed to the user is asset type "Money owed to me", not Spendable, on its own Owed to you tab; Sukli never says someone will not pay; write-off is the user's own action and stays out of everyday spending. Changing an account to this type links its earlier transfers by direction.
- Merchant is separate from category, optional, pick-or-add, manageable in Settings, Sukli CSV only.
- Investments: platform > wallet > asset; own display currency; zero-balance crypto hidden; graph uses recorded values only; saved prices deletable; typed cost figures changeable; pie from a symbol on the group row; platform actions on one line.
- Anything typed by hand that feeds a total needs a way to change or remove it.
- Selecting several entries allows Delete or Edit (never amounts); mixed values flagged first.
- Crypto interest only on Earn; move coins by transfer. "All" buttons fill the whole balance.
- Card billing period = day after the statement date through the next statement date; entries count on their posted date when set.
- Account form fields share one size (46px); related pairs on one row; labels share one height; Loan planner rows align on the bottom edge.
- Questions such as "Did you mean…" always give two real answers (Yes/No).
- Google backup, Cloud sync, Supabase, sign-up hidden for new users (kept in code).
- Interest help: "?" buttons open on click only.
- Entry form: nothing above or inside the calculator may move while typing (a kind or flow change may re-lay the form); guesses must not depend on the amount; currency selector right-most and as tall as the amount box; a touch pick must not trigger the control that moves up under the finger. Entry type buttons: three on one row, Debt and Lent on a second row with captions; paired pickers share one row.
- Exchange rates: clickable "Exchange Rate" with three-line summary; converter is the one place to edit a rate.
- Exported files carry date and HHMM.
- Input ids/names must avoid words iOS autofill reads ("name"); entry text box is `f-what`.
- Save row floats and shrinks while the keyboard is open.
- First run: mode choice (Simple or Advanced), then five easy questions; the "now" figure is after the payment.
- Tags/events are free-text labels (Bluecoins Labels column).
- Japanese text shown to the user: kanji, then romaji, then English (user is about JLPT N4).
- Receipt photos decoded once, scaled down; reader released when Scan closes; low memory means retry smaller.
- The scanner remembers corrections; it does not learn by itself.
- The sandbox cannot test real Safari or haptics; 320-360px layouts are no longer a goal.
