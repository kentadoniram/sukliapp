# v13.45: shared bill paid in another currency keeps ONE hand-set rate; Earn auto-subscribe never makes Spot or Interest Earned negative
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'wusd',name:'Wallet USD',cur:'USD',type:'cash',open:500,include:true,archived:false}));for(const [i,n] of [['pa','Ana'],['pb','Ben']])d.accounts.push(c.stamp({id:i,name:n,cur:d.settings.homeCur||'PHP',type:'owed',open:0,include:true,archived:false}))})")
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Dinner'); pg.evaluate("(()=>{const e=document.querySelector('#f-acct');e.value='wusd';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(400); pg.fill('#f-amount','10.16'); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const e=document.querySelector('#f-peso');e.value='630';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.locator('.oth-who').nth(0).select_option('pa'); pg.locator('.oth-who').nth(1).select_option('pb'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(1500)
    r=J("return c.get().txs.filter(x=>!x.deleted&&x.name==='Dinner'||(x.name||'').startsWith('Paid for')&&x.name.includes('Dinner')).map(x=>[x.kind,x.amount,x.toAmount||null,+(x.fx/c.homeRate(c.get(),x.date)).toFixed(4)])")
    tr=[x for x in r if x[2]]
    ok('each person share = USD share x 62.0079 (%s)'%tr, len(tr)==2 and all(abs(x[2]-x[1]*630/10.16)<0.01 and abs(x[3]-62.0079)<0.001 for x in tr))
    ok('home totals add back to 630.00', abs(sum(x[2] for x in tr)+[x for x in r if not x[2]][0][1]*630/10.16-630)<0.02)
    J("c.commit(d=>{d.accounts.push(c.stamp({id:'zs',name:'Zed Spot USDC',wallet:'Spot',cur:'USDC',type:'crypto',assetType:'crypto',exchange:'Zed',open:1000,include:false,archived:false,invtab:true}),c.stamp({id:'ze',name:'Zed Earn USDC',wallet:'Earn',cur:'USDC',type:'crypto',assetType:'crypto',exchange:'Zed',open:0,include:false,archived:false,invtab:true}))})")
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');const f=await import('/js/finance.js');
      const t0=e.e8Ms('2026-11-01','02:00');
      c.commit(d=>{const a=d.accounts.find(x=>x.id==='ze');a.earn={on:true,apy:8.76,subOn:true,slots:['03:00','15:00'],from:'zs',lastHour:e.floorHour(t0),trackFrom:t0,lastSlot:t0};});
      for(const [dd,hm] of [['01','04:00'],['02','02:00'],['02','04:00'],['02','14:00'],['02','16:00'],['03','02:00'],['03','04:00'],['03','16:00']]) c.commit(d=>{e.runEarn(d,e.e8Ms('2026-11-'+dd,hm))});
      const d=c.get(),tr=f.balanceTrail(d),mins=[];
      for(const [id,l] of tr) for(const x of l) if(x.id==='zs') mins.push(x.after);
      const int=d.txs.filter(t=>t.earnDay).reduce((q,t)=>q+t.amount,0), sw=d.txs.filter(t=>t.earnAuto).reduce((q,t)=>q+t.amount,0), b=c.balances(d);
      return {min:Math.min(...mins),pos:d.txs.filter(t=>t.earnDay).every(t=>t.amount>0),total:b.get('zs')+b.get('ze'),want:1000+int}})()""")
    ok('Spot never negative after any entry (min %s)'%r['min'], r['min']>=-1e-9)
    ok('interest stays positive and balances add up %s'%r, r['pos'] and abs(r['total']-r['want'])<1e-6)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
