# Plan: spending without OCR (item solver 13.18 and category estimate 13.19 built 2026-10-31; screens not built yet)

## Idea (user)
When OCR does not work (efficiency and accuracy issues), the user lists what was bought plus the total only. Sukli works out prices, or how much went to drinks, snacks, toiletries, as more purchases come in. Rough is okay when prices are not consistent. Example: 2 cupcakes + 1 water bottle = 120; later 1 + 1 = 70, so cupcake 50 and bottle 20.
User's real goal (2026-10-31): know how much was spent on drinks, outside food (not dining out), toiletries etc. WITHOUT detailed item entry. So the category model (below) is the main path; the exact item solver is the precise add-on.

## Two tools
1. Exact item solver `js/itemsolve.js` (13.18): needs item names; exact when it can be; ranges otherwise.
2. Category estimate `js/catsolve.js` (13.19): needs only counts per category plus the total; always rough ("about", with a range). Chosen as the main way. The two combine: an amount the exact solver or the user has pinned down goes in as `lines[].amount` and stays exact.

## Decisions (user, 2026-10-31)
1. Per shop only (item solver). Category model: per shop prices borrowing from the all-shops fit.
2. Japan tax: 8% food, 10% other, as settings (item solver). The category model works on tax-included totals, so it needs no tax rates.
3. Quantities may be decimals and must truly be decimals (0.35 kg stays 0.35); pieces whole; "." and "," accepted (`parseQty`).
4. No pre-fill of the total.
5. Advanced mode only.
6. Build the maths first; screens later.
7. Relatedness (item solver): same item joins automatically (spelling), same price at a shop only by the user's link (solver may suggest), merely similar never joined (only an "about" range).
8. Enter by category (drinks, snacks...) instead of exact items: yes. Split categories by PRICE LEVEL, not by type of food (drinks about 150 yen and ready meals about 520 yen apart).

## Item solver (built)
- `solveShop(purchases, opts)`; equation per purchase with rounding slack per taxed group (`opts.rounding` any/floor/round/ceil); two-phase simplex gives the lowest and highest price per item; whole-yen rule for pieces; typed price and scanned line price are extra clues; newest purchases win when a price changed (older ones dropped with a note); statuses solved / narrowed / unknown; helpers `sameCandidates`, `typicalFor`, `itemKey`, `parseQty`. 39 tests (`tests/itemsolve-test.mjs`). Speed: 10 items / 20 purchases about 0.1 s, 30 / 60 about 3 s.

## Category estimate (built)
- `estimateSpending(purchases, opts)`; purchases `{ id, date, shop, total, lines: [{ cat, n } or { cat, amount }] }`. Model: total about sum(count x average category price), prices tax-included. Non-negative fit by coordinate descent on relative errors; Huber robust weights (odd receipts count less); ridge toward typical Japan prices (`DEFAULT_CATS`, guess 300 for a new category) with strength picked by 5-fold cross-validation (0.8 when under 10 receipts); per shop fit shrunk toward the all-shops fit (stronger shrink under 8 receipts); every receipt's real total split across its categories by count x price so the sum is exact; known `amount` lines taken out first and kept exact.
- Range = bootstrap of the whole fit (price uncertainty) combined with the misfit of how receipts split (`resid`). Price quality: guess (no receipt) / good / rough / very rough; hints like "A receipt with mostly drinks would help".
- Simulation results (made-up receipts, noise 25% per item, two shops): 45 receipts: median category error 3.3%, worst 10.6%, 80% range holds truth 20 of 25, average range width 13%; 15 receipts 5.3% error vs 90 receipts 3.6%; one 12-pack receipt moves the drinks price under 12%. Weakness: identical mixes on every receipt cannot separate categories (ranges widen); similar-price categories need more receipts. 19 tests (`tests/catsolve-test.mjs`).

## What the user will see (not built yet)
- Quick entry (Advanced only): pick shop, tap categories with counts (decimals for weight), type the total, Save. Saved like any entry; carries the lines (`items` list exists for scans); new fields go to the Sukli CSV only. No pre-filled total.
- Spending by category page: "Drinks about 9,300 (8,100 to 10,500)" with the number of receipts used and plain quality words; labelled estimates; they never change a saved total or the budget; the user can type a known price any time (Change / Remove).
- Optional exact items for shops where the user wants precise prices (item solver): item prices page, "costs the same as" link, next-purchase hint.
- Plain short wording; no "you should".

## Next
- Screens: category quick entry, spending-by-category page, then the item list and item prices page. Sukli CSV fields. UI tests.
