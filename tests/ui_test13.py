from playwright.sync_api import sync_playwright
from pkhelp import choose
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page(); pg.add_init_script("try{var c=JSON.parse(localStorage.getItem('sukli-coll')||'{}');if(c['i-crypto']===undefined){c['i-crypto']=false;localStorage.setItem('sukli-coll',JSON.stringify(c))}}catch(e){}"); 
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
    # new account sheet: searchable currency picker + own token + exchange
    pg.goto('http://localhost:8123/index.html#/accounts'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-act=acct-new]').click()"); pg.wait_for_selector('#acct-form')
    pg.click('[data-act=acct-cur]'); pg.wait_for_selector('#curq')
    pg.fill('#curq','thai'); pg.wait_for_timeout(200)
    ok('search finds Thai Baht with flag', 'THB' in pg.inner_text('#curlist') and '🇹🇭' in pg.inner_text('#curlist'))
    pg.fill('#curq','japan'); pg.wait_for_timeout(200); ok('search by country', 'JPY' in pg.inner_text('#curlist'))
    pg.fill('#curq','bbsol'); pg.wait_for_timeout(200)
    pg.click('[data-new]'); pg.wait_for_timeout(400)
    ok('custom token selected in form', pg.input_value('input[name=cur]')=='BBSOL')
    pg.fill('input[name=name]','Bybit BBSOL'); pg.select_option('select[name=type]','crypto'); choose(pg,'select[name=exchange]',value='Bybit'); pg.click('#acct-form .btn:not(.ghost):not(.danger)'); pg.wait_for_timeout(400)
    a=pg.evaluate("window.sukli.get().accounts.find(a=>a.name==='Bybit BBSOL')")
    ok('account saved with token and exchange', a and a['cur']=='BBSOL' and a['exchange']=='Bybit')
    ok('token keeps 8 decimals', pg.evaluate("window.sukli.get().settings.curDec.BBSOL")==8)
    pg.reload(); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/index.html#/accounts'); pg.wait_for_timeout(500)
    pg.select_option('[data-aview=group]','exchange'); pg.wait_for_timeout(300)
    ok('accounts page keeps investments in their own block', pg.locator('.invblock').count()==1)
    pg.goto('http://localhost:8123/index.html#/invest'); pg.wait_for_timeout(600)
    ok('exchange group shown (Investments tab)', 'Bybit' in pg.inner_text('main, #app'))
    # custom account type (receivable) from Settings
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('#atype-new')
    pg.fill('#atype-new','Prepaid pot'); pg.click('[data-act=atype-add]'); pg.wait_for_timeout(400)
    ok('custom type stored', pg.evaluate("Object.values(window.sukli.get().settings.customTypes||{}).some(v=>v.label==='Prepaid pot')"))
    key=pg.evaluate("Object.keys(window.sukli.get().settings.customTypes)[0]")
    pg.evaluate("window.sukli.commit(d=>{d.accounts.push({id:'rcv',name:'Owed by Juan',cur:'PHP',type:'%s',open:0,include:false,archived:false,updatedAt:Date.now()})})" % key)
    nw0=pg.evaluate("(async()=>{const m=await import('./js/finance.js');return m.netWorth(window.sukli.get()).net})()")
    pg.evaluate("window.sukli.commit(d=>{const src=d.accounts.find(a=>a.type==='bank'&&a.cur==='PHP'&&!a.deleted);d.txs.push({id:'loan1',kind:'transfer',amount:1000,toAmount:1000,cur:'PHP',fx:1,date:'2026-10-18 10:00:00',name:'Lent to Juan',cat:'',acct:src.id,toAcct:'rcv',updatedAt:Date.now()})})")
    nw1=pg.evaluate("(async()=>{const m=await import('./js/finance.js');return m.netWorth(window.sukli.get()).net})()")
    ok('lending moves money to receivable, net worth unchanged', abs(nw1-nw0)<1e-6)
    # trade transfer between two crypto accounts shows trade wording + fee type
    pg.evaluate("window.sukli.commit(d=>{d.accounts.push({id:'ex1',name:'Bybit USDT x',cur:'USDT',type:'crypto',venue:'Bybit',open:500,include:false,archived:false,updatedAt:Date.now()})})")
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.click('[data-e="kind"][data-v="transfer"]')
    pg.select_option('#f-acct','ex1'); pg.wait_for_timeout(200)
    opts=pg.evaluate("[...document.querySelectorAll('#f-to option')].map(o=>o.value)")
    pg.select_option('#f-to','')if False else None
    # choose BBSOL account as receiver
    rid=pg.evaluate("window.sukli.get().accounts.find(a=>a.name==='Bybit BBSOL').id")
    pg.select_option('#f-to',rid); pg.wait_for_timeout(200)
    ok('trade wording shown', 'Trade' in pg.inner_text('#convrow'))
    pg.check('#f-conv'); pg.fill('#f-amount','100'); pg.fill('#f-toamt','0.5'); pg.wait_for_timeout(200)
    ok('inverse price shown', '1 BBSOL =' in pg.inner_text('#convrow'))
    b.close()
print('ERRORS',errs); print(sum(res),'/',len(res))
