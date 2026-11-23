from playwright.sync_api import sync_playwright
from tests.invnavhelp import go_invest
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
import re
def num(t):
    m=re.search(r'([−-])?₱\s*([\d,]+\.\d+)',t); v=float(m.group(2).replace(',','')); return -v if m.group(1) else v
with sync_playwright() as p:
    b=p.chromium.launch()
    for d in ('theme1','legacy'):
        c=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(700)
        if d=='legacy': pg.evaluate("localStorage.setItem('sukli-look', JSON.stringify({design:'legacy'}))"); pg.reload(); pg.wait_for_timeout(1500)
        n=d+': '
        pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(1500)
        # 1. arrow hit area: tap exactly on the arrow
        res=pg.evaluate("(()=>{const ch=document.querySelector('.collrow .collhead .chev'),bt=ch.closest('.collhead'),r=ch.getBoundingClientRect(),b=bt.getBoundingClientRect();return {inside:r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom,x:r.left+r.width/2,y:r.top+r.height/2}})()")
        ok(n+'collapsible arrow sits inside its button', res['inside'])
        h0=pg.evaluate("document.elementFromPoint(%f,%f).closest('.collhead')!=null"%(res['x'],res['y']))
        ok(n+'a tap on the arrow lands on the collapsible button', h0)
        # 4. Investments button
        ok(n+'Investments button at the top of Accounts', pg.locator('a[href="#/invest"]:has-text("Investments")').count()>=1)
        if d=='theme1':
            t=pg.inner_text('.nwcard')
            ok(n+'Net worth card has Assets: and Debts: rows', 'Assets:' in t and 'Debts:' in t)
            a=num(t[t.index('Assets:'):]); db_=num(t[t.index('Debts:'):]); nw=num(t)
            ok(n+'Net worth = Assets - Debts (%s - %s = %s)'%(a,db_,nw), abs(a-db_-nw)<0.02)
            hh=pg.evaluate("document.querySelector('.nwcard').getBoundingClientRect().height")
            ok(n+'card is slim (%d px)'%hh, hh<=130)
        else: ok(n+'legacy keeps its own card', pg.locator('.nwcard.t1nw').count()==0)
        # 2/10. back navigation
        pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(300); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(1200)
        pg.evaluate("async()=>{const m=await import('/js/invnav.js');m.INV.sec='overview';m.INV.cat='';window.dispatchEvent(new Event('sukli-render'))}"); pg.wait_for_timeout(300)
        pg.click('.tabs a:has-text("Accounts")'); pg.wait_for_timeout(500); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('[data-sec^=\"ia-crypto-\"] > .collrow .collhead').click()"); pg.wait_for_timeout(300); pg.locator('[data-sec^="ia-crypto-"] [data-act=inv-plat]:visible').first.click(); pg.wait_for_timeout(700)
        ok(n+'platform opens', pg.locator('.platpage').count()==1)
        if d=='theme1':
            ok(n+'platform has a back button', pg.locator('.invpage [data-act=nav-back], header [data-act=nav-back]').count()>=1)
            pg.click('[data-act=nav-back]'); pg.wait_for_timeout(700)
        else:
            pg.go_back(); pg.wait_for_timeout(700)
        ok(n+'back from a platform returns to the category sections, not Accounts', pg.locator('.invacc').count()==1 and pg.url.endswith('#/invest'))
        pg.go_back(); pg.wait_for_timeout(600)
        ok(n+'back again returns to the Overview', pg.locator('.invacc').count()==0 and pg.url.endswith('#/invest'))
        pg.go_back(); pg.wait_for_timeout(700)
        ok(n+'only then does it leave Investments', pg.url.endswith('#/accounts'))
        # platform page layout
        go_invest(pg,None,wait=1500)
        t=pg.inner_text('.platpage')
        ok(n+'no wallet counts', not re.search(r'\d+ wallets?\b',pg.inner_text('.ivplat')))
        ok(n+'no drag instruction', 'Touch and drag' not in t)
        lay=pg.evaluate("""(()=>{const h=document.querySelector('.holdhead'),a=h.querySelector('.invh').getBoundingClientRect(),s=h.querySelector('.holdset').getBoundingClientRect();const rg=[...document.querySelectorAll('.invrg > *')].map(e=>Math.round(e.getBoundingClientRect().top));return {same:Math.abs((a.top+a.bottom)/2-(s.top+s.bottom)/2)<6,right:s.left>a.right,sh:s.height,fs:parseFloat(getComputedStyle(h.querySelector('.invh')).fontSize),rg:new Set(rg).size}})()""")
        ok(n+'Platform Settings is opposite Holdings and short %s'%lay, lay['same'] and lay['right'] and lay['sh']<=34 and lay['fs']>=17)
        ok(n+'1M 3M 1Y All are on one row', lay['rg']==1)
        ok(n+'no page errors %s'%errs, not errs); c.close()
