# Sukli QA suite (run now and then, not on every change)

This folder is separate from `tests/` (the per-feature tests that run while building). `qa/` checks the whole app hangs together. It does **not** replace your own testing on a real phone with real data.

## Run it
```
python3 qa/run_qa.py               everything (about 6-8 min)
python3 qa/run_qa.py --quick       lighter (about 3 min): fewer looks/sizes, no 20,000-entry test
python3 qa/run_qa.py integration   one suite: integration | system | e2e | regression | performance
python3 qa/run_qa.py selftest      proves the checks can fail (breaks a temporary copy of the app on purpose)
python3 qa/run_qa.py regression --full           also re-runs every file in tests/ (20+ min)
python3 qa/run_qa.py regression --update-golden  accept new "golden" figures after you checked them
```
Needs: node, python3 with Playwright (Chromium). It starts its own web server on port 8123 if none is running.
The report is written to `qa/reports/latest.md` (and a dated copy plus a `.json`). Exit code 1 = something failed.
A script that fails is run once more; if it then passes it is listed as *flaky* instead of failed.

## What each suite checks
| Suite | Files | What it does |
|---|---|---|
| Integration | `integration/ledger_integrity.mjs` | Imports the sample CSV and re-derives every balance, history, balance trail and net worth by plain loops; checks money is conserved by transfers, ids unique, no orphan accounts or categories. |
| | `integration/roundtrip_and_trades.mjs` | Export → import round trips keep every entry and balance; 300 seeded random buy/sell sequences must obey the average-cost identities. |
| System | `system/sys_static.mjs` | Every import resolves and is really exported; the offline cache lists every module; version and cache name agree. |
| | `system/sys_every_screen.py` | Opens every screen, every Investments section, in Theme 1 / dark / Legacy / 320 px with biggest text / Simple mode / tablet, and with an empty app. Fails on script errors, 404s, `NaN` / `undefined` / `Infinity` text, sideways scroll, blank screens. |
| End-to-end | `e2e/e2e_money_workflows.py` | Real screens: add / edit / delete / restore / undo an expense with balances checked by hand; buy and sell a coin through the Trade form and compare realised profit with hand maths; wipe and restore a backup; export the CSV into a fresh app. |
| Regression | `regression/golden_numbers.mjs` | Key figures from the sample CSV compared with `golden.json`. `--full` also runs all of `tests/`. |
| Performance | `performance/perf_node.mjs` | Times the heavy calculations at 3,000 and 20,000 entries against `perf_budget.json`. |
| | `performance/perf_browser.py` | Cold load, CSV import, draw time of every screen, scrolling freezes, memory, then the same with 20,000 entries. |

## Reading a report
* **Failures**: a check broke. Re-run the named script alone (the report shows the command).
* **Findings** (⚠️): not failures, but worth a look (for example a slow screen or a risky behaviour).
* A changed **golden** figure means behaviour moved. If the change is intended, check the number, then `--update-golden`.
* Performance budgets in `performance/perf_budget.json` are about 10x what the cloud sandbox measured. Your computer or phone will differ; tighten them once you have your own numbers.

## Limits (what this cannot do)
Real device behaviour (iOS keyboard, touch feel, camera, location, notifications, Google sign-in, live exchange rates, map tiles), visual taste, and whether a number is *right for your real money* beyond what is re-derived here. Those stay with your own testing. The sample CSV is the only real data used.
