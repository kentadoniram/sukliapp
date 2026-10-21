from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
U='http://localhost:8123/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto(U); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    def last_label():
        pg.fill('#q','o'); pg.wait_for_timeout(400)
        return pg.evaluate("(()=>{const r=[...document.querySelectorAll('#ledger-list .row .tt')];return r.length?r[0].textContent:''})()")
    def new_entry(name, frm='', to=''):
        pg.goto(U+'#/home'); pg.wait_for_timeout(500); pg.click('.fab'); pg.wait_for_selector('#entry')
        pg.fill('#f-amount','30'); 
        if name: pg.type('#f-name',name,delay=30)
        pg.wait_for_timeout(300)
        if frm: pg.fill('#f-from',frm); pg.dispatch_event('#f-from','change')
        if to: pg.fill('#f-to',to); pg.dispatch_event('#f-to','change')
        pg.wait_for_timeout(300)
        pg.click('[data-e=save]'); pg.wait_for_timeout(700)
    new_entry('bus','One Ayala','San Pedro'); pg.goto(U+'#/ledger'); pg.wait_for_timeout(500)
    ok('Bus: From - To', last_label()=='Bus: One Ayala - San Pedro')
    new_entry('train'); pg.goto(U+'#/ledger'); pg.wait_for_timeout(500)
    ok('Train Commute', last_label()=='Train Commute')
    # choose suggested category chip keeps label
    pg.goto(U+'#/home'); pg.wait_for_timeout(400); pg.click('.fab'); pg.wait_for_selector('#entry'); pg.type('#f-name','bus',delay=40); pg.wait_for_timeout(300)
    pg.locator('[data-e=cat].guess').first.click(); pg.wait_for_timeout(300)
    ok('label kept after tapping suggested category', pg.input_value('#f-name')=='bus')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto(U+'#/home'); pg.wait_for_timeout(1200)
    ok('projected card', 'Spending vs expected income' in pg.inner_text('#view') and pg.locator('svg[aria-label*="expected income"]').count()==1)
    box=pg.locator('.wentpie svg').first.bounding_box(); print(box); ok('pie big enough', box['width']>=170)
    pg.screenshot(path='/tmp/proj.png', full_page=False)
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
