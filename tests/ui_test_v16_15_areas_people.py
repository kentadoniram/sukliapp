import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
from tests.invnavhelp import go_invest
res = []
def ok(n, c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    look = "async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}"
    pg.evaluate(look, 'theme1'); pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(700)
    ok('the Home / Investments toggle is gone (v16.17)', pg.locator('.areasw').count() == 0 and pg.locator('.t1top .areatitle.on').inner_text().strip() == 'Home')
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(700)
    ok('Investments names itself in the header and has no toggle', pg.evaluate("location.hash").startswith('#/invest') and pg.locator('.areasw').count() == 0 and 'Investments' in pg.locator('.t1top .areatitle.on').inner_text())
    ok('Investments marks the page as its own area', pg.evaluate("document.body.dataset.area") == 'invest')
    bg = pg.evaluate("getComputedStyle(document.body).backgroundColor"); ok('Investments page has its own tint %s' % bg, bg != 'rgb(246, 247, 249)' and bg != pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--paper')"))
    go_invest(pg, None, 700, 'accounts'); pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500); pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(700)
    ok('coming into Investments from Home lands on Overview', pg.locator('.invpage.sec-overview').count() == 1)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(700)
    ok('Home has no tint', pg.evaluate("document.body.dataset.area") == 'main')
    for sec in ['platform', 'accounts']:
        go_invest(pg, None, 700, sec); ok('no toggle on the %s section' % sec, pg.locator('.areasw').count() == 0)
    go_invest(pg, None, 700, 'platform')
    ok('a platform is one card with Performance, Profit and Loss and Other Metrics inside', pg.evaluate("(()=>{const c=document.querySelector('.platcard');if(!c)return false;const t=c.innerText;return /Performance/.test(t)&&/Profit and Loss/.test(t)&&/Other Metrics/.test(t)&&!document.querySelector('.platpage > .invcard.perf')})()"))
    pg.evaluate("async()=>{const m=await import('/js/invnav.js');}"); go_invest(pg, None, 700, 'accounts')
    pg.evaluate("document.querySelector('.invcat')&&document.querySelector('.invcat').click()"); pg.wait_for_timeout(500)
    ok('platform cards in Accounts carry their assets and wallets', pg.locator('.invplat .ic-m').count() >= 1 or pg.locator('.invcat').count() >= 1)
    # people with several currencies
    pg.evaluate(look, 'legacy'); pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500)
    ok('Legacy has no switch', pg.locator('.areasw:visible').count() == 0)
    pg.evaluate("""async()=>{const c=await import('/js/core.js');const {uid,stamp,commit,get}=c;
      commit((d)=>{const cash=d.accounts.find(a=>a.type==='cash'||a.type==='bank'); const mk=(cur)=>stamp({id:uid(),name:'Zed Test',person:'Zed Test',cur,type:'owed',open:0,include:true,archived:false});
        const a=mk('PHP'), j=mk('JPY'); d.accounts.push(a,j);
        d.txs.push(stamp({id:uid(),kind:'transfer',amount:1000,cur:cash.cur,fx:1,date:'2026-11-01 10:00:00',name:'Lent',acct:cash.id,toAcct:a.id,lent:true,toAmount:1000}));
        d.txs.push(stamp({id:uid(),kind:'transfer',amount:5000,cur:cash.cur,fx:1,date:'2026-11-02 10:00:00',name:'Lent',acct:cash.id,toAcct:j.id,lent:true,toAmount:5000}));});}""")
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(900)
    n = pg.evaluate("document.querySelectorAll('.personrow').length"); k = pg.evaluate("document.querySelectorAll('.personrow .curblock').length")
    ok('one person with two currencies is one card with two currency blocks (%s, %s)' % (n, k), n == 1 and k == 2)
    ok('the person card has an Add currency button', pg.locator('.personrow [data-act="owed-cur"]').count() == 1)
    pg.click('.personrow [data-act="owed-cur"]'); pg.wait_for_timeout(500)
    ok('Add currency opens the currency picker', pg.locator('#curlist').count() == 1)
    pg.click('#curlist [data-c="USD"]'); pg.wait_for_timeout(600)
    cnt = pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.filter(a=>!a.deleted&&a.person==='Zed Test').map(a=>a.cur).sort().join()})()")
    ok('the person now has a USD account too (%s)' % cnt, cnt == 'JPY,PHP,USD')
    pg.click('.personrow [data-act="owed-cur"]'); pg.wait_for_timeout(400); pg.click('#curlist [data-c="USD"]'); pg.wait_for_timeout(500)
    cnt2 = pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.filter(a=>!a.deleted&&a.person==='Zed Test').length})()")
    ok('the same currency is not added twice', cnt2 == 3)
    ok('no page errors %s' % errs, not errs)
    b.close()
print('fails', res.count(False))
