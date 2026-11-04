# v13.36: address on demand (cached, editable), edit trades, owed in a foreign currency
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
calls=[]
def route(r):
    calls.append(r.request.url)
    r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'display_name':'x','address':{'amenity':'Life Tsukagoshi','suburb':'Tsukagoshi','city_district':'Saiwai Ward','city':'Kawasaki','state':'Kanagawa','country':'Japan'}}))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.route('**/nominatim.openstreetmap.org/**',route)
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;d.accounts.push(c.stamp({id:'a91',name:'A91',type:'cash',cur:'JPY',open:100000,include:true,archived:false}))})})()")
    # 1 address
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'a91'}})})()"); pg.wait_for_selector('#locrow'); pg.wait_for_timeout(400)
    pg.click('#locrow [data-e=loc-edit]'); pg.fill('#f-loc','35.53, 139.69'); pg.press('#f-loc','Tab'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1800)
    ok('typed point: address looked up by itself, coordinates not shown on the button', len(calls)==1 and '35.53' not in pg.inner_text('#locrow [data-e=loc-get]'))
    pg.click('#locrow [data-e=loc-detail]'); ok('Details shows the coordinates as JSON', '"latitude": 35.53' in pg.inner_text('#locrow .locjson')); pg.click('#locrow [data-e=loc-detail]')
    t=pg.inner_text('#locrow'); ok('address shown %s'%t.replace('\n',' '), 'Saiwai Ward' in t and 'Kawasaki' in t and 'Japan' not in t)
    ok('one request', len(calls)==1)
    pg.fill('#f-amount','300'); pg.fill('#f-what','Milk'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.name==='Milk');return [t.place,t.loc]})()"); ok('address saved on the entry %s'%r, r[0] and 'Kawasaki' in r[0])
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'a91'}})})()"); pg.wait_for_selector('#locrow'); pg.wait_for_timeout(300)
    pg.click('#locrow [data-e=loc-edit]'); pg.fill('#f-loc','35.53, 139.69'); pg.press('#f-loc','Tab'); pg.wait_for_timeout(300)
    ok('same place: address filled from the saved one, no new request', 'Kawasaki' in pg.inner_text('#locrow') and len(calls)==1)
    pg.click('#locrow [data-e=addr-edit]'); pg.fill('#f-place','Life Supermarket, Tsukagoshi'); pg.press('#f-place','Tab'); pg.wait_for_timeout(300)
    r=pg.evaluate("(async()=>{const g=await import('/js/geo.js');const c=await import('/js/core.js');return g.cachedAddress(c.get(),{la:35.53,lo:139.69})})()"); ok('typed address kept for the place %s'%r, r=='Life Supermarket, Tsukagoshi')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 2 trade edit
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'x91',name:'Zed BTC',wallet:'Spot',cur:'BTC',type:'crypto',assetType:'crypto',exchange:'Zed',open:0,include:false,archived:false,invtab:true}))});
      const m=await import('/js/trades.js');m.openTrade({side:'buy',asset:'x91'})})()"""); pg.wait_for_selector('#tr'); pg.wait_for_timeout(400)
    pg.select_option('#tr [name=cash]','a91'); pg.fill('#tr [name=qty]','0.01'); pg.fill('#tr [name=total]','50000'); pg.fill('#tr [name=fee]','100'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#tr').requestSubmit()"); pg.wait_for_timeout(800)
    BAL="(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());const tr=c.get().txs.filter(t=>!t.deleted&&t.trade&&t.trade.asset==='x91');return [b.get('a91'),b.get('x91'),tr.length,tr[0]&&tr[0].id]})()"
    r=pg.evaluate(BAL); print(r); base=r[0]+0
    ok('buy recorded: cash 49600 (after the 300 milk and 50100), 0.01 BTC %s'%r, abs(r[1]-0.01)<1e-9 and r[2]==1)
    tid=r[3]; before=r[0]
    pg.evaluate("(async(id)=>{const u=await import('/js/ui.js');u.ACT.edit({dataset:{id}})})('%s')"%tid); pg.wait_for_selector('[data-edit]'); pg.click('[data-edit]'); pg.wait_for_selector('#tr'); pg.wait_for_timeout(500)
    ok('edit form opens filled %s'%pg.input_value('#tr [name=qty]'), pg.input_value('#tr [name=qty]')=='0.01' and pg.input_value('#tr [name=total]')=='50000' and pg.input_value('#tr [name=fee]')=='100')
    pg.fill('#tr [name=qty]','0.02'); pg.fill('#tr [name=total]','100000'); pg.fill('#tr [name=fee]','200'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#tr').requestSubmit()"); pg.wait_for_timeout(900)
    r=pg.evaluate(BAL); ok('edited in place: still 1 trade, same id, BTC 0.02, cash down 50000 + 100 more %s'%r, r[2]==1 and r[3]==tid and abs(r[1]-0.02)<1e-9 and abs((before-r[0])-50100)<0.01)
    # 3 owed foreign
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.rates=d.settings.rates||{};d.accounts.push(c.stamp({id:'o91',name:'Dollar Dan',type:'owed',cur:'USD',open:0,include:false,archived:false}));
      d.txs.push(c.stamp({id:'ol91',kind:'transfer',date:c.nowStamp(),acct:'a91',toAcct:'o91',cur:'JPY',amount:15000,toAmount:100,fx:1,name:'Paid for Dan',lent:true}))})})()""")
    pg.evaluate("location.hash='#/owed'"); pg.wait_for_timeout(700)
    t=pg.inner_text('body'); ok('shows $100.00 as the amount, an approximate home value and the rate', '$100' in t and '≈' in t and 'Rate used' in t)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
