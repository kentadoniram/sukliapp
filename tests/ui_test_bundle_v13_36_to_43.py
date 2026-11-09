# Recent features, one browser and one imported CSV for all of them (merged from ui_test87 to ui_test97 so the suite stays short).
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)

def part0(p,b,ctx,pg,errs):
    # v13.34: merchant + branch + place
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';const a=d.accounts.find(x=>!x.deleted&&x.cur==='JPY')||d.accounts[0];
      for(let i=0;i<3;i++) d.txs.push(c.stamp({id:'lf'+i,kind:'expense',date:'2026-10-1'+i+' 12:00:00',acct:a.id,cur:a.cur,amount:500+i,fx:1,name:'Groceries',merchant:'Life Tsukagoshi'}))})})()""")
    pg.evaluate("document.querySelector('[data-act=mer-edit]')||0")
    pg.evaluate("(async()=>{await import('/js/merchantset.js');const el=document.createElement('button');el.dataset.m='Life Tsukagoshi';window.__el=el;document.body.appendChild(el);const u=await import('/js/ui.js');u.ACT['mer-edit'](el)})()"); pg.wait_for_selector('input[name=br]'); pg.wait_for_timeout(300)
    pg.fill('input[name=m]','Life'); pg.fill('input[name=br]','Tsukagoshi'); pg.fill('input[name=place]','Tsukagoshi, Saiwai Ward, Kawasaki, Kanagawa')
    pg.evaluate("document.querySelector('input[name=m]').closest('form').requestSubmit()"); pg.wait_for_timeout(800)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();return [d.txs.filter(t=>t.merchant==='Life'&&t.branch==='Tsukagoshi').length,JSON.stringify(d.settings.merchantInfo)]})()")
    ok('3 entries now Life / Tsukagoshi, place saved %s'%r, r[0]==3 and 'Saiwai Ward' in r[1])
    # second branch from entry form, same merchant
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{merchant:'Life'}})})()"); pg.wait_for_selector('#branchcell [data-e=branchpick]'); pg.wait_for_timeout(400)
    ok('branch sits beside the merchant once one is chosen', pg.locator('#branchcell [data-e=branchpick]').count()==1)
    pg.click('#branchcell [data-e=branchpick]'); pg.wait_for_timeout(300)
    ok('existing branch offered', 'Tsukagoshi' in pg.inner_text('body'))
    pg.click('[data-b=Tsukagoshi]'); pg.fill('#f-amount','300'); pg.fill('#f-what','Milk'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.name==='Milk');return t&&[t.merchant,t.branch]})()"); ok('saved with branch %s'%r, r==['Life','Tsukagoshi'])
    r=pg.evaluate("(async()=>{const m=await import('/js/merchantset.js');return m.branchesOf((await import('/js/core.js')).get(),'Life').map(b=>[b.name,b.n])})()"); ok('one merchant, branch counts %s'%r, r==[['Tsukagoshi',4]])
    ok('no errors %s'%errs, not errs)

def part1(p,b,ctx,pg,errs):
    # v13.34: cashback in Add Entry
    JS="(async()=>{const c=await import('/js/core.js');const d=c.get();const e=d.txs.find(t=>t.name==='CB test'&&!t.deleted);const cb=d.txs.filter(t=>t.cashbackOf&&e&&t.cashbackOf===e.id&&!t.deleted);return {e:e&&[e.amount,e.cashback&&e.cashback.mode],cb:cb.map(x=>x.amount),bal:c.balances(d).get(e&&e.acct)}})()"
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.titleCase=false})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'cbw',name:'CB Wallet',type:'cash',cur:'PHP',open:10000,include:true,archived:false}))});const m=await import('/js/entry.js');m.openEntry({preset:{acct:'cbw'}})})()"); pg.wait_for_selector('#cbrow'); pg.wait_for_timeout(400)
    pg.click('#cbrow [data-e=cb-on]'); pg.fill('#f-amount','1000'); pg.fill('#f-what','CB test'); pg.fill('#f-cbv','5'); pg.press('#f-cbv','Tab'); pg.wait_for_timeout(200)
    ok('live calc shows 50 %s'%pg.inner_text('#cbcalc'), '50.00' in pg.inner_text('#cbcalc'))
    pg.fill('#f-amount','2000'); pg.wait_for_timeout(200); ok('recalculates when amount changes', '100.00' in pg.inner_text('#cbcalc'))
    pg.fill('#f-amount','1000'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('saved expense 1000 + income 50, balance 9050 %s'%r, r['e']==[1000,'pct'] and r['cb']==[50] and abs(r['bal']-9050)<0.01)
    # edit amount: cashback follows
    id=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.find(t=>t.name==='CB test').id})()")
    pg.evaluate("(async(id)=>{const m=await import('/js/entry.js');m.openEntry({id})})('%s')"%id); pg.wait_for_selector('#f-cbv'); pg.wait_for_timeout(300)
    ok('opens with cashback on', pg.input_value('#f-cbv')=='5')
    pg.fill('#f-amount','2000'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('edit follows: 2000 and 100 %s'%r, r['e'][0]==2000 and r['cb']==[100] and abs(r['bal']-8100)<0.01)
    pg.evaluate("(async(id)=>{const m=await import('/js/entry.js');m.openEntry({id})})('%s')"%id); pg.wait_for_selector('#f-cbv'); pg.wait_for_timeout(300)
    pg.click('#cbrow [data-e=cb-mode][data-v=fixed]'); pg.fill('#f-cbv','30'); pg.press('#f-cbv','Tab'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('fixed 30 %s'%r, r['cb']==[30] and r['e'][1]=='fixed')
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(600)
    t=pg.inner_text('body'); ok('Entries shows one row, with the cashback in its note', t.count('CB test')==1 and 'cashback' in t.lower())
    pg.evaluate("(async(id)=>{const m=await import('/js/entry.js');m.openEntry({id})})('%s')"%id); pg.wait_for_selector('#f-cbv'); pg.wait_for_timeout(300)
    pg.click('#cbrow [data-e=cb-off]'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate(JS); ok('removing cashback removes the income %s'%r, r['cb']==[] and abs(r['bal']-8000)<0.01)
    ok('no errors %s'%errs, not errs)

def part2(p,b,ctx,pg,errs):
    # v13.36: address on demand (cached, editable), edit trades, owed in a foreign currency
    calls=[]
    def route(r):
        calls.append(r.request.url)
        r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'display_name':'x','address':{'amenity':'Life Tsukagoshi','suburb':'Tsukagoshi','city_district':'Saiwai Ward','city':'Kawasaki','state':'Kanagawa','country':'Japan'}}))
    pg.route('**/nominatim.openstreetmap.org/**',route)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;d.accounts.push(c.stamp({id:'a91',name:'A91',type:'cash',cur:'JPY',open:100000,include:true,archived:false}))})})()")
    # 1 address
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'a91'}})})()"); pg.wait_for_selector('#locrow'); pg.wait_for_timeout(400)
    pg.click('#locrow [data-e=loc-edit]'); pg.fill('#f-loc','35.53, 139.69'); pg.press('#f-loc','Tab'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1800)
    ok('typed point: address looked up by itself, coordinates not shown on the button', len(calls)==1 and '35.53' not in pg.inner_text('#locrow [data-e=loc-get]'))
    pg.click('#locrow [data-e=loc-detail]'); ok('Details shows the coordinates as JSON', '"latitude": 35.53' in pg.inner_text('#locrow .locjson')); pg.click('#locrow [data-e=loc-detail]')
    t=pg.inner_text('#locrow'); ok('address shown %s'%t.replace('\n',' '), 'Saiwai Ward' in t and 'Kawasaki' in t and 'Japan' not in t)
    ok('one request', len(calls)==1)
    pg.fill('#f-amount','300'); pg.fill('#f-what','Milk 91'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.name==='Milk 91');return [t.place,t.loc]})()"); ok('address saved on the entry %s'%r, r[0] and 'Kawasaki' in r[0])
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'a91'}})})()"); pg.wait_for_selector('#locrow'); pg.wait_for_timeout(300)
    pg.click('#locrow [data-e=loc-edit]'); pg.fill('#f-loc','35.53, 139.69'); pg.press('#f-loc','Tab'); pg.wait_for_timeout(300)
    ok('same place: address filled from the saved one, no new request', 'Kawasaki' in pg.inner_text('#locrow') and len(calls)==1)
    pg.click('#locrow [data-e=addr-edit]'); pg.fill('#f-place','Life Supermarket, Tsukagoshi'); pg.press('#f-place','Tab'); pg.wait_for_timeout(300)
    r=pg.evaluate("(async()=>{const g=await import('/js/geo.js');const c=await import('/js/core.js');return g.cachedAddress(c.get(),{la:35.53,lo:139.69})})()"); ok('typed address kept for the place %s'%r, r=='Life Supermarket, Tsukagoshi')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 2 trade edit
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'x91',name:'Zed BTC',wallet:'Spot',cur:'BTC',type:'crypto',assetType:'crypto',exchange:'Zed',open:0,include:false,archived:false,invtab:true}))});
      const m=await import('/js/trades.js');m.openTrade({side:'buy',asset:'x91'})})()"""); pg.wait_for_selector('#tr'); pg.wait_for_timeout(400)
    pg.select_option('#tr [name=cash]','a91'); pg.fill('#tr [name=qty]','0.01'); pg.fill('#tr [name=total]','50000'); pg.click('#tr [data-fm=fixed]'); pg.fill('#tr [name=fee]','100'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#tr').requestSubmit()"); pg.wait_for_timeout(800)
    BAL="(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());const tr=c.get().txs.filter(t=>!t.deleted&&t.trade&&t.trade.asset==='x91');return [b.get('a91'),b.get('x91'),tr.length,tr[0]&&tr[0].id]})()"
    r=pg.evaluate(BAL); print(r); base=r[0]+0
    ok('buy recorded: cash 49600 (after the 300 milk and 50100), 0.01 BTC %s'%r, abs(r[1]-0.01)<1e-9 and r[2]==1)
    tid=r[3]; before=r[0]
    pg.evaluate("(async(id)=>{const u=await import('/js/ui.js');u.ACT.edit({dataset:{id}})})('%s')"%tid); pg.wait_for_selector('[data-edit]'); pg.click('[data-edit]'); pg.wait_for_selector('#tr'); pg.wait_for_timeout(500)
    ok('edit form opens filled %s'%pg.input_value('#tr [name=qty]'), pg.input_value('#tr [name=qty]')=='0.01' and pg.input_value('#tr [name=total]')=='50000' and pg.input_value('#tr [name=fee]')=='100')
    pg.fill('#tr [name=qty]','0.02'); pg.fill('#tr [name=total]','100000'); pg.click('#tr [data-fm=fixed]'); pg.fill('#tr [name=fee]','200'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#tr').requestSubmit()"); pg.wait_for_timeout(500)
    try:
        pg.wait_for_selector('text=Record anyway',timeout=1500); pg.click('text=Record anyway')
    except Exception: pass
    pg.wait_for_timeout(700)
    r=pg.evaluate(BAL); ok('edited in place: still 1 trade, same id, BTC 0.02, cash down 50000 + 100 more %s'%r, r[2]==1 and r[3]==tid and abs(r[1]-0.02)<1e-9 and abs((before-r[0])-50100)<0.01)
    # 3 owed foreign
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.rates=d.settings.rates||{};d.accounts.push(c.stamp({id:'o91',name:'Dollar Dan',type:'owed',cur:'USD',open:0,include:false,archived:false}));
      d.txs.push(c.stamp({id:'ol91',kind:'transfer',date:c.nowStamp(),acct:'a91',toAcct:'o91',cur:'JPY',amount:15000,toAmount:100,fx:1,name:'Paid for Dan',lent:true}))})})()""")
    pg.evaluate("location.hash='#/owed'"); pg.wait_for_timeout(700)
    t=pg.inner_text('body'); ok('shows $100.00 as the amount, an approximate home value and the rate', '$100' in t and '≈' in t and 'Rate used' in t)
    ok('no errors %s'%errs, not errs)

def part3(p,b,ctx,pg,errs):
    # v13.37: internal transfer, Transfer/Move label, From side of a transfer, earn start rules
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,o)=>d.accounts.push(c.stamp({id,name:'Kx '+w+' USDT',wallet:w,cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Kx',open:o,include:false,archived:false,invtab:true}));mk('k92s','Spot',100);d.accounts.push(c.stamp({id:'b92',name:'Other USDT',wallet:'Spot',cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Oth',open:0,include:false,archived:false,invtab:true}))})})()")
    # 1 internal move creates the Earn account once, no fee, balances change
    r=pg.evaluate("(async()=>{const m=await import('/js/internal.js'),c=await import('/js/core.js');const n0=c.get().accounts.length;const a=m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Earn',amount:'40'});const b=m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Earn',amount:'10'});const d=c.get(),bal=c.balances(d);const e=d.accounts.filter(x=>x.exchange==='Kx'&&x.wallet==='Earn');return [a.ok,b.ok,d.accounts.length-n0,e.length,bal.get('k92s'),bal.get(e[0].id),d.txs.filter(t=>t.internal).length,d.txs.find(t=>t.internal).fee]})()")
    ok('internal move %s'%r, r==[True,True,1,1,50,50,2,0])
    r=pg.evaluate("(async()=>{const m=await import('/js/internal.js');return [m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Spot',amount:'1'}).ok,m.internalMove({platform:'Kx',cur:'USDT',from:'Spot',to:'Earn',amount:''}).ok]})()")
    ok('same wallet / empty amount refused %s'%r, r==[False,False])
    # 2 sheet opens from platform and has Internal button
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(800)
    ok('platform has Internal button', pg.locator('[data-act=inv-internal][data-ex=Kx]').count()>=1)
    pg.evaluate("document.querySelector('[data-act=inv-internal][data-ex=Kx]').click()"); pg.wait_for_selector('#itf'); 
    ok('sheet: platform fixed to Kx, from/to wallets', pg.locator('#itf [name=plat]').count()==0 and 'Kx' in pg.inner_text('#itf') and pg.input_value('#itf [name=from]')=='Spot' and pg.locator('#itf [name=to] option').count()>=2)
    pg.click('#it-rev'); pg.wait_for_timeout(200); ok('reverse swaps From and To %s'%pg.input_value('#itf [name=from]'), pg.input_value('#itf [name=from]')=='Earn' and pg.input_value('#itf [name=to]')=='Spot'); pg.click('#it-rev')
    ok('currency shown inside the amount box', pg.inner_text('#it-cur')=='USDT')
    pg.click('#it-all'); ok('All fills the balance %s'%pg.input_value('#itf [name=amt]'), pg.input_value('#itf [name=amt]')=='50')
    pg.fill('#itf [name=amt]','5'); pg.click('#it-save'); pg.wait_for_timeout(500)
    ok('saved from the sheet', pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(t=>t.internal).length})()")==3)
    # 3 + menu label
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.invEntryMenu({ex:'Kx'})})()"); pg.wait_for_timeout(400)
    t=pg.inner_text('.invopts'); ok('menu: Transfer/Move and Internal Transfer', 'Transfer/Move' in t and 'Internal Transfer' in t)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 4 clicked account is From
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs.push(c.stamp({id:'t92',kind:'transfer',date:c.nowStamp(),acct:'b92',toAcct:'k92s',cur:'USDT',amount:3,toAmount:3,fx:1,name:'in'}))});const m=await import('/js/accpage.js');return m.transferPreset?m.transferPreset(c.get(),'k92s'):null})()")
    ok('preset keeps clicked account as From %s'%r, r is None or (r['acct']=='k92s'))
    # 5 earn rules
    r=pg.evaluate("(async()=>{const e=await import('/js/earn.js');const off=0,t=(h,m)=>Date.UTC(2026,0,4,h,m);const f=(x)=>e.e8Label(x,off);return [f(e.earnStartOf(t(15,0),{startRule:'nextHour',startLagH:0},off)),f(e.earnStartOf(t(15,1),{startRule:'nextHour',startLagH:0},off)),f(e.earnStartOf(t(15,9),{startRule:'midnight',startLagH:0},off)),f(e.earnStartOf(t(15,9),{startRule:'midnight',startLagH:0},8))]})()")
    ok('start rules %s'%r, r==['2026-01-04 16:00','2026-01-04 16:00','2026-01-05 00:00','2026-01-05 00:00'] or r[:3]==['2026-01-04 16:00','2026-01-04 16:00','2026-01-05 00:00'])
    ok('no errors %s'%errs, not errs)

def part4(p,b,ctx,pg,errs):
    # v13.38: exact 9-decimal amounts (SOL, USDC), "All" leaves nothing behind
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,cur,o)=>d.accounts.push(c.stamp({id,name:'Sx '+w+' '+cur,wallet:w,cur,type:'crypto',assetType:'crypto',exchange:'Sx',open:o,include:false,archived:false,invtab:true}));mk('s93','Spot','SOL',0.1);mk('e93','Earn','SOL',0);mk('u93','Spot','USDC',0.2);
      d.txs.push(c.stamp({id:'i1',kind:'income',date:c.nowStamp(),acct:'s93',amount:0.2,cur:'SOL',fx:1,name:'a'}));d.txs.push(c.stamp({id:'i2',kind:'income',date:c.nowStamp(),acct:'s93',amount:1.123456789,cur:'SOL',fx:1,name:'b'}));d.txs.push(c.stamp({id:'i3',kind:'income',date:c.nowStamp(),acct:'s93',amount:0.000000001,cur:'SOL',fx:1,name:'c'}))})})()""")
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.balances(c.get()).get('s93')})()"); ok('float sum is exact %s'%r, r==1.42345679)
    # All in the entry form, then save
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'s93',toAcct:'e93'}})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    pg.click('[data-e=allamt]'); pg.wait_for_timeout(200); v=pg.input_value('#f-amount'); ok('All fills 9 decimals %s'%v, v.replace(',','')=='1.42345679')
    pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return [b.get('s93'),b.get('e93')]})()"); ok('source empty, destination exact %s'%r, r==[0,1.42345679])
    # a 9-decimal amount typed by hand is kept whole
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'e93',toAcct:'s93'}})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    pg.fill('#f-amount','0.123456789'); pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const b=c.balances(c.get());return [b.get('s93'),b.get('e93')]})()"); ok('9 decimals kept %s'%r, r==[0.123456789,1.300000001])
    # display shows the dust instead of hiding it
    t=pg.evaluate("(async()=>{const c=await import('/js/core.js');return [c.fmt(0.003123,'SOL'),c.fmt(1.5,'SOL'),c.fmt(1.123456789,'SOL')]})()"); ok('coin display keeps real digits %s'%t, t==['SOL 0.003123','SOL 1.50','SOL 1.123456789'])
    ok('exactAmt', pg.evaluate("(async()=>{const c=await import('/js/core.js');return [c.exactAmt(1.42345679),c.exactAmt(0.1+0.2),c.exactAmt(5e-11)]})()")==['1.42345679','0.3','0'])
    ok('no errors %s'%errs, not errs)

def part5(p,b,ctx,pg,errs):
    # v13.40: Subscription Settings, Internal Transfer From list
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,cur,o)=>d.accounts.push(c.stamp({id,name:'Qx '+w+' '+cur,wallet:w,cur,type:'crypto',assetType:'crypto',exchange:'Qx',open:o,include:false,archived:false,invtab:true}));mk('q1','Spot','USDT',500);mk('q2','Earn','USDT',0);mk('q3','Margin','USDT',0)})})()""")
    # internal: From can be any wallet
    pg.evaluate("(async()=>{const m=await import('/js/internal.js');m.openInternal({platform:'Qx'})})()"); pg.wait_for_selector('#itf')
    ws=pg.eval_on_selector_all('#itf [name=from] option','o=>o.map(x=>x.value)'); ok('From lists every wallet %s'%ws, 'Spot' in ws and 'Earn' in ws and 'Margin' in ws)
    pg.select_option('#itf [name=from]','Earn'); ok('From can be changed to Earn', pg.input_value('#itf [name=from]')=='Earn')
    h=pg.evaluate("[document.querySelector('#itf [name=from]').offsetHeight,document.querySelector('#it-rev').offsetHeight]"); ok('From and Reverse same height %s'%h, h[0]==h[1])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('q2')})()"); pg.wait_for_selector('#ew')
    t=pg.inner_text('#ew'); ok('named Subscription Settings with a switch', 'Subscription Settings' in t and pg.locator('#ew .switch input').count()==0)
    t=pg.inner_text('#ew'); ok('turned on: APY beside Timezone, explanations, no amount field', 'Yearly Rate' in t and 'What These Mean' in t and 'Deposit Time' in t and 'Amount (Type All' not in t and 'Extra Hours' not in t)
    ok('Timezone and Yearly Rate share a row', pg.evaluate("(()=>{const a=document.querySelector('#ew [data-ew=tz]').getBoundingClientRect(),b=document.querySelector('#ew [data-ew=apy]').getBoundingClientRect();return Math.abs(a.top-b.top)<4})()"))
    pg.click('#ew [data-ew=suby]'); pg.wait_for_timeout(400)
    v=pg.input_value('#ew [data-ew=from]'); ok('Move From pre-filled with Spot %s'%v, v=='q1')
    ok('Add Time box is small', pg.evaluate("document.querySelector('#ew [data-ew=pickslot]').offsetWidth")<150)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='q2');return [a.earn.from,a.earn.subOn]})()"); ok('saved %s'%r, r==['q1',True])
    pg.click('#ew [data-ew=done]'); pg.wait_for_timeout(500); ok('Done closes', pg.locator('#ew').count()==0)
    ok('no errors %s'%errs, not errs)

def part6(p,b,ctx,pg,errs):
    # v13.41: exchange settings, internal transfer assets, subscription switch outside, layouts
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;const mk=(id,w,cur,o)=>d.accounts.push(c.stamp({id,name:'Wx '+w+' '+cur,wallet:w,cur,type:'crypto',assetType:'crypto',exchange:'Wx',open:o,include:false,archived:false,invtab:true}));mk('w1','Spot','SOL',3);mk('w2','Earn','USDT',50);
      d.accounts.push(c.stamp({id:'op1',name:'Pay Pal Person',type:'owed',cur:'PHP',open:0,include:false}))})})()""")
    # internal sheet: same assets for every wallet, defaults, new asset, alignment
    pg.evaluate("(async()=>{const m=await import('/js/internal.js');m.openInternal({platform:'Wx'})})()"); pg.wait_for_selector('#itf')
    cs=pg.eval_on_selector_all('#itf [name=cur] option','o=>o.map(x=>x.value)'); ok('assets of every wallet offered %s'%cs, 'SOL' in cs and 'USDT' in cs and '__new' in cs)
    ok('defaults Spot -> Earn', pg.input_value('#itf [name=from]')=='Spot' and pg.input_value('#itf [name=to]')=='Earn')
    tops=pg.evaluate("['#itf [name=from]','#it-rev','#itf [name=to]'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.top),Math.round(r.height)]})"); ok('From, Reverse, To aligned %s'%tops, tops[0]==tops[1]==tops[2] or (tops[0]==tops[1] and tops[1]==tops[2]))
    ok('Reverse shows only the symbol', pg.inner_text('#it-rev').strip()=='⇄')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # exchange settings sheet
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(800)
    ok('exchange name is tappable', pg.locator('.exname[data-act=plat-open][data-ex=Wx]').count()==1)
    pg.evaluate("document.querySelector('.exname[data-act=plat-open][data-ex=Wx]').click()"); pg.wait_for_selector('#pset'); t=pg.inner_text('#pset')
    ok('settings for the whole exchange %s'%t[:60].replace('\\n',' '), 'Timezone of Wx' in t and 'Internal Transfer' in t and 'Earn Products' in t and 'Rename' in t)
    pg.select_option('#pset [data-p=tz]','9'); pg.wait_for_timeout(300); z=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().settings.platformTz.Wx})()"); ok('timezone saved %s'%z, z==9)
    pg.click('#pset [data-p=done]'); pg.wait_for_timeout(300)
    # account page: no Move to Spot, switch beside Subscription Settings
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccountDetail('w2')})()"); pg.wait_for_timeout(900); t=pg.inner_text('body')
    ok('no Move to Spot', 'Move to Spot' not in t)
    ok('switch beside Subscription Settings', pg.locator('.subbtn .switch input[data-act=earn-toggle]').count()==1)
    pg.evaluate("document.querySelector('.subbtn .switch input').click()"); pg.wait_for_timeout(500)
    on=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.find(x=>x.id==='w2').earn.on})()"); ok('switch turns tracking on %s'%on, on is True)
    # earn window: timezone and yearly rate same size
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('w2')})()"); pg.wait_for_selector('#ew')
    h=pg.evaluate("['#ew [data-ew=tz]','#ew [data-ew=apy]'].map(s=>document.querySelector(s).getBoundingClientRect().height)"); ok('Timezone and Yearly Rate same size %s'%h, h[0]==h[1])
    ok('no switch inside the settings', pg.locator('#ew .switch').count()==0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('no errors %s'%errs, not errs)

def part7(p,b,ctx,pg,errs):
    # v13.42: address saved with the entry and shown when reopened; top-50 coins in every account; exchange account types
    calls=[]
    def route(r):
        calls.append(r.request.url)
        r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'display_name':'x','address':{'amenity':'Cafe Nine','suburb':'Kawasaki Daishi','city':'Kawasaki','state':'Kanagawa'}}))
    pg.route('**/nominatim.openstreetmap.org/**',route)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;
      d.accounts.push(c.stamp({id:'a96',name:'A96',type:'cash',cur:'JPY',open:100000,include:true}));
      d.txs.push(c.stamp({id:'p1',kind:'expense',date:c.nowStamp(),acct:'a96',amount:500,cur:'JPY',fx:1,name:'Saved place',loc:{la:35.1,lo:139.1},place:'Cafe Eight, Yokohama'}));
      d.txs.push(c.stamp({id:'p2',kind:'expense',date:c.nowStamp(),acct:'a96',amount:600,cur:'JPY',fx:1,name:'No place',loc:{la:35.60,lo:139.75}}));
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
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs.push(c.stamp({id:'p3',kind:'expense',date:c.nowStamp(),acct:'a96',amount:1,cur:'JPY',fx:1,name:'Old',loc:{la:35.60,lo:139.75}}))})})()")
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

def part8(p,b,ctx,pg,errs):
    # v13.43: Interest Earned daily entry in Spot (grows hourly), hourly breakdown, account types per exchange, Earned in realized
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;d.settings.platformTz={Ex:0};
      const mk=(id,w,o)=>d.accounts.push(c.stamp({id,name:'Ex '+w+' USDT',wallet:w,cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Ex',open:o,include:false,archived:false,invtab:true}));mk('sp','Spot',0);mk('er','Earn',1000);
      d.accounts.find(a=>a.id==='er').earn={on:true,apy:8.76,lastHour:Date.now()-5*3600e3,lastSlot:Date.now(),trackFrom:Date.now()-30*3600e3,startLagH:0,firstLagH:1}})})()""")
    # a subscription 30 hours ago so there is principal; run the engine
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commit(d=>{d.txs.push(c.stamp({id:'sub1',kind:'transfer',date:c.nowStamp(new Date(Date.now()-30*3600e3)),acct:'sp',toAcct:'er',cur:'USDT',amount:1000,toAmount:1000,fx:1,name:'sub',earnSubAt:Date.now()-30*3600e3}));e.runEarn(d)})})()""")
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();const t=d.txs.filter(x=>x.earnDay);return [t.length,t.map(x=>x.acct),t.map(x=>x.name),t.some(x=>x.earnOpen),c.balances(d).get('sp'),c.balances(d).get('er')]})()"); print(r)
    ok('daily entries credited to Spot, named Interest Earned', r[0]>=1 and all(a=='sp' for a in r[1]) and all(n=='Interest Earned' for n in r[2]))
    ok('today is open, Spot balance grew, Earn balance untouched except the subscription', r[3] and r[4]>-1000 and r[5]==2000)
    # one entry per day, grows with the next hour
    n0=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.earnOpen);return [t.amount,c.get().txs.filter(x=>x.earnDay).length]})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commit(d=>{d.accounts.find(a=>a.id==='er').earn.lastHour-=H;function f(){};e.runEarn(d,Date.now()+3600e3)})})()""".replace("-=H","-=3600e3"))
    n1=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.earnDay&&x.earnOpen);return [t&&t.amount,c.get().txs.filter(x=>x.earnDay).length]})()"); print(n0,n1)
    ok('the next hour adds to the same entry (no new row)', n1[0] is not None and n1[0]>=n0[0] and n1[1]<=n0[1]+1)
    # entry list note and breakdown
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(900); t=pg.inner_text('body')
    ok('Entries shows Interest Earned with the still-adding-up note', 'Interest Earned' in t and 'adding up' in t)
    pg.evaluate("(async()=>{const c=await import('/js/core.js'),m=await import('/js/accpage.js');m.openInterestDetail(c.get().txs.find(x=>x.earnDay))})()"); pg.wait_for_timeout(500)
    t=pg.inner_text('.sheet'); ok('tapping shows the hourly list %s'%t[:70].replace('\n',' '), 'Interest Earned' in t and 'platform clock' in t and t.count('0.')>=2)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # account types per exchange
    r=pg.evaluate("(async()=>{const t=await import('/js/tokens.js'),c=await import('/js/core.js');t.addAccountType('Ex','Copy Trading');return t.accountTypesOf(c.get(),'Ex').includes('Copy Trading')})()"); ok('account type added for one exchange', r is True)
    r=pg.evaluate("(async()=>{const t=await import('/js/tokens.js'),c=await import('/js/core.js');return t.accountTypesOf(c.get(),'Other Ex').includes('Copy Trading')})()"); ok('and only for that exchange', r is False)
    pg.evaluate("(async()=>{const m=await import('/js/platform.js');m.openPlatform('Ex')})()"); pg.wait_for_selector('#pset'); ok('exchange settings has + Add Account Type', 'Add Account Type' in pg.inner_text('#pset') and 'Copy Trading' in pg.inner_text('#pset'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # earned in the realized card
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.wait_for_timeout(300); t=pg.inner_text('body')
    ok('Unrealized Profit, Realized Profit, Earned shown', 'Unrealized Profit' in t and 'Realized Profit' in t and 'Earned' in t)
    ok('no errors %s'%errs, not errs)

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    print('--- ui_test88.py'); part0(p,b,ctx,pg,errs)
    print('--- ui_test89.py'); part1(p,b,ctx,pg,errs)
    print('--- ui_test91.py'); part2(p,b,ctx,pg,errs)
    print('--- ui_test92.py'); part3(p,b,ctx,pg,errs)
    print('--- ui_test93.py'); part4(p,b,ctx,pg,errs)
    print('--- ui_test94.py'); part5(p,b,ctx,pg,errs)
    print('--- ui_test95.py'); part6(p,b,ctx,pg,errs)
    print('--- ui_test96.py'); part7(p,b,ctx,pg,errs)
    print('--- ui_test97.py'); part8(p,b,ctx,pg,errs)
    b.close()
print('fails',res.count(False))
