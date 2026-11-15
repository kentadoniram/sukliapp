from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';const acc=d.accounts.find(x=>!x.deleted);
      d.txs.push(c.stamp({id:'rb',kind:'expense',date:c.nowStamp(),acct:acc.id,cur:acc.cur,fx:1,amount:640,name:'Train fare',cat:'',reimb:{co:'ACME',st:'pending'},items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}));
      d.txs.push(c.stamp({id:'rp',kind:'expense',date:c.nowStamp(),acct:acc.id,cur:acc.cur,fx:1,amount:300,name:'Taxi',cat:'',reimb:{co:'ACME',st:'paid',got:200,on:c.nowStamp(),rid:'none'},items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}))})""")
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(900)
    # 3 reimbursable details
    pg.evaluate("document.querySelector('[data-id=rb]').click()"); pg.wait_for_selector('.evw'); t=pg.inner_text('.evw')
    ok('details box shows company, status, amount', all(x in t for x in ['Reimbursable','ACME','Waiting','Amount to get back','640']))
    pg.evaluate("document.querySelectorAll('.sheet,.scrim').forEach(x=>x.remove())")
    pg.evaluate("document.querySelector('[data-id=rp]').click()"); pg.wait_for_selector('.evw'); t=pg.inner_text('.evw')
    ok('paid one shows received and the part not paid', 'Received' in t and 'Not paid back' in t and '100' in t)
    pg.evaluate("document.querySelectorAll('.sheet,.scrim').forEach(x=>x.remove())")
    # 2 qty field has no clear x
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=items-on]').click()"); pg.wait_for_timeout(300)
    pg.click('.items .item .in-q'); pg.wait_for_timeout(300)
    ok('no clear X over quantity', pg.evaluate("(()=>{const x=document.querySelector('.clearx');return !x||x.hidden||!x.isConnected})()"))
    pg.evaluate("document.querySelectorAll('.sheet,.scrim').forEach(x=>x.remove())")
    # 1 date picker buttons
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    pg.click('#f-when'); pg.wait_for_selector('#dp'); pg.wait_for_timeout(300)
    r=pg.evaluate("(()=>{const bs=[...document.querySelectorAll('#dp .btnrow .btn')].map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,rad:parseFloat(getComputedStyle(b).borderTopLeftRadius),right:r.right}});return {bs,vw:innerWidth}})()")
    print(r)
    ok('Cancel and Set are round pills', len(r['bs'])==2 and all(x['rad']>=20 for x in r['bs']))
    ok('pills are not stretched blocks', all(x['w']<200 for x in r['bs']))
    ok('right aligned like Save', r['bs'][1]['right']>r['vw']-60)
    pg.evaluate("document.querySelectorAll('.sheet,.scrim').forEach(x=>x.remove())")
    # 4 compare rates
    pg.click('header [data-act=menu]'); pg.wait_for_selector('.drawer'); ok('burger has no Compare Rates', 'Compare Rates' not in pg.inner_text('.drawer'))
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(800); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    ok('Settings has Compare Rates', 'Compare Rates' in pg.inner_text('#view'))
    pg.click('[data-act=open-rates]'); pg.wait_for_timeout(700); ok('opens the rates page', 'Savings and earning options' in pg.inner_text('#view'))
    ok('no errors %s'%errs, not errs)
    b.close()
