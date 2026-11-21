# v12aa: investment accounts first in the transfer pickers; the search box and currency chips never move
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw,vh in ((390,844),(320,640),(1100,800)):
        pg=b.new_page(viewport={'width':vw,'height':vh},service_workers='block'); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
        pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{d.accounts.push(m.stamp({id:'iv1',name:'Bybit USDT',cur:'USDT',type:'crypto',open:5,include:false,archived:false,exchange:'Bybit',wallet:'Spot',invtab:true}),m.stamp({id:'iv2',name:'Binance BTC',cur:'BTC',type:'crypto',open:1,include:false,archived:false,exchange:'Binance',wallet:'Spot',invtab:true}))})})()""")
        pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(500)
        pg.evaluate("""(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'iv1'}})})()""")
        pg.wait_for_selector('[data-which=acct]'); pg.click('[data-which=acct]'); pg.wait_for_selector('#aclist h3')
        pg.click('[data-chip=""]'); pg.wait_for_timeout(200)
        heads=pg.evaluate("[...document.querySelectorAll('#aclist h3')].map(h=>h.textContent)")
        first_non_inv=next((i for i,h in enumerate(heads) if not ('·' in h and h.split(' · ')[0] in ('Bybit','Binance'))),99)
        ok(f'[{vw}] investment groups come first', len(heads)>=3 and all(('·' in h) for h in heads[:2]) and first_non_inv>=2)
        order=[h for h in heads[first_non_inv:]]
        want=['Bank','Cash','E-wallet / card balance']
        idx=[order.index(w) for w in want if w in order]
        ok(f'[{vw}] then banks, cash, e-wallets in that order', idx==sorted(idx) and len(idx)>=2)
        # chips and search stay put
        def pos(): return pg.evaluate("(()=>{const a=document.querySelector('#acq').getBoundingClientRect(),c=document.querySelector('.acchips').getBoundingClientRect(),s=document.querySelector('.sheet.pickfix').getBoundingClientRect();return [Math.round(a.top),Math.round(c.top),Math.round(s.top),Math.round(s.height)]})()")
        p0=pos(); chips=pg.locator('[data-chip]'); n=chips.count(); same=True
        for i in range(min(n,6)):
            chips.nth(i).click(); pg.wait_for_timeout(120); same = same and pos()==p0
        pg.fill('#acq','zzzz-nothing'); pg.wait_for_timeout(150); same = same and pos()==p0
        pg.fill('#acq','b'); pg.wait_for_timeout(150); same = same and pos()==p0
        ok(f'[{vw}] search box, chips and sheet do not move (chips: {n})', same)
        ok(f'[{vw}] the list itself scrolls', pg.evaluate("(()=>{const l=document.querySelector('#aclist');return getComputedStyle(l).overflowY==='auto'})()"))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        ok(f'[{vw}] no page errors', not errs); print(errs[:2])
        pg.close()
    b.close()
print('SUMMARY', sum(res), '/', len(res)); raise SystemExit(0 if all(res) else 1)
