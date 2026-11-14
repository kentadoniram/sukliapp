# v15.34: New Entry reads a typed name like the Wallet screenshot does: chain word gives the merchant, the rest the branch
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{(await import('/js/entry.js')).openEntry({})})()"); pg.wait_for_selector('#f-what',timeout=5000)
    pg.fill('#f-what','Lawson Kawasaki'); pg.wait_for_timeout(600)
    t=pg.inner_text('#merchrow')
    ok('merchant Lawson suggested %r'%t, 'Lawson' in t)
    ok('branch Kawasaki suggested %r'%t, 'Kawasaki' in t)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
