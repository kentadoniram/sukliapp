# v13.42: address saved with the entry and shown when reopened; top-50 coins in every account; exchange account types
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
calls=[]
def route(r):
    calls.append(r.request.url)
    r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'display_name':'x','address':{'amenity':'Cafe Nine','suburb':'Kawasaki Daishi','city':'Kawasaki','state':'Kanagawa'}}))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.route('**/nominatim.openstreetmap.org/**',route)
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;
      d.accounts.push(c.stamp({id:'a96',name:'A96',type:'cash',cur:'JPY',open:100000,include:true}));
      d.txs.push(c.stamp({id:'p1',kind:'expense',date:c.nowStamp(),acct:'a96',amount:500,cur:'JPY',fx:1,name:'Saved place',loc:{la:35.1,lo:139.1},place:'Cafe Eight, Yokohama'}));
      d.txs.push(c.stamp({id:'p2',kind:'expense',date:c.nowStamp(),acct:'a96',amount:600,cur:'JPY',fx:1,name:'No place',loc:{la:35.53,lo:139.69}}));
      d.accounts.push(c.stamp({id:'t1',name:'Tx USDT',wallet:'Spot',cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Tx',open:100,include:false,invtab:true}))})})()""")
    # 1 reopened entry shows its saved address
    pg.evaluate("(async()=>{const c=await import('/js/core.js'),m=await import('/js/entry.js');m.openEntry({id:'p1'})})()"); pg.wait_for_selector('#locrow'); pg.wait_for_timeout(400)
    t=pg.inner_text('#locrow'); ok('saved address shown on reopen %s'%t.replace('\n',' ')[:90], 'Cafe Eight' in t and 'not found' not in t)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # reopening an entry without an address looks it up once and keeps it
    n0=len(calls)
    pg.evaluate("(async()=>{const c=await import('/js/core.js'),m=await import('/js/entry.js');m.openEntry({id:'p2'})})()"); pg.wait_for_selector('#locrow'); pg.wait_for_timeout(2200)
    t=pg.inner_text('#locrow'); ok('address found on open %s'%t.replace('\n',' ')[:80], 'Cafe Nine' in t and len(calls)==n0+1)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.find(t=>t.id==='p2').place})()"); ok('and saved on the entry without pressing Save %s'%r, r and 'Cafe Nine' in r)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # backfill
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs.push(c.stamp({id:'p3',kind:'expense',date:c.nowStamp(),acct:'a96',amount:1,cur:'JPY',fx:1,name:'Old',loc:{la:35.53,lo:139.69}}))})})()")
    n=pg.evaluate("(async()=>{const g=await import('/js/geo.js');return g.backfillAddresses(3)})()"); ok('backfill fills old entries from the saved answer %s'%n, n==1)
    # 2 hierarchy
    r=pg.evaluate("(async()=>{const t=await import('/js/tokens.js'),c=await import('/js/core.js');return [t.TOP_TOKENS.length,new Set(t.TOP_TOKENS.map(x=>x.c)).size,t.accountTypesOf(c.get(),'Binance'),t.accountTypesOf(c.get(),'Bybit').includes('TradFi'),t.accountTypesOf(c.get(),'Binance').includes('TradFi')]})()"); ok('50 distinct coins, account types per exchange %s'%r, r[0]==50 and r[1]==50 and 'ETF' in r[2] and r[3] is True and r[4] is False)
    pg.evaluate("(async()=>{const m=await import('/js/internal.js');m.openInternal({platform:'Tx'})})()"); pg.wait_for_selector('#itf')
    cs=pg.eval_on_selector_all('#itf [name=cur] option','o=>o.map(x=>x.value)'); ok('top coins offered without adding %s'%len(cs), 'DOGE' in cs and 'TON' in cs and 'HYPE' in cs)
    ws=pg.eval_on_selector_all('#itf [name=to] option','o=>o.map(x=>x.value)'); ok('account types of the exchange %s'%ws, 'Earn' in ws and 'Options' in ws)
    pg.select_option('#itf [name=cur]','USDT'); pg.fill('#itf [name=amt]','10'); pg.select_option('#itf [name=to]','Earn'); pg.click('#it-save'); pg.wait_for_timeout(500)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());const e=c.get().accounts.find(x=>x.exchange==='Tx'&&x.wallet==='Earn');return [b.get('t1'),e&&b.get(e.id)]})()"); ok('moved with no setup %s'%r, r==[90,10])
    pg.keyboard.press('Escape')
    # trade picker: pick a coin never added
    pg.evaluate("(async()=>{const m=await import('/js/trades.js');m.openTrade({platform:'Tx'})})()"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(300)
    o=pg.eval_on_selector_all('#tr [name=asset] option','o=>o.map(x=>x.value)'); ok('trade picker offers top coins %s'%len(o), 'tok:SOL' in o)
    pg.evaluate("(()=>{const s=document.querySelector('#tr [name=asset]');s.value='tok:SOL';s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.filter(x=>x.exchange==='Tx'&&x.cur==='SOL');return [a.length,a[0]&&a[0].wallet,(c.get().settings.tickers||{}).SOL&&c.get().settings.tickers.SOL.cgId]})()"); ok('SOL made on first use with a price id %s'%r, r==[1,'Spot','solana'])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
