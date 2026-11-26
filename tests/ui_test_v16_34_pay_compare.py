# v16.37: Card rate vs market rate in the entry view (the card's conversion against the market rate)
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("""async()=>{const c=await import('/js/core.js');
      c.commit(db=>{db.settings.rates=Object.assign({},db.settings.rates,{JPY:0.4});
        const cat=db.categories.find(x=>!x.deleted&&x.kind==='expense').id;
        db.accounts.push({id:'t-card',name:'Test Card',cur:c.HOME,type:'card',open:0,include:true,archived:false});
        db.txs.push({id:'x-home',kind:'expense',amount:612.5,cur:c.HOME,acct:'t-card',cat,date:c.nowStamp(),name:'Lunch no price'});
        db.txs.push({id:'x-kept',kind:'expense',amount:612.5,cur:c.HOME,acct:'t-card',cat,date:c.nowStamp(),name:'Lunch kept',orig:{cur:'JPY',amt:1500,mid:0.4,rate:612.5/1500,home:612.5,at:c.nowStamp()}});
        db.txs.push({id:'x-cheap',kind:'expense',amount:590,cur:c.HOME,acct:'t-card',cat,date:c.nowStamp(),name:'Lunch cheap',orig:{cur:'JPY',amt:1500,mid:0.4,rate:590/1500,home:590,at:c.nowStamp()}});});}""")
    view=lambda i: (pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"), pg.evaluate("async(i)=>{const v=await import('/js/entryview.js');v.openEntryView(i)}", i), pg.wait_for_selector('.evw'), pg.wait_for_timeout(300))
    pg.evaluate("""async()=>{const m=await import('/js/entry.js');m.openEntry({});return true}"""); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    ok('nothing in New Entry', pg.locator('#paycmp').count()==0)
    view('x-kept'); t=pg.inner_text('.evw'); print(t[-700:])
    ok('card check shown open', pg.locator('#pc-body').is_visible())
    ok('shop price, card charge and market equivalent', '¥1,500' in t and '612.5' in t and ('₱600' in t or '600.00' in t))
    ok('markup in amount and percent', '+₱12.50' in t.replace(' ','') or '12.50' in t) ; ok('percent 2.08', '2.08%' in t)
    ok('only one comparison, no account list', pg.locator('.pcrow').count()==0 and 'Cash (JPY)' not in t and 'Test Debit' not in t and 'Starting guess' not in t)
    ok('says posted amount is what is recorded', 'is recorded' in t)
    view('x-cheap'); t=pg.inner_text('.evw'); ok('card cheaper than market shows as a saving', '−₱10' in t and '-1.67%' in t or '−1.67%' in t)
    view('x-home'); ok('no price: form offered, collapsed', pg.locator('#pc-body').is_hidden())
    pg.click('[data-ev=pc-toggle]'); pg.fill('#pc-amt','1500')
    pg.evaluate("(()=>{const s=document.getElementById('pc-cur');s.value='JPY';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
    pg.click('[data-ev=pc-save]'); pg.wait_for_timeout(500)
    o=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.find(x=>x.id==='x-home')})()")
    ok('shop price saved beside the unchanged posted amount', o['amount']==612.5 and o['orig']['cur']=='JPY' and o['orig']['amt']==1500 and o['orig']['mid']>0 and o['orig']['late'])
    ok('card check now shown', 'Markup the card added' in pg.inner_text('.evw'))
    ok('no page errors %s'%errs, not errs)
    b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
