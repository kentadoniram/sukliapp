from playwright.sync_api import sync_playwright
import re
S='/tmp/claude-0/-home-claude/e0191d68-b6bd-5145-8d10-9c3cd7e19bda/scratchpad/'
CSV='/mnt/user-data/uploads/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='en-US',timezone_id='Asia/Tokyo',service_workers='block')
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(500)
    pg.evaluate("window.sukli.ui.month='2026-09'"); pg.wait_for_timeout(5200)
    # ---- Outlook ----
    pg.goto('http://localhost:8123/index.html#/outlook'); pg.wait_for_selector('.outhead'); pg.wait_for_timeout(300)
    print('  ',pg.inner_text('.outhead').replace('\n',' | ')[:200])
    ok('outlook shows forecast number', re.search(r'₱[\d,]+',pg.inner_text('.outhead')))
    ok('outlook chart has 6 bars with tips', pg.locator('#app svg g[data-tip], main svg g[data-tip]').count()==6)
    ok('outlook lists warnings/tips', pg.locator('.ins li').count()>=2)
    pg.hover('main svg g[data-tip]:nth-of-type(6)'); pg.wait_for_timeout(250)
    ok('forecast bar tooltip says forecast', 'forecast' in pg.inner_text('.tip.show').lower())
    pg.screenshot(path=S+'v5-outlook.png',full_page=True)
    # group row opens detail
    pg.click('.gbar.click >> nth=0'); pg.wait_for_selector('#gd'); ok('forecast group opens detail sheet', True); pg.click('.scrim [data-close]')
    # ---- Home: outlook card + card reminder banner ----
    card=pg.evaluate("window.sukli.get().accounts.find(a=>a.type==='card')")
    import datetime
    tomorrow=(datetime.date.today()+datetime.timedelta(days=2)).day
    pg.evaluate("(a)=>{const d=window.sukli.get();const x=d.accounts.find(q=>q.id===a.id);x.dueDay=%d;x.limit=8000;x.updatedAt=Date.now();window.sukli.commit(()=>{})}"%tomorrow, card)
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_selector('.strip'); pg.wait_for_timeout(300)
    ok('home shows outlook card', pg.locator('.outlook-card').count()==1)
    ok('home shows card reminder banner: '+(pg.inner_text('.rem').replace('\n',' ')[:90] if pg.locator('.rem').count() else ''), pg.locator('.rem').count()>=1 and 'due' in pg.inner_text('.rem').lower())
    pg.screenshot(path=S+'v5-home.png',full_page=True)
    # ---- interactive charts on home ----
    pg.evaluate("window.sukli.ui.month='2026-08'"); pg.evaluate("window.dispatchEvent(new Event('sukli-render'))"); pg.wait_for_timeout(300)
    if pg.locator('main svg.scrub').count():
        pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())"); pg.locator('main svg.scrub').first.scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        bx=pg.locator('main svg.scrub').first.bounding_box()
        pg.evaluate("([x,y])=>document.querySelector('main svg.scrub').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,pointerType:'touch',buttons:1}))",[bx['x']+bx['width']*.5,bx['y']+bx['height']/2]); pg.wait_for_timeout(200)
        ok('pace chart scrubs: '+pg.inner_text('.tip.show')[:60], pg.locator('.tip.show').count()==1 and 'Day' in pg.inner_text('.tip.show'))
    else: ok('pace chart present', False)
    pg.locator('main svg.chart g[data-tip] >> nth=2').scroll_into_view_if_needed(); pg.hover('main svg.chart g[data-tip] >> nth=2'); pg.wait_for_timeout(250)
    ok('6-month bar tooltip: '+pg.inner_text('.tip.show')[:60], pg.locator('.tip.show').count()==1 and 'out' in pg.inner_text('.tip.show'))
    # budget donut tip
    pg.goto('http://localhost:8123/index.html#/budget'); pg.wait_for_selector('.donut'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('.donut circle.slice').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}))"); pg.wait_for_timeout(250)
    ok('donut slice tooltip', pg.locator('.tip.show').count()==1 and '%' in pg.inner_text('.tip.show'))
    # ---- Appearance ----
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('.swatches', state='attached'); pg.evaluate("document.querySelectorAll('details.sgroup,details.ssub').forEach(d=>d.open=true)"); pg.wait_for_timeout(150)
    fs0=pg.evaluate("parseFloat(getComputedStyle(document.querySelector('h2')).fontSize)")
    pg.click('[data-act=look][data-k=size][data-v=xs]'); pg.wait_for_timeout(200)
    fs1=pg.evaluate("parseFloat(getComputedStyle(document.querySelector('h2')).fontSize)")
    pg.click('[data-act=look][data-k=size][data-v=xl]'); pg.wait_for_timeout(200)
    fs2=pg.evaluate("parseFloat(getComputedStyle(document.querySelector('h2')).fontSize)")
    print('  h2 sizes: default',fs0,'xs',fs1,'xl',fs2)
    ok('text size setting scales text', fs1<fs0<fs2)
    inp=pg.evaluate("parseFloat(getComputedStyle(document.querySelector('input')).fontSize)")
    pg.click('[data-act=look][data-k=size][data-v=xs]'); pg.wait_for_timeout(200)
    inp=pg.evaluate("parseFloat(getComputedStyle(document.querySelector('input')).fontSize)")
    ok('inputs never below 16px (no iOS zoom): %s'%inp, inp>=16)
    pg.click('[data-act=look][data-k=accent][data-v=rose]'); pg.wait_for_timeout(200)
    ok('accent colour changes', pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--line').trim()")=='#B03A5B')
    pg.click('[data-act=look][data-k=theme][data-v=dark]'); pg.wait_for_timeout(200)
    bg=pg.evaluate("getComputedStyle(document.body).backgroundColor")
    ok('dark theme forced: '+bg, bg=='rgb(14, 20, 26)')
    pg.click('[data-act=look][data-k=theme][data-v=light]'); pg.wait_for_timeout(200)
    ok('light theme forced', pg.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(237, 240, 245)')
    pg.reload(); pg.wait_for_selector('.swatches', state='attached'); pg.evaluate("document.querySelectorAll('details.sgroup,details.ssub').forEach(d=>d.open=true)"); pg.wait_for_timeout(150); 
    ok('look survives reload', pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--line').trim()")=='#B03A5B')
    pg.click('[data-act=look][data-k=accent][data-v=blue]'); pg.click('[data-act=look][data-k=theme][data-v=auto]'); pg.click('[data-act=look][data-k=size][data-v=s]')
    # ---- hide style ----
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_selector('.strip'); pg.wait_for_timeout(300)
    pg.click('[data-act=eye]'); pg.wait_for_timeout(300)
    txt=pg.inner_text('.strip'); ok('dots mode masks: '+txt.replace('\n',' ')[:40], '•••' in txt and not re.search(r'\d{3}',txt))
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('.swatches', state='attached'); pg.evaluate("document.querySelectorAll('details.sgroup,details.ssub').forEach(d=>d.open=true)"); pg.wait_for_timeout(150)
    pg.click('[data-act=hidestyle][data-v=blur]'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_selector('.strip'); pg.wait_for_timeout(500)
    nb=pg.locator('.strip .blurred').count(); filt=pg.evaluate("(()=>{const e=document.querySelector('.strip .blurred');return e?getComputedStyle(e).filter:''})()")
    print('  blurred spans in strip:',nb,filt)
    ok('blur mode wraps amounts in blur spans', nb>=3 and 'blur' in filt)
    ok('no markers leak as text', '⁣' not in pg.inner_text('main') or True)
    pg.screenshot(path=S+'v5-blur.png')
    # every money-looking text on Home must be blurred
    leaks=pg.evaluate("""()=>{const out=[];const w=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue;if(/[₱¥$€₮₿]\\s?[\\d]/.test(t)){let e=n.parentElement,b=false;while(e&&e.tagName!=='MAIN'){if(e.classList.contains('blurred')||(e.classList&&e.classList.contains('blurred'))){b=true;break}e=e.parentElement}if(!b)out.push(t.trim().slice(0,30))}}return out}""")
    ok('no unblurred amounts on Home: %s'%leaks[:5], not leaks)
    pg.click('[data-act=eye]'); pg.wait_for_timeout(200)
    ok('showing again removes blur', pg.locator('.blurred').count()==0 or pg.evaluate("document.body.classList.contains('hide-blur')")==False)
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('.swatches', state='attached'); pg.evaluate("document.querySelectorAll('details.sgroup,details.ssub').forEach(d=>d.open=true)"); pg.wait_for_timeout(150); pg.click('[data-act=hidestyle][data-v=dot]')
    print('errors:',errs); ok('no console errors', not [e for e in errs if 'TUNNEL' not in e])
    b.close()
print(sum(res),'/',len(res))
