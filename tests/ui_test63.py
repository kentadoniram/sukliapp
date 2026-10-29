# v13.4: Merchant (where you bought it), separate from the category
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry')
    ok('merchant row shows for expenses', pg.is_visible('#merchrow') and 'Merchant (optional)' in pg.inner_text('#merchrow'))
    y0=pg.evaluate("document.querySelector('#merchrow').getBoundingClientRect().height")
    pg.type('#f-what','Shopee pork chop',delay=15); pg.wait_for_timeout(500)
    y1=pg.evaluate("document.querySelector('#merchrow').getBoundingClientRect().height")
    ok('suggested from the name', 'Shopee' in pg.inner_text('#merchrow') and 'suggested' in pg.inner_text('#merchrow'))
    ok('the merchant row keeps its height when the suggestion appears (%s, %s)'%(y0,y1), abs(y0-y1)<1)
    pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mlist'); lt=pg.inner_text('#mlist'); ok('picker lists suggestions', 'Lazada' in lt and 'Wet market' in lt)
    pg.fill('#mq','wet'); pg.wait_for_timeout(200); pg.click('#mlist [data-m="Wet market"]'); pg.wait_for_timeout(300)
    ok('picked Wet market', 'Wet market' in pg.inner_text('#merchrow') and 'suggested' not in pg.inner_text('#merchrow'))
    pg.fill('#f-amount','250'); pg.wait_for_timeout(200)
    pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    t=pg.evaluate("(()=>{const x=window.sukli.get().txs.filter(t=>!t.deleted&&t.name==='Shopee pork chop');return x.length&&[x[0].merchant,x[0].kind,x[0].cat?1:0]})()")
    ok('saved with merchant, still an expense with a category %s'%t, t and t[0]=='Wet market' and t[1]=='expense' and t[2]==1)
    # type a new merchant, case variant is merged
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.fill('#f-what','shoes'); pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mq'); pg.fill('#mq','sm mall'); pg.wait_for_timeout(200)
    ok('add as new row', 'Add as a new merchant' in pg.inner_text('#mlist')); pg.press('#mq','Enter'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','1200'); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.fill('#f-what','socks'); pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mq'); pg.fill('#mq','SM MALL'); pg.press('#mq','Enter'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','150'); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(900)
    ms=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted&&t.merchant&&/sm mall/i.test(t.merchant)).map(t=>t.merchant)"); ok('same merchant keeps one spelling %s'%ms, len(ms)==2 and len(set(ms))==1)
    # transfer and income do not keep a merchant row
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.click('[data-e=kind][data-v=transfer]'); pg.wait_for_timeout(200); ok('hidden for transfer', not pg.is_visible('#merchrow'))
    pg.click('[data-e=kind][data-v=income]'); pg.wait_for_timeout(200); ok('hidden for income', not pg.is_visible('#merchrow')); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # list shows merchant and search finds it
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#ledger-list'); pg.fill('#q','wet market'); pg.wait_for_timeout(500); lt=pg.inner_text('#ledger-list'); ok('search by merchant, row shows it', 'Shopee pork chop' in lt and 'Wet market' in lt)
    # edit reopens with merchant and can clear it
    pg.click('#ledger-list .row'); pg.wait_for_selector('#entry'); ok('edit shows saved merchant', 'Wet market' in pg.inner_text('#merchrow'))
    pg.click('[data-e=merchpick]'); pg.wait_for_selector('#mlist'); pg.click('#mlist [data-m=""]'); pg.wait_for_timeout(200); pg.click('#btns .btn:not(.ghost)'); pg.wait_for_timeout(800)
    ok('cleared merchant is removed', pg.evaluate("window.sukli.get().txs.find(t=>t.name==='Shopee pork chop').merchant")==None)
    # bulk edit
    pg.evaluate("window.sukli.commit(d=>{for(const t of d.txs){if(['shoes','socks'].includes(t.name))t.deleted=false}})")
    pg.fill('#q','Shopee pork'); pg.wait_for_timeout(400); pg.click('[data-act=sel-start]'); pg.click('[data-act=sel-all]'); pg.click('[data-act=sel-edit]'); pg.wait_for_selector('#be')
    ok('bulk edit has Merchant', 'Merchant (expenses)' in pg.inner_text('#be')); pg.fill('#be-merch','Lazada'); pg.click('#be-go'); pg.wait_for_timeout(700)
    ok('bulk edit set merchant', pg.evaluate("window.sukli.get().txs.find(t=>t.name==='Shopee pork chop').merchant")=='Lazada')
    # fill from names
    pg.evaluate("window.sukli.commit(d=>{const c=d.categories.find(x=>!x.deleted&&x.kind==='expense').id,a=d.accounts.find(x=>!x.deleted&&x.type==='bank'&&x.cur===window.sukli.get().settings.home||x.type==='bank').id;const now=window.sukli.get;d.txs.push({id:'fm1',kind:'expense',amount:99,cur:'PHP',fx:1,date:'2026-10-20 10:00:00',name:'Lazada order',cat:c,acct:a,updatedAt:Date.now()})})")
    pg.goto('http://localhost:8123/#/analytics'); pg.wait_for_selector('.afilters'); pg.click('.afilters [data-v="6m"]'); pg.wait_for_timeout(700)
    if pg.locator('section[data-sec=an-merch] .collbody[hidden]').count(): pg.click('section[data-sec=an-merch] .collhead'); pg.wait_for_timeout(300)
    h=pg.inner_text('section[data-sec=an-merch]'); print(repr(h[:300])); ok('By merchant section lists merchants', 'sm mall' in h.lower() and 'Lazada' in h)
    pg.click('[data-act=an-merch] >> nth=0'); pg.wait_for_selector('.sheet'); st=pg.inner_text('.sheet'); ok('merchant detail shows what it was and entries', 'What it was' in st and 'Entries' in st); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('fill button counts old entries', pg.locator('[data-act=merch-fill]').count()==1)
    pg.click('[data-act=merch-fill]'); pg.wait_for_selector('[role=dialog], .sheet'); pg.click('[role=dialog] .btn:not(.ghost), .sheet .btn:not(.ghost)'); pg.wait_for_timeout(700)
    ok('old entry got merchant, name unchanged', pg.evaluate("(()=>{const t=window.sukli.get().txs.find(x=>x.id==='fm1');return t.merchant==='Lazada'&&t.name==='Lazada order'})()"))
    # Sukli CSV keeps merchant, Bluecoins export does not need it
    csv=pg.evaluate("import('/js/sukliCsv.js').then(m=>m.exportSukliCSV(window.sukli.get()))"); ok('Sukli CSV has Merchant column', '"Merchant"' in csv.split('\r\n')[0] and 'Lazada' in csv)
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
