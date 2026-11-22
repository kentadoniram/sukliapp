"""SYSTEM TEST: open every screen (and every Investments section) in each look and screen size with real imported data.
Fails on: script errors, console errors, own-site 404s, NaN/undefined/Infinity/[object]/Invalid Date text, sideways scroll, a blank screen."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qahelp import *
QUICK = '--quick' in sys.argv
CONFIGS = [('Theme 1 light, phone 402', dict(w=402), dict(design='theme1', theme='light'), 'advanced'),
           ('Theme 1 dark, phone 402', dict(w=402, scheme='dark'), dict(design='theme1', theme='dark'), 'advanced'),
           ('Legacy light, phone 402', dict(w=402), dict(design='legacy', theme='light'), 'advanced'),
           ('Theme 1 light, small phone 320', dict(w=320, h=640), dict(design='theme1', theme='light', size='xl'), 'advanced'),
           ('Theme 1 light, Simple mode', dict(w=402), dict(design='theme1', theme='light'), 'simple'),
           ('Theme 1 light, tablet 820', dict(w=820, h=1100, touch=False), dict(design='theme1', theme='light'), 'advanced')]
if QUICK: CONFIGS = CONFIGS[:2]
routes = [r for r in route_names() if r not in ('styleguide', 'modelguide')]
with sync_playwright() as p:
    for label, vp, look, mode in CONFIGS:
        ctx = new_ctx(p, **vp); P = Page(ctx); pg = P.pg
        boot_csv(P); set_look(pg, **look); set_mode(pg, mode); P.take()
        bad = []; n = 0
        for r in routes:
            pg.goto(URL + f'index.html#/{r}'); pg.wait_for_timeout(500); open_all(pg); n += 1
            errs, b404 = P.take(); txt = text_problems(pg); ov = overflow(pg)
            blank = len(pg.inner_text('#view').strip()) < 5
            if errs or b404 or txt or ov > 1 or blank: bad.append(f'{r}: ' + '; '.join(filter(None, [errs[0] if errs else '', ('404 ' + b404[0]) if b404 else '', 'text ' + ','.join(txt) if txt else '', f'sideways scroll {ov}px' if ov > 1 else '', 'blank' if blank else ''])))
        ok(f'[{label}] {n} screens open with no errors, no NaN/undefined text, no sideways scroll', not bad, ' | '.join(bad[:4]))
        # Investments sections
        bad = []
        for sec in ('overview', 'platform', 'calendar', 'accounts'):
            pg.goto(URL + 'index.html#/home'); pg.wait_for_timeout(200)
            pg.evaluate("async (s)=>{const m=await import('/js/invnav.js');m.setSec(s)}", sec); pg.goto(URL + 'index.html#/invest'); pg.wait_for_timeout(700)
            pg.evaluate("async (s)=>{const m=await import('/js/invnav.js');m.setSec(s)}", sec); pg.wait_for_timeout(500); open_all(pg)
            errs, b404 = P.take(); txt = text_problems(pg); ov = overflow(pg)
            if errs or b404 or txt or ov > 1: bad.append(f'{sec}: ' + '; '.join(filter(None, [errs[0] if errs else '', ','.join(txt), f'scroll {ov}px' if ov > 1 else ''])))
        ok(f'[{label}] Investments sections open clean', not bad, ' | '.join(bad[:3]))
        ctx.close()
        if QUICK: pass
    # a brand-new app with no data at all must also open every screen without errors
    for scheme, vp in (('light', dict(w=402)),):
        ctx = new_ctx(p, **vp); P = Page(ctx); pg = P.pg; boot_empty(P); P.take(); bad = []
        for r in routes:
            pg.goto(URL + f'index.html#/{r}'); pg.wait_for_timeout(350); errs, b404 = P.take(); txt = text_problems(pg)
            if errs or b404 or txt or overflow(pg) > 1: bad.append(f'{r}: ' + '; '.join(filter(None, [errs[0] if errs else '', ','.join(txt)])))
        ok('[empty app, no data] every screen opens with no errors or NaN/undefined text', not bad, ' | '.join(bad[:4]))
        ctx.close()
finish()
