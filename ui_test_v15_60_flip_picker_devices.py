# v15.60: card flip (no see-through, readable both sides, same width as Spent Each Day) and the in-page month picker, on desktop (mouse) and emulated iPhone (touch, WebKit-style UA) in two viewport sizes
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
DEV={'desktop':dict(viewport={'width':1100,'height':800}),
     'iPhone 13':dict(viewport={'width':390,'height':844},device_scale_factor=3,has_touch=True,is_mobile=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'),
     'iPhone SE (Chrome UA)':dict(viewport={'width':320,'height':568},device_scale_factor=2,has_touch=True,is_mobile=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1')}
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,kw in DEV.items():
        touch=kw.get('has_touch',False); ctx=b.new_context(service_workers='block',**kw); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.add_init_script("Event.prototype.composedPath=function(){return []}")
        tap=(lambda s: pg.tap(s)) if touch else (lambda s: pg.click(s))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000)
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1500)
        N=name
        # picker
        tap('.mscard'); pg.wait_for_timeout(200); ok(N+': opens', pg.locator('#mspanel:visible').count()==1)
        pos=pg.evaluate("(()=>{const r=document.getElementById('mspanel').getBoundingClientRect(),h=document.querySelector('header.top').getBoundingClientRect();return {pos:getComputedStyle(document.getElementById('mspanel')).position,below:r.top>=h.bottom-1,w:r.width,vw:innerWidth}})()")
        ok(N+': panel is in the page flow under the header, not floating %s'%pos, pos['pos']=='static' and pos['below'] and pos['w']<=pos['vw'])
        y0=int(pg.inner_text('.msyear b'))
        for i in range(3): tap('.msyear [data-d="-1"]'); pg.wait_for_timeout(180)
        ok(N+': year arrow x3 stays open %s'%pg.inner_text('.msyear b'), pg.locator('#mspanel:visible').count()==1 and int(pg.inner_text('.msyear b'))==y0-3)
        tap('.msyear [data-d="1"]'); pg.wait_for_timeout(150); ok(N+': forward arrow', int(pg.inner_text('.msyear b'))==y0-2)
        tap('.mscard'); pg.wait_for_timeout(250); ok(N+': arrow closes it', pg.locator('#mspanel:visible').count()==0 and pg.get_attribute('.mscard','aria-expanded')=='false')
        tap('.mscard'); pg.wait_for_timeout(150); pg.evaluate("window.dispatchEvent(new Event('sukli-render'))"); pg.wait_for_timeout(400); ok(N+': redraw keeps it open', pg.locator('#mspanel:visible').count()==1)
        tap('.mscard'); pg.wait_for_timeout(200); ok(N+': and still closes after a redraw', pg.locator('#mspanel:visible').count()==0)
        tap('.mscard'); pg.wait_for_timeout(150); tap('.msm:not([disabled])'); pg.wait_for_timeout(700); ok(N+': picking a month closes it and switches', pg.locator('#mspanel:visible').count()==0)
        # widths
        w=pg.evaluate("(()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return [Math.round(x.left),Math.round(x.right)]};return [r('.main-home-card .sc-front'),r('.main-home-card .sc-back'),r('.week')]})()")
        ok(N+': card width equals Spent Each Day %s'%w, w[0]==w[2] and w[1]==w[2])
        # flip
        swap='.sc-front .sc-swap'
        tap(swap); pg.wait_for_timeout(120)
        e=pg.evaluate("(()=>{const v=s=>getComputedStyle(document.querySelector(s)).visibility;return [v('.sc-front'),v('.sc-back')]})()"); ok(N+': first half: only the front is drawn %s'%e, e==['visible','hidden'])
        pg.wait_for_timeout(330)
        e=pg.evaluate("(()=>{const v=s=>getComputedStyle(document.querySelector(s)).visibility;return [v('.sc-front'),v('.sc-back')]})()"); ok(N+': second half: only the back is drawn %s'%e, e==['hidden','visible'])
        pg.wait_for_timeout(700)
        m=pg.evaluate("(()=>{const q=s=>getComputedStyle(document.querySelector(s)).transform;const t=q('.sc-inner');return t})()")
        ok(N+': at rest the back reads normally (net rotation 180° of a 180° face = unmirrored) %s'%m[:40], m.startswith('matrix3d(-1'))
        ok(N+': all the card parts are hidden-backface', pg.evaluate("[...document.querySelectorAll('.main-home-card .sc-face, .main-home-card .sc-face *')].every(e=>getComputedStyle(e).backfaceVisibility==='hidden')"))
        t=pg.inner_text('.sc-back'); ok(N+': back has Net worth / Assets / Liabilities', all(k in t for k in ('Net worth','Assets','Liabilities')))
        tap('.sc-back .sc-swap'); pg.wait_for_timeout(1100); ok(N+': flips back', pg.locator('.main-home-card.flipped').count()==0)
        ok(N+': no overflow', pg.evaluate("document.documentElement.scrollWidth")<=kw['viewport']['width'])
        ok(N+': no page errors %s'%errs, not errs)
        ctx.close()
