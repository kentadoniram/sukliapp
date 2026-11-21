from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(timezone_id='Asia/Tokyo')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    J=lambda js: pg.evaluate("(async()=>{"+js+"})()")
    # shared date helpers: local day, never the UTC day (Tokyo is UTC+9, so they differ between 00:00 and 09:00)
    pg.clock.install(time='2026-11-20T05:36:00+09:00') if hasattr(pg,'clock') else None
    pg.reload(); pg.wait_for_selector('.welcome')
    r=J("const c=await import('/js/core.js'),f=await import('/js/finance.js'),ro=await import('/js/rolling.js');return [c.today(),f.today(),ro.today(),new Date().toISOString().slice(0,10),c.lastDay(2028,2),c.lastDay(2027,2),c.lastDay(2026,12),c.p2(5)]")
    print(r)
    ok('today() is one shared function (core, finance, rolling agree)', r[0]==r[1]==r[2])
    ok('today() is the local day, which can differ from the UTC day early in Tokyo', r[0]=='2026-11-20' and r[3]=='2026-11-19')
    ok('lastDay handles leap years and December', r[4]==29 and r[5]==28 and r[6]==31 and r[7]=='05')
    m=J("const s=await import('/js/stats.js');return [s.median([]),s.median([5]),s.median([1,3]),s.median([9,1,5]),s.median([4,1,3,2])]")
    ok('median is one shared function: empty 0, odd middle, even average %s'%m, m==[0,5,2,5,2.5])
    # centralized config is the single source for the breakeven fee and the graph ranges
    c=J("const k=await import('/js/config.js');return [k.DEFAULT_SELL_FEE,k.MAX_LEARNED_FEE,k.INV_RANGES.map(x=>x[0]).join()]")
    ok('config holds the default selling fee, its cap and the graph ranges %s'%c, c==[0.001,0.05,'1M,3M,1Y,All'])
    ok('no errors on load', not errs)
    b.close()
