import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  [' + str(x)[:260] + ']'))
U = 'http://localhost:8123/'
SEED = """async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
  commit((d)=>{const mk=(cur,ex,w,o)=>stamp({id:uid(),name:cur+' '+w,cur,type:'crypto',open:o,include:true,archived:false,exchange:ex,wallet:w});
    d.accounts.push(mk('USDT','Bybit','Futures',5),mk('USDT','Bybit','Margin',7),mk('BTC','Bybit','Spot',0.5),mk('USDT','Bybit','Spot',9),mk('ETH','Bybit','Margin',1),mk('ETH','Bybit','Spot',2));
    d.accounts.push(stamp({id:'cashjp',name:'Wallet JP',cur:'JPY',type:'cash',open:200000,include:true,archived:false}));
    d.accounts.push(stamp({id:'cashph',name:'Wallet PH',cur:'PHP',type:'cash',open:50000,include:true,archived:false}));
    d.accounts.push(stamp({id:'homerjp',name:'Homer',person:'Homer',cur:'JPY',type:'loan',open:-10000,include:true,archived:false}));
    d.accounts.push(stamp({id:'margejp',name:'Marge',person:'Marge',cur:'JPY',type:'loan',open:-5000,include:true,archived:false}));
    d.settings.rates=d.settings.rates||{}; Object.assign(d.settings.rates,{BTC:5600000,ETH:200000,USDT:58,JPY:0.4});
  });}"""
for design in ('theme1', 'legacy'):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
        pg.evaluate("async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}", design); pg.evaluate(SEED); pg.wait_for_timeout(300); n = design + ': '
        # 2: currency change keeps the person
        pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',debt:true,flow:'borrow',acctTouched:true,acct:'homerjp',toAcct:'cashjp',amount:'100'}})}"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
        pg.evaluate("c=>{const e=document.querySelector('#f-cur');e.value=c;e.dispatchEvent(new Event('change',{bubbles:true}))}", 'PHP'); pg.wait_for_timeout(500)
        ok(n + 'warning before adding PHP under Homer', pg.locator('.confirm-text').count() == 1 and 'Homer' in pg.locator('.confirm-text').inner_text(), pg.locator('.confirm-text').all_inner_texts())
        pg.click('[data-yes]'); pg.wait_for_timeout(700)
        info = pg.evaluate("async()=>{const c=await import('/js/core.js'),d=c.get();const h=d.accounts.filter(a=>!a.deleted&&a.name==='Homer');return {h:h.map(a=>a.cur).sort().join(),m:d.accounts.filter(a=>!a.deleted&&a.name==='Marge').length,cur:document.querySelector('#f-cur').value}}")
        ok(n + 'Homer now has JPY+PHP, Marge untouched, currency is PHP %s' % info, info['h'] == 'JPY,PHP' and info['m'] == 1 and info['cur'] == 'PHP')
        pg.evaluate("c=>{const e=document.querySelector('#f-cur');e.value=c;e.dispatchEvent(new Event('change',{bubbles:true}))}", 'JPY'); pg.wait_for_timeout(500)
        ok(n + 'switching back to JPY: no warning, still Homer', pg.locator('.confirm-text').count() == 0)
        pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove());document.body.classList.remove('noscroll')")
        # 1: add person from the picker
        pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',debt:true,flow:'borrow',acct:'homerjp',toAcct:'cashjp',amount:'100'}})}"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelectorAll('[data-e=acctpick]').forEach(e=>e.dataset.x='1')")
        ok(n + 'the Debt/Lent form still renders', pg.locator('#f-amount').count() == 1)
        pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove());document.body.classList.remove('noscroll')")
        # 4: coin picker order
        pg.goto(U + '#/home'); pg.wait_for_timeout(500)
        pg.evaluate("async()=>{const m=await import('/js/trades.js');m.openTrade({platform:'Bybit'})}"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(400)
        W = ['Spot', 'Margin', 'Futures', 'Options', 'Earn', 'Funding', 'ETF', 'TradFi', 'Other']
        if design == 'theme1':
            pg.click('#tile-a'); pg.wait_for_selector('.tr-pick .tr-prow'); pg.wait_for_timeout(300)
            subs = pg.evaluate("[...document.querySelectorAll('.tr-pick .tr-psec:first-of-type .tr-prow small')].map(x=>x.textContent).filter(t=>!t.includes('≈'))")
        else:
            subs = pg.evaluate("[...document.querySelectorAll('#tr [name=asset] optgroup')].filter(g=>/Bybit/.test(g.label)).flatMap(g=>[...g.children].map(o=>o.textContent))")
        idx = [next((i for i, w in enumerate(W) if w in t), 99) for t in subs]
        ok(n + 'coins are ordered Spot, Margin, Futures, then the rest %s' % subs[:8], len(subs) >= 6 and idx == sorted(idx), subs)
        pg.keyboard.press('Escape'); pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
        # 5: selector styles
        pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
        pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
        for sty, sel in (('tabs', '.dsel-tabs'), ('chips', '.dsel-chips'), ('drop', '.dsel-drop'), ('tiles', '.dsel-tiles'), ('seg', '.t1seg, .segm')):
            pg.evaluate("s=>localStorage.setItem('sukli-look',JSON.stringify({dsel:s}))", sty); pg.reload(); pg.wait_for_timeout(600); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
            ok(n + 'style %s renders' % sty, pg.locator(sel).count() >= 1, pg.locator('.dstybar').count())
        pg.evaluate("localStorage.setItem('sukli-look',JSON.stringify({dsel:'tabs'}))"); pg.reload(); pg.wait_for_timeout(600); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
        pg.locator('.dsel-i').nth(1).click(); pg.wait_for_timeout(500)
        ok(n + 'picking a tab switches the section', pg.locator('.dsel-i.on').count() == 1 and pg.locator('[data-dsec="i-tok"], [data-sec="i-tok"]').count() >= 1)
        # 6: accounts header
        pg.goto(U + '#/accounts'); pg.wait_for_timeout(800)
        ok(n + 'Add account sits in the header beside the eye', pg.locator('header.top .hdr-add').count() == 1 and pg.locator('.actrow .hdr-add').count() == 0)
        ok(n + 'Investments is a distinct nav jump', pg.locator('.actrow .navjump.nj-inv').count() == 1)
        ok(n + 'no horizontal overflow', pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"))
        ok(n + 'no script errors', not errs, errs[:2])
        b.close()
print('%d/%d' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
