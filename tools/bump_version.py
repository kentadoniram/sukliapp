#!/usr/bin/env python3
"""Run once for every build you hand over: python3 tools/bump_version.py
Adds 1 to `change` in js/version.js, sets its date to today (MMDD), and gives sw.js the matching cache name (sukli-v<major>.<change>),
so the number shown in Settings and the service-worker cache always move together."""
import re, datetime, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = root / 'js' / 'version.js'; s = v.read_text()
major = int(re.search(r'major:\s*(\d+)', s).group(1)); change = int(re.search(r'change:\s*(\d+)', s).group(1)) + 1
s = re.sub(r'change:\s*\d+', f'change: {change}', s); s = re.sub(r"date:\s*'\d+'", "date: '%s'" % datetime.date.today().strftime('%m%d'), s); v.write_text(s)
w = root / 'sw.js'; t = w.read_text(); t = re.sub(r"const VERSION = '[^']*';", f"const VERSION = 'sukli-v{major}.{change}';", t, count=1); w.write_text(t)
print(f'version {major}.{change}.1.{datetime.date.today():%m%d}  cache sukli-v{major}.{change}')
