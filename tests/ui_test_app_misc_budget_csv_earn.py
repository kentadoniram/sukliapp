# First run, budget, backup, receipts, card periods, CSV round trip (one browser and one imported CSV; merged from ui_test30.py, ui_test31.py, ui_test54.py, ui_test55.py, ui_test79.py, ui_test82.py, ui_test85.py).
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)

from pkhelp import choose, open_menu
import json
import os

def part0(p,b,ctx,pg,errs):
    # Budget setup + alerts, input history, transfer form layout, opening balance in history, card toggle without redraw
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    # --- budget setup
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(600)
    pg.click('[data-act=budget-setup]'); pg.wait_for_selector('#bs')
    ok('setup lists categories with kinds', pg.locator('#bs .bsrow').count()>10 and pg.locator('#bs [data-cls].on').count()>10)
    pg.fill('#bs [name=alert]','50')
    row=pg.locator('#bs .bsrow:has(span:text-is("Dining Out"))').first if pg.locator('#bs .bsrow:has(span:text-is("Dining Out"))').count() else pg.locator('#bs .bsrow:has-text("Dining Out")').first
    pg.evaluate("document.querySelectorAll('#bs details').forEach(d=>d.open=true)")
    row.locator('[data-on]').check(); row.locator('[data-amt]').fill('100'); row.locator('[data-cls=want]').click()
    gro=pg.locator('#bs .bsrow:has-text("Grocery")').first; gro.locator('[data-on]').check(); gro.locator('[data-amt]').fill('100000'); gro.locator('[data-cls=need]').click()
    pg.click('#bs .btn:not(.ghost)'); pg.wait_for_timeout(600)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const c=d.categories.find(x=>!x.deleted&&x.name==='Dining Out'),a=d.accounts.find(x=>!x.deleted&&x.cur===m.HOME);d.txs.push(m.stamp({id:'dine1',kind:'expense',date:m.nowStamp(),name:'Test dinner',amount:500,cur:a.cur,fx:1,acct:a.id,cat:c.id,createdAt:Date.now()}));});})()""")
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(500)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(500); t=pg.inner_text('#view')
    ok('budget tab warns about the over-budget want', 'Dining Out' in t and 'want' in t and 'over budget' in t)
    ok('needs, wants, luxury card', 'Needs, Wants and Luxury' in t and 'Wants' in t and 'Needs' in t)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(700)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(250)
    pg.wait_for_timeout(600); ok('home shows a budget alert', 'Budget alert' in pg.inner_text('#view'))
    # --- opening balance in account history
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(500)
    pg.locator('.row.acct:has(strong:text-is("Wallet"))').first.click(); pg.wait_for_selector('#ad'); pg.wait_for_timeout(300)
    ad=pg.inner_text('#ad'); ok('opening balance shown with its date', 'Opening balance' in ad and 'Oct 18' in ad)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # --- transfer form layout
    pg.click('[data-act=add]'); pg.wait_for_selector('#f-amount'); pg.click('.seg button:has-text("Transfer")'); pg.wait_for_timeout(400)
    g=pg.evaluate("(()=>{const s=document.querySelector('.swapbtn').getBoundingClientRect(),a=document.querySelector('.two.sw .acctbtn').getBoundingClientRect();return [Math.abs((s.top+s.height/2)-(a.top+a.height/2)), document.querySelector('.chips.qpone')? getComputedStyle(document.querySelector('.chips.qpone')).flexWrap:'none']})()")
    ok('swap button centred on the account row', g[0]<=1.5); ok('usual routes in one scrolling line', g[1]=='nowrap')
    # save a transfer with a far-away date through the app model then find it in input history
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const a=d.accounts.find(x=>!x.deleted);d.txs.push(m.stamp({id:'odd1',kind:'expense',date:'2024-01-05 12:00:00',name:'Typo year',amount:123,cur:a.cur,fx:1,acct:a.id,cat:'',createdAt:Date.now()}));});})()""")
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(500); pg.click('[data-act=ih-open]'); pg.wait_for_selector('#ihlist')
    ok('input history lists newest typed first', 'Typo year' in pg.inner_text('#ihlist').split('\n')[1:6].__str__() or 'Typo year' in pg.inner_text('#ihlist')[:400])
    pg.click('[data-act=ih-filter][data-v=odd]'); pg.wait_for_timeout(300); ok('odd dates filter flags it', 'Unusual date' in pg.inner_text('#ihlist') and 'Typo year' in pg.inner_text('#ihlist'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # --- card toggle must not redraw the page (no flicker)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(800)
    pg.evaluate("window.__mark = document.querySelector('#view').firstElementChild")
    pg.click('.collhead >> nth=0'); pg.wait_for_timeout(300)
    same=pg.evaluate("window.__mark === document.querySelector('#view').firstElementChild && window.__mark.isConnected")
    ok('toggling a card keeps the page in place', same)
    ok('no errors', not errs); print(errs[:3])

def part1(p,b,ctx,pg,errs):
    # v12v: first-run guide, 7-day bars, invest + menu, investments block on Accounts, fee rows in Expense filter, Check hint,
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const a=d.accounts.find(x=>!x.deleted&&x.cur===m.HOME),c=d.categories.find(x=>!x.deleted&&x.kind==='expense');d.txs.push(m.stamp({id:'wk1',kind:'expense',acct:a.id,cat:c.id,amount:123,cur:m.HOME,date:m.nowStamp(),name:'week test'}))})})()""")
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(900)
    ok('home shows last 7 days bars', (pg.locator('.week .wk').count()==7 or pg.locator('.week .wc').count()==7))
    ok('week rows do not overlap', pg.evaluate("""()=>[...document.querySelectorAll('.week .wk')].every(r=>{const d=r.querySelector('.wd').getBoundingClientRect(),t=r.querySelector('.wtrack').getBoundingClientRect(),v=r.querySelector('.wv').getBoundingClientRect();return d.right<=t.left+1&&t.right<=v.left+1})"""))
    # burger categories fold
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer')
    h=pg.locator('.drawer [data-dtoggle]:not([data-key])'); first=h.get_attribute('aria-expanded')
    h.click(); second=h.get_attribute('aria-expanded'); vis=pg.locator('.drawer .dhead:not([data-key]) + .dsub').is_visible()
    ok('burger Categories folds and unfolds', first!=second and vis==(second=='true'))
    h.click(); ok('burger Categories folds back', pg.locator('.drawer .dhead:not([data-key]) + .dsub').is_visible()==(h.get_attribute('aria-expanded')=='true'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # tab re-tap scrolls to top
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(700)
    pg.evaluate("window.scrollTo(0,1500)"); pg.wait_for_timeout(200); y0=pg.evaluate("window.scrollY")
    pg.click('#tabs a[href="#/ledger"]'); pg.wait_for_timeout(900)
    ok('re-tapping the open tab scrolls to top', y0>300 and pg.evaluate("window.scrollY")<5)
    # ledger filters: a transfer with a fee
    pg.evaluate("""(async()=>{const m=await import('/js/core.js');m.commit(d=>{const a=d.accounts.filter(x=>!x.deleted&&x.cur===m.HOME);d.txs.push(m.stamp({id:'fee1',kind:'transfer',acct:a[0].id,toAcct:a[1].id,amount:500,cur:m.HOME,date:m.nowStamp(),name:'FeeTest move',fee:15,feeBy:'from',feeCur:m.HOME}))})})()""")
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(600)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(150)
    pg.fill('#q','FeeTest'); pg.wait_for_timeout(300)
    ok('All: transfer and its fee are one row', pg.locator('#ledger-list .row').count()==1 and 'fee' in pg.inner_text('#ledger-list').lower())
    pg.click('[data-act=filter][data-v=expense]'); pg.wait_for_timeout(600); pg.fill('#q','FeeTest'); pg.wait_for_timeout(300)
    ok('Expense filter lists the fee as an expense', pg.locator('#ledger-list .row').count()==1 and 'Fee · FeeTest move' in pg.inner_text('#ledger-list'))
    pg.click('[data-act=filter][data-v=transfer]'); pg.wait_for_timeout(600); pg.fill('#q','FeeTest'); pg.wait_for_timeout(300)
    ok('Transfer filter shows only the transfer', pg.locator('#ledger-list .row').count()==1 and 'Fee · ' not in pg.inner_text('#ledger-list'))
    pg.click('[data-act=filter][data-v=review]'); pg.wait_for_timeout(500)
    ok('Check explains itself', 'Check means' in pg.inner_text('#filterhint'))
    # accounts: investments are a separate block
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(700)
    ok('accounts page keeps investments in their own block', pg.locator('.invblock').count()==1 and pg.locator('.invblock a[href="#/invest"]').count()==1)
    # invest + menu
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(700)
    ok('invest header wording is clear', 'Record activity' in pg.inner_text('#view') and 'Add asset' in pg.inner_text('#view'))
    pg.click('#tabs .fab'); pg.wait_for_selector('.sheet .invopts')
    ok('middle + on Invest asks account first, then 5 kinds', pg.locator('.sheet select[name=acc]').count()==1 and pg.locator('.sheet .invopt').count()==5)
    ok('option title and note do not overlap', pg.evaluate("""()=>[...document.querySelectorAll('.invopt')].every(o=>{const b=o.querySelector('b').getBoundingClientRect(),s=o.querySelector('small').getBoundingClientRect();return b.bottom<=s.top+1})"""))
    pg.click('.sheet [data-close]'); pg.wait_for_timeout(300)
    # budget pie: no redraw on tap
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(600)
    while pg.locator('[data-act=month][data-d="-1"]:not([disabled])').count() and pg.locator('svg.donut .slice').count()==0: pg.click('[data-act=month][data-d="-1"]'); pg.wait_for_timeout(250)
    if pg.locator('svg.donut .slice').count()==0: ok('(no month with spending found)', False)
    else:
        pg.evaluate("document.querySelector('svg.donut').__mark=1")
        pg.locator('svg.donut .slice').first.dispatch_event('click'); pg.wait_for_timeout(300)
        ok('tapping a slice keeps the same chart element (no redraw)', pg.evaluate("document.querySelector('svg.donut').__mark===1"))
        ok('slice tap highlights and opens its row', pg.locator('svg.donut .slice.sel').count()==1 and pg.locator('details.pierow[open]').count()==1)
        pg.locator('svg.donut .slice').first.dispatch_event('click'); pg.wait_for_timeout(300)
        ok('tapping again clears it', pg.locator('svg.donut .slice.sel').count()==0 and pg.locator('details.pierow[open]').count()==0)
    # entry form: group suggestions when no category
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500); pg.click('#tabs .fab'); pg.wait_for_selector('#f-what')
    pg.fill('#f-what','zzqx unknown thing'); pg.wait_for_timeout(500)
    ok('entry offers existing groups when no category fits', pg.locator('#catrow .chips.grptiles .chip').count()>=3)
    pg.locator('#catrow .chips.grptiles .chip').first.click(); pg.wait_for_selector('.pk-list .pk-opt')
    ok('a group opens its categories with add-new', pg.locator('.pk-add').count()==1)
    ok('no page errors', not errs); print(errs[:3])

def part2(p,b,ctx,pg,errs):
    # v12aq: card billing period filter and posted date
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(()=>{const s=window.sukli;s.commit(d=>{const id='cardz';d.accounts.push({id,name:'Zed Card',cur:'PHP',type:'card',open:0,include:true,archived:false,stmtDay:11,dueDay:1,limit:50000,updatedAt:Date.now()});
      const c=d.categories.find(x=>x.kind==='expense'&&!x.deleted).id, mk=(i,date,amt,extra)=>d.txs.push(Object.assign({id:i,kind:'expense',amount:amt,cur:'PHP',fx:1,date,name:i,cat:c,acct:id,updatedAt:Date.now()},extra||{}));
      mk('pa','2026-10-05 12:00:00',500); mk('pb','2026-10-11 20:00:00',300,{posted:'2026-10-12'}); mk('pc','2026-10-15 12:00:00',200);});})()""")
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('[data-act=acct][data-id=cardz]').click()"); pg.wait_for_selector('select[data-bp]')
    opts=pg.eval_on_selector_all('select[data-bp] option','o=>o.map(x=>[x.value,x.textContent])'); print(opts[:3])
    ok('period list has Current first', len(opts)>=12 and opts[1][1].startswith('Current') and opts[1][0]=='2026-10-12|2026-11-11')
    pg.select_option('select[data-bp]','2026-10-12|2026-11-11'); pg.wait_for_timeout(400)
    t=pg.inner_text('.gdhead ~ .rows.plain') if pg.locator('.gdhead ~ .rows.plain').count() else pg.inner_text('.rows.plain')
    ok('current period has the posted-later entry and the 15th', 'pb' in t and 'pc' in t and 'pa' not in t.replace('past',''))
    ok('row says posted', 'posted' in t)
    ok('statement summary on a card period', pg.locator('.cardbox.stmt').count()==1 and 'Charges (2)' in pg.inner_text('.cardbox.stmt'))
    pg.select_option('select[data-bp]','2026-09-12|2026-10-11'); pg.wait_for_timeout(400)
    st=pg.inner_text('.cardbox.stmt'); ok('closed statement shows owed 500 at the statement date', '500' in st and 'Owed at the statement date' in st and 'Pay by' in st)
    t=pg.inner_text('.rows.plain'); ok('previous period has only the 5th', 'pa' in t and 'pb' not in t and 'pc' not in t)
    pg.click('[data-ad=edit]'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    r=pg.evaluate("window.sukli.cardOwedAtStmt ? 0 : 0")
    # entry form
    pg.evaluate("document.querySelector('[data-ad=add]').click()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
    ok('posted link shown for a card', pg.locator('[data-e=postedon]').count()==1 and pg.is_visible('[data-e=postedon]'))
    pg.click('[data-e=postedon]'); pg.wait_for_timeout(300)
    ok('posted date shown', pg.locator('[data-e=posted]').count()==1)
    pg.fill('#f-amount','123'); pg.click('[data-e=save]'); pg.wait_for_timeout(900)
    tx=pg.evaluate("(()=>{const t=window.sukli.get().txs.filter(x=>x.acct==='cardz'&&Math.abs(x.amount-123)<1e-9)[0];return t?[t.date.slice(0,10),t.posted]:null})()")
    ok('saved with posted day after date %s'%(tx,), tx and tx[1] and tx[1]>tx[0])
    ok('no errors', not errs); print(errs[:3])

def part3(p,b,ctx,pg,errs):
    # v12ar: Sukli CSV round trip keeps posted date, tags, fee, items, card details
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(()=>{const s=window.sukli;s.commit(d=>{const id='cardq';d.accounts.push({id,name:'Q Card',cur:'PHP',type:'card',open:0,include:true,archived:false,stmtDay:11,dueDay:1,limit:50000,exchange:'',updatedAt:Date.now()});
      const c=d.categories.find(x=>x.kind==='expense'&&!x.deleted).id,src=d.accounts.find(a=>a.type==='bank'&&a.cur==='PHP'&&!a.deleted).id;
      d.txs.push({id:'qa',kind:'expense',amount:300,cur:'PHP',fx:1,date:'2026-10-11 20:00:00',name:'Late, "quoted" charge',cat:c,acct:id,posted:'2026-10-12',labels:'Okinawa trip',notes:'n1',items:[{n:'milk',amt:100,cat:c},{n:'rice',amt:200,cat:''}],updatedAt:Date.now()});
      d.txs.push({id:'qb',kind:'transfer',amount:500,toAmount:500,cur:'PHP',fx:1,toFx:1,date:'2026-10-15 09:00:00',name:'Pay card',cat:'',acct:src,toAcct:id,fee:15,feeBy:'to',feeCat:'',weird:{x:1},updatedAt:Date.now()});});})()""")
    csv=pg.evaluate("import('/js/sukliCsv.js').then(m=>m.exportSukliCSV(window.sukli.get()))")
    ok('has Record and Posted Date headers', csv.split('\r\n')[0].startswith('﻿"Record"') and 'Posted Date' in csv.split('\r\n')[0])
    ok('billing period column filled', '2026-10-12..2026-11-11' in csv)
    n=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length")
    # re-import into a fresh app
    pg.evaluate("localStorage.clear(); indexedDB.databases().then(l=>l.forEach(d=>indexedDB.deleteDatabase(d.name)))"); pg.wait_for_timeout(500)
    pg.goto('http://localhost:8123/'); pg.reload(); pg.wait_for_selector('#first-file',state='attached')
    open('/tmp/sukli_full.csv','w',encoding='utf-8').write(csv)
    pg.set_input_files('#first-file','/tmp/sukli_full.csv'); pg.wait_for_timeout(2500)
    if pg.locator('#setup .btn').count(): pg.click('#setup .btn'); pg.wait_for_timeout(800)
    r=pg.evaluate("""(()=>{const d=window.sukli.get();const a=d.txs.find(t=>t.id==='qa'),b=d.txs.find(t=>t.id==='qb'),c=d.accounts.find(x=>x.name==='Q Card');
      return {n:d.txs.filter(t=>!t.deleted).length,a:a&&[a.posted,a.labels,a.notes,a.name,(a.items||[]).length,a.amount],b:b&&[b.fee,b.feeBy,b.weird&&b.weird.x,b.toAmount],c:c&&[c.stmtDay,c.dueDay,c.limit,c.type]}})()""")
    print(r)
    ok('same number of entries', r['n']==n)
    ok('posted, tags, notes, quoted name, items kept', r['a']==['2026-10-12','Okinawa trip','n1','Late, "quoted" charge',2,300])
    ok('transfer fee and extra field kept', r['b']==[15,'to',1,500])
    ok('card details kept', r['c']==[11,1,50000,'card'])
    ok('no errors', not errs); print(errs[:3])

def part4(p,b,ctx,pg,errs):
    # v13.25: "What was it?" typed as a list (coke, 2 bread, soap) offers Count by group and keeps the parts
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.titleCase=false})})()")
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Lawson'); pg.wait_for_timeout(300); ok('no hint for a plain name', pg.locator('.partshint').count()==0)
    pg.fill('#f-what','coke, 2 onigiri, tissue, mystery thing'); pg.wait_for_timeout(400)
    ok('hint appears for a list', pg.locator('.partshint').count()==1 and '4 things' in pg.inner_text('.partshint'))
    pg.evaluate("document.querySelector('[data-e=parts-use]').click()"); pg.wait_for_timeout(500)
    rows=pg.evaluate("[...document.querySelectorAll('.cnt')].map(r=>[r.querySelector('.cnt-g').value,r.querySelector('.cnt-n').value])")
    ok('counts filled by guess %s'%rows, ['drinks','1'] in rows and ['snacks','2'] in rows and ['household','1'] in rows and ['','1'] in rows)
    pg.evaluate("(()=>{const s=[...document.querySelectorAll('.cnt-g')].find(x=>!x.value); s.value='other'; s.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.fill('#f-amount','640'); pg.click('#btns .btn'); pg.wait_for_timeout(800)
    t=pg.evaluate("(async()=>{const m=await import('/js/core.js');const t=m.get().txs.filter(x=>!x.deleted&&x.name&&x.name.startsWith('coke'))[0];return t&&[t.counts,t.parts,t.name]})()")
    ok('saved counts and parts, name kept as typed: %s'%t, t and t[2]=='coke, 2 onigiri, tissue, mystery thing' and len(t[1])==4 and {'g':'snacks','n':2} in t[0])
    # a place name with a comma can be dismissed
    pg.wait_for_timeout(1500); pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Kawasaki, Kanagawa'); pg.wait_for_timeout(300); ok('hint also on a place name', pg.locator('.partshint').count()==1)
    pg.evaluate("document.querySelector('[data-e=parts-off]').click()"); pg.wait_for_timeout(300); ok('Not a list hides it', pg.locator('.partshint').count()==0)
    ok('no errors %s'%errs, not errs)

def part5(p,b,ctx,pg,errs):
    # v13.30: fare suggestions with confidence on the Pasmo reader ( text injected)
    TXT="""23:28
    Balance
    ¥809 Add Money
    Latest Transactions
    Kawasaki Station ¥528 >
    From Kita-Senju Station — Tran...
    2 hours ago
    Kita-Senju Station ¥1,393 >
    From Tobu-nikko Station — Tr...
    3 hours ago
    Kawasaki, Kanagawa ¥494 >
    Purchase
    Yesterday
    Shibuya, Tokyo +¥5,000 >
    Credit
    Saturday
    Kawasaki Station ¥341 >"""
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'pm1',name:'Pasmo',cur:'JPY',type:'cash',open:1000,include:true,archived:false}))})})()")
    pg.evaluate("window.__walletText="+__import__('json').dumps(TXT))
    open('/tmp/blank.png','wb').write(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082'))
    # three earlier rides on the same pair (opposite direction) at 483
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{const cat=d.categories.find(x=>!x.deleted).id;for(let i=0;i<3;i++)d.txs.push(c.stamp({id:'f'+i,kind:'expense',amount:483,cur:'JPY',fx:1,date:'2026-10-1'+i+' 08:00:00',name:'Train: Kawasaki - Kita-Senju',from:'Kawasaki',to:'Kita-Senju',cat,acct:'pm1'}))})})()""")
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer')
    pg.evaluate("document.querySelector('.drawer [data-act=wallet-scan]').click()"); pg.wait_for_timeout(600); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=15000)
    t=pg.inner_text('.sheet')
    ok('note shows the usual fare with confidence', 'Usually' in t and '483' in t and 'always the same' in t and 'Worth a check' in t)
    ok('only the differing pair is flagged', pg.locator('.wsfare').count()==1)
    pg.evaluate("document.querySelector('[data-act=ws-fare]').click()"); pg.wait_for_timeout(300)
    ok('Use the usual fare changes the row', '483' in pg.inner_text('.wslist') and pg.locator('.wsfare').count()==0)
    ok('no errors %s'%errs, not errs)

def part6(p,b,ctx,pg,errs):
    # v13.33: Earn schedule in UTC+8, "All" precision, 2-decimal Entries list. Browser timezone is set far from UTC+8 on purpose.
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';const mk=(id,w,o)=>d.accounts.push(c.stamp({id,name:'Zed '+w+' USDC',wallet:w,cur:'USDC',type:'crypto',assetType:'crypto',exchange:'Zed',open:o,include:false,archived:false,invtab:true}));mk('zs','Spot',1211);mk('ze','Earn',0);mk('qs','Spot',500);d.accounts[d.accounts.length-1].exchange='Q';mk('qe','Earn',0);d.accounts[d.accounts.length-1].exchange='Q'})})()")
    # 2 All = 1211 exactly, even with a guessed fee
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'zs',toAcct:'ze'}})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=allamt]').click()"); pg.wait_for_timeout(300)
    v=pg.input_value('#f-amount'); ok('All fills 1211 (%s)'%v, v.replace(',','')=='1211')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 3 list vs detail
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs.push(c.stamp({id:'tt1',kind:'expense',date:c.nowStamp(),acct:'zs',cur:'USDC',amount:1210.996,fx:1,name:'Decimal test'}))});c.ui&&0})()")
    pg.evaluate("(async()=>{const m=await import('/js/app.js')}).catch&&0") if False else None
    html=pg.evaluate("(async()=>{const s=await import('/js/screens.js');const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.id==='tt1');return s.row(t,c.accountMap(c.get()),c.catMap(c.get()),false,null)})()")
    print(html[html.find('class="amt'):][:200]) if False else print(html[-400:])
    ok('list shows 1,210.99 (cut)', '1,210.99' in html and '1,210.996' not in html)
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({id:'tt1'})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    v=pg.input_value('#f-amount'); ok('detail keeps 1210.996 (%s)'%v, v.replace(',','')=='1210.996')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 1 Earn
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');
      const sub=Date.UTC(2026,10,1,7,9), now=e.e8Ms('2026-11-03','15:00');
      c.commit(d=>{const a=d.accounts.find(x=>x.id==='ze');a.earn={on:true,apy:8.76,lastHour:e.floorHour(sub),trackFrom:sub,lastSlot:now};
        d.txs.push(c.stamp({id:'es1',kind:'transfer',date:c.nowStamp(new Date(sub)),acct:'zs',toAcct:'ze',cur:'USDC',amount:1000,fx:1,name:'Sub',earnSubAt:sub}));
        const m=e.runEarn(d,now); window.__m=m;});
      const d=c.get(),log=d.settings.earnLog.ze,a=d.accounts.find(x=>x.id==='ze'),subs=e.subscriptions(d,a);
      return {m:window.__m,days:log.days.map(x=>[x.day,x.amt,x.hours.length]).reverse(),pend:log.hours.map(x=>e.e8Label(x.h)),first:e.e8Label(subs[0].first),start:e.e8Label(subs[0].start),sub:e.e8Label(subs[0].sub),txs:d.txs.filter(t=>t.earnDay).length}})()""")
    print(r)
    ok('subscription 15:09, earning from 16:00, first payout 17:00 (UTC+8)', r['sub']=='2026-11-01 15:09' and r['start']=='2026-11-01 16:00' and r['first']=='2026-11-01 17:00')
    ok('day 1 has 8 hours (17:00 to 00:00) = 0.08', r['days'][0]==['2026-11-01',0.08,8])
    ok('day 2 full 24 hours = 0.24', r['days'][1]==['2026-11-02',0.24,24])
    ok('today still hourly, 15 hours, today has one open entry', len(r['pend'])==15 and r['pend'][0]=='2026-11-03 01:00' and r['txs']==3)
    # auto subscription at 03:00 and 15:00 UTC+8
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');
      const l=e.e8Ms('2026-11-03','00:00'), now=e.e8Ms('2026-11-03','15:30');
      c.commit(d=>{const a=d.accounts.find(x=>x.id==='qe');a.earn={on:true,apy:0,subOn:true,slots:['03:00','15:00'],subAmt:'all',from:'qs',lastHour:e.floorHour(now),lastSlot:l};e.runEarn(d,now)});
      const d=c.get();return d.txs.filter(t=>t.earnAuto&&t.acct==='qs').map(t=>[e.e8Label(t.earnSubAt),t.amount])})()""")
    ok('auto subscribe used the 03:00 slot time and moved all 500 %s'%r, r==[['2026-11-03 03:00',500]])
    # UI opens
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('ze')})()"); pg.wait_for_selector('#ew'); pg.wait_for_timeout(300)
    t=pg.inner_text('#ew'); ok('window mentions UTC+8 and daily history', 'UTC+8' in t and 'Daily History' in t and '2026-11-02' in t)
    pg.click('#ew [data-ew=day][data-v="2026-11-02"]'); pg.wait_for_timeout(200)
    ok('day expands to hourly rows', pg.locator('#ew .cardbox li').count()==24)
    ok('no errors %s'%errs, not errs)

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    print('--- tests/ui_test30.py'); part0(p,b,ctx,pg,errs)
    print('--- tests/ui_test31.py'); part1(p,b,ctx,pg,errs)
    print('--- tests/ui_test54.py'); part2(p,b,ctx,pg,errs)
    print('--- tests/ui_test55.py'); part3(p,b,ctx,pg,errs)
    print('--- tests/ui_test79.py'); part4(p,b,ctx,pg,errs)
    print('--- tests/ui_test82.py'); part5(p,b,ctx,pg,errs)
    print('--- tests/ui_test85.py'); part6(p,b,ctx,pg,errs)
    b.close()
print('fails',res.count(False))
