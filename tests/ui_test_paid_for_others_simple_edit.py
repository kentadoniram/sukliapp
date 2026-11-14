# v15.37: Paid for others shows in Simple mode and when editing an existing entry
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(c); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':850})
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    pg.click('.fab'); pg.wait_for_selector('#othrow'); pg.wait_for_timeout(300)
    ok('new entry shows Paid for others', pg.locator('#othrow [data-e=oth-on]').is_visible())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{const cat=d.categories.find(x=>x.kind==='expense');const acc=d.accounts.find(x=>!x.deleted&&x.include);d.accounts.push(c.stamp({id:'pa',name:'Ana',cur:acc.cur,type:'owed',open:0,include:true,archived:false}));d.txs.push(c.stamp({id:'e1',kind:'expense',date:c.nowStamp(),acct:acc.id,cur:acc.cur,fx:1,amount:1000,name:'Dinner',cat:cat.id,toAcct:'',toAmount:null,fee:0,notes:'',labels:'',items:[],flag:null,createdAt:Date.now()}))})")
    pg.evaluate("(async()=>{const s=await import('/js/entryview.js');s.openEntryView('e1')})()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-ev=edit]').click()"); pg.wait_for_selector('#othrow'); pg.wait_for_timeout(400)
    ok('edit shows Paid for others', pg.locator('#othrow [data-e=oth-on]').count()==1)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('.oth-who').value='pa';document.querySelector('.oth-who').dispatchEvent(new Event('change',{bubbles:true}))"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#entry form, form').requestSubmit()"); pg.wait_for_timeout(800)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.filter(x=>!x.deleted);return t.map(x=>[x.name,x.amount,!!x.lent])})()")
    print(r)
    ok('edit saved: expense now 500 and a 500 lent entry', any(x[1]==500 and not x[2] for x in r) and any(x[1]==500 and x[2] for x in r))
    b.close()
