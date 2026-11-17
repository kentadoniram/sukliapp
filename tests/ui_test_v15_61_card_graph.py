# v15.61: line graph in both faces of the main home card (cash flow / net worth), follows the month, round end marker, shadows
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for W in (390,320):
        pg=b.new_context(viewport={'width':W,'height':844},service_workers='block').new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000)
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1500)
        g=pg.evaluate("""(()=>{const o={};for(const f of ['front','back']){const sp=document.querySelector('.sc-'+f+' .sc-spark'),r=sp.getBoundingClientRect(),c=document.querySelector('.sc-'+f).getBoundingClientRect(),d=sp.querySelector('.sk-dot'),l=sp.querySelector('.sk-line');o[f]={has:!!l,d:l?l.getAttribute('d').length:0,curve:l?/C/.test(l.getAttribute('d')):false,dot:d?[parseFloat(getComputedStyle(d).width),getComputedStyle(d).borderRadius,getComputedStyle(d).boxShadow!=='none']:null,lineShadow:l?getComputedStyle(l).filter.includes('drop-shadow'):false,inside:r.left>=c.left&&r.right<=c.right,label:sp.getAttribute('aria-label'),w:r.width}}return o})()""")
        print(g)
        ok('%d: cash flow graph on the front (smooth, shadowed, round marker)'%W, g['front']['has'] and g['front']['curve'] and g['front']['lineShadow'] and g['front']['dot'][0]>=12 and g['front']['dot'][1]=='50%' and g['front']['dot'][2] and g['front']['inside'])
        ok('%d: net worth graph on the back'%W, g['back']['has'] and g['back']['curve'] and g['back']['dot'] and g['back']['inside'] and 'Net worth' in g['back']['label'] and g['back']['d']!=g['front']['d'])
        ok('%d: end marker sits on the end of the line (right edge, inside the box)'%W, pg.evaluate("(()=>{const sp=document.querySelector('.sc-front .sc-spark'),d=sp.querySelector('.sk-dot').getBoundingClientRect(),r=sp.getBoundingClientRect();return Math.abs(d.left+d.width/2-r.right)<2 && d.top>=r.top-8 && d.bottom<=r.bottom+8})()"))
        # data check: last point of cash flow = month net for a past month
        v=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),f=await import('/js/finance.js');const db=c.get(),ym='2026-09';const s=f.cashFlowSeries(db,ym),st=c.monthStats(db,ym);return [s.length,Math.round(s[s.length-1]),Math.round(st.income-st.spent),f.netWorthSeries(db,ym).length]})()""")
        ok('%d: cash flow ends at the month net income %s'%(W,v), v[0]==30 and abs(v[1]-v[2])<=1 and 20<=v[3]<=27)
        # follows the month
        d0=pg.evaluate("document.querySelector('.sc-front .sk-line').getAttribute('d')"); w0=pg.evaluate("document.querySelector('.sc-back .sk-line').getAttribute('d')")
        pg.click('.mscard'); pg.wait_for_timeout(150); pg.click('.msm[data-m$="-08"]:not([disabled])'); pg.wait_for_timeout(900)
        d1=pg.evaluate("document.querySelector('.sc-front .sk-line').getAttribute('d')"); w1=pg.evaluate("document.querySelector('.sc-back .sk-line').getAttribute('d')")
        ok('%d: both graphs change with the selected month'%W, d0!=d1 and w0!=w1)
        # empty month
        pg.click('.mscard'); pg.wait_for_timeout(150)
        for i in range(8): pg.click('.msyear [data-d="-1"]'); pg.wait_for_timeout(60)
        pg.click('.msm >> nth=0'); pg.wait_for_timeout(800)
        ok('%d: a month with no entries shows a quiet flat line, not an error'%W, pg.locator('.sc-front .sc-spark').count()==1 and not errs)
        # flip still fine
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1200)
        pg.click('.sc-front .sc-swap'); pg.wait_for_timeout(1000)
        ok('%d: back graph visible after the flip'%W, pg.evaluate("getComputedStyle(document.querySelector('.sc-back')).visibility")=='visible' and pg.evaluate("document.documentElement.scrollWidth")<=W)
        ok('%d: no page errors %s'%(W,errs), not errs)
