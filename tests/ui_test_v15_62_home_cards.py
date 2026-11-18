# v15.62: Average-per-day card, Net income benchmark chip, Quick Glance bell with unread badge, mountain fill
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for W in (390,320):
        pg=b.new_context(viewport={'width':W,'height':844},service_workers='block',has_touch=True,is_mobile=True).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000)
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1800)
        # --- average card
        r=pg.evaluate("(()=>{const w=document.querySelector('.week').getBoundingClientRect(),a=document.querySelector('.avgcard').getBoundingClientRect();return {wb:w.bottom,at:a.top,ab:a.bottom,wl:w.left,al:a.left,wr:w.right,ar:a.right,seg:[...document.querySelectorAll('.avgcard .seg button')].map(x=>x.textContent),hidden:getComputedStyle(document.querySelector('.wkavg')).display,r1:getComputedStyle(document.querySelector('.week')).borderRadius,r2:getComputedStyle(document.querySelector('.avgcard')).borderRadius,after:document.querySelector('.week').parentElement.children[1]===document.querySelector('.avgcard')}})()")
        print(r)
        ok('%d: average card sits directly under Spent Each Day, tucked (overlapping edge), two stacked cards'%W, r['after'] and r['at']<r['wb'] and r['ab']>r['wb'] and r['al']>=r['wl'] and r['ar']<=r['wr'])
        ok('%d: three options'%W, r['seg']==['Last 7 Days','Last 30 Days','Overall'])
        ok('%d: same radius, old inline averages hidden in Theme 1'%W, r['r1']==r['r2'] and r['hidden']=='none')
        vals={}
        for k,lab in (('d7','Last 7 Days'),('d30','Last 30 Days'),('all','Overall')):
            pg.tap('.avgcard .seg button:has-text("%s")'%lab); pg.wait_for_timeout(150)
            vals[k]=pg.inner_text('.avgval b')
        want=pg.evaluate("(async()=>{const c=await import('/js/core.js'),r=await import('/js/rolling.js');const a=r.dailyAverages(c.get(),new Date().toISOString().slice(0,10));return a})()")
        print(vals,want)
        ok('%d: toggling changes the value (7 / 30 / overall)'%W, len(set(vals.values()))>=2)
        ok('%d: Overall shows the number of days'%W, 'days' in pg.inner_text('.avgval small'))
        pg.tap('.avgcard .seg button:has-text("Last 30 Days")'); pg.wait_for_timeout(100); pg.reload(); pg.wait_for_timeout(1500)
        ok('%d: choice is remembered'%W, 'on' in (pg.get_attribute('.avgcard .seg button:nth-child(2)','class') or ''))
        # --- net income chip
        ch=pg.evaluate("(()=>{const c=document.querySelector('.sc-front .bm-chip'),n=document.querySelector('.sc-front .sc-net b');return {has:!!c,txt:c&&c.textContent,fs:parseFloat(getComputedStyle(n).fontSize),lab:c&&c.getAttribute('aria-label')}})()")
        print(ch)
        ok('%d: Net income larger (>=38px at 390)'%W, ch['fs']>=(38 if W>=390 else 30))
        ok('%d: comparison chip shows a percent against average'%W, ch['has'] and '%' in ch['txt'] and 'average' in ch['txt'])
        seen=[ch['txt']]
        for i in range(3):
            pg.tap('.sc-front .bm-chip'); pg.wait_for_timeout(120); seen.append(pg.inner_text('.sc-front .bm-chip'))
        print(seen)
        ok('%d: tap cycles average -> median -> best month -> average'%W, 'median' in seen[1] and 'best' in seen[2] and 'average' in seen[3])
        ok('%d: chip stays inside the card'%W, pg.evaluate("(()=>{const c=document.querySelector('.sc-front .bm-chip').getBoundingClientRect(),f=document.querySelector('.sc-front').getBoundingClientRect();return c.right<=f.right-8&&c.left>=f.left})()") and pg.evaluate("document.documentElement.scrollWidth")<=W)
        # current month (in progress): compared over the same days only, no errors
        pg.tap('.mscard'); pg.wait_for_timeout(150); pg.evaluate("(()=>{const t=new Date(),m=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0');const b=document.querySelector('.msm[data-m=\"'+m+'\"]');if(b)b.click()})()"); pg.wait_for_timeout(900)
        ok('%d: the month in progress renders (same-days comparison)'%W, pg.locator('.main-home-card').count()==1 and not errs)
        pg.tap('.mscard'); pg.wait_for_timeout(150); pg.evaluate("(()=>{const b=[...document.querySelectorAll('.msm')].find(x=>x.dataset.m.endsWith('-10')&&!x.disabled);if(b)b.click()})()"); pg.wait_for_timeout(900)
        # --- mountain
        m=pg.evaluate("(()=>{const a=document.querySelector('.sc-front .sk-area'),g=document.querySelector('.sc-front linearGradient'),st=[...g.querySelectorAll('stop')].map(s=>s.getAttribute('stop-opacity'));return {fill:a.getAttribute('fill'),st}})()")
        ok('%d: mountain fill fades from semi-transparent to clear %s'%(W,m), m['fill'].startswith('url(') and float(m['st'][0])<=.35 and float(m['st'][1])==0)
        # --- bell
        pos=pg.evaluate("(()=>{const q=s=>document.querySelector(s).getBoundingClientRect();return {bell:q('.bellbtn'),eye:q('[data-act=eye]'),t:document.querySelector('.bellbtn .bdot')&&document.querySelector('.bellbtn .bdot').textContent}})()")
        ok('%d: bell immediately left of the eye %s'%(W,pos['t']), pos['bell']['right']<=pos['eye']['left']+1 and pos['eye']['left']-pos['bell']['right']<12)
        n0=int(pg.evaluate("(()=>{const d=document.querySelector('.bellbtn .bdot');return d?parseInt(d.textContent):0})()"))
        ok('%d: unread badge shown (%d)'%(W,n0), n0>=1)
        pg.tap('.bellbtn'); pg.wait_for_selector('.glancesheet',timeout=5000); pg.wait_for_timeout(300)
        n1=int(pg.evaluate("(()=>{const d=document.querySelector('.bellbtn .bdot');return d?parseInt(d.textContent):0})()"))
        ok('%d: opening reads the first item, badge drops %d -> %d'%(W,n0,n1), n1==n0-1)
        # dismiss, bell reopens
        pg.tap('.glancesheet [data-g="done"]'); pg.wait_for_timeout(500); ok('%d: dismissed'%W, pg.locator('.glancesheet').count()==0)
        pg.tap('.bellbtn'); pg.wait_for_selector('.glancesheet',timeout=5000); ok('%d: bell reopens after dismissing'%W, True)
        # read the rest
        for i in range(12):
            if pg.locator('.glancesheet [data-g="next"]').count()==0: break
            pg.tap('.glancesheet [data-g="next"]'); pg.wait_for_timeout(150)
        pg.tap('.glancesheet [data-g="done"]'); pg.wait_for_timeout(500)
        n2=pg.evaluate("document.querySelector('.bellbtn .bdot')?1:0")
        ok('%d: badge gone once everything is read'%W, n2==0 and 'all read' in pg.get_attribute('.bellbtn','aria-label'))
        pg.tap('.bellbtn'); pg.wait_for_selector('.glancesheet',timeout=5000); ok('%d: bell still reopens when all read'%W, True)
        pg.tap('.glancesheet [data-g="done"]'); pg.wait_for_timeout(400)
        ok('%d: no page errors %s'%(W,errs), not errs)
