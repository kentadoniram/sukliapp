# v12ae: iPhone 16 Pro (402x874, touch) and small phones 320-360: no zoom triggers, no sideways scroll, steady entry form with a keyboard-sized screen
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
ROUTES=['home','ledger','calendar','accounts','budget','cashflow','outlook','analytics','invest','settings']
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
SMALL="[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]),select,textarea')].filter(e=>e.getBoundingClientRect().width>0&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.name||e.id||e.className)"
OVER="(()=>{const W=innerWidth;return [document.documentElement.scrollWidth>W+1,[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>W+1)&&getComputedStyle(e).position!=='fixed'&&!e.closest('svg,.wkv,.chips,.qp,.fquick,.ratebox,.scrollx,.seg,.nmap')}).length]})()"
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':402,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block')
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    for w in (320,360,402):
        pg.set_viewport_size({'width':w,'height':874}); small=[]; over=[]
        for r in ROUTES:
            pg.goto('http://localhost:8123/#/'+r); pg.wait_for_timeout(450)
            pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.wait_for_timeout(100)
            small+= [f'{r}:{x}' for x in pg.evaluate(SMALL)]
            o=pg.evaluate(OVER)
            if o[0] or o[1]: over.append(f'{r}:{o}')
        ok(f'[{w}] no field under 16px (Safari would zoom in): {small}', not small)
        ok(f'[{w}] no sideways scroll on any screen: {over}', not over)
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(400)
        g=pg.evaluate("(()=>{const a=[...document.querySelectorAll('.fdbtn')].map(e=>e.getBoundingClientRect());return [a.length,a[0]&&a[1]&&a[0].right<=a[1].left-6,a[0]&&a[0].width>=90]})()")
        ok(f'[{w}] date range buttons sit apart and are wide enough', g[0]==2 and g[1] and g[2])
    # zoom guards
    pg.set_viewport_size({'width':402,'height':874})
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(300)
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-amount'); pg.click('[data-e=calc]'); pg.wait_for_timeout(250)
    ta=pg.evaluate("[getComputedStyle(document.querySelector('.keypad button')).touchAction,getComputedStyle(document.body).touchAction]")
    ok(f'keypad has touch-action manipulation: {ta}', ta[0]=='manipulation')
    # tap the same key twice quickly, page must not change scale
    sc0=pg.evaluate("visualViewport.scale")
    for _ in range(4): pg.tap('.keypad button[data-v="7"]',timeout=3000)
    ok('same key tapped four times keeps the scale', pg.evaluate("visualViewport.scale")==sc0 and pg.input_value('#f-amount')=='7777')
    # keyboard-sized screen: nothing moves while typing
    pg.set_viewport_size({'width':402,'height':540})
    pg.wait_for_timeout(300)
    POS="(()=>{const o=document.querySelector('#f-name').getBoundingClientRect().top;const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top-o),Math.round(r.height)]};return JSON.stringify([q('#f-amount'),q('.keypad button'),q('#whenrow'),q('#acctrow')])})()"
    p0=pg.evaluate(POS); st=True
    pg.tap('#f-name'); pg.keyboard.type('Life Tsukagoshi',delay=20); pg.wait_for_timeout(500)
    st = pg.evaluate(POS)==p0
    for k in ['1','2','+','3','⌫','=']:
        pg.tap(f'.keypad button[data-v="{k}"]'); 
        if pg.evaluate(POS)!=p0: st=False
    ok('entry form stays put with a short (keyboard) screen', st)
    # caret alignment: text box content is vertically centred
    c=pg.evaluate("(()=>{const e=document.querySelector('#f-name');const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return [r.height,parseFloat(cs.lineHeight)||0,parseFloat(cs.paddingTop),parseFloat(cs.paddingBottom)]})()")
    ok(f'text box height {c[0]} with equal top/bottom padding', c[0]>=44 and c[2]==c[3])
    ok('no page errors', not errs)
    b.close()
print('SUMMARY', sum(res), 'passed', len(res)-sum(res), 'failed')
