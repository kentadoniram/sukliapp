"""Shared helpers for the browser QA checks (Playwright). Prints PASS/FAIL/WARN/INFO lines the runner counts."""
import os, re, sys, json, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get('QA_URL', 'http://localhost:8123/')
CSV = os.environ.get('QA_CSV', '/home/claude/Transactions.csv')
res = []
def ok(name, cond, extra=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
def warn(name): print('WARN ' + name)
def info(name): print('INFO ' + name)
def finish():
    bad = res.count(False); print(f'SUMMARY {len(res)-bad}/{len(res)}'); sys.exit(1 if bad else 0)
IGNORE = ('ERR_TUNNEL', 'Failed to load resource', 'open.er-api', 'ERR_NAME_NOT_RESOLVED', 'ERR_CONNECTION', 'tile.openstreetmap', 'ERR_INTERNET', 'net::ERR', 'favicon')
class Page:
    """A page plus everything that went wrong on it: script errors, console errors, own-site 404s."""
    def __init__(self, ctx):
        self.pg = ctx.new_page(); self.errs = []; self.bad404 = []
        self.pg.on('pageerror', lambda e: self.errs.append('pageerror: ' + str(e)[:300]))
        self.pg.on('console', lambda m: self.errs.append('console: ' + m.text[:300]) if m.type == 'error' and not any(s in m.text for s in IGNORE) else None)
        self.pg.on('response', lambda r: self.bad404.append(r.url) if r.status >= 400 and r.url.startswith(URL) and not (_NO_VENDOR and '/vendor/' in r.url) else None)   # the vendor folder (coin logos, map) is not part of the test copy
    def take(self):
        e, b = self.errs[:], self.bad404[:]; self.errs.clear(); self.bad404.clear(); return e, b
import os as _os
_NO_VENDOR = not _os.path.isdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'vendor'))
def new_ctx(p, w=402, h=874, touch=True, scheme='light'):
    return p.chromium.launch().new_context(viewport={'width': w, 'height': h}, locale='en-US', timezone_id='Asia/Tokyo', service_workers='block', color_scheme=scheme, has_touch=touch, is_mobile=w < 600)
def boot_csv(P, csv=CSV):
    """First run with the sample CSV, as a user would: pick the file, accept the setup screen."""
    pg = P.pg; pg.goto(URL + 'index.html'); pg.wait_for_selector('#first-file', state='attached')
    pg.set_input_files('#first-file', csv); pg.wait_for_selector('#setup', timeout=30000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
def boot_empty(P):
    pg = P.pg; pg.goto(URL + 'index.html'); pg.wait_for_selector('.welcome, #view', timeout=15000); pg.wait_for_timeout(400)
def route_names():
    s = open(os.path.join(ROOT, 'js', 'app.js')).read(); m = re.search(r'const routes = \{(.*?)\};\n', s, re.S)
    names = []
    for part in re.split(r',\s*(?![^()]*\))', m.group(1)):
        k = part.split(':')[0].strip()
        if re.match(r'^[a-z]+$', k): names.append(k)
    return names
BADTEXT = re.compile(r'\bNaN\b|\bundefined\b|\bInfinity\b|\[object |Invalid Date|\bnull\b(?!\s*[:,])')
def text_problems(pg):
    t = pg.inner_text('body')
    return sorted(set(m.group(0) for m in BADTEXT.finditer(t)))
def overflow(pg):
    return pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
def open_all(pg):
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); pg.wait_for_timeout(150)
def set_look(pg, **kw):
    pg.evaluate("async (k)=>{const m=await import('/js/appearance.js');m.setLook(k)}", kw); pg.wait_for_timeout(150)
def set_mode(pg, mode):
    pg.evaluate("async (m)=>{const c=await import('/js/core.js');c.commitQuiet(d=>{d.settings.mode=m})}", mode); pg.wait_for_timeout(150)
