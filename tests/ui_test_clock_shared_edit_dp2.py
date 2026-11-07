# v13.51 (setup copied): 48: a shared (Paid for others) bill is ONE bill: opening, editing and deleting any part works on the whole bill
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';const home=d.settings.homeCur||'PHP';d.accounts.push(c.stamp({id:'w1',name:'Wallet One',cur:home,type:'cash',open:5000,include:true,archived:false}));for(const [i,n] of [['pa','Ana'],['pb','Ben']])d.accounts.push(c.stamp({id:i,name:n,cur:home,type:'owed',open:0,include:true,archived:false}))})")
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.fill('#f-what','Team Dinner'); pg.evaluate("(()=>{const e=document.querySelector('#f-acct');e.value='w1';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.fill('#f-amount','900'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.locator('.oth-who').nth(0).select_option('pa'); pg.locator('.oth-who').nth(1).select_option('pb'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(1200)
    mem=lambda: J("return c.get().txs.filter(t=>!t.deleted&&t.splitId).map(t=>[t.id,t.kind,t.amount,t.date,t.cat])")
    lent=[x for x in mem() if x[1]=='transfer'][0][0]
    J("const s=await import('/js/entryview.js');s.openEntryView('%s')"%lent); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-ev=edit]').click()"); pg.wait_for_selector('[data-sb=datepick]'); pg.wait_for_timeout(300)
    wd=pg.evaluate("(()=>{const b=document.querySelector('[data-sb=datepick]').getBoundingClientRect(),n=document.querySelector('[data-sb=name]').getBoundingClientRect();return [Math.round(b.right),Math.round(n.right),Math.round(b.left),Math.round(n.left)]})()")
    ok('date box is as wide as the other boxes %s'%wd, abs(wd[0]-wd[1])<=2 and abs(wd[2]-wd[3])<=2)
    # time + analog clock
    pg.evaluate("document.querySelector('[data-sb=datepick]').click()"); pg.wait_for_selector('#dp'); pg.wait_for_timeout(200)
    ok('date picker has hour and minute lists', pg.locator('#dp-h').count()==1 and pg.locator('#dp-m').count()==1)
    pg.evaluate("document.querySelector('#dp [data-clock]').click()"); pg.wait_for_selector('#dp .dpface'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelectorAll('.toast').forEach(x=>x.remove())"); pg.locator('#dp .dpface').scroll_into_view_if_needed(); pg.wait_for_timeout(200); box=pg.locator('#dp .dpface').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']/2; rr=box['width']*0.38
    pg.mouse.click(cx+rr, cy)    # 3 o'clock on the face
    pg.wait_for_timeout(200); ok('tapping 3 on the clock sets the hour to 3 or 15', pg.evaluate("+document.querySelector('#dp-h')?.value||0") in (3,15) or pg.inner_text('#dp .dpcbig').strip()=='03')
    pg.mouse.click(cx, cy+rr)    # 30 minutes (bottom)
    pg.wait_for_timeout(200); ok('then tapping the bottom sets the minute to 30', pg.locator('#dp .dpcbig').nth(1).inner_text().strip()=='30')
    pg.evaluate("document.querySelector('#dp [data-ap=pm]').click()"); pg.wait_for_timeout(150)
    pg.evaluate("document.querySelector('#dp [data-ok]').click()"); pg.wait_for_timeout(300)
    ok('date button shows the clock time', '15:30' in pg.inner_text('[data-sb=datepick]'))
    # my own share is editable (whole bill = my share + others)
    pg.evaluate("document.querySelector('[data-sb=mode][data-v=amount]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const e=document.querySelector('[data-sb=mine]');e.value='100';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(200)
    tot=pg.input_value('[data-sb=total]'); ok('typing Your Part 100 makes the bill 100 + 600 = 700 (%s)'%tot, abs(float(tot)-700)<0.01)
    pg.evaluate("document.querySelector('[data-sb=save]').click()"); pg.wait_for_timeout(600)
    m=mem(); mine=[x for x in m if x[1]=='expense'][0]
    ok('saved: my part 100, time 15:30 on every part %s'%m, abs(mine[2]-100)<0.01 and all('15:30' in x[3] for x in m))
    # Paid for Others box sizes: name bigger than before, amount shorter
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.fill('#f-amount','500'); pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=amount]').click()"); pg.wait_for_selector('.oth-n',state='attached')
    hs=pg.evaluate("[Math.round(document.querySelector('.oth-who').getBoundingClientRect().height),Math.round(document.querySelector('.oth-n').getBoundingClientRect().height),Math.round(document.querySelector('.oth-who').getBoundingClientRect().width),Math.round(document.querySelector('.oth-n').getBoundingClientRect().width)]")
    ok('name box is taller and wider than amount box %s'%hs, hs[0]>hs[1] and hs[2]>hs[3])
    # Entries list: asset change lines show at most 2 decimals (coin balance has many)
    J("c.commit(d=>{d.accounts.push(c.stamp({id:'wu2',name:'Coin Wallet',cur:'USDT',type:'cash',open:10.123456,include:true,archived:false}));d.txs.push(c.stamp({id:'cx1',kind:'expense',date:'2026-11-05 10:00:00',name:'Coin Spend',amount:1.123456,cur:'USDT',fx:1,acct:'wu2'}))})")
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(1200)
    bal=pg.evaluate("[...document.querySelectorAll('small.bal .bv')].map(x=>x.textContent).filter(x=>/USDT|₮|\\$/.test(x)||true).join(' | ')")
    import re
    dec=[len(m.split('.')[1]) for m in re.findall(r'\d+\.\d+',bal)]
    ok('Entries asset changes have at most 2 decimals (%s)'%bal[:120], dec and max(dec)<=2)
    ok('no errors %s'%errs, not errs)
    b.close()
print('SUMMARY',sum(res),'passed',len(res)-sum(res),'failed')
