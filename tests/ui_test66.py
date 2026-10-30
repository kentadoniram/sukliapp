# v13.6: Debt (pay or borrow), Lent (lend or paid back), detail line, Owed to you tab, overpaid extra, write-off
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
BAL="(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return {pw:b.get('pw'),pc:b.get('pc'),fr:b.get('fr')}})()"
def save(pg): pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
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
    ok('no note under Expense', pg.locator('.segnote').count()==0)
    pg.click('[data-e=kind][data-v=transfer]'); pg.wait_for_timeout(200); ok('Transfer shows what it is', 'between your own accounts' in pg.inner_text('.segnote'))
    pg.click('[data-e=kind][data-v=debt]'); pg.wait_for_timeout(300)
    ok('Debt offers paid / borrowed', pg.locator('[data-e=flow]').count()==2 and 'I borrowed money' in pg.inner_text('.segsub') and 'Pay or borrow' in pg.inner_text('.segnote') or 'record money you borrowed' in pg.inner_text('.segnote'))
    # borrow
    pg.click('[data-e=flow][data-v=borrow]'); pg.wait_for_timeout(300); t=pg.inner_text('#entry')
    ok('borrow questions', 'Who did you borrow from?' in t and 'Received into' in t and 'not income' in t)
    pg.click('[data-e=acctpick][data-which=acct]'); pg.wait_for_selector('#aclist'); n1=pg.inner_text('#aclist'); ok('borrowed-from lists only debts', 'Pay Card' in n1 and 'Pay Wallet' not in n1); pg.click('#aclist [data-id=pc]'); pg.wait_for_timeout(300)
    pg.click('[data-e=acctpick][data-which=to]'); pg.wait_for_selector('#aclist'); pg.click('#aclist [data-id=pw]'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','3000'); before=pg.evaluate(BAL); save(pg); after=pg.evaluate(BAL)
    ok('wallet up 3000, card debt up 3000', abs((after['pw']-before['pw'])-3000)<0.01 and abs((before['pc']-after['pc'])-3000)<0.01)
    ok('borrow saved with its flag, not income', pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.debtBorrow);return !!t&&t.kind==='transfer'&&t.name==='Borrowed from Pay Card'})()"))
    # lend (add a person)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.click('[data-e=kind][data-v=lent]'); pg.wait_for_timeout(300); t=pg.inner_text('#entry')
    ok('Lent offers lent / paid back', 'I lent money' in pg.inner_text('.segsub') and 'They paid me back' in pg.inner_text('.segsub') and 'Who did you lend to?' in t)
    pg.click('[data-e=acctpick][data-which=to]'); pg.wait_for_selector('#aclist'); pg.click('[data-addnew]'); pg.wait_for_selector('input[name=v]'); pg.fill('input[name=v]','Ana'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    ok('person added and chosen', 'Ana' in pg.inner_text('#acctrow'))
    pg.click('[data-e=acctpick][data-which=acct]'); pg.wait_for_selector('#aclist'); pg.click('#aclist [data-id=pw]'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','2000'); save(pg)
    st=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.type==='owed');const b=c.balances(c.get());const t=c.get().txs.find(x=>x.lent);return [a&&a.name,a&&b.get(a.id),t&&t.kind,t&&t.name,a&&a.id]})()"); aid=st[4]
    ok('lent: owed account holds 2000, saved as a transfer: %s'%st[:4], st[0]=='Ana' and abs(st[1]-2000)<0.01 and st[2]=='transfer' and st[3]=='Lent to Ana')
    sp=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(t=>!t.deleted&&(t.kind==='expense'||t.kind==='income')&&/Ana/.test(t.name)).length})()"); ok('lending is not spending or income', sp==0)
    # owed tab
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_selector('.owedpage'); t=pg.inner_text('.owedpage')
    ok('Owed to you shows Ana and the total', 'Ana' in t and '2,000' in t and 'Waiting since' in t and 'They paid me back' in t)
    # partial pay back
    pg.click('[data-act=owed-back]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300); ok('opens Paid back with Ana', 'Who paid you back?' in pg.inner_text('#entry') and 'Ana' in pg.inner_text('#acctrow') and pg.locator('[data-e=debtamt]').count()==1)
    pg.fill('#f-amount','500'); save(pg); st=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return b.get('%s')})()"%aid); ok('partial payment leaves 1500 (%s)'%st, abs(st-1500)<0.01)
    # overpaid
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_selector('.owedpage'); pg.click('[data-act=owed-back]'); pg.wait_for_selector('#entry'); pg.fill('#f-amount','1800'); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(500)
    ok('overpaid asks what the extra is (not gift)', 'more than they owed' in pg.locator('.sheet').last.inner_text() and 'Interest earned' in pg.locator('.sheet').last.inner_text() and 'gift' not in pg.locator('.sheet').last.inner_text().lower())
    pg.click('[data-x="Interest earned"]'); pg.wait_for_timeout(900)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get(),b=c.balances(d);const inc=d.txs.find(t=>!t.deleted&&t.kind==='income'&&/Interest earned/.test(t.name));return [b.get('%s'),inc&&inc.amount]})()"%aid)
    ok('owed goes to 0 and the extra 300 is income: %s'%r, abs(r[0])<0.01 and r[1] and abs(r[1]-300)<0.01)
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_selector('.owedpage'); ok('Ana moves to Paid back', 'Paid back (1)' in pg.inner_text('.owedpage') or 'Everyone has paid you back' in pg.inner_text('.owedpage'))
    # write-off
    pg.click('[data-act=owed-new]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300); pg.fill('#f-amount','900'); save(pg)
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_selector('.owedpage'); pg.click('[data-act=owed-edit]'); pg.wait_for_selector('.sheet form'); pg.click('[data-off]'); pg.wait_for_timeout(400); pg.click('[data-yes]'); pg.wait_for_timeout(900)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get(),b=c.balances(d);const t=d.txs.find(x=>!x.deleted&&x.kind==='expense'&&/Not paid back/.test(x.name));return [b.get('%s'),t&&t.amount]})()"%aid)
    ok('write-off sets owed to 0 and records a loss: %s'%r, abs(r[0])<0.01 and r[1] and abs(r[1]-900)<0.01)
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#ledger-list'); pg.fill('#q','Lent to'); pg.wait_for_timeout(500); lt=pg.inner_text('#ledger-list'); ok('ledger says Lent', 'Lent' in lt)
    pg.click('#ledger-list .row'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300); ok('editing reopens in Lent', 'Who did you lend to?' in pg.inner_text('#entry') and pg.get_attribute('[data-e=flow][data-v=lend]','aria-pressed')=='true')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok('no errors', not errs)
print('fails=%d'%len([r for r in res if not r]))
