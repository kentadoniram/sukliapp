# v13.32: "Paid for others" with several people (equal, amounts, percent, with or without your own share) and the Owed to You history
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
def J(pg,js): return pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J(pg,"c.commit(d=>{d.settings.mode='advanced';for(const [i,n] of [['pplana','Ana'],['pplben','Ben'],['pplcy','Cy']])d.accounts.push(c.stamp({id:i,name:n,cur:d.settings.homeCur||'PHP',type:'owed',open:0,include:true,archived:false}))})")
    def open_entry(name,amt):
        pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
        pg.fill('#f-what',name); pg.fill('#f-amount',amt); pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    def pick(i,who): pg.locator('.oth-who').nth(i).select_option(who); pg.wait_for_timeout(150)
    def save(): pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(1200)
    def rows(name): return J(pg,"return c.get().txs.filter(x=>!x.deleted&&(x.name||'').includes('%s')).map(x=>[x.kind,x.amount,x.toAcct||'',!!x.splitId])"%name)
    # A: one person, equal, you are included
    open_entry('UT A dinner','1200'); pick(0,'pplana'); save(); r=rows('UT A dinner')
    ok('A: your half is the expense, Ana owes her half %s'%r, sorted(r)==sorted([['expense',600,'',True],['transfer',600,'pplana',True]]))
    # B: three people, equal, you are not part of it
    pg.wait_for_timeout(1500); open_entry('UT B bill','900'); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pick(0,'pplana'); pick(1,'pplben'); pick(2,'pplcy'); pg.evaluate("document.querySelector('.oth-me').click()"); pg.wait_for_timeout(200)
    ok('B: summary says you are not part of it', 'not part of it' in pg.inner_text('#oth-sum') and '300' in pg.inner_text('#oth-sum'))
    save(); r=rows('UT B bill')
    ok('B: three transfers of 300 and no expense %s'%r, sorted(r)==sorted([['transfer',300,'pplana',True],['transfer',300,'pplben',True],['transfer',300,'pplcy',True]]))
    gid=J(pg,"return new Set(c.get().txs.filter(x=>!x.deleted&&(x.name||'').includes('UT B bill')).map(x=>x.splitId)).size"); ok('B: all three share one bill id', gid==1)
    # C: unequal amounts, you included
    pg.wait_for_timeout(1500); open_entry('UT C bill','1000'); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=amount]').click()"); pg.wait_for_timeout(200)
    pick(0,'pplana'); pick(1,'pplben'); pg.locator('.oth-n').nth(0).fill('300'); pg.locator('.oth-n').nth(1).fill('200'); pg.wait_for_timeout(150)
    ok('C: summary shows your part 500', '500' in pg.inner_text('#oth-sum'))
    save(); r=rows('UT C bill'); ok('C: expense 500, Ana 300, Ben 200 %s'%r, sorted(r)==sorted([['expense',500,'',True],['transfer',300,'pplana',True],['transfer',200,'pplben',True]]))
    # D: percentages, not included: must add to 100
    pg.wait_for_timeout(1500); open_entry('UT D bill','1000'); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=pct]').click()"); pg.wait_for_timeout(200)
    pick(0,'pplana'); pick(1,'pplben'); pg.locator('.oth-n').nth(0).fill('25'); pg.locator('.oth-n').nth(1).fill('25'); pg.evaluate("document.querySelector('.oth-me').click()"); pg.wait_for_timeout(200)
    save(); ok('D: 50 percent in total is refused when you are not part of it', len(rows('UT D bill'))==0 and pg.locator('#err').is_visible())
    pg.locator('.oth-n').nth(0).fill('50'); pg.locator('.oth-n').nth(1).fill('50'); pg.wait_for_timeout(150); save(); r=rows('UT D bill')
    ok('D: two transfers of 500 %s'%r, sorted(r)==sorted([['transfer',500,'pplana',True],['transfer',500,'pplben',True]]))
    # history on the Owed to You tab
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(900)
    ok('names are tappable', pg.locator('[data-act=owed-hist]').count()>=3)
    pg.evaluate("document.querySelector('[data-act=owed-hist][data-id=pplana]').click()"); pg.wait_for_selector('.ohist'); t=pg.inner_text('.sheet')
    ok('history lists how they came to owe you, with details %s'%t[:0], t.count('Lent')>=4 and 'Part of: UT A dinner' in t and 'Still owed' in t and 'owed after' in t)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    J(pg,"const t=c.get().txs.find(x=>!x.deleted&&x.kind==='transfer'&&x.toAcct==='pplana'&&x.name.includes('UT A'));c.commit(d=>{d.txs.push(c.stamp({id:'pb1',kind:'transfer',amount:200,toAmount:200,cur:t.cur,fx:t.fx,date:'2099-01-01 10:00:00',name:'Ana paid back',cat:'',acct:'pplana',toAcct:t.acct,lentBack:true,debtPay:false}))})")
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(700); pg.evaluate("document.querySelector('[data-act=owed-hist][data-id=pplana]').click()"); pg.wait_for_selector('.ohist'); t=pg.inner_text('.sheet')
    ok('payment back shows in the history', 'Paid back' in t and '200' in t)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
