# v16.34/16.35: "If you had paid another way" summary in the entry view (after the fact; nothing in New Entry)
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    H=pg.evaluate("""async()=>{const c=await import('/js/core.js');
      c.commit(db=>{db.settings.rates=Object.assign({},db.settings.rates,{JPY:0.4});
        const cat=db.categories.find(x=>!x.deleted&&x.kind==='expense').id;
        db.accounts.push({id:'t-card',name:'Test Card',cur:c.HOME,type:'card',open:0,include:true,archived:false,pay:{markup:0.3,fee:2.5,flat:0,cashback:0.5}},{id:'t-deb',name:'Test Debit',cur:c.HOME,type:'bank',open:50000,include:true,archived:false,pay:{markup:0,fee:1,flat:0,cashback:0}});
        db.txs.push({id:'x-home',kind:'expense',amount:612.5,cur:c.HOME,acct:'t-card',cat,date:c.nowStamp(),name:'Lunch no price'});
        db.txs.push({id:'x-kept',kind:'expense',amount:612.5,cur:c.HOME,acct:'t-card',cat,date:c.nowStamp(),name:'Lunch kept',orig:{cur:'JPY',amt:1500,mid:0.4,rate:612.5/1500,home:612.5,at:c.nowStamp()}});
        db.accounts.push({id:'t-jpy',name:'Test JPY Bank',cur:'JPY',type:'bank',open:100000,include:true,archived:false});
        db.txs.push({id:'x-jpy',kind:'expense',amount:1500,cur:'JPY',hfx:0.4,acct:'t-jpy',cat,date:c.nowStamp(),name:'Lunch yen'});});
      return c.HOME}""")
    # nothing in New Entry
    pg.evaluate("""async()=>{const m=await import('/js/entry.js');m.openEntry({});return true}"""); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    ok('no compare link in New Entry', pg.locator('#paycmp').count()==0 and 'Compare payment' not in pg.inner_text('body'))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    view=lambda i: (pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"), pg.evaluate("async(i)=>{const v=await import('/js/entryview.js');v.openEntryView(i)}", i), pg.wait_for_selector('.evw'), pg.wait_for_timeout(300))
    # entry with a kept shop price
    view('x-kept'); t=pg.inner_text('.evw'); print(t[:700])
    ok('summary shown open', pg.locator('#pc-body').is_visible() and 'What you paid (confirmed)' in t)
    ok('cash baseline and other accounts', 'Cash (JPY)' in t and 'Test Debit' in t)
    ok('the account used is not listed as an alternative', pg.locator('.pcrow', has_text='Test Card').count()==0)
    ok('compared with what you paid', 'than you paid' in t)
    ok('says estimates, not spending', 'not extra spending' in t)
    ok('shop price and posted rate rows', 'Shop price' in t and 'Posted rate' in t and 'market then' in t)
    ok('starting guess shown for default accounts', 'Starting guess' in t or 'Your assumptions' in t)
    pg.locator('.pcrow', has_text='Test Debit').locator('[data-act=pc-edit]').click(); pg.wait_for_selector('input[name=m]')
    pg.fill('input[name=f]','4'); pg.click('button[type=submit]:visible'); pg.wait_for_timeout(500)
    ok('editing assumptions refreshes the summary', 'fee 4%' in pg.locator('.pcrow',has_text='Test Debit').inner_text())
    pg.click('[data-ev=pc-toggle]'); ok('can be collapsed', pg.evaluate("document.getElementById('pc-body').hidden"))
    # entry paid in yen directly
    view('x-jpy'); t=pg.inner_text('.evw'); ok('foreign-account expense summarised with its own price', 'for a price of ¥1,500' in t and 'Test Debit' in t)
    # entry with no price: offered, then saved
    view('x-home'); ok('no price: form offered, collapsed', pg.locator('#pc-body').is_hidden() and pg.locator('[data-ev=pc-toggle]').count()==1)
    pg.click('[data-ev=pc-toggle]'); pg.fill('#pc-amt','1500')
    pg.evaluate("(()=>{const s=document.getElementById('pc-cur');s.value='JPY';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
    pg.click('[data-ev=pc-save]'); pg.wait_for_timeout(500)
    o=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.find(x=>x.id==='x-home')})()")
    ok('shop price saved beside the unchanged posted amount', o['amount']==612.5 and o['orig']['cur']=='JPY' and o['orig']['amt']==1500 and abs(o['orig']['rate']-612.5/1500)<1e-9 and o['orig']['mid']>0 and o['orig']['late'])
    ok('summary now shown', 'What you paid (confirmed)' in pg.inner_text('.evw'))
    ok('no page errors %s'%errs, not errs)
    b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
