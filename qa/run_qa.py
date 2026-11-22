#!/usr/bin/env python3
"""Sukli QA runner. Not part of the normal change cycle: run it now and then, or before you trust a big release.

  python3 qa/run_qa.py                 integration + system + e2e + regression + performance (about 6-8 minutes)
  python3 qa/run_qa.py integration     one suite (integration | system | e2e | regression | performance | selftest)
  python3 qa/run_qa.py --quick         fewer screen/look combinations, no 20,000-entry browser test (about 3 minutes)
  python3 qa/run_qa.py regression --full        also re-runs the whole tests/ folder (long: 20+ minutes)
  python3 qa/run_qa.py regression --update-golden   after YOU have checked that a changed figure is correct
  python3 qa/run_qa.py regression --full --filter trade     only tests/ files with 'trade' in the name
  python3 qa/run_qa.py --csv /path/Transactions.csv   use another Bluecoins file (then --update-golden once)

A report is written to qa/reports/ (qa-report-<date>.md and .json, plus latest.md). Exit code is 1 if any check FAILS."""
import sys, os, re, json, time, glob, shutil, socket, subprocess, argparse, datetime, tempfile
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SUITES = ['integration', 'system', 'e2e', 'regression', 'performance']
ap = argparse.ArgumentParser(add_help=False); ap.add_argument('suites', nargs='*'); ap.add_argument('--quick', action='store_true'); ap.add_argument('--full', action='store_true')
ap.add_argument('--filter', default='', help='with --full: only tests/ files whose name contains this'); ap.add_argument('--update-golden', action='store_true'); ap.add_argument('--csv', default=os.environ.get('QA_CSV', '/home/claude/Transactions.csv')); ap.add_argument('-h', '--help', action='store_true')
a = ap.parse_args()
if a.help: print(__doc__); sys.exit(0)
want = a.suites or SUITES
if 'all' in want: want = SUITES + (['selftest'] if 'selftest' in want else [])
for s in want:
    if s not in SUITES + ['selftest']: print('unknown suite', s); sys.exit(2)
port = 8123
def port_open(p):
    with socket.socket() as s: s.settimeout(0.3); return s.connect_ex(('127.0.0.1', p)) == 0
srv = None
if not port_open(port): srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
ENV = {**os.environ, 'QA_URL': f'http://localhost:{port}/', 'QA_CSV': a.csv, 'PYTHONPATH': os.path.join(ROOT, 'tests')}
LINE = re.compile(r'^(PASS|FAIL|WARN|INFO|ok  )\s*(.*)$')
def run_script(path, extra=(), timeout=600):
    ext = os.path.splitext(path)[1]; cmd = ['node', path, a.csv] if ext == '.mjs' else [sys.executable, path]
    cmd += list(extra); t = time.time()
    try: pr = subprocess.run(cmd, cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=timeout); out, rc = pr.stdout + pr.stderr, pr.returncode
    except subprocess.TimeoutExpired as e: out, rc = (e.stdout or b'').decode() if isinstance(e.stdout, bytes) else (e.stdout or ''), 124; out += '\nFAIL timed out after %ds' % timeout
    res = {'script': os.path.relpath(path, ROOT), 'rc': rc, 'secs': round(time.time() - t, 1), 'pass': [], 'fail': [], 'warn': [], 'info': [], 'perf': [], 'crash': ''}
    for ln in out.splitlines():
        m = LINE.match(ln.strip())
        if not m: continue
        k, msg = m.group(1), m.group(2)
        if k in ('PASS', 'ok  '): res['pass'].append(msg)
        elif k == 'FAIL': res['fail'].append(msg)
        elif k == 'WARN': res['warn'].append(msg)
        elif k == 'INFO' and msg.startswith('PERF'): res['perf'].append(msg[5:])
        elif k == 'INFO': res['info'].append(msg)
    if rc != 0 and not res['fail']: res['crash'] = '\n'.join(out.strip().splitlines()[-6:])
    return res
def run_with_retry(path, extra=()):
    r = run_script(path, extra)
    if (r['fail'] or r['crash']) and 'golden' not in path:
        r2 = run_script(path, extra)
        if not (r2['fail'] or r2['crash']): r2['flaky'] = r['fail'][:3] or [r['crash'][-200:]]; return r2
        r['retried'] = True
    return r
results = {}
t_all = time.time()
for suite in want:
    if suite == 'selftest': continue
    print(f'== {suite}', flush=True); results[suite] = []
    scripts = sorted(glob.glob(os.path.join(HERE, suite, '*.mjs')) + glob.glob(os.path.join(HERE, suite, '*.py')))
    for sc in scripts:
        extra = []
        if suite == 'regression' and sc.endswith('golden_numbers.mjs') and a.update_golden: extra = ['--update']
        if a.quick and sc.endswith(('sys_every_screen.py',)): extra = ['--quick']
        if a.quick and sc.endswith('perf_browser.py'): print('   skipped in --quick:', os.path.basename(sc)); continue
        r = run_with_retry(sc, extra); results[suite].append(r)
        flag = 'FAIL' if (r['fail'] or r['crash']) else ('flaky' if r.get('flaky') else 'ok')
        print(f"   {flag:5} {os.path.basename(sc):34} {len(r['pass'])} pass, {len(r['fail'])} fail, {len(r['warn'])} warn  ({r['secs']}s)", flush=True)
    if suite == 'regression' and a.full:
        print('   re-running the whole tests/ folder (4 at a time, failures once more alone) ...', flush=True)
        files = sorted(f for f in glob.glob(os.path.join(ROOT, 'tests', '*')) if re.search(r'(-test\.mjs|ui_test.*\.py)$', f) and a.filter in os.path.basename(f))
        with ThreadPoolExecutor(4) as ex: outs = list(ex.map(lambda f: run_script(f, timeout=300), files))
        redo = [i for i, r in enumerate(outs) if r['fail'] or r['crash'] or r['rc']]
        for i in redo:
            r2 = run_script(files[i], timeout=300)
            if not (r2['fail'] or r2['crash'] or r2['rc']): r2['flaky'] = outs[i]['fail'][:2] or ['failed under load, passed alone']
            outs[i] = r2
        for r in outs:
            if r['rc'] and not r['fail']: r['fail'] = [r['crash'] or 'exit code %d' % r['rc']]
        results[suite] += outs
        bad = [r for r in outs if r['fail']]; print(f'   tests/ folder: {len(outs) - len(bad)}/{len(outs)} files clean, {sum(1 for r in outs if r.get("flaky"))} flaky', flush=True)
# ---------------- self test: do the checks really fail when the app is broken? ----------------
def selftest():
    print('== selftest (breaks a copy of the app on purpose; every break must be caught)', flush=True)
    tmp = tempfile.mkdtemp(prefix='qa-mut-'); out = []
    for d in ('js', 'qa', 'tests'): shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d), ignore=shutil.ignore_patterns('__pycache__', 'reports', 'fixtures', 'receipts'))
    for f in ('sw.js', 'index.html', 'design.css', 'styles.css'): shutil.copy(os.path.join(ROOT, f), tmp)
    MUT = [('core.js', "else if (t.kind === 'expense') add(t.acct, -t.amount);", "else if (t.kind === 'expense') add(t.acct, t.amount);", 'integration/ledger_integrity.mjs', 'an expense adds money instead of taking it'),
           ('tradecalc.js', "p.cost += x.valueHome + fee; addPaid(p, x.paidCur, x.paidAmt); }   // the buying", "p.cost += x.valueHome; addPaid(p, x.paidCur, x.paidAmt); }   // the buying", 'integration/roundtrip_and_trades.mjs', 'buying fee left out of the cost'),
           ('finance.js', "assets = sum(items.filter((i) => i.base > 0).map((i) => i.base));", "assets = sum(items.filter((i) => i.base > 0).map((i) => i.base)) * 1.01;", 'integration/ledger_integrity.mjs', 'net worth overstated by 1 percent'),
           ('finance.js', "net: assets - debts", "net: assets - debts + 5000", 'regression/golden_numbers.mjs', 'net worth off by 5,000 (golden figure moves)'),
           ('sukliCsv.js', "const stats = { added: 0,", "const stats = { added: 0, /*mut*/", None, None)]
    for fn, old, new, script, why in MUT:
        if script is None: continue
        p = os.path.join(tmp, 'js', fn); s = open(p).read()
        if old not in s: out.append((why, None)); continue
        open(p, 'w').write(s.replace(old, new, 1)); env = {**ENV}
        pr = subprocess.run(['node', os.path.join(tmp, 'qa', script), a.csv], cwd=tmp, env=env, capture_output=True, text=True, timeout=120)
        caught = pr.returncode != 0 and 'FAIL' in pr.stdout; out.append((why, caught)); open(p, 'w').write(s)
    # a missing offline-cache entry and a missing file
    sw = os.path.join(tmp, 'sw.js'); s = open(sw).read(); open(sw, 'w').write(s.replace("'js/people.js', ", '', 1))
    pr = subprocess.run(['node', os.path.join(tmp, 'qa/system/sys_static.mjs')], cwd=tmp, env=ENV, capture_output=True, text=True); out.append(('a js file missing from the offline cache', pr.returncode != 0)); open(sw, 'w').write(s)
    os.remove(os.path.join(tmp, 'js', 'quick.js')); pr = subprocess.run(['node', os.path.join(tmp, 'qa/system/sys_static.mjs')], cwd=tmp, env=ENV, capture_output=True, text=True); out.append(('a module the app imports is gone', pr.returncode != 0))
    shutil.rmtree(tmp, ignore_errors=True); rows = []
    for why, c in out: print(f"   {'caught' if c else 'MISSED' if c is False else 'n/a   '}  {why}"); rows.append({'break': why, 'caught': c})
    return rows
st = selftest() if 'selftest' in want else None
if srv: srv.terminate()
# ---------------- report ----------------
def ver():
    try:
        v = open(os.path.join(ROOT, 'js', 'version.js')).read(); g = lambda k: (re.search(k + r'\s*[:=]\s*(\d+)', v) or [0, '?'])[1]; return f"{g('major')}.{g('change')}"
    except Exception: return '?'
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M'); rp = os.path.join(HERE, 'reports'); os.makedirs(rp, exist_ok=True)
tot = {'pass': 0, 'fail': 0, 'warn': 0}; L = []
L += [f'# Sukli QA report', '', f'- App version: **{ver()}**  ·  run: {datetime.datetime.now():%Y-%m-%d %H:%M}  ·  took {time.time() - t_all:.0f} s', f'- Sample data: `{a.csv}`  ·  mode: {"quick" if a.quick else "full"}{" + whole tests/ folder" if a.full else ""}', '']
rows = []
for s, rs in results.items():
    p = sum(len(r['pass']) for r in rs); f = sum(len(r['fail']) + (1 if r['crash'] and not r['fail'] else 0) for r in rs); w = sum(len(r['warn']) for r in rs); fl = sum(1 for r in rs if r.get('flaky'))
    tot['pass'] += p; tot['fail'] += f; tot['warn'] += w; rows.append(f"| {s} | {len(rs)} | {p} | {f} | {w} | {fl} | {'❌ FAIL' if f else '✅ pass'} |")
L += ['## Result: ' + ('❌ **FAILED** — ' + str(tot['fail']) + ' check(s) need attention' if tot['fail'] else '✅ **all checks passed**') + f" ({tot['pass']} passed, {tot['warn']} findings to read)", '', '| Suite | Scripts | Checks passed | Failed | Findings | Flaky | |', '|---|---|---|---|---|---|---|'] + rows + ['']
fails = [(s, r) for s, rs in results.items() for r in rs if r['fail'] or r['crash']]
if fails:
    L += ['## Failures', '']
    for s, r in fails:
        L.append(f"**{r['script']}**" + (' (failed twice)' if r.get('retried') else ''))
        for m in r['fail'][:12]: L.append(f'- ❌ {m}')
        if r['crash'] and not r['fail']: L.append('- ❌ script crashed:\n```\n' + r['crash'] + '\n```')
        L.append(f"  Re-run alone: `{'node ' if r['script'].endswith('.mjs') else 'python3 '}{r['script']}`"); L.append('')
warns = [(s, r, w) for s, rs in results.items() for r in rs for w in r['warn']]
if warns:
    L += ['## Findings (not failures: things a person should look at)', ''] + [f"- ⚠️ {w}  _({r['script']})_" for s, r, w in warns] + ['']
flaky = [(s, r) for s, rs in results.items() for r in rs if r.get('flaky')]
if flaky: L += ['## Flaky (failed once, passed on retry)', ''] + [f"- {r['script']}: {r['flaky'][0][:160]}" for s, r in flaky] + ['']
perf = [(r['script'], p) for rs in results.values() for r in rs for p in r['perf']]
if perf: L += ['## Performance numbers', '', '```'] + [p for _, p in perf] + ['```', '']
if st: L += ['## Self test: are the checks able to fail?', ''] + [f"- {'✅ caught' if x['caught'] else '❌ MISSED'}: {x['break']}" for x in st] + ['']
inf = [(r['script'], i) for rs in results.values() for r in rs for i in r['info']]
if inf: L += ['## Notes', ''] + [f'- {i}' for _, i in inf] + ['']
md = '\n'.join(L); open(os.path.join(rp, f'qa-report-{stamp}.md'), 'w').write(md); open(os.path.join(rp, 'latest.md'), 'w').write(md)
json.dump({'version': ver(), 'when': stamp, 'totals': tot, 'results': results, 'selftest': st}, open(os.path.join(rp, f'qa-report-{stamp}.json'), 'w'), indent=1)
print('\n' + next(l for l in L if l.startswith('## Result'))); print(f"Report: qa/reports/qa-report-{stamp}.md")
sys.exit(1 if tot['fail'] or (st and any(x['caught'] is False for x in st)) else 0)
