# v15.63: compact Theme 1 switch on the label row, comparison tags on every figure (front + back), diagonal arrows, raised bars; Legacy unchanged
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for W in (390,320):
        ctx=b.new_context(viewport={'width':W,'height':844},service_workers='block',has_touch=True,is_mobile=True); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000)
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1800)
        # 1 toggle
        t=pg.evaluate("""(()=>{const g=document.querySelector('.t1seg'),h=document.querySelector('.avgcard .subh'),c=document.querySelector('.avgcard'),gr=g.getBoundingClientRect(),hr=h.getBoundingClientRect(),cs=getComputedStyle(g),ps=getComputedStyle(g,'::before');return {gh:gr.height,gw:gr.width,sameRow:Math.abs((gr.top+gr.bottom)/2-(hr.top+hr.bottom)/2)<6,rad:cs.borderRadius,pillRad:ps.borderRadius,ch:c.getBoundingClientRect().height,slots:[...g.querySelectorAll('button')].map(x=>x.textContent+'|'+x.getAttribute('aria-label')),oldSeg:document.querySelectorAll('.avgcard .seg').length,right:gr.right<=c.getBoundingClientRect().right}})()""")
        print(t)
        ok('%d: switch is compact (<=36px high) with a rounded track and a rounded oblong pill'%W, t['gh']<=36 and float(t['rad'][:-2])>=14 and float(t['pillRad'].split('px')[0])>=12)
        ok('%d: label and switch share one row (320 may wrap)'%W, t['sameRow'] or W<=320)
        ok('%d: three slots with full spoken names'%W, [x.split('|')[1] for x in t['slots']]==['Last 7 Days','Last 30 Days','Overall'] and t['oldSeg']==0)
        ok('%d: bottom card is shorter than before (<=150px at 390)'%W, t['ch']<=(150 if W>=390 else 175))
        pg.tap('.t1s-slot[aria-label="Overall"]'); pg.wait_for_timeout(350)
        ok('%d: pill moves to the third slot'%W, pg.get_attribute('.t1seg','data-sel')=='2' and pg.evaluate("(()=>{const pill=getComputedStyle(document.querySelector('.t1seg'),'::before').transform;return pill!=='none'})()"))
        # legacy keeps the shared seg component
        ok('%d: shared seg component untouched'%W, pg.evaluate("(async()=>{const c=await import('/js/components.js');const h=c.seg({options:[{label:'a',value:'a'},{label:'b',value:'b'}],value:'a',act:'x'});return h.includes('class=\"seg sm two')})()"))
        # 2 chips
        f=pg.evaluate("""(()=>{const o={};for(const k of ['front','back']){const f=document.querySelector('.sc-'+k);o[k]={rows:[...f.querySelectorAll('.sc-row')].map(r=>({lab:r.querySelector('.sc-lab').textContent.trim(),arrowD:r.querySelector('.sc-arr path').getAttribute('d'),mini:!!r.querySelector('.bm-mini'),txt:r.querySelector('.bm-mini')?r.querySelector('.bm-mini').textContent:'',cls:r.querySelector('.bm-mini')?r.querySelector('.bm-mini').className:''}))}}return o})()""")
        print(f)
        d_up='M7 17L17 7M9 7h8v8'; d_dn='M7 7l10 10M9 17h8V9'
        fr={r['lab']:r for r in f['front']['rows']}; bk={r['lab']:r for r in f['back']['rows']}
        ok('%d: Income arrow points down-right, Expenses up-right'%W, fr['Income']['arrowD']==d_dn and fr['Expenses']['arrowD']==d_up)
        ok('%d: Assets arrow up-right, Liabilities down-right'%W, bk['Assets']['arrowD']==d_up and bk['Liabilities']['arrowD']==d_dn)
        ok('%d: Income, Expenses, Assets, Liabilities all carry a percent tag'%W, all(r['mini'] and '%' in r['txt'] for r in (fr['Income'],fr['Expenses'],bk['Assets'],bk['Liabilities'])))
        ok('%d: tags coloured better/worse'%W, all(('good' in r['cls'] or 'bad' in r['cls']) for r in (fr['Income'],fr['Expenses'],bk['Assets'],bk['Liabilities'])))
        # tap Net income chip changes all tags together
        before=pg.evaluate("[...document.querySelectorAll('.main-home-card [data-bm]')].map(e=>e.dataset.i)")
        pg.tap('.sc-front .bm-chip'); pg.wait_for_timeout(150)
        after=pg.evaluate("[...document.querySelectorAll('.main-home-card [data-bm]')].map(e=>e.dataset.i)")
        names=pg.evaluate("document.querySelector('.sc-front .bm-chip').textContent")
        ok('%d: one tap moves every tag to the next benchmark %s -> %s'%(W,before,after), len(set(after))==1 and after[0]!=before[0] and 'median' in names)
        # expenses: lower is better
        pg.tap('.sc-front .bm-chip'); pg.tap('.sc-front .bm-chip'); pg.wait_for_timeout(100)
        # mini tags inside card, no overflow
        ok('%d: tags stay inside the card, no sideways scroll'%W, pg.evaluate("(()=>{const f=document.querySelector('.sc-front').getBoundingClientRect();return [...document.querySelectorAll('.sc-front .bm-mini,.sc-front .bm-chip')].every(e=>{const r=e.getBoundingClientRect();return r.right<=f.right-4&&r.left>=f.left})&&document.documentElement.scrollWidth<=innerWidth})()"))
        pg.tap('.sc-front .sc-swap'); pg.wait_for_timeout(1000)
        ok('%d: back face tags inside the card'%W, pg.evaluate("(()=>{const f=document.querySelector('.sc-back').getBoundingClientRect();return [...document.querySelectorAll('.sc-back .bm-mini')].every(e=>{const r=e.getBoundingClientRect();return r.right<=f.right-4&&r.left>=f.left})})()"))
        # hidden amounts hide the percent gap
        pg.tap('.sc-back .sc-swap'); pg.wait_for_timeout(1000); pg.tap('[data-act=eye]'); pg.wait_for_timeout(500)
        ok('%d: eye hides the percentages'%W, pg.evaluate("[...document.querySelectorAll('.main-home-card .bm-mini,.main-home-card .bm-chip')].every(e=>!/\\d/.test(e.textContent))"))
        pg.tap('[data-act=eye]'); pg.wait_for_timeout(400)
        # 3 bars (the sample file ends in October, so add a few recent expenses)
        pg.evaluate("""(async()=>{const m=await import('/js/core.js');const d0=new Date();const ds=n=>{const d=new Date(d0.getTime()-n*864e5);return d.toISOString().slice(0,10)+' 12:00:00'};m.commit(d=>{const a=d.accounts.find(x=>!x.deleted);[[0,420],[1,1500],[3,800],[5,260]].forEach(([n,v],i)=>d.txs.push(m.stamp({id:'bar'+i,kind:'expense',date:ds(n),name:'Test '+i,amount:v,cur:a.cur,fx:1,acct:a.id})))})})()"""); pg.wait_for_timeout(1200)
        bar=pg.evaluate("(()=>{const i=document.querySelector('.week .wc .wb i')||document.querySelector('.week .wk .wtrack i');const s=getComputedStyle(i);return {sh:s.boxShadow,ov:getComputedStyle(i.parentElement).overflow}})()")
        print(bar)
        ok('%d: bars have an outward shadow, slot not clipping them'%W, bar['sh']!='none' and bar['ov']=='visible')
        ok('%d: no page errors %s'%(W,errs), not errs)
        # legacy
        pg.evaluate("(async()=>{const a=await import('/js/appearance.js');})()")
        ctx.close()
