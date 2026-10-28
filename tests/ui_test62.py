# v13.2: Pay debt in the entry form
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.accounts.forEach(a=>{if(['card','loan'].includes(a.type))a.archived=true});
      d.accounts.push(c.stamp({id:'pc',name:'Pay Card',cur:c.HOME,type:'card',open:0,include:false,archived:false}));
      d.accounts.push(c.stamp({id:'pw',name:'Pay Wallet',cur:c.HOME,type:'bank',open:50000,include:true,archived:false}));
      d.txs.push(c.stamp({id:'p1',kind:'expense',amount:10000,cur:c.HOME,fx:1,date:c.nowStamp().slice(0,10)+' 08:00:00',name:'card buy',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:'pc'}))})})()""")
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(600)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry')
    btns=pg.eval_on_selector_all('#seg button','b=>b.map(x=>x.textContent)'); ok('four options %s'%btns, btns==['Expense','Income','Transfer','Pay debt'])
    sw=pg.evaluate("(()=>{const s=document.querySelector('#seg').getBoundingClientRect();return [s.width,...[...document.querySelectorAll('#seg button')].map(b=>b.getBoundingClientRect().width)]})()"); ok('options fit one row %s'%sw, max(sw[1:])<=sw[0]/4+2)
    pg.click('[data-e=kind][data-v=debt]'); pg.wait_for_timeout(300); t=pg.inner_text('#entry')
    ok('plain questions', 'What will you pay?' in t and 'Paid from' in t and 'not counted as spending' in t)
    ok('no fee row, no swap, no All button', pg.locator('#feerow *').count()==0 and pg.locator('.swapbtn').count()==0 and not pg.is_visible('#f-all'))
    ok('debt shown with what is owed', 'Pay Card' in t and 'You owe' in t)
    ok('all-I-owe chip', pg.locator('[data-e=debtamt]').count()>=1)
    pg.click('[data-e=acctpick][data-which=acct]'); pg.wait_for_selector('#aclist'); names=pg.inner_text('#aclist'); ok('Paid from lists no cards or loans', 'Pay Card' not in names and 'Pay Wallet' in names); pg.click('#aclist [data-id=pw]'); pg.wait_for_timeout(300)
    pg.click('[data-e=acctpick][data-which=to]'); pg.wait_for_selector('#aclist'); n2=pg.inner_text('#aclist'); ok('What will you pay lists only debts', 'Pay Card' in n2 and 'Pay Wallet' not in n2); pg.click('#aclist [data-id=pc]'); pg.wait_for_timeout(300)
    pg.click('[data-e=debtamt]:last-child'); pg.wait_for_timeout(300); ok('amount filled with all owed', pg.input_value('#f-amount').replace(',','').startswith('10000'))
    pg.fill('#f-amount','4000'); pg.wait_for_timeout(200)
    before=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return [b.get('pw'),b.get('pc')]})()")
    pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    after=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());const t=c.get().txs.find(x=>x.debtPay);return [b.get('pw'),b.get('pc'),t&&t.kind,t&&t.acct,t&&t.toAcct,t&&t.name,t&&t.fee]})()")
    print(before,after)
    ok('saved as a transfer with the debt flag', after[2]=='transfer' and after[3]=='pw' and after[4]=='pc' and after[5]=='Paid Pay Card' and not after[6])
    ok('wallet down 4000, debt down 4000', abs((before[0]-after[0])-4000)<0.01 and abs((after[1]-before[1])-4000)<0.01)
    sp=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(t=>!t.deleted&&t.kind==='expense'&&t.name==='Paid Pay Card').length})()"); ok('not an expense', sp==0)
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#ledger-list'); pg.fill('#q','Paid Pay'); pg.wait_for_timeout(500); lt=pg.inner_text('#ledger-list'); ok('ledger says Pay debt: '+lt[:80].replace('\n',' | '), 'Pay debt' in lt)
    pg.click('#ledger-list .row'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    ok('editing reopens in Pay debt', pg.get_attribute('[data-e=kind][data-v=debt]','aria-pressed')=='true' and 'What will you pay?' in pg.inner_text('#entry'))
    pg.click('[data-e=kind][data-v=transfer]'); pg.wait_for_timeout(300); ok('plain Transfer still shows From and To', 'From' in pg.inner_text('#entry') and pg.locator('.swapbtn').count()==1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/#/debts'); pg.wait_for_selector('.debtpage'); pg.click('[data-act=debt-pay]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    ok('Pay this debt opens the form with the debt chosen', pg.get_attribute('[data-e=kind][data-v=debt]','aria-pressed')=='true' and 'Pay Card' in pg.inner_text('#entry'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.fill('#f-what','credit card payment'); pg.wait_for_timeout(500); ok('smart chip offers Pay debt', 'Use Pay debt' in pg.inner_text('#entry'))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
