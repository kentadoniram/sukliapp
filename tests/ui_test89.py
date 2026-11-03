# v13.34: cashback in Add Entry
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
JS="(async()=>{const c=await import('/js/core.js');const d=c.get();const e=d.txs.find(t=>t.name==='CB test'&&!t.deleted);const cb=d.txs.filter(t=>t.cashbackOf&&e&&t.cashbackOf===e.id&&!t.deleted);return {e:e&&[e.amount,e.cashback&&e.cashback.mode],cb:cb.map(x=>x.amount),bal:c.balances(d).get(e&&e.acct)}})()"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'cbw',name:'CB Wallet',type:'cash',cur:'PHP',open:10000,include:true,archived:false}))});const m=await import('/js/entry.js');m.openEntry({preset:{acct:'cbw'}})})()"); pg.wait_for_selector('#cbrow'); pg.wait_for_timeout(400)
    pg.click('#cbrow [data-e=cb-on]'); pg.fill('#f-amount','1000'); pg.fill('#f-what','CB test'); pg.fill('#f-cbv','5'); pg.press('#f-cbv','Tab'); pg.wait_for_timeout(200)
    ok('live calc shows 50 %s'%pg.inner_text('#cbcalc'), '50.00' in pg.inner_text('#cbcalc'))
    pg.fill('#f-amount','2000'); pg.wait_for_timeout(200); ok('recalculates when amount changes', '100.00' in pg.inner_text('#cbcalc'))
    pg.fill('#f-amount','1000'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('saved expense 1000 + income 50, balance 9050 %s'%r, r['e']==[1000,'pct'] and r['cb']==[50] and abs(r['bal']-9050)<0.01)
    # edit amount: cashback follows
    id=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.find(t=>t.name==='CB test').id})()")
    pg.evaluate("(async(id)=>{const m=await import('/js/entry.js');m.openEntry({id})})('%s')"%id); pg.wait_for_selector('#f-cbv'); pg.wait_for_timeout(300)
    ok('opens with cashback on', pg.input_value('#f-cbv')=='5')
    pg.fill('#f-amount','2000'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('edit follows: 2000 and 100 %s'%r, r['e'][0]==2000 and r['cb']==[100] and abs(r['bal']-8100)<0.01)
    pg.evaluate("(async(id)=>{const m=await import('/js/entry.js');m.openEntry({id})})('%s')"%id); pg.wait_for_selector('#f-cbv'); pg.wait_for_timeout(300)
    pg.click('#cbrow [data-e=cb-mode][data-v=fixed]'); pg.fill('#f-cbv','30'); pg.press('#f-cbv','Tab'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('fixed 30 %s'%r, r['cb']==[30] and r['e'][1]=='fixed')
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(600)
    t=pg.inner_text('body'); ok('Entries shows one row, with the cashback in its note', t.count('CB test')==1 and 'cashback' in t.lower())
    pg.evaluate("(async(id)=>{const m=await import('/js/entry.js');m.openEntry({id})})('%s')"%id); pg.wait_for_selector('#f-cbv'); pg.wait_for_timeout(300)
    pg.click('#cbrow [data-e=cb-off]'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('removing cashback removes the income %s'%r, r['cb']==[] and abs(r['bal']-8000)<0.01)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
