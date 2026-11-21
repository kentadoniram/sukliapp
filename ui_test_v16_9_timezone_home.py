from playwright.sync_api import sync_playwright
import re
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(service_workers='block',viewport={'width':390,'height':844},timezone_id='Asia/Tokyo'); pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(700)
    J=lambda js: pg.evaluate("(async()=>{"+js+"})()")
    # ---- platform and market clocks. The instant below is Fri 2026-11-20 05:36 in Tokyo ----
    r=J("""const z=await import('/js/timezone.js');const ms=Date.parse('2026-11-19T20:36:00Z'),db={settings:{platformTz:{}}};
      return {tokyo:z.dayIn(ms,9),binance:z.platformDay(db,'Binance',ms),bybit:z.platformDay(db,'Bybit',ms),bitget:z.platformDay(db,'Bitget',ms),nasdaq:z.platformDay(db,'NASDAQ',ms),pse:z.platformDay(db,'PSE',ms),
        nyW:z.zoneLabel(z.zoneFor(db,'NASDAQ'),ms),nyS:z.zoneLabel(z.zoneFor(db,'NASDAQ'),Date.parse('2026-07-01T12:00:00Z')),mnl:z.zoneLabel(z.zoneFor(db,'PSEI'),ms),
        nOpen:z.marketState(db,'NASDAQ',ms).open,pOpen:z.marketState(db,'PSE',ms).open,cOpen:z.marketState(db,'Binance',ms).always,
        nSat:z.marketState(db,'NASDAQ',Date.parse('2026-11-21T16:00:00Z')).open,pLunch:z.marketState(db,'PSE',Date.parse('2026-11-20T04:00:00Z')).open,pAm:z.marketState(db,'PSE',Date.parse('2026-11-20T02:00:00Z')).open,
        own:z.platformDay({settings:{platformTz:{bitget:-9}}},'Bitget',ms),pd:[z.priceDay(db,{market:'NASDAQ'},{exchange:'Bitget'},ms),z.priceDay(db,{},{exchange:'Bitget'},ms),z.priceDay(db,{},null,ms)]}""")
    print(r)
    ok('Tokyo, Bitget and PSE are already on 20 Nov', r['tokyo']=='2026-11-20' and r['bitget']=='2026-11-20' and r['pse']=='2026-11-20')
    ok('Binance, Bybit (UTC) and NASDAQ (New York) are still on 19 Nov', r['binance']=='2026-11-19' and r['bybit']=='2026-11-19' and r['nasdaq']=='2026-11-19')
    ok('New York follows daylight saving: UTC-5 in November, UTC-4 in July; Manila UTC+8', r['nyW']=='UTC−5' and r['nyS']=='UTC−4' and r['mnl']=='UTC+8')
    ok('NASDAQ is open (15:36 Thursday in New York) while PSE is closed at 04:36; crypto never closes', r['nOpen'] and not r['pOpen'] and r['cOpen'])
    ok('Market closed at the weekend; PSE closed over lunch (12:00-13:30), open at 10:00', not r['nSat'] and not r['pLunch'] and r['pAm'])
    ok('A platform timezone chosen by the person overrides the default', r['own']=='2026-11-19')
    ok('Price day: a ticker with a market uses the market, else the platform, else UTC', r['pd']==['2026-11-19','2026-11-20','2026-11-19'])
    # ---- stamps written by Investments use those clocks ----
    pg.clock.install(time='2026-11-20T05:36:00+09:00') if hasattr(pg,'clock') else None
    r=J("""const c=await import('/js/core.js'),i=await import('/js/invest.js');
      c.commit(d=>{d.settings.tickers=d.settings.tickers||{};d.settings.tickers.NVDA={ticker:'NVDA',name:'Nvidia',assetType:'stock',market:'NASDAQ',quote:'USD',price:0};d.settings.tickers.ZZZ={ticker:'ZZZ',name:'Z',assetType:'crypto',quote:'USD',price:0};d.settings.tickers.QQQ={ticker:'QQQ',name:'Q',assetType:'crypto',quote:'USD',price:0};});
      const ms=Date.parse('2026-11-19T20:36:00Z'),d0=Date.now;Date.now=()=>ms;
      const A={exchange:'Bitget'};const t=c.get().settings.tickers;
      i.pushHistory(t.NVDA,100,'USD','manual',A);i.pushHistory(t.ZZZ,5,'USD','manual',A);i.pushHistory(t.QQQ,5,'USD','live');Date.now=d0;
      return [t.NVDA.history[0].date,t.ZZZ.history[0].date,t.QQQ.history[0].date]""")
    ok('manual price on NASDAQ stock = NASDAQ day, on a Bitget coin = Bitget day, automatic feed = UTC day %s'%r, r==['2026-11-19','2026-11-20','2026-11-19'])
    # ---- PHP is the home currency, not the only one: HOME = USD, USD = 50 PHP, JPY = 0.4 PHP ----
    J("""const c=await import('/js/core.js');c.commit(d=>{d.txs=[];d.settings.home='USD';d.settings.rates=Object.assign({},d.settings.rates,{USD:50,JPY:0.4});
      d.accounts=d.accounts.filter(a=>false);
      const A=(id,name,cur,open,type)=>d.accounts.push(c.stamp({id,name,cur,type:type||'cash',open,include:true,archived:false}));
      A('h_p','Cash PHP','PHP',5000);A('h_j','Cash JPY','JPY',10000);A('h_u','Cash USD','USD',100);});c.syncHome();""")
    sp=J("const s=await import('/js/screens.js'),c=await import('/js/core.js');const r=s.spendable(c.get());return {total:r.total,by:[...r.by.entries()]}")
    print(sp)
    ok('Spendable total in USD: 5000 PHP (100) + 10000 JPY (80) + 100 USD = 280', abs(sp['total']-280)<1e-6)
    nw=J("""const c=await import('/js/core.js'),f=await import('/js/finance.js');const n=f.netWorth(c.get());return n.net""")
    ok('Net worth agrees with Spendable (280 USD)', abs(nw-280)<1e-6)
    pg.evaluate("window.location.hash='#/accounts'"); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('[data-act=nw]') && document.querySelector('[data-act=nw]').click()"); pg.wait_for_timeout(600)
    tips=pg.evaluate("[...document.querySelectorAll('[data-tip]')].map(e=>e.dataset.tip)")
    last=tips[-1] if tips else ''
    print(last)
    ok('Net worth bars end at the same 280 USD (they used the PHP rate before)', bool(re.search(r'280\.00',last)) or bool(re.search(r'\$\s*280',last)))
    sc=J("""const s=await import('/js/safety.js'),c=await import('/js/core.js');const db=c.get();const r=s.safetyCheck(db,{amount:10000,acct:'h_j',cat:''});return r.map(x=>x.text)""")
    print(sc)
    ok('Safety check shows USD, never a peso sign, and counts 10000 JPY as 80 USD', all('₱' not in t for t in sc) and any('$80' in t or '80.00' in t for t in sc))
    ok('no errors', not errs); print(errs[:2])
    b.close()
