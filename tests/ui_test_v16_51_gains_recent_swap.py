# v16.51: Gains rows aligned, Recent earnings grouped by day, Convert shows two assets side by side with the swap between
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+('' if c else '  ['+str(x)[:200]+']'))
SEED="""async()=>{const c=await import('/js/core.js');const {stamp,commit}=c;
 commit((d)=>{for(const [id,cur] of [['wA','AAA'],['wB','BBB']]) d.accounts.push(stamp({id,name:cur,cur,type:'crypto',open:100,include:true,archived:false,exchange:'Binance',wallet:'Spot'}));
  d.settings.rates=d.settings.rates||{}; d.settings.rates.AAA=10; d.settings.rates.BBB=20;});}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate(SEED); pg.evaluate("localStorage.setItem('sukli-dpanels','[\"i-gain\"]')"); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    g=pg.evaluate("()=>[...document.querySelectorAll('.rowbtn')].map(e=>{const r=e.getBoundingClientRect(),k=[...e.children],v=k[k.length-1].getBoundingClientRect();return Math.round(r.right-v.right)})")
    ok('Earned rows: the figure sits at the right edge like the other rows', len(g)==2 and all(x<=30 for x in g), g)
    pg.evaluate("()=>{const e=document.querySelectorAll('.calfacts li:not(:has(.rowbtn))');}")
    others=pg.evaluate("()=>[...document.querySelectorAll('.calfacts li:not(:has(.rowbtn))')].filter(l=>l.offsetWidth&&l.children.length>=2).slice(0,6).map(l=>{const r=l.getBoundingClientRect(),v=l.children[l.children.length-1].getBoundingClientRect();return Math.round(r.right-v.right)})")
    ok('and the same gap as other rows (within 30px)', others and all(abs(x-g[0])<=30 for x in others), (g,others))
    # Recent earnings by day: seed two days of Earn income
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{const day=(n)=>new Date(Date.now()-n*864e5).toISOString().slice(0,10)+' 09:00:00';
      d.accounts.push(c.stamp({id:'ea',name:'EarnUSDT',cur:'USDT',type:'crypto',open:100,include:true,archived:false,exchange:'Binance',wallet:'Earn',earn:{on:true,apy:5}}));
      for(const [i,n,v] of [['e1',1,0.5],['e2',1,0.25],['e3',2,0.4]]) d.txs.push(c.stamp({id:i,kind:'income',amount:v,cur:'USDT',fx:1,acct:'ea',date:day(n),name:'Earn interest',earnDay:true,cat:'Crypto earned',fee:0,notes:'',labels:'',items:[]}));});}""")
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(300); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(1200); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    pg.locator('.pkbtn:has-text("Recent")').first.click(); pg.wait_for_timeout(400)
    ok('Recent window is grouped by day', pg.locator('.dayblk').count()>=2, pg.locator('.dayblk').count())
    ok('each day shows a total and a record count', all('record' in t for t in pg.locator('.dayblk > summary').all_inner_texts()))
    first=pg.locator('.dayblk').first; n=first.locator('.calfacts li').count()
    ok('records are listed inside the day', n>=1, n)
    ok('the two same-day entries add up in the day total', any('+' in t and 'record' in t for t in pg.locator('.dayblk > summary').all_inner_texts()))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    for theme in ('theme1','legacy'):
        pg.evaluate("t=>{const l=JSON.parse(localStorage.getItem('sukli-look')||'{}');l.design=t;localStorage.setItem('sukli-look',JSON.stringify(l))}",theme); pg.reload(); pg.wait_for_timeout(1500)
        pg.evaluate("async()=>{const m=await import('/js/trades.js');m.openTrade({asset:'wA',platform:'Binance',side:'convert'})}"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(500)
        r=pg.evaluate("()=>{const q=(s)=>document.querySelector(s).getBoundingClientRect();const a=q('#tp-from'),m=q('#tr-swap-p'),c=q('#tp-to');return {sameRow:Math.abs(a.top-c.top)<6&&Math.abs(a.top-m.top)<60,between:a.right<=m.left+1&&m.right<=c.left+1,fits:document.documentElement.scrollWidth<=innerWidth+1,fromQty:!!document.querySelector('#tp-from [name=qty]'),toQty:!!document.querySelector('#tp-to [name=qty2]')}}")
        ok(theme+': two assets side by side in one row', r['sameRow'], r); ok(theme+': swap button sits between them', r['between'], r)
        ok(theme+': each side has its own amount and nothing overflows', r['fromQty'] and r['toQty'] and r['fits'], r)
        pg.click('#tr-swap-p'); pg.wait_for_timeout(300)
        ok(theme+': swap works from the middle button', pg.evaluate("document.querySelector('#tr [name=asset]').value")!='wA')
        pg.evaluate("document.querySelector('#tr [data-side=buy]').click()"); pg.wait_for_timeout(300)
        ok(theme+': leaving Convert puts the fields back', pg.evaluate("document.querySelector('#tr-pair').hidden && !document.querySelector('#tp-from [name=qty]') && !!document.querySelector('#tr [name=qty]')"))
        pg.evaluate("document.querySelector('#tr [data-x]')?.click()"); pg.wait_for_timeout(300)
    ok('no page errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
