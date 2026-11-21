# v15.37 batch 4: split-item categories/tax order/qty, reimbursable pill, hide investment accounts, list alignment
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("""c.commit(d=>{d.settings.mode='advanced';const acc=d.accounts.find(x=>!x.deleted&&x.include);acc.cur='JPY';
      const cats=d.categories.filter(x=>x.kind==='expense');const a=cats[0],b2=cats[5],c2=cats[9];
      for(let i=0;i<3;i++)d.txs.push(c.stamp({id:'r'+i,kind:'expense',date:c.nowStamp(),acct:acc.id,cur:'JPY',fx:1,amount:500,name:'Shop',cat:a.id,items:[{n:'x',amt:200,q:1,cat:a.id},{n:'y',amt:300,q:1,cat:b2.id}],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}));
      d.txs.push(c.stamp({id:'rb',kind:'expense',date:c.nowStamp(),acct:acc.id,cur:'JPY',fx:1,amount:640,name:'Train: Kawasaki-Yurakucho',cat:a.id,reimb:{co:'ACME',st:'pending'},items:[],toAcct:'',toAmount:null,fee:0,notes:'',labels:'',flag:null,createdAt:Date.now()}));
      d.settings.ctx={a:a.id,b:b2.id};})""")
    # reimbursable pill in list and in details
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(1000)
    ok('Entries list shows Reimbursable', 'Reimbursable' in pg.inner_text('#view'))
    pg.evaluate("document.querySelector('[data-id=rb]').click()"); pg.wait_for_selector('.evw'); 
    ok('Entry details show Reimbursable', 'Reimbursable' in pg.inner_text('.evw'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # split items: JPY puts 8% first, related category first, qty typeable
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=items-on]').click()"); pg.wait_for_timeout(300)
    ok('qty is an input', pg.locator('.items .item .in-q').count()>=1)
    ctx=J("return c.get().settings.ctx")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');const x=c.get().settings.ctx;const s=document.querySelector('.items .item .in-c');s.value=x.a;s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    if pg.locator('.items .item').count()<2:
        pg.evaluate("document.querySelector('[data-e=item-add]').click()"); pg.wait_for_timeout(300)
    groups=pg.evaluate("[...document.querySelectorAll('.items .item')].slice(-1)[0].querySelector('.in-c').querySelectorAll('optgroup')[0].label")
    ok('next item lists related categories first: %s'%groups, groups.startswith('Goes with'))
    b.close()
