from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';d.settings.invOpen='spot';
      const A=(id,name,cur,ex,w,amt)=>{d.accounts.push(c.stamp({id,name,type:'crypto',cur,exchange:ex,wallet:w,include:true,invtab:true}));d.txs.push(c.stamp({id:'t'+id,kind:'income',date:c.nowStamp(),acct:id,cur,fx:1,amount:amt,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}))};
      A('b1','Binance BTC','BTC','Binance','Spot',1.23456789);A('b2','Binance USDT','USDT','Binance','Spot',123456.789);A('b3','Binance BTC Earn','BTC','Binance','Earn',2);A('b4','Binance SHIB','SHIB','Binance','Spot',987654321.12345)})""")
    # version
    v=J("return (await import('/js/version.js')).versionText()"); v=pg.evaluate("(async()=>(await import('/js/version.js')).versionText())()"); print(v)
    ok('version is past 37', int(v.split('.')[1])>=43)
    sw=pg.evaluate("fetch('/sw.js').then(r=>r.text())"); ok('sw cache name matches version', ("sukli-v15.%s'"%v.split('.')[1]) in sw)
    # Spot tab contained
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(1200); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); pg.wait_for_timeout(300)
    r=pg.evaluate("""[...document.querySelectorAll('.hold')].map(h=>{const rc=h.getBoundingClientRect(),a=h.querySelector('.ramt').getBoundingClientRect(),m=h.querySelector('.rmain small');const pr=h.closest('.wblock').getBoundingClientRect();return {inside:a.right<=pr.right+1&&rc.right<=pr.right+1,clip:m.scrollWidth>m.clientWidth+1,wrap:getComputedStyle(m).whiteSpace}})""")
    print(r); ok('amounts stay inside the card', all(x['inside'] for x in r)); ok('detail lines are not clipped', all(not x['clip'] for x in r))
    ok('page does not scroll sideways', pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
    pg.evaluate("document.querySelector('.wsw [data-w=__overview]').click()"); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    r=pg.evaluate("[...document.querySelectorAll('.ovrow, .ovrow .coll')].map(e=>{const s=getComputedStyle(e);return [s.borderTopWidth,s.borderLeftWidth,s.borderBottomWidth]})"); print(r)
    ok('Overview has no divider lines or bars', r and all(all(x=='0px' for x in y) for y in r))
    ok('Overview amounts stay on one line', pg.evaluate("[...document.querySelectorAll('.ovpart .ramt b')].every(b=>b.getBoundingClientRect().height<30)"))
    # entry form
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(600)
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    ok('no top bar', pg.locator('.typebar').count()==0)
    cs=pg.evaluate("['expense','income','transfer'].map(k=>getComputedStyle(document.querySelector('#seg [data-v='+k+']')).backgroundColor+'|'+getComputedStyle(document.querySelector('#seg [data-v='+k+']')).color)"); print(cs)
    ok('Expense selected: red fill', cs[0].split('|')[0].startswith('rgb(181, 65, 47)'))
    ok('Income label green, Transfer label blue', cs[1].split('|')[1]=='rgb(22, 119, 78)' and cs[2].split('|')[1]=='rgb(47, 111, 208)')
    pg.click('[data-e=kind][data-v=transfer]'); pg.wait_for_timeout(300)
    ok('Transfer selected: blue fill', pg.evaluate("getComputedStyle(document.querySelector('#seg [data-v=transfer]')).backgroundColor")=='rgb(47, 111, 208)')
    pg.click('[data-e=kind][data-v=expense]'); pg.wait_for_timeout(300)
    ok('Reimbursable caption removed', 'Work travel, meals or supplies' not in pg.inner_text('#reimbrow'))
    m=pg.evaluate("(()=>{const b=document.querySelector('#reimbrow .reimbbox');const s=getComputedStyle(b);return [s.marginTop,s.marginBottom,s.paddingTop,s.borderTopWidth]})()"); print(m)
    ok('Reimbursable section has no extra margin, padding or border', m==['0px','0px','0px','0px'])
    ok('no errors %s'%errs, not errs)
    b.close()
