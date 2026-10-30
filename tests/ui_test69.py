# v13.8: an old account changed to "Money owed to me", fully paid back: still listed, selectable, history linked
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block',has_touch=True); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)+(e.stack or '')[:300]))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.accounts.push(c.stamp({id:'bw',name:'Bank W',cur:c.HOME,type:'bank',open:50000,include:true,archived:false}));
      d.accounts.push(c.stamp({id:'bn',name:'Ben receivable',cur:c.HOME,type:'other',open:0,include:false,archived:false}));
      const D=c.nowStamp().slice(0,10);
      d.txs.push(c.stamp({id:'l1',kind:'transfer',amount:3000,cur:c.HOME,fx:1,date:D+' 08:00:00',name:'Lent Ben',acct:'bw',toAcct:'bn',toAmount:3000,fee:0}));
      d.txs.push(c.stamp({id:'l2',kind:'transfer',amount:3000,cur:c.HOME,fx:1,date:D+' 09:00:00',name:'Ben paid',acct:'bn',toAcct:'bw',toAmount:3000,fee:0}))})})()""")
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(600)
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openReclass('bn')})()"); pg.wait_for_selector('.invopt'); pg.click('.invopt[data-t=owed]'); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear()"); pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(600)
    ok('Accounts page not blank (default grouping)', 'Money owed to me' in pg.inner_text('#view'))
    ok('account row listed on Accounts', pg.locator('.row.acct[data-id=bn]').count()==1)
    pg.click('.row.acct[data-id=bn]'); pg.wait_for_timeout(500); ok('account opens', 'Ben receivable' in pg.inner_text('#view') or 'Ben receivable' in pg.inner_text('body'))
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(600); t=pg.inner_text('#view')
    ok('Owed page lists him with the payback linked: '+t[-300:].replace('\n',' | '), 'Ben receivable' in t and 'Paid back' in t and '3,000' in t.replace('₱','') )
    pg.click('summary:has-text("Paid back")') if pg.locator('summary:has-text("Paid back")').count() else None
    ok('Lend again button there', pg.locator('[data-act=owed-more][data-id=bn]').count()==1)
    pg.click('[data-act=owed-more][data-id=bn]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300); ok('Lend again opens with him chosen', 'Ben receivable' in pg.inner_text('#acctrow'))
    pg.keyboard.press('Escape'); pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.click('[data-e=kind][data-v=lent]'); pg.wait_for_timeout(300); pg.click('[data-e=flow][data-v=back]'); pg.wait_for_timeout(300)
    pg.click('[data-e=acctpick][data-which=acct]'); pg.wait_for_selector('#aclist'); ok('picker lists him for paid back', pg.locator('#aclist [data-id=bn]').count()==1)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[aria-label=Menu],[data-act=menu],[data-act=drawer],.menubtn')&&document.querySelector('[aria-label=Menu],[data-act=menu],[data-act=drawer],.menubtn').click()"); pg.wait_for_timeout(300)
    ok('menu has Owed to you and Accounts', pg.locator('text=Owed to you').count()>=1 and pg.locator('a:has-text("Accounts")').count()>=1)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
