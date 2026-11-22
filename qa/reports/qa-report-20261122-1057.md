# Sukli QA report

- App version: **16.19**  ·  run: 2026-11-22 10:57  ·  took 387 s
- Sample data: `/home/claude/Transactions.csv`  ·  mode: full

## Result: ✅ **all checks passed** (100 passed, 4 findings to read)

| Suite | Scripts | Checks passed | Failed | Findings | Flaky | |
|---|---|---|---|---|---|---|
| integration | 2 | 26 | 0 | 0 | 0 | ✅ pass |
| system | 2 | 20 | 0 | 0 | 0 | ✅ pass |
| e2e | 1 | 17 | 0 | 1 | 0 | ✅ pass |
| regression | 1 | 11 | 0 | 0 | 0 | ✅ pass |
| performance | 2 | 26 | 0 | 3 | 0 | ✅ pass |

## Findings (not failures: things a person should look at)

- ⚠️ 2-pre FINDING: a Buy paid in a currency with no known rate to home currency is saved with a home value of 0 (cost basis 0), with no warning. Later sales then show the whole proceeds as profit. [[0, 1]]  _(qa/e2e/e2e_money_workflows.py)_
- ⚠️ route_render_20k: the analytics screen takes 1218 ms to draw (still inside its 4000 ms limit)  _(qa/performance/perf_browser.py)_
- ⚠️ route_render_20k: the invest screen takes 1013 ms to draw (still inside its 4000 ms limit)  _(qa/performance/perf_browser.py)_
- ⚠️ route_render_20k: the trips screen takes 3523 ms to draw (still inside its 4000 ms limit)  _(qa/performance/perf_browser.py)_

## Performance numbers

```
cold_load_to_first_screen=330ms (budget 2000)
csv_import_to_home=1965ms (budget 6000)
route_render per screen: trips=212, invest=153, outlook=126, ledger=115, analytics=93, accounts=47 (ms, slowest 6)
route_render_20k per screen: trips=3523, analytics=1218, invest=1013, outlook=414, spend=339, ledger=195 (ms, slowest 6)
search_20k=205ms (budget 3000)
import_csv_3k=54.3ms (budget 400)
balances_3k=2.1ms (budget 30)
net_worth_3k=3.4ms (budget 50)
balance_trail_3k=5.3ms (budget 100)
balances_20k=14.3ms (budget 150)
net_worth_20k=24.1ms (budget 300)
balance_trail_20k=24.4ms (budget 400)
trade_book_20k=0.5ms (budget 100)
account_history_20k=3.0ms (budget 300)
monthly_series_20k=14.4ms (budget 300)
forecast_20k=103.4ms (budget 1000)
export_csv_20k=68.1ms (budget 800)
import_csv_20k=739.5ms (budget 3000)
```

## Self test: are the checks able to fail?

- ✅ caught: an expense adds money instead of taking it
- ✅ caught: buying fee left out of the cost
- ✅ caught: net worth overstated by 1 percent
- ✅ caught: net worth off by 5,000 (golden figure moves)
- ✅ caught: a js file missing from the offline cache
- ✅ caught: a module the app imports is gone

## Notes

- 3 same-currency transfers carry a different "arrived" amount (ATM or bank charges kept by the importer)
- page weight: 116 files, about 1975 KB on first load; DOMContentLoaded 259 ms
- DOM size on Home after use: 134 elements
- scrolling Entries: 0 long tasks, longest 0 ms
- scale test with 20000 entries in the app
- Entries list draws 120 rows at once with 20,000 entries
