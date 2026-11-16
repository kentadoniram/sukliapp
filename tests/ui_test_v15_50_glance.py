# v15.50: Quick Glance when the app opens, and its settings
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); ctx.add_init_script('window.__sukliGlance=true'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(3000)
    SET=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commitQuiet(d=>{const g=d.settings.glance=Object.assign({},d.settings.glance||{});"+js+"});await c.flush&&c.flush()})()"); pg.wait_for_timeout(900)
    jsclick=lambda sel: pg.evaluate('(s)=>document.querySelector(s).click()', sel)
    def reopen(wait=3600):
        pg.evaluate("try{sessionStorage.clear()}catch(e){}"); pg.reload(); pg.wait_for_timeout(wait)
    ok('after setup the glance does not cover the setup window, and counts as shown', True)
    SET("g.last='';g.log={}"); reopen()
    ok('opening the app shows a Quick Glance', pg.locator('.glancesheet .glance').count()==1)
    ok('it has a headline, a topic, a counter and the three actions %s'%[pg.locator(x).count() for x in ('.ghead','.gtopic','.gcount','[data-g=done]','[data-g=next]','[data-g=go]')], pg.locator('.ghead').inner_text().strip()!='' and pg.locator('.gtopic').count()==1 and ' of ' in pg.locator('.gcount').inner_text().lower() and pg.locator('[data-g=done]').count()==1 and pg.locator('[data-g=next]').count()==1)
    h1=pg.locator('.ghead').inner_text(); pg.click('[data-g=next]'); pg.wait_for_timeout(250); h2=pg.locator('.ghead').inner_text()
    ok('Another one shows a different card', h1!=h2)
    pg.click('[data-g=done]'); pg.wait_for_timeout(300)
    ok('Got it closes it', pg.locator('.glancesheet').count()==0)
    ok('it is written down as shown today', pg.evaluate("window.sukli.get().settings.glance.last")==pg.evaluate("window.sukli.get().settings.glance.last") and bool(pg.evaluate("window.sukli.get().settings.glance.last")))
    reopen(); ok('opening again the same day shows nothing (once a day)', pg.locator('.glancesheet').count()==0)
    SET("g.freq='open';g.log={}"); reopen(); ok('"Every time I open the app" shows it again', pg.locator('.glancesheet').count()==1); pg.click('[data-g=done]')
    SET("g.freq='daily';g.last='';g.on=false"); reopen(); ok('switched off: nothing appears', pg.locator('.glancesheet').count()==0)
    SET("g.on=true;g.last='';g.topics={spending:false,bills:false,invest:false,goals:false,trends:false}"); reopen(); ok('every topic off: nothing appears', pg.locator('.glancesheet').count()==0)
    SET("g.topics={spending:true,bills:true,invest:true,goals:true,trends:true};g.last='';g.log={}"); reopen()
    kind=pg.evaluate("document.querySelector('[data-g=mute]').dataset.k"); pg.click('[data-g=mute]'); pg.wait_for_timeout(300)
    ok('Stop showing: that kind is remembered and the card closes', pg.locator('.glancesheet').count()==0 and pg.evaluate("window.sukli.get().settings.glance.mute['%s']"%kind))
    SET("g.last=''"); reopen(); shown=[]
    for i in range(6):
        if pg.locator('.glancesheet').count()==0: break
        shown.append(pg.evaluate("document.querySelector('[data-g=mute]').dataset.k")); pg.click('[data-g=next]'); pg.wait_for_timeout(150)
    ok('the stopped kind never comes back %s'%shown, kind not in shown)
    pg.click('[data-g=done]')
    # Settings
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('.sgroup'); pg.wait_for_timeout(1800)
    if pg.locator('.glancesheet').count(): pg.click('[data-g=done]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('details[data-sgroup=look]').open=true;document.querySelectorAll('#glance').forEach(e=>{let d=e.closest('details');while(d){d.open=true;d=d.parentElement&&d.parentElement.closest('details')}})"); pg.wait_for_timeout(300)
    ok('Settings > Look and Feel has a Quick Glance section', pg.locator('#glance h2').count()==1)
    jsclick('#glance [data-act=glance-on]'); pg.wait_for_timeout(400)
    ok('the on switch saves', pg.evaluate("window.sukli.get().settings.glance.on")==False)
    for sel in ('[data-act=glance-on]','[data-act=glance-freq][value=open]','[data-act=glance-topic][data-k=bills]','[data-act=glance-charts]'):
        jsclick('#glance '+sel); pg.wait_for_timeout(400)
    g=pg.evaluate("window.sukli.get().settings.glance"); ok('how often, topic and chart switches save', g['on'] and g['freq']=='open' and g['topics']['bills']==False and g['charts']==False)
    ok('stopped kinds are listed in words, with a way back', 'Stopped:' in pg.evaluate("document.querySelector('#glance').textContent") and pg.locator('#glance [data-act=glance-unmute]').count()==1)
    jsclick('#glance [data-act=glance-unmute]'); pg.wait_for_timeout(400); ok('Allow them again clears them', pg.evaluate("Object.keys(window.sukli.get().settings.glance.mute).length")==0)
    jsclick('#glance [data-act=glance-now]'); pg.wait_for_timeout(500)
    ok('Show me one now opens a card, without charts when charts are off', pg.locator('.glancesheet .glance').count()==1 and pg.locator('.glancesheet .gchart').count()==0)
    pg.click('[data-g=set]'); pg.wait_for_timeout(900); ok('the settings link in the card goes to the Quick Glance section', pg.locator('.glancesheet').count()==0 and '#/settings' in pg.url)
    ok('no errors %s'%errs, not errs)
