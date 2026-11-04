# v13.38: exact 9-decimal amounts (SOL, USDC), "All" leaves nothing behind
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,cur,o)=>d.accounts.push(c.stamp({id,name:'Sx '+w+' '+cur,wallet:w,cur,type:'crypto',assetType:'crypto',exchange:'Sx',open:o,include:false,archived:false,invtab:true}));mk('s93','Spot','SOL',0.1);mk('e93','Earn','SOL',0);mk('u93','Spot','USDC',0.2);
      d.txs.push(c.stamp({id:'i1',kind:'income',date:c.nowStamp(),acct:'s93',amount:0.2,cur:'SOL',fx:1,name:'a'}));d.txs.push(c.stamp({id:'i2',kind:'income',date:c.nowStamp(),acct:'s93',amount:1.123456789,cur:'SOL',fx:1,name:'b'}));d.txs.push(c.stamp({id:'i3',kind:'income',date:c.nowStamp(),acct:'s93',amount:0.000000001,cur:'SOL',fx:1,name:'c'}))})})()""")
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.balances(c.get()).get('s93')})()"); ok('float sum is exact %s'%r, r==1.42345679)
    # All in the entry form, then save
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'s93',toAcct:'e93'}})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    pg.click('[data-e=allamt]'); pg.wait_for_timeout(200); v=pg.input_value('#f-amount'); ok('All fills 9 decimals %s'%v, v.replace(',','')=='1.42345679')
    pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return [b.get('s93'),b.get('e93')]})()"); ok('source empty, destination exact %s'%r, r==[0,1.42345679])
    # a 9-decimal amount typed by hand is kept whole
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'e93',toAcct:'s93'}})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','0.123456789'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return [b.get('s93'),b.get('e93')]})()"); ok('9 decimals kept %s'%r, r==[0.123456789,1.300000001])
    # display shows the dust instead of hiding it
    t=pg.evaluate("(async()=>{const c=await import('/js/core.js');return [c.fmt(0.003123,'SOL'),c.fmt(1.5,'SOL'),c.fmt(1.123456789,'SOL')]})()"); ok('coin display keeps real digits %s'%t, t==['SOL 0.003123','SOL 1.50','SOL 1.123456789'])
    ok('exactAmt', pg.evaluate("(async()=>{const c=await import('/js/core.js');return [c.exactAmt(1.42345679),c.exactAmt(0.1+0.2),c.exactAmt(5e-11)]})()")==['1.42345679','0.3','0'])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
