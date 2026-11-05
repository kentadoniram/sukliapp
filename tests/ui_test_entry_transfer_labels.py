from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
    names=pg.evaluate("()=>import('./js/core.js').then(c=>c.get().accounts.filter(a=>!a.deleted).map(a=>a.name+' · '+a.cur))")
    # transfer with a blank label
    pg.evaluate("()=>window.sukli.openEntry({})"); pg.wait_for_selector('#entry'); pg.click('[data-e="kind"][data-v="transfer"]')
    pg.select_option('#f-acct',label=names[0]); pg.select_option('#f-to',label=names[1]); pg.wait_for_timeout(100)
    ph=pg.get_attribute('#f-what','placeholder'); ok('placeholder shows the two accounts', names[0].split(' · ')[0] in ph and names[1].split(' · ')[0] in ph)
    pg.fill('#f-amount','100'); pg.click('[data-e="save"]'); pg.wait_for_timeout(400)
    last=pg.evaluate("()=>import('./js/core.js').then(c=>{const t=c.get().txs.filter(t=>t.kind==='transfer'&&!t.deleted).sort((a,b)=>a.updatedAt<b.updatedAt?1:-1)[0];return {n:t.name,auto:t.autoName,flag:t.flag}})")
    print(' transfer saved as',last); ok('blank transfer label becomes From - To', last['n']==names[0].split(' · ')[0]+' - '+names[1].split(' · ')[0] and not last['flag'])
    # expense with no label: category Grocery, usual amount -> label from history, goes to Review
    pg.evaluate("()=>window.sukli.openEntry({})"); pg.wait_for_selector('#entry'); pg.fill('#f-amount','350')
    pg.fill('#f-what','Grocery'); pg.wait_for_timeout(300)
    ch=pg.locator('#catrow [data-e=cat]:has-text("Grocery")')
    if ch.count(): ch.first.click(); pg.wait_for_timeout(200)
    pg.fill('#f-what',''); pg.dispatch_event('#f-what','input'); pg.click('[data-e="save"]'); pg.wait_for_timeout(400)
    e=pg.evaluate("()=>import('./js/core.js').then(c=>{const t=c.get().txs.filter(t=>t.kind==='expense'&&!t.deleted).sort((a,b)=>a.updatedAt<b.updatedAt?1:-1)[0];return {n:t.name,auto:t.autoName,flag:t.flag}})")
    print(' expense saved as',e); ok('blank expense label is guessed and put on Review', e['n'] and e['auto'] and e['flag']=='review')
    # Save stays reachable in a short viewport (keyboard open)
    pg.set_viewport_size({'width':390,'height':480})
    pg.evaluate("()=>window.sukli.openEntry({})"); pg.wait_for_selector('#entry'); pg.focus('#f-notes'); pg.wait_for_timeout(500)
    box=pg.locator('#btns [data-e=save]').bounding_box(); ok('Save button inside the visible area', box and box['y']>=0 and box['y']+box['height']<=480)
    print('ERRS',errs); ok('no script errors', not errs)
    b.close()
print(sum(res),'/',len(res))
