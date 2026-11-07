# v15.2: Hokkaido stations, group pictures, account and merchant pictures (automatic, chosen, own image)
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    r=pg.evaluate("""(async()=>{const S=await import('/js/stations.js'),P=await import('/js/pictures.js'),L=await import('/js/loc.js');
      const sap=S.findStation('Sapporo'),kut=S.findStation('Kutchan Station'),asa=S.findStation('Asahikawa'),nis=S.findStation('Niseko');
      return {km:Math.round(L.distKm(sap,kut)),asa:Math.round(L.distKm(sap,asa)),nis:!!nis,
        g:P.GKEYS.length, gt:P.guessGroupG('Transportation'), a:[P.guessAcctIcon('GCash','bank'),P.guessAcctIcon('SMBC','other'),P.guessAcctIcon('PASMO','cash'),P.guessAcctIcon('My Cash','other'),P.guessAcctIcon('Maya Savings','bank'),P.guessAcctIcon('Binance','other'),P.guessAcctIcon('Mystery','card')],
        m:[P.guessMerchIcon("McDonald's"),P.guessMerchIcon('7-Eleven'),P.guessMerchIcon('Starbucks'),P.guessMerchIcon('Nobody Shop'),P.guessMerchIcon('Keikyu Railway')]};})()""")
    print(r)
    ok('Hokkaido: Sapporo to Kutchan about 45 to 70 km, Asahikawa about 110 to 130 km, Niseko known', 45<=r['km']<=70 and 100<=r['asa']<=140 and r['nis'])
    ok('Transportation group picture is a solid group icon', r['gt']=='g_sign' and r['g']>=30)
    ok('accounts guessed %s'%r['a'], r['a']==['ewallet','bank','iccard','cash','ewallet','coins','card'])
    ok('merchants guessed %s'%r['m'], r['m']==['burger','store','coffee','store','train'])
    J("c.commit(d=>{d.settings.mode='advanced';const home=d.settings.homeCur||'PHP';for(const [i,n,t] of [['w1','GCash','ewallet'],['w2','Pasmo','ic'],['w3','Mystery Place','other']])d.accounts.push(c.stamp({id:i,name:n,cur:home,type:t,open:100,include:true,archived:false}));d.settings.merchants=['McDo','Nobody Shop'];d.settings.merchantInfo={'Nobody Shop':{branches:{},icon:'cart'}};d.txs.push(c.stamp({id:'tm',kind:'expense',date:'2026-10-01',name:'x',amount:10,cur:home,fx:1,acct:'w1',merchant:'McDo'}))})")
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_selector('.row.acct'); pg.wait_for_timeout(500)
    ok('account rows show pictures (svg inside badge)', pg.evaluate("[...document.querySelectorAll('.row.acct .badge svg')].length>=3"))
    # edit account: choose picture
    pg.evaluate("[...document.querySelectorAll('.row.acct')].find(r=>r.textContent.includes('Mystery')).click()"); pg.wait_for_timeout(500)
    pg.evaluate("(document.querySelector('[data-act=edit-acct],[data-act=acct-edit]')||[...document.querySelectorAll('button')].find(b=>/^Edit/.test(b.textContent.trim()))).click()"); pg.wait_for_selector('#acct-pic'); 
    pg.evaluate("document.querySelector('#acct-pic').click()"); pg.wait_for_selector('.icocell'); pg.evaluate("document.querySelector('.icocell[data-ico=safe]').click()"); pg.wait_for_timeout(300)
    ok('picked picture shows in the form', 'Chosen picture' in pg.inner_text('#acct-pic'))
    pg.evaluate("document.querySelector('#acct-form .btn:not(.ghost)').click()"); pg.wait_for_timeout(500)
    ok('saved on the account', J("return c.get().accounts.find(a=>a.id==='w3').icon")=='safe' or pg.evaluate("(async()=>(await import('/js/core.js')).get().accounts.find(a=>a.id==='w3').icon)()")=='safe')
    # own image
    img="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.find(a=>a.id==='w2').icon=%r;c.stamp(d.accounts.find(a=>a.id==='w2'))})})()"%img); pg.wait_for_timeout(500)
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_selector('.row.acct'); pg.wait_for_timeout(500)
    ok('own image shows', pg.evaluate("!!document.querySelector('.row.acct img.cimg')"))
    # merchant picker rows
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.fill('#f-what','Lunch'); pg.fill('#f-amount','900'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=merchpick]').click()"); pg.wait_for_selector('.mpr'); pg.wait_for_timeout(300)
    mp=pg.evaluate("[...document.querySelectorAll('.mpr')].map(r=>[r.dataset.m,!!r.querySelector('.badge svg')])")
    ok('merchant rows have pictures %s'%mp[:3], mp and all(x[1] for x in mp))
    # settings: pictures lists
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('#arrange'); pg.evaluate("document.querySelectorAll('details.sgroup,details.ssub').forEach(d=>d.open=true)"); pg.wait_for_timeout(300)
    ok('Pictures section exists', pg.locator('#pic-set').count()==1)
    pg.evaluate("document.querySelector('[data-act=pic-list][data-k=merch]').click()"); pg.wait_for_selector('[data-pid]'); 
    ok('merchant list shows names and Automatic/Chosen', 'McDo' in pg.inner_text('#pic-list') and 'Chosen picture' in pg.inner_text('#pic-list'))
    pg.evaluate("[...document.querySelectorAll('[data-pid]')].find(r=>r.dataset.pid==='McDo').click()"); pg.wait_for_selector('.icocell'); ok('library offers own image', pg.locator('[data-own]').count()==1)
    pg.evaluate("document.querySelector('.icocell[data-ico=gift]').click()"); pg.wait_for_timeout(400)
    ok('merchant picture saved', pg.evaluate("(async()=>(await import('/js/core.js')).get().settings.merchantInfo.McDo.icon)()")=='gift')
    # group library
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
