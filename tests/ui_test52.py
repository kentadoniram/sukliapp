# v12an+: entry rows, platform headers, Spot/Earn, empty assets hidden, All button
from playwright.sync_api import sync_playwright
from pkhelp import choose
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
URL='http://localhost:8123/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); pg.add_init_script("try{var c=JSON.parse(localStorage.getItem('sukli-coll')||'{}');if(c['i-crypto']===undefined){c['i-crypto']=false;localStorage.setItem('sukli-coll',JSON.stringify(c))}}catch(e){}"); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.welcome'); pg.click('[data-act=wz-old]'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    # 1. entry layout
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-what')
    r=pg.evaluate("(()=>{const a=document.querySelector('#acctrow .acctbtn').getBoundingClientRect(),w=document.querySelector('#f-when').getBoundingClientRect();return {at:a.top,wt:w.top,ah:a.height,wh:w.height,aw:a.width,ww:w.width,right:w.right}})()")
    ok(f'expense: Account and When on one row {r}', abs(r['at']-r['wt'])<6 and r['ww']>=110 and abs(r['aw']-r['ww'])<2)
    ok(f'When button fits the screen {r}', r['right']<=402-18)
    pg.click('#seg [data-k=income]') if pg.locator('#seg [data-k=income]').count() else None
    pg.wait_for_timeout(200)
    r=pg.evaluate("(()=>{const a=document.querySelector('#acctrow .acctbtn').getBoundingClientRect(),w=document.querySelector('#f-when').getBoundingClientRect();return Math.abs(a.top-w.top)})()")
    ok('income: same row too', r<6)
    pg.click('#seg button >> nth=2') if pg.locator('#seg button').count()>=3 else None; pg.wait_for_timeout(300)
    isT=pg.locator('[data-e=swapacct]').count()==1
    ok('transfer view reached', isT)
    if isT:
        a=pg.evaluate("(()=>{const f=document.querySelector('#acctrow .acctbtn').getBoundingClientRect(),w=document.querySelector('#f-when').getBoundingClientRect();return [f.top,w.top]})()")
        ok(f'transfer keeps From/To above When {a}', a[1]>a[0]+20)
        pg.evaluate("window.sukli.get()")
        ok('fee box: fee amount and Taken from on one row', pg.evaluate("(()=>{const i=document.querySelector('#f-fee'),s=document.querySelector('[data-e=feeby][data-v=from]');if(!i||!s)return false;const a=i.getBoundingClientRect(),c=s.getBoundingClientRect();return Math.abs((a.top+a.bottom)/2-(c.top+c.bottom)/2)<30})()"))
        ok('both options say Taken from sender / receiver', 'Taken from' in pg.inner_text('[data-e=feeby][data-v=from]') and 'receiver' in pg.inner_text('[data-e=feeby][data-v=to]'))
        ok('All button shown for transfers', pg.is_visible('#f-all'))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # build a crypto platform: Spot USDT has coins, Spot BNB empty
    pg.evaluate("""async()=>{const c=await import('/js/core.js');const g=c.get();c.commit(d=>{
      d.accounts.push(c.stamp({id:'sp1',name:'Zeta XRP',wallet:'Spot',cur:'XRP',type:'crypto',assetType:'crypto',exchange:'Zeta',open:123.45678912,include:false,archived:false,invtab:true}));
      d.accounts.push(c.stamp({id:'sp2',name:'Zeta DOGE',wallet:'Spot',cur:'DOGE',type:'crypto',assetType:'crypto',exchange:'Zeta',open:0,include:false,archived:false,invtab:true}));
      d.settings.tickers=d.settings.tickers||{};});}""")
    pg.goto(URL+'#/invest'); pg.wait_for_selector('.exname'); pg.wait_for_timeout(400)
    ex=pg.evaluate("(()=>{const e=[...document.querySelectorAll('.exname')].find(x=>/zeta/i.test(x.textContent));return e?{t:getComputedStyle(e).textTransform,w:getComputedStyle(e).fontWeight,txt:e.innerText}:null})()")
    ok(f'platform name is bold and uppercase {ex}', ex and ex['t']=='uppercase' and int(ex['w'])>=700 and ex['txt']=='ZETA')
    sm=pg.inner_text('.gsum2 >> nth=0'); ok(f'platform total shows two currencies: {sm!r}', '≈' in sm)
    body=pg.inner_text('#view')
    ok('asset with a balance is listed', 'XRP' in body)
    ok('empty asset (DOGE) is hidden', 'DOGE' not in body and 'empty asset' in body)
    pg.click('[data-act=inv-empty]'); pg.wait_for_timeout(400)
    ok('Show them reveals the empty asset', 'DOGE' in pg.inner_text('#view'))
    pg.click('[data-act=inv-empty]'); pg.wait_for_timeout(300)
    ok('and hides again', 'DOGE' not in pg.inner_text('#view'))
    # 3. Spot has no interest options; Earn has
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount('sp1')})()"); pg.wait_for_selector('#acct-form')
    ok('Spot crypto: interest fields hidden with an Earn note', not pg.is_visible('#intfields') and pg.is_visible('#earnnote') and 'Earn' in pg.inner_text('#earnnote'))
    choose(pg,'#acct-form [name=wallet]',value='Earn'); pg.wait_for_timeout(200)
    ok('choosing the Earn wallet shows interest fields', pg.is_visible('#intfields') and not pg.is_visible('#earnnote'))
    choose(pg,'#acct-form [name=wallet]',value='Spot'); pg.wait_for_timeout(200)
    ok('back to Spot hides them again', not pg.is_visible('#intfields'))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # Move to Earn makes the Earn account and opens a transfer with it
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccountDetail('sp1')})()"); pg.wait_for_selector('[data-act=wallet-xfer]')
    ok('Move to Earn offered, Move to Spot not (it is already Spot)', pg.locator('[data-act=wallet-xfer][data-w=Earn]').count()==1 and pg.locator('[data-act=wallet-xfer][data-w=Spot]').count()==0)
    pg.click('[data-act=wallet-xfer][data-w=Earn]'); pg.wait_for_selector('#f-all', timeout=5000); pg.wait_for_timeout(400)
    earn=pg.evaluate("window.sukli.get().accounts.find(a=>a.exchange==='Zeta'&&a.cur==='XRP'&&a.wallet==='Earn')")
    ok(f'Earn account for XRP created: {earn and earn["name"]}', earn and earn['name']=='Zeta Earn XRP')
    ok('transfer opened From Spot To Earn', pg.is_visible('[data-e=swapacct]') and 'Zeta XRP' in pg.inner_text('#acctrow') and 'Earn' in pg.inner_text('#acctrow'))
    # 4. All fills the exact balance
    pg.click('#f-all'); pg.wait_for_timeout(300)
    v=pg.input_value('#f-amount'); ok(f'All fills the whole balance without float noise: {v}', v.replace(',','')=='123.45678912')
    pg.fill('#f-amount','5'); pg.dispatch_event('#f-amount','input'); pg.fill('#f-fee','0.5'); pg.dispatch_event('#f-fee','input'); pg.click('#f-all'); pg.wait_for_timeout(300)
    v=pg.input_value('#f-amount').replace(',',''); ok(f'with a fee taken from the sender, All leaves room for it: {v}', v=='122.95678912')
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # trade form: All
    pg.evaluate("(async()=>{const m=await import('/js/trades.js');m.openTrade({asset:'sp1',side:'sell'})})()"); pg.wait_for_selector('#tr')
    ok('sell: All beside Units, not beside Total', pg.is_visible('[data-all=qty]') and not pg.is_visible('[data-all=total]'))
    pg.click('[data-all=qty]'); pg.wait_for_timeout(200); ok('sell All fills the whole holding', pg.input_value('#tr [name=qty]')=='123.45678912')
    pg.click('[data-side=buy]'); pg.wait_for_timeout(200)
    ok('buy: All beside Total, not Units', pg.is_visible('[data-all=total]') and not pg.is_visible('[data-all=qty]'))
    ok('no page errors', not errs); print(errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
