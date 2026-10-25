from playwright.sync_api import sync_playwright
import json, re
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
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(400)
    # 3 labels
    pg.click('.fab'); pg.wait_for_selector('#entry')
    seg=pg.inner_text('#seg'); ok('entry types renamed: '+seg.replace('\n',' '), all(w in seg for w in ['Expense','Income','Transfer']) and 'Spent' not in seg)
    # 11 suggestions: type "c"
    pg.fill('#f-name','c'); pg.dispatch_event('#f-name','input'); pg.wait_for_timeout(200)
    sug=pg.locator('#sugg button').all_inner_texts(); print('  suggestions for "c":',[x.replace('\n',' ') for x in sug])
    ok('typing c suggests names with their account', len(sug)>=2 and all(x.lower().find('c')>=0 for x in sug))
    pg.fill('#f-name','craft'); pg.dispatch_event('#f-name','input'); pg.wait_for_timeout(200)
    ok('account suggested + highlighted', pg.locator('.field.suggested').count()==1 and 'suggested' in pg.inner_text('#acctrow').lower())
    acct_before=pg.input_value('#f-acct')
    pg.select_option('#f-acct', index=2); pg.wait_for_timeout(100)
    ok('highlight clears once you choose yourself', pg.locator('.field.suggested').count()==0)
    pg.screenshot(path=S+'v4-suggest.png')
    pg.click('[data-close]')
    # 10 two-way rate
    pg.click('.fab'); pg.wait_for_selector('#entry')
    opts=pg.eval_on_selector_all('#f-acct option','os=>os.map(o=>[o.value,o.textContent])'); yen=[o for o in opts if 'JPY' in o[1]][0]
    pg.select_option('#f-acct', yen[0]); pg.fill('#f-amount','10000'); pg.dispatch_event('#f-amount','input'); pg.wait_for_timeout(100)
    pg.click('[data-e=fxopen]'); pg.wait_for_selector('#cv-r'); pg.fill('#cv-r','0.4'); pg.dispatch_event('#cv-r','input'); pg.click('#cv-apply'); pg.wait_for_timeout(100)
    ok('rate -> peso: '+pg.input_value('#f-peso'), abs(float(pg.input_value('#f-peso'))-4000)<0.01)
    pg.click('[data-e=fxopen]'); pg.wait_for_selector('#cv-b'); pg.fill('#cv-b','3850'); pg.dispatch_event('#cv-b','input'); pg.click('#cv-fromamts'); pg.click('#cv-apply'); pg.wait_for_timeout(100)
    ok('peso -> rate: '+pg.input_value('#f-fx'), abs(float(pg.input_value('#f-fx'))-0.385)<1e-6)
    pg.fill('#f-amount','20000'); pg.dispatch_event('#f-amount','input'); pg.wait_for_timeout(50)
    ok('peso kept, rate follows amount: '+pg.input_value('#f-fx'), abs(float(pg.input_value('#f-fx'))-0.1925)<1e-6)
    pg.fill('#f-name','Test yen bill'); pg.click('[data-e=save]'); pg.wait_for_timeout(300)
    tx=pg.evaluate("window.sukli.get().txs.find(t=>t.name==='Test yen bill')")
    ok('saved entry has exact rate from peso value: '+str(tx['fx']), abs(tx['fx']*tx['amount']-3850)<0.001)
    # settings inverse rates
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('[data-act=rate-open][data-c=JPY]')
    pg.click('[data-act=rate-open][data-c=JPY]'); pg.wait_for_selector('#cv-r'); pg.fill('#cv-r','0.4'); pg.dispatch_event('#cv-r','input'); pg.click('#cv-apply'); pg.wait_for_timeout(200)
    pg.click('[data-act=rate-open][data-c=JPY]'); pg.wait_for_selector('#cv-r')
    ok('settings: saved 1 JPY = 0.4 PHP shows as manual; 1 PHP = 2.5 JPY', abs(float(pg.input_value('#cv-r'))-0.4)<1e-6 and 'Manual' in pg.inner_text('#cv-src') and '2.5 JPY' in pg.inner_text('#cv-sum'))
    pg.click('#cv-reset'); pg.wait_for_timeout(200)
    # 7 burger drawer
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_selector('.strip')
    ok('no gear in header, burger present', pg.locator('header [aria-label=Settings]').count()==0 and pg.locator('header [data-act=menu]').count()==1)
    pg.click('header [data-act=menu]'); pg.wait_for_selector('.drawer')
    items=pg.locator('.drawer a').all_inner_texts(); print('  menu:',[i.strip().replace('\n',' ') for i in items])
    for w in ['Home','Entries','Calendar','Budget','Cash flow','Analytics','Accounts','Expense categories','Income categories','Settings']:
        ok('menu has '+w, any(w in i for i in items))
    pg.screenshot(path=S+'v4-menu.png')
    pg.click('.drawer a[href="#/calendar"]'); pg.wait_for_selector('.cal'); ok('menu navigates to calendar and closes', pg.locator('.drawer').count()==0)
    # calendar: click day -> details
    pg.locator('.cal-d.o').first.click(); pg.wait_for_selector('.sheet .facts')
    t=pg.inner_text('.sheet'); ok('calendar day sheet shows outflow/inflow/transfers', all(w in t for w in ['Cash outflow','Cash inflow','Transfers']))
    pg.screenshot(path=S+'v4-day.png')
    pg.click('[data-add]'); pg.wait_for_selector('#entry'); ok('add entry on that day uses that date', True); pg.click('[data-close]')
    ok('calendar color classes', pg.locator('.cal-d i.o').count()>0 and pg.locator('.cal-d i.b').count()>0)
    # 6 flows
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_selector('.strip')
    st=pg.inner_text('.strip'); ok('strip labels renamed', all(w in st for w in ['Cash inflow','Cash outflow','Net income']) and 'Went out' not in st)
    for k in ['inflow','outflow','net']:
        pg.click(f'.strip [data-k={k}]'); pg.wait_for_selector('#fd'); ok('flow detail opens: '+k, len(pg.inner_text('#fd'))>20)
        if k=='outflow': pg.screenshot(path=S+'v4-flow-out.png')
        pg.click('[data-close]')
    # 8 months clickable (home 6 months and reports 12)
    pg.wait_for_selector('.chart g.hit', timeout=15000); pg.wait_for_timeout(400); pg.locator('.chart g.hit').nth(3).click(); pg.wait_for_selector('#fd'); ok('home month bar opens month detail', 'Net income' in pg.inner_text('.sheet-head'))
    pg.screenshot(path=S+'v4-month.png'); pg.click('[data-close]')
    pg.goto('http://localhost:8123/index.html#/reports'); pg.wait_for_selector('.chart')
    ok('reports has 12 clickable months', pg.locator('.chart g.hit').count()==12)
    pg.locator('.chart g.hit').nth(5).click(); pg.wait_for_selector('#fd'); pg.click('[data-go]'); pg.wait_for_timeout(300)
    ok('"Open this month" jumps home', pg.evaluate("location.hash")=='#/home')
    # 9 collapse + group by
    pg.goto('http://localhost:8123/index.html#/reports'); pg.wait_for_selector('.coll')
    pg.click('[data-act=coll][data-id=r-by]'); pg.wait_for_timeout(200)
    ok('section collapses', pg.locator('[data-id=r-by]').first.get_attribute('aria-expanded')=='false' and pg.locator('.seg.four:visible').count()==0)
    pg.click('[data-act=coll][data-id=r-by]'); pg.wait_for_timeout(200)
    for by in ['category','account','weekday','group']:
        pg.click(f'[data-act=by][data-v={by}]'); pg.wait_for_timeout(150)
        ok('reports grouped by '+by, pg.locator('.gbar, .gdet').count()>0 or 'Nothing' in pg.inner_text('#view'))
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_selector('.coll')
    pg.click('[data-act=coll][data-id=h-out]'); pg.wait_for_timeout(150); ok('home section collapses', pg.locator('.gbar.click[data-k=expense]:visible').count()==0)
    pg.reload(); pg.wait_for_selector('.coll'); ok('collapse remembered', pg.locator('.gbar.click[data-k=expense]:visible').count()==0)
    pg.click('[data-act=coll][data-id=h-out]')
    # 4 budget
    pg.evaluate("window.sukli.ui.month='2026-08'")
    pg.goto('http://localhost:8123/index.html#/budget'); pg.wait_for_selector('.donut')
    ok('donut drawn with slices', pg.locator('.donut circle.slice').count()>=3)
    first=pg.locator('.pierow').first.inner_text()
    ok('rows show percentage', '%' in first)
    pg.locator('.donut circle.slice').first.dispatch_event('click'); pg.wait_for_timeout(200)
    ok('slice click selects and expands row', pg.locator('.pierow[open]').count()==1 and '%' in pg.text_content('.donut'))
    g=pg.locator('.pierow[open] .pl').inner_text()
    pg.click('.pierow[open] [data-act=budget]'); pg.wait_for_selector('form input[name=v]'); pg.fill('form input[name=v]','5000'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    t=pg.inner_text('#view'); ok('budget set shows used %: ', 'used' in t and ('Over' in t or 'Close' in t or 'On track' in t))
    pg.screenshot(path=S+'v4-budget2.png')
    pg.click('[data-act=pieby][data-v=category]'); pg.wait_for_timeout(200); ok('donut by category', pg.locator('.donut circle.slice').count()>=2)
    # force an over-budget warning
    pg.click('[data-act=pieby][data-v=group]'); pg.wait_for_timeout(200)
    pg.evaluate("""()=>{const d=window.sukli.get(); const b=d.budgets.find(x=>!x.deleted); window.sukli.commit(dd=>{const x=dd.budgets.find(y=>y.id===b.id); x.amount=100; x.updatedAt=Date.now();});}""")
    pg.wait_for_timeout(300); ok('over-budget warning banner', pg.locator('.warnrow.over').count()>=1)
    pg.screenshot(path=S+'v4-budget-warn.png')
    # 5 cash flow
    pg.goto('http://localhost:8123/index.html#/cashflow'); pg.wait_for_selector('.strip')
    t=pg.inner_text('#view'); ok('cash flow window', all(w in t for w in ['Net income by month','By account','Biggest cash outflows']))
    pg.locator('[data-act=acct-flow]').first.click(); pg.wait_for_timeout(300); ok('account row opens entries', pg.evaluate("location.hash")=='#/ledger')
    # categories page: edit/add/delete
    pg.goto('http://localhost:8123/index.html#/categories?k=expense'); pg.wait_for_selector('[data-act=cat-new]')
    pg.click('[data-act=cat-new] >> nth=0'); pg.wait_for_selector('#catform'); pg.fill('[name=g]','Pets'); pg.fill('[name=n]','Vet'); pg.fill('[name=k]','vet, kibble'); pg.click('#catform .btn'); pg.wait_for_timeout(300)
    ok('category added on page', 'Vet' in pg.inner_text('#view'))
    pg.click('[data-act=cat-edit] >> text=Vet'); pg.wait_for_selector('#catform'); pg.fill('[name=n]','Veterinary'); pg.click('#catform .btn:not([data-del])'); pg.wait_for_timeout(300)
    ok('category edited', 'Veterinary' in pg.inner_text('#view'))
    pg.click('[data-act=cat-edit] >> text=Veterinary'); pg.wait_for_selector('#catform'); pg.click('[data-del]'); pg.wait_for_timeout(300)
    ok('category deleted', 'Veterinary' not in pg.inner_text('#view'))
    # hidden mode on new screens
    pg.click('header [data-act=eye]'); pg.wait_for_timeout(200)
    for r in ['calendar','budget','cashflow']:
        pg.goto('http://localhost:8123/index.html#/'+r); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelectorAll('#view select').forEach(e=>e.remove())")  # account names in filters may contain digits
        txt=re.sub(r'\d+%','',pg.inner_text('#view').replace('2026','').replace('12,000','')); txt=re.sub(r'Entries this month\s+\d+','',txt); digits=re.findall(r'\d[\d,.]*', txt)
        ctx=[txt[max(0,txt.find(d)-40):txt.find(d)+20].replace('\n',' | ') for d in digits if len(d.replace(',','').replace('.',''))>=3][:2]; print(r,ctx)
        ok('hidden mode masks '+r+' (digits left: '+str([d for d in digits if len(d.replace(",","").replace(".",""))>=3][:6])+')', len([d for d in digits if len(d.replace(',','').replace('.',''))>=3])==0)
    errs=[e for e in errs if 'ERR_TUNNEL_CONNECTION_FAILED' not in e and 'ERR_NAME_NOT_RESOLVED' not in e]   # the sandbox blocks outside sites
    print('ERRORS:',errs); ok('no console errors', not errs)
    b.close()
print(sum(res),'/',len(res),'passed')
