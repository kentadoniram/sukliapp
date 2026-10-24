#!/bin/bash
# Runs every test and prints one summary. Needs: node, python3 + playwright, and your Bluecoins CSV (default /home/claude/Transactions.csv).
cd "$(dirname "$0")"; CSV=${1:-/home/claude/Transactions.csv}; pass=0; fail=0
run() { if "$@" >/tmp/t.out 2>&1 && ! grep -q "^FAIL" /tmp/t.out; then pass=$((pass+1)); echo "ok    $*"; else fail=$((fail+1)); echo "FAIL  $*"; tail -5 /tmp/t.out; fi; }
for t in node-test home-test fin-test route-test graph-test itemcat-test rolling-test export-compat-test opening-test trail-test; do [ -f "$CSV" ] && run node tests/$t.mjs "$CSV"; done
for t in trade-test tax-test loan-test route2-test import-preserve-test opening-conflict-test export-trade-test route-work-test interest-test; do run node tests/$t.mjs; done
(python3 -m http.server 8123 >/dev/null 2>&1 & echo $! >/tmp/srv.pid); sleep 1
for f in tests/ui_test*.py; do PYTHONPATH=tests run python3 $f; done
kill $(cat /tmp/srv.pid) 2>/dev/null
echo "SUMMARY: $pass passed, $fail failed"; [ $fail -eq 0 ]
