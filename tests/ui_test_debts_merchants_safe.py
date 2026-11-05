# Debts and Owed to You: plan, pay debt, merchants, lent, write-off, safe to spend (one browser and one imported CSV; merged from ui_test61.py, ui_test63.py, ui_test80.py).
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)

import re

def part0(p,b,ctx,pg,errs):
    # v13.1-13.3: Debts tab (plan with cash flow, due dates, habits, shortfall)
    SETUP="""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.txs.forEach(t=>{t.deleted=true});
      d.accounts.forEach(a=>{if(['card','loan'].includes(a.type))a.archived=true});
      const now=new Date(), fm=(dt)=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
      const soon=new Date(now);soon.setDate(Math.min(now.getDate()+2,28));const later=new Date(now);later.setDate(Math.min(now.getDate()+12,28));
      const ex=d.categories.filter(x=>!x.deleted&&x.kind==='expense'), inc=d.categories.find(x=>!x.deleted&&x.kind==='income');
      const mk=(id,name,type,extra)=>d.accounts.push(c.stamp(Object.assign({id,name,cur:c.HOME,type,open:0,include:false,archived:false},extra)));
      mk('pw','Wallet','bank',{open:200000,include:true});
      mk('dc','Test Card','card',{stmtDay:1,dueDay:later.getDate(),debtInt:{on:false}});
      mk('dl','Test Loan','loan',{dueDay:soon.getDate(),loan:{kind:'personal',principal:30000,rate:12,months:12,monthly:2665.5,fees:0,net:30000,lateFee:3,dueDay:soon.getDate(),start:'2026-01-10'}});
      mk('da','Add-on Loan','loan',{dueDay:later.getDate(),debtInt:{on:true,rate:2,kind:'addon',principal:10000,start:'2099-01-01'}});
      const T=(id,o)=>d.txs.push(c.stamp(Object.assign({id,cur:c.HOME,fx:1},o)));
      for(let k=1;k<=3;k++){const m=new Date(now.getFullYear(),now.getMonth()-k,1), ym=fm(m).slice(0,7);
        T('i'+k,{kind:'income',amount:50000,date:ym+'-25 09:00:00',name:'Pay',cat:inc.id,acct:'pw'});
        T('e'+k,{kind:'expense',amount:20000,date:ym+'-05 09:00:00',name:'Rent stuff',cat:ex[0].id,acct:'pw'});
        T('f'+k,{kind:'expense',amount:10000,date:ym+'-12 09:00:00',name:'Fun stuff',cat:ex[1].id,acct:'pw'});
        T('p'+k,{kind:'transfer',debtPay:true,amount:6000,toAmount:6000,date:ym+'-20 09:00:00',name:'Paid Test Card',acct:'pw',toAcct:'dc'});}
      const base=fm(now)+' 09:00:00';
      T('x1',{kind:'expense',amount:40000,date:base,name:'card spend',cat:ex[0].id,acct:'dc'});
      T('x2',{kind:'expense',amount:20000,date:base,name:'loan owed',cat:ex[0].id,acct:'dl'});
      T('x3',{kind:'expense',amount:9000,date:base,name:'addon owed',cat:ex[0].id,acct:'da'});
      delete d.settings.debtBudget; delete d.settings.debtForce;})})()"""
    def total_pct(pg):
        m=re.search(r'Total ₱[\d,\.]+ \((\d+)% of your income\)', pg.inner_text('.debtpage')); return int(m.group(1)) if m else None
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.goto('http://localhost:8123/#/debts'); pg.wait_for_selector('.debtpage'); pg.wait_for_timeout(200)
    pg.evaluate(SETUP); pg.wait_for_timeout(700); t=pg.inner_text('.debtpage')
    ok('three debts listed', 'Your debts (3)' in t and 'Test Card' in t and 'Test Loan' in t and 'Add-on Loan' in t)
    ok('month card shows income, usual spending and what is left', 'Income you usually get' in t and '₱50,000.00' in t and 'Your usual spending' in t and '₱30,000.00' in t and 'Left after your usual spending' in t)
    pc=total_pct(pg); ok('plan total is within 30%% of income, cushion kept (%s)'%pc, pc is not None and 0<pc<=30 and 'Kept as a safety cushion' in t)
    names=pg.eval_on_selector_all('.payorder li .po-b .dn','b=>b.map(x=>x.textContent)'); ok('pay order has three rows, nearest due first: %s'%names, len(names)==3 and names[0]=='Test Loan')
    ok('due date shown: overdue gets a late-payment warning, a due-soon debt says Pay now', ('Paying late can add interest or fees' in t) or ('Pay now' in t))   # which one depends on today's date
    card=pg.locator('.payorder li', has_text='Test Card').inner_text(); ok('card follows your habit (usually pays about 6,000)', 'You usually pay about ₱6,000.00' in card and '3 of the last 6 months' in card)
    amts=[float(re.search(r'Pay ₱([\d,\.]+)',pg.locator('.payorder li').nth(i).inner_text()).group(1).replace(',','')) for i in range(3)]; ok('amounts differ per debt %s'%amts, len(set(amts))==3)
    ok('card warning for missing rate', 'No interest rate is set for Test Card' in t); ok('add-on warning', 'uses add-on interest' in t)
    ok('light shown', pg.locator('.debtlight').count()==1)
    # typed figure too high is cut, can be forced and undone
    pg.click('[data-act=debt-budget]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=v]','50000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700); t=pg.inner_text('.debtpage')
    ok('typed 50,000 is cut with a clear note', 'Use my figure anyway' in t and 'Suggests at most 40%' in t.replace('Sukli s','S') or ('Use my figure anyway' in t and 'at most 40%' in t)); pc=total_pct(pg); ok('plan still within 40%% (%s)'%pc, pc is not None and pc<=40)
    pg.click('[data-act=debt-force]'); pg.wait_for_timeout(600); t=pg.inner_text('.debtpage'); pc2=total_pct(pg); ok('forced figure is used and flagged (%s)'%pc2, 'Go back to the safe amount' in t and pc2 is not None)
    pg.click('[data-act=debt-unforce]'); pg.wait_for_timeout(600); ok('back to safe amount', 'Use my figure anyway' in pg.inner_text('.debtpage'))
    # shortfall
    pg.click('[data-act=debt-budget]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=v]','2000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700); t=pg.inner_text('.debtpage')
    ok('shortfall flagged with amount', 'Short by' in t and 'debtlight red' in pg.inner_html('.debtpage'))
    ok('lists which debts are left short', pg.locator('.shortlist li').count()>=1)
    ok('ways to find the money', 'Ways to find' in t and 'Ask the lender' in t)
    tot=float(re.search(r'Total ₱([\d,\.]+)', pg.inner_text('.debtpage')).group(1).replace(',','')); ok('nothing suggested above the money available (%s)'%tot, tot<=2000.01)
    names=pg.eval_on_selector_all('.payorder li .po-b .dn','b=>b.map(x=>x.textContent)'); ok('nearest due still first when short', names[0]=='Test Loan')
    # mode toggle moves only the extra
    pg.click('[data-act=debt-budget-clear]'); pg.wait_for_selector('[role=dialog], .sheet'); pg.click('[role=dialog] .btn:not(.ghost), .sheet .btn:not(.ghost)'); pg.wait_for_timeout(600)
    ok('own figure removed', pg.evaluate("window.sukli.get().settings.debtBudget")==None)
    pg.click('[data-act=debt-mode][data-m=snowball]'); pg.wait_for_timeout(500); ok('mode switch works', 'on' in (pg.get_attribute('[data-act=debt-mode][data-m=snowball]','class') or ''))
    # edit figures
    pg.click('[data-act=debt-edit][data-id=dc]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=rate]','42.6'); pg.fill('input[name=min]','2000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700)
    ok('rate set', 'No interest rate is set for Test Card' not in pg.inner_text('.debtpage'))
    pg.click('[data-act=debt-edit][data-id=dc]'); pg.wait_for_selector('.sheet form'); pg.click('[data-rm]'); pg.wait_for_timeout(500)
    ok('typed figures removable', pg.evaluate("window.sukli.get().accounts.find(a=>a.id==='dc').dm")==None)
    pg.click('.burger'); pg.wait_for_timeout(300); ok('menu has Debts', 'Debts' in pg.inner_text('.drawer'))
    ok('no errors', not errs); print(errs[:3])

def part1(p,b,ctx,pg,errs):
    # v13.4: Merchant (where you bought it), separate from the category
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.titleCase=false})})()")
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry')
    ok('merchant row shows for expenses', pg.is_visible('#merchrow') and 'Merchant (optional)' in pg.inner_text('#merchrow'))
    y0=pg.evaluate("document.querySelector('#merchrow').getBoundingClientRect().height")
    pg.type('#f-what','Shopee pork chop',delay=15); pg.wait_for_timeout(500)
    y1=pg.evaluate("document.querySelector('#merchrow').getBoundingClientRect().height")
    ok('suggested from the name', 'Shopee' in pg.inner_text('#merchrow') and 'suggested' in pg.inner_text('#merchrow'))
    ok('the merchant row keeps its height when the suggestion appears (%s, %s)'%(y0,y1), abs(y0-y1)<1)
    pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mlist'); lt=pg.inner_text('#mlist'); ok('picker lists suggestions', 'Lazada' in lt and 'Wet market' in lt)
    pg.fill('#mq','wet'); pg.wait_for_timeout(200); pg.click('#mlist [data-m="Wet market"]'); pg.wait_for_timeout(300)
    ok('picked Wet market', 'Wet market' in pg.inner_text('#merchrow') and 'suggested' not in pg.inner_text('#merchrow'))
    pg.fill('#f-amount','250'); pg.wait_for_timeout(200)
    pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    t=pg.evaluate("(()=>{const x=window.sukli.get().txs.filter(t=>!t.deleted&&t.name==='Shopee pork chop');return x.length&&[x[0].merchant,x[0].kind,x[0].cat?1:0]})()")
    ok('saved with merchant, still an expense with a category %s'%t, t and t[0]=='Wet market' and t[1]=='expense' and t[2]==1)
    # type a new merchant, case variant is merged
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.fill('#f-what','shoes'); pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mq'); pg.fill('#mq','sm mall'); pg.wait_for_timeout(200)
    ok('add as new row', 'Add as a new merchant' in pg.inner_text('#mlist')); pg.press('#mq','Enter'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','1200'); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.fill('#f-what','socks'); pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mq'); pg.fill('#mq','SM MALL'); pg.press('#mq','Enter'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','150'); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    ms=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted&&t.merchant&&/sm mall/i.test(t.merchant)).map(t=>t.merchant)"); ok('same merchant keeps one spelling %s'%ms, len(ms)==2 and len(set(ms))==1)
    # transfer and income do not keep a merchant row
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.click('[data-e=kind][data-v=transfer]'); pg.wait_for_timeout(200); ok('hidden for transfer', not pg.is_visible('#merchrow'))
    pg.click('[data-e=kind][data-v=income]'); pg.wait_for_timeout(200); ok('hidden for income', not pg.is_visible('#merchrow')); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # list shows merchant and search finds it
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#ledger-list'); pg.fill('#q','wet market'); pg.wait_for_timeout(500); lt=pg.inner_text('#ledger-list'); ok('search by merchant, row shows it', 'Shopee pork chop' in lt and 'Wet market' in lt)
    # edit reopens with merchant and can clear it
    pg.click('#ledger-list .row'); pg.wait_for_selector('[data-ev=edit]'); pg.click('[data-ev=edit]'); pg.wait_for_selector('#entry'); ok('edit shows saved merchant', 'Wet market' in pg.inner_text('#merchrow'))
    pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mlist'); pg.click('#mlist [data-m=""]'); pg.wait_for_timeout(200); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(800)
    ok('cleared merchant is removed', pg.evaluate("window.sukli.get().txs.find(t=>t.name==='Shopee pork chop').merchant")==None)
    # bulk edit
    pg.evaluate("window.sukli.commit(d=>{for(const t of d.txs){if(['shoes','socks'].includes(t.name))t.deleted=false}})")
    pg.fill('#q','Shopee pork'); pg.wait_for_timeout(400); pg.click('[data-act=sel-start]'); pg.click('[data-act=sel-all]'); pg.click('[data-act=sel-edit]'); pg.wait_for_selector('#be')
    ok('bulk edit has Merchant', 'Merchant (expenses)' in pg.inner_text('#be')); pg.fill('#be-merch','Lazada'); pg.click('#be-go'); pg.wait_for_timeout(700)
    ok('bulk edit set merchant', pg.evaluate("window.sukli.get().txs.find(t=>t.name==='Shopee pork chop').merchant")=='Lazada')
    # fill from names
    pg.evaluate("window.sukli.commit(d=>{const c=d.categories.find(x=>!x.deleted&&x.kind==='expense').id,a=d.accounts.find(x=>!x.deleted&&x.type==='bank'&&x.cur===window.sukli.get().settings.home||x.type==='bank').id;const now=window.sukli.get;d.txs.push({id:'fm1',kind:'expense',amount:99,cur:'PHP',fx:1,date:'2026-10-20 10:00:00',name:'Lazada order',cat:c,acct:a,updatedAt:Date.now()})})")
    pg.goto('http://localhost:8123/#/analytics'); pg.wait_for_selector('.afilters'); pg.click('.afilters [data-v="6m"]'); pg.wait_for_timeout(700)
    if pg.locator('section[data-sec=an-merch] .collbody[hidden]').count(): pg.click('section[data-sec=an-merch] .collhead'); pg.wait_for_timeout(300)
    h=pg.inner_text('section[data-sec=an-merch]'); print(repr(h[:300])); ok('By merchant section lists merchants', 'sm mall' in h.lower() and 'Lazada' in h)
    pg.click('[data-act=an-merch] >> nth=0'); pg.wait_for_selector('.sheet'); st=pg.inner_text('.sheet'); ok('merchant detail shows what it was and entries', 'What It Was' in st and 'Entries' in st); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('fill button counts old entries', pg.locator('[data-act=merch-fill]').count()==1)
    pg.click('[data-act=merch-fill]'); pg.wait_for_selector('[role=dialog], .sheet'); pg.click('[role=dialog] .btn:not(.ghost), .sheet .btn:not(.ghost)'); pg.wait_for_timeout(700)
    ok('old entry got merchant, name unchanged', pg.evaluate("(()=>{const t=window.sukli.get().txs.find(x=>x.id==='fm1');return t.merchant==='Lazada'&&t.name==='Lazada order'})()"))
    # Sukli CSV keeps merchant, Bluecoins export does not need it
    csv=pg.evaluate("import('/js/sukliCsv.js').then(m=>m.exportSukliCSV(window.sukli.get()))"); ok('Sukli CSV has Merchant column', '"Merchant"' in csv.split('\r\n')[0] and 'Lazada' in csv)
    ok('no errors', not errs); print(errs[:3])

def part2(p,b,ctx,pg,errs):
    # v13.28: card reminder opens the payment window; Safe to spend (money minus what is already owed)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(()=>{const s=window.sukli;s.commit(d=>{d.settings.mode='advanced';const home=d.settings.homeCur||'PHP';d.accounts.push({id:'cardsafe',name:'Safe Card',cur:home,type:'card',open:0,include:false,archived:false,stmtDay:11,dueDay:1,limit:900000,updatedAt:Date.now()});
      d.txs.push({id:'cs1',kind:'expense',amount:12345,cur:home,fx:1,date:new Date().toISOString().slice(0,10)+' 12:00:00',name:'Card buy',cat:d.categories.find(c=>!c.deleted).id,acct:'cardsafe',updatedAt:Date.now()});});})()""")
    s=pg.evaluate("(async()=>{const m=await import('/js/safe.js');const c=await import('/js/core.js');const r=m.safeToSpend(c.get());return [r.money,r.committed,r.safe,r.items.map(x=>x.name)]})()")
    ok('card owed counts as committed %s'%s, s[1]>=12345-0.01 and 'Safe Card' in s[3] and abs(s[0]-s[1]-s[2])<0.01)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(900)
    t=pg.inner_text('#view'); ok('Home shows Safe to spend', 'Safe to spend' in t and 'already owed' in t)
    pg.evaluate("document.querySelector('[data-act=safe-info]').click()"); pg.wait_for_selector('.sheet'); ok('breakdown lists the card', 'Safe Card' in pg.inner_text('.sheet') and 'Safe to spend' in pg.inner_text('.sheet'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const b=document.createElement('button');b.dataset.act='card-pay';b.dataset.id='cardsafe';b.id='tmpb';document.body.appendChild(b);b.click();})()"); pg.wait_for_timeout(800)
    tx=pg.inner_text('.sheet, #entry, .entry') if pg.locator('.sheet, #entry, .entry').count() else ''
    ok('payment window opens as a debt payment', 'I paid a debt' in tx or 'Paid from' in tx)
    ok('amount filled with what is owed', '12,345' in tx or '12345' in pg.evaluate("document.body.innerText.replace(/,/g,'')"))
    ok('no errors %s'%errs, not errs)
    print('fails', res.count(False))

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    print('--- tests/ui_test61.py'); part0(p,b,ctx,pg,errs)
    print('--- tests/ui_test63.py'); part1(p,b,ctx,pg,errs)
    print('--- tests/ui_test80.py'); part2(p,b,ctx,pg,errs)
    b.close()
print('fails',res.count(False))
