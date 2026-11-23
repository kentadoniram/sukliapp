# v16.24: the app opens with no internet and on a connection that hangs (service worker: per-file install, timeout fallback to the saved copy)
import sys, time
from playwright.sync_api import sync_playwright
U='http://localhost:8123/'; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+('' if c else '  ['+str(x)[:200]+']'))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(U); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(2500)
    ok('the service worker installs and takes over', pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"))
    n=pg.evaluate("caches.keys().then(async k=>{let n=0;for(const x of k){n+=(await (await caches.open(x)).keys()).length}return n})")
    ok('the app files are saved for offline use (%s)'%n, n>=60, n)
    ctx.set_offline(True)
    for path in ('', '#/invest', '#/accounts'):
        t=time.time(); q=ctx.new_page(); q.goto(U+path)
        try: q.wait_for_selector('#view',timeout=8000); q.wait_for_timeout(800); L=q.evaluate("document.querySelector('#view').innerText.length"); ok('offline: %s opens with content'%(path or 'home'), L>50 and time.time()-t<6, L)
        except Exception as e: ok('offline: %s opens'%(path or 'home'), False, e)
        q.close()
    ctx.set_offline(False)
    ctx.route('**/*', lambda r: None)   # a connection that never answers
    t=time.time(); q=ctx.new_page()
    try: q.goto(U+'#/home', timeout=20000, wait_until='commit'); q.wait_for_selector('#view',timeout=20000); d=time.time()-t; ok('a hanging connection still opens the app quickly (%.1fs)'%d, d<9, d)
    except Exception as e: ok('hanging connection opens the app', False, e)
    ctx.unroute('**/*'); ok('no errors', not errs, errs[:2]); b.close()
print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
