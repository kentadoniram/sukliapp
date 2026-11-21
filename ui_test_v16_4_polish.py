from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
def lum(rgb):
    r,g,b=[int(x) for x in rgb]
    f=lambda v:(v/255/12.92) if v/255<=.03928 else (((v/255)+.055)/1.055)**2.4
    return .2126*f(r)+.7152*f(g)+.0722*f(b)
def ratio(a,b):
    la,lb=sorted((lum(a),lum(b)),reverse=True); return (la+.05)/(lb+.05)
import re
def rgb(s): return re.findall(r'\d+',s)[:3]
with sync_playwright() as p:
    b=p.chromium.launch()
    for sch in ('light','dark'):
      for vw in (390,320):
        ctx=b.new_context(service_workers='block',viewport={'width':vw,'height':844},color_scheme=sch); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
        n=f'{sch}/{vw}: '
        ok(n+'version 16.4+', pg.evaluate("(async()=>(await import('/js/version.js')).versionText())()").split('.')[0]=='16' and int(pg.evaluate("(async()=>(await import('/js/version.js')).versionText())()").split('.')[1])>=4)
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1500)
        h=pg.evaluate("(()=>{const q=s=>document.querySelector(s),a=q('.sc-front .sc-row .sc-vl'),r=e=>e.getBoundingClientRect();const rows=[...document.querySelectorAll('.sc-front .sc-row')].map(e=>{const v=e.querySelector('.sc-val'),m=e.querySelector('.bm-mini');return {same:m?Math.abs(r(v).top+r(v).height/2-(r(m).top+r(m).height/2))<6:null,sep:!!e.querySelector('.sc-sep')}});const bell=q('.bellbtn');return {rows,face:Math.round(r(q('.sc-front')).height),nudge:bell?{cls:bell.classList.contains('ringing'),anim:getComputedStyle(bell.querySelector('svg')).animationName}:null,over:document.documentElement.scrollWidth>innerWidth}})()")
        print(h)
        ok(n+'Income and Expenses show value and % on one line', all(x['same'] and x['sep'] for x in h['rows']) or vw==320)
        ok(n+'main card is shorter (<=240px at 390, was 262+)', h['face']<=(240 if vw==390 else 255))
        ok(n+'bell nudges when unread', h['nudge'] is None or h['nudge']['cls']==(h['nudge']['anim']=='bellnudge') )
        # tooltip contrast
        box=pg.locator('.sc-front .sc-spark').bounding_box(); pg.mouse.move(box['x']+box['width']*.45,box['y']+box['height']/2); pg.wait_for_timeout(250)
        t=pg.evaluate("(()=>{const t=document.querySelector('.sc-front .sk-tip'),s=getComputedStyle(t);return {c:s.color,bg:s.backgroundColor,vis:!t.hidden}})()")
        ok(n+'tooltip text readable (contrast %.1f)'%ratio(rgb(t['c']),rgb(t['bg'])), t['vis'] and ratio(rgb(t['c']),rgb(t['bg']))>=7)
        pg.mouse.move(2,2)
        # net worth %
        pg.click('.sc-front .sc-swap'); pg.wait_for_timeout(900)
        w=pg.evaluate("(()=>({chip:!!document.querySelector('.sc-back .bm-chip'),txt:document.querySelector('.sc-back .bm-chip')?.innerText,rows:[...document.querySelectorAll('.sc-back .sc-row')].map(e=>!!e.querySelector('.bm-mini')),over:[...document.querySelectorAll('.sc-back .sc-row')].some(e=>e.getBoundingClientRect().right>document.querySelector('.sc-back').getBoundingClientRect().right+1)}))()")
        print(w)
        ok(n+'net worth has a percentage chip; Assets/Liabilities keep theirs, nothing sticks out', w['chip'] and all(w['rows']) and not w['over'])
        ok(n+'wider bars', pg.evaluate("(()=>{const b=document.querySelector('.week .wc .wb');return b?b.getBoundingClientRect().width:99})()")>=24)
        # menu
        pg.click('.burger'); pg.wait_for_timeout(500)
        d=pg.evaluate("(()=>{const e=document.querySelector('.drawer'),s=getComputedStyle(e);return {w:Math.round(e.getBoundingClientRect().width),bg:s.backgroundImage.includes('gradient'),a:getComputedStyle(document.querySelector('.drawer a')).color,bgc:s.backgroundColor}})()")
        ok(n+'menu narrower with a gradient %s'%d, d['bg'] and d['w']<=(264 if vw==390 else 220))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(1500)
        g=pg.evaluate("(()=>{const q=s=>getComputedStyle(document.querySelector(s));return {a:q('.topgrp.assets').backgroundImage.includes('gradient'),l:!!document.querySelector('.topgrp.liabs')&&q('.topgrp.liabs').backgroundImage.includes('gradient'),bw:q('.topgrp.assets').borderTopWidth,h:q('.topgrp.assets h2').color,bg:q('.topgrp.assets').backgroundColor}})()")
        print(g)
        ok(n+'v16.7: Assets header is plain; its first category card keeps the gradient and a thin border', pg.evaluate("(()=>{const c=getComputedStyle(document.querySelector('.topgrp.assets > .coll'));return c.backgroundImage.includes('gradient')&&c.borderTopWidth==='1px'&&getComputedStyle(document.querySelector('.topgrp.assets')).borderTopWidth==='0px'})()"))
        ok(n+'no errors %s'%errs, not errs)
        ctx.close()
    ctx=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=ctx.new_page()
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
    pg.evaluate("localStorage.setItem('sukli-look', JSON.stringify({design:'legacy'}))"); pg.reload(); pg.wait_for_timeout(1200)
    pg.click('.burger'); pg.wait_for_timeout(500)
    ok('legacy: burger menu unchanged (width, plain background)', pg.evaluate("(()=>{const e=document.querySelector('.drawer'),s=getComputedStyle(e);return !s.backgroundImage.includes('gradient')&&Math.round(e.getBoundingClientRect().width)>=300})()"))
    pg.keyboard.press('Escape'); pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(1200)
    ok('legacy: v16.7 Assets header plain, category card has a tinted border and no gradient', pg.evaluate("(()=>{const c=getComputedStyle(document.querySelector('.topgrp.assets > .coll'));return !c.backgroundImage.includes('gradient')&&c.borderTopWidth==='1px'&&getComputedStyle(document.querySelector('.topgrp.assets')).borderTopWidth==='0px'})()"))
