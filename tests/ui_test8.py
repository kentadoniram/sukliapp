from playwright.sync_api import sync_playwright
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
    pg.goto('http://localhost:8123/index.html#/accounts'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(300)
    ok('net worth card shown: '+pg.inner_text('.nwmain').replace('\n',' | ')[:80], 'Net worth' in pg.inner_text('.nwmain'))
    pg.select_option('[data-aview=group]','cur'); pg.wait_for_timeout(300)
    secs=pg.locator('.coll .collhead h2').all_inner_texts(); print('  sections',[x.replace('\n',' ') for x in secs])
    ok('grouped by currency first (PHP first)', secs[0].startswith('PHP'))
    # sorted high to low inside PHP
    def amounts(sec):
        return pg.eval_on_selector_all(f'section.coll:nth-of-type({sec}) .row.acct .ramt b','els=>els.map(e=>e.textContent)')
    first=pg.eval_on_selector_all('section.coll .row.acct .ramt b','els=>els.slice(0,6).map(e=>parseFloat(e.textContent.replace(/[^0-9.\\-−]/g,"").replace("−","-")))')
    print('  first amounts',first)
    ok('sorted high to low', all(first[i]>=first[i+1] for i in range(len(first)-1)))
    pg.select_option('[data-aview=group]','type'); pg.wait_for_timeout(200)
    secs=pg.locator('.coll .collhead h2').all_inner_texts(); print('  by type',[x.replace('\n',' ') for x in secs])
    ok('grouping by category works', len(secs)>=3 and not secs[0].startswith('PHP'))
    pg.select_option('[data-aview=sort]','low'); pg.wait_for_timeout(200)
    ok('sort buttons toggle', pg.input_value('[data-aview=sort]')=='low')
    pg.select_option('[data-aview=group]','cur'); pg.select_option('[data-aview=sort]','high'); pg.wait_for_timeout(200)
    pg.screenshot(path=S+'v5-accounts.png')
    # net worth sheet
    pg.click('[data-act=nw]'); pg.wait_for_selector('#nw svg'); 
    ok('net worth sheet: 12 bars + kinds', pg.locator('#nw svg g[data-tip]').count()==12 and pg.locator('#nw .gbar').count()>=2)
    pg.hover('#nw svg g[data-tip]:nth-of-type(12)'); pg.wait_for_timeout(250)
    ok('hover shows tooltip', pg.locator('.tip.show').count()==1 and 'Oct' in pg.inner_text('.tip.show'))
    pg.screenshot(path=S+'v5-networth.png'); pg.click('.scrim [data-close]')
    # account detail
    pg.click('section.coll .row.acct >> nth=0'); pg.wait_for_selector('#ad svg.scrub'); pg.wait_for_timeout(300)
    ok('detail has history rows', pg.locator('#ad .rows .row').count()>=1)
    ok('detail chart has points', pg.evaluate("JSON.parse(document.querySelector('#ad svg.scrub').dataset.pts).length")>=30)
    box=pg.locator('#ad svg.scrub').bounding_box()
    pg.mouse.move(box['x']+box['width']*0.5, box['y']+box['height']/2); pg.mouse.down(); pg.mouse.move(box['x']+box['width']*0.6, box['y']+box['height']/2); pg.wait_for_timeout(200)
    ok('scrub shows cursor and tooltip', pg.locator('#ad svg .scrubcur').count()==1 and pg.locator('.tip.show').count()==1)
    pg.mouse.up()
    pg.click('[data-ad=range][data-v="365"]'); pg.wait_for_timeout(100)
    ok('range 1 year', pg.evaluate("JSON.parse(document.querySelector('#ad svg.scrub').dataset.pts).length")==365)
    pg.screenshot(path=S+'v5-acctdetail.png')
    # edit -> interest + card
    pg.click('[data-ad=edit]'); pg.wait_for_selector('#acct-form')
    pg.fill('#acct-form [name=apy]','4'); pg.fill('#acct-form [name=interestFrom]','2026-10-10'); pg.click('#acct-form button[type=submit], #acct-form .btnrow .btn:not(.ghost):not([data-del])'); pg.wait_for_timeout(300)
    n=pg.evaluate("window.sukli.get().txs.filter(t=>t.auto).length"); print('  auto rows',n)
    ok('interest rows posted from start date', n>=8)
    ok('interest category created/used', pg.evaluate("(()=>{const d=window.sukli.get();const t=d.txs.find(t=>t.auto);const c=d.categories.find(c=>c.id===t.cat);return c && c.group==='Earn'})()"))
    pg.close() if False else None
    # credit card fields
    pg.click('.scrim [data-close]') if pg.locator('.scrim').count() else None
    pg.goto('http://localhost:8123/index.html#/accounts'); pg.wait_for_selector('.nwcard')
    card=pg.evaluate("window.sukli.get().accounts.find(a=>a.type==='card')")
    print('  a card account:', card and card['name'])
    if card:
        pg.click(f'[data-act=acct][data-id="{card["id"]}"]'); pg.wait_for_selector('#ad'); pg.click('[data-ad=edit]'); pg.wait_for_selector('#cardfields:not([hidden])')
        pg.fill('#acct-form [name=limit]','50000'); pg.fill('#acct-form [name=dueDay]','25'); pg.click('#acct-form button[type=submit], #acct-form .btnrow .btn:not(.ghost):not([data-del])'); pg.wait_for_timeout(300)
        ok('detail stays open and refreshes after save', pg.locator('#ad .cardbox').count()==1)
        while pg.locator('.scrim').count(): pg.locator('.scrim [data-close]').last.click(); pg.wait_for_timeout(100)
        pg.click(f'[data-act=acct][data-id="{card["id"]}"]'); pg.wait_for_selector('#ad .cardbox')
        txt=pg.inner_text('#ad .cardbox'); print('  ',txt.replace('\n',' | ')[:160])
        ok('card box shows limit and next payment', '50,000' in txt and ('Amount due' in txt or 'Next' in txt or 'Paid' in txt))
        with pg.expect_download() as dl: pg.click('[data-ad=ics]')
        ok('ics downloads', dl.value.suggested_filename.endswith('.ics'))
    print('errors:',errs); ok('no console errors', not [e for e in errs if 'TUNNEL' not in e])
    b.close()
print(sum(res),'/',len(res))
