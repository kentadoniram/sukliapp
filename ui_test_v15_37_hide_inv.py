from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'inv1',name:'Binance',type:'crypto',cur:'USDT',include:true,openBal:100}));d.txs.push(c.stamp({id:'i1',kind:'income',date:c.nowStamp(),acct:'inv1',cur:'USDT',fx:1,amount:100,name:'dep',cat:'',items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}))})")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(1000)
    ok('shown', 'Binance' in pg.inner_text('#view') or 'USDT' in pg.inner_text('#view').split('Performance')[-1] or pg.locator('#view :text("Binance")').count()>0); 
    J("c.commit(d=>{d.accounts.find(a=>a.id==='inv1').invHidden=true})"); pg.wait_for_timeout(800); pg.goto('http://localhost:8123/#/invest'); pg.reload(); pg.wait_for_timeout(1000)
    ok('hidden', 'binance' not in pg.inner_text('#view').lower().split('hidden from this tab')[0])
    ok('account still exists', J("return !!c.get().accounts.find(a=>a.id==='inv1'&&!a.deleted)"))
    print(pg.inner_text('#view')[:600]); ok('hidden link', 'idden' in pg.inner_text('#view'))
    ok('no errors %s'%errs, not errs)
    # JPY tax order
    b.close()
