"""PERFORMANCE (screen side): how fast the app starts, imports, and draws each screen; page weight; memory. Also repeats at 20,000 entries."""
import sys, os, json, time; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qahelp import *
B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'perf_budget.json')))['browser']
def perf(name, ms, budget): print(f'INFO PERF {name}={ms:.0f}ms (budget {budget})'); ok(f'{name}: {ms:.0f} ms (limit {budget} ms)', ms <= budget)
routes = [r for r in route_names() if r not in ('styleguide', 'modelguide')]
RENDER = """async (r)=>{ const t0=performance.now(); location.hash='#/'+r; await new Promise(res=>{let n=0;const tick=()=>{n++; if(n>2) res(); else requestAnimationFrame(tick)};requestAnimationFrame(tick)}); await new Promise(res=>setTimeout(res,0)); return performance.now()-t0 }"""
def measure_routes(pg, label, budget):
    pg.goto(URL + 'index.html#/home'); pg.wait_for_timeout(600); worst = ('', 0); allms = {}
    for r in routes:
        pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(120)
        ms = min(pg.evaluate(RENDER, r) for _ in range(1)); allms[r] = ms
        if ms > worst[1]: worst = (r, ms)
    slow = {r: round(m) for r, m in allms.items() if m > budget}
    print('INFO PERF ' + label + ' per screen: ' + ', '.join(f'{r}={m:.0f}' for r, m in sorted(allms.items(), key=lambda x: -x[1])[:6]) + ' (ms, slowest 6)')
    for r, m in allms.items():
        if m > 1000 and m <= budget: warn(f'{label}: the {r} screen takes {m:.0f} ms to draw (still inside its {budget} ms limit)')
    ok(f'{label}: every screen draws within {budget} ms (slowest {worst[0]} {worst[1]:.0f} ms)', not slow, str(slow))
with sync_playwright() as p:
    ctx = new_ctx(p, 402, 874); P = Page(ctx); pg = P.pg
    # cold load of an empty app
    t = time.time(); pg.goto(URL + 'index.html'); pg.wait_for_selector('.welcome, #view', timeout=20000); perf('cold_load_to_first_screen', (time.time() - t) * 1000, B['cold_load_to_first_screen'])
    nav = pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];const rs=performance.getEntriesByType('resource');return {dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd,files:rs.length,kb:Math.round(rs.reduce((s,r)=>s+(r.transferSize||r.encodedBodySize||0),0)/1024)}})()")
    info(f"page weight: {nav['files']} files, about {nav['kb']} KB on first load; DOMContentLoaded {nav['dcl']:.0f} ms")
    if nav['files'] > 250: warn(f"first load makes {nav['files']} requests (the app loads each module as its own file)")
    ok(f"first load weighs {nav['kb']} KB (limit 4000 KB)", nav['kb'] < 4000)
    # import
    t = time.time(); boot_csv(P); perf('csv_import_to_home', (time.time() - t) * 1000, B['csv_import_to_home'])
    measure_routes(pg, 'route_render', B['route_render'])
    m = pg.evaluate("({nodes:document.getElementsByTagName('*').length})"); info(f"DOM size on Home after use: {m['nodes']} elements")
    # long tasks while scrolling the entries list
    pg.goto(URL + 'index.html#/ledger'); pg.wait_for_timeout(800)
    lt = pg.evaluate("""async()=>{let long=0,max=0;const ob=new PerformanceObserver(l=>{for(const e of l.getEntries()){long++;max=Math.max(max,e.duration)}});try{ob.observe({entryTypes:['longtask']})}catch(e){return null}
      for(let i=0;i<20;i++){window.scrollBy(0,600);await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,30)))}await new Promise(r=>setTimeout(r,200));return {long,max}}""")
    if lt: info(f"scrolling Entries: {lt['long']} long tasks, longest {lt['max']:.0f} ms"); ok('scrolling Entries has no freeze longer than 400 ms', lt['max'] < 400, str(lt))
    heap = pg.evaluate("performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : -1")
    if heap >= 0: ok(f'JS memory after browsing every screen is {heap} MB (limit {B["heap_mb_max"]} MB)', heap <= B['heap_mb_max'])
    ok('no script errors while measuring', not P.errs, str(P.errs[:2]))
    # ---- 20,000 entries inside the app
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commitQuiet(d=>{const base=d.txs.filter(t=>!t.deleted);let k=0;while(d.txs.length<20000){for(const t of base){if(d.txs.length>=20000)break;d.txs.push({...t,id:'big'+k++,updatedAt:Date.now()})}}})}""")
    pg.wait_for_timeout(1500)
    n = pg.evaluate("window.sukli.get().txs.length"); info(f'scale test with {n} entries in the app')
    measure_routes(pg, 'route_render_20k', B['route_render_20k'])
    pg.goto(URL + 'index.html#/ledger'); pg.wait_for_timeout(1500)
    rows = pg.evaluate("document.querySelectorAll('#ledger-list .row').length"); info(f'Entries list draws {rows} rows at once with 20,000 entries')
    ok('Entries list does not draw every one of 20,000 rows at once (page would crawl)', rows < 3000, str(rows))
    t = time.time(); pg.fill('#q', 'coffee'); pg.wait_for_function("document.querySelector('#ledger-list')", timeout=8000); pg.wait_for_timeout(300); perf('search_20k', (time.time() - t) * 1000 - 300, 3000)
    ok('no script errors at 20,000 entries', not P.errs, str(P.errs[:2]))
finish()
