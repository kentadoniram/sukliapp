import json, re, base64
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/e0191d68-b6bd-5145-8d10-9c3cd7e19bda/scratchpad/'
CSV='/mnt/user-data/uploads/Transactions.csv'
errs=[]; DRIVE={}   # id -> {name, body}; shared by both "phones"
GIS="window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'fake',expires_in:3600}),20)})}}};"
def drive_route(route):
    r=route.request; u=r.url; m=r.method
    if 'accounts.google.com/gsi/client' in u: return route.fulfill(status=200,content_type='text/javascript',body=GIS)
    if 'googleapis.com' not in u: return route.continue_()
    if m=='GET' and '/drive/v3/files?' in u:
        q=re.search(r'q=([^&]+)',u).group(1); from urllib.parse import unquote; q=unquote(q)
        if "name='sukli-data.json'" in q: fs=[{'id':i,'name':f['name']} for i,f in DRIVE.items() if f['name']=='sukli-data.json']
        else: fs=[{'id':i,'name':f['name']} for i,f in DRIVE.items() if f['name'].startswith('sukli-backup-')]
        return route.fulfill(status=200,content_type='application/json',body=json.dumps({'files':fs}))
    mm=re.search(r'/drive/v3/files/([^?]+)\?alt=media',u)
    if m=='GET' and mm: return route.fulfill(status=200,content_type='application/json',body=DRIVE[mm.group(1)]['body'])
    if m=='POST' and 'uploadType=multipart' in u:
        raw=r.post_data; meta=json.loads(raw.split('\r\n\r\n')[1].split('\r\n--')[0]); body=raw.split('\r\n\r\n')[2].rsplit('\r\n--',1)[0]
        i='f%d'%(len(DRIVE)+1); DRIVE[i]={'name':meta['name'],'body':body,'parents':meta['parents']}
        return route.fulfill(status=200,content_type='application/json',body=json.dumps({'id':i}))
    mm=re.search(r'/upload/drive/v3/files/([^?]+)\?uploadType=media',u)
    if m=='PATCH' and mm: DRIVE[mm.group(1)]['body']=r.post_data; return route.fulfill(status=200,content_type='application/json',body=json.dumps({'id':mm.group(1)}))
    mm=re.search(r'/drive/v3/files/([^?]+)$',u)
    if m=='DELETE' and mm: DRIVE.pop(mm.group(1),None); return route.fulfill(status=204,body='')
    route.fulfill(status=404,body='unmocked '+m+' '+u)
def newpg(b):
    ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',timezone_id='Asia/Tokyo',service_workers='block',accept_downloads=True)
    ctx.add_init_script("localStorage.setItem('sukli.legacy','1')"); pg=ctx.new_page(); pg.route('**/*',drive_route)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    return ctx,pg
with sync_playwright() as p:
    b=p.chromium.launch()
    ctxA,A=newpg(b); A.goto('http://localhost:8123/index.html'); A.wait_for_selector('#first-file',state='attached')
    A.set_input_files('#first-file',CSV); A.wait_for_selector('#setup'); A.click('#setup .btn'); A.wait_for_timeout(300)
    # --- bulk add
    A.click('.fab'); A.wait_for_selector('#entry'); A.click('.sheet-head .iconbtn'); 
    A.evaluate("()=>import('./js/entry.js').then(m=>m.openBulk())"); A.wait_for_selector('#bulk')
    A.fill('#b-text','bus 30\nPandesal 45\n+ refund 1200\ngarbage line\nmcdo ₱358.5'); A.click('#bulk .btn'); A.wait_for_timeout(400)
    print('BULK:',A.evaluate("()=>window.sukli.get().txs.filter(t=>t.date.startsWith(new Date().toISOString().slice(0,4))&&!t.src).map(t=>[t.name,t.amount,t.kind,t.flag])"))
    # --- edit + delete + undo
    A.goto('http://localhost:8123/index.html#/ledger'); A.wait_for_timeout(400)
    A.click('#ledger-list .row >> nth=0'); A.wait_for_selector('#entry'); 
    print('edit sheet name:',A.input_value('#f-name'))
    A.click('[data-e="del"]'); A.wait_for_timeout(200)
    print('URL before:',A.url, A.evaluate('history.length'))
    A.wait_for_timeout(300); print('URL after:',A.url)
    n1=A.evaluate("()=>window.sukli.get().txs.filter(t=>!t.deleted).length"); A.click('.toast .linkbtn'); A.wait_for_timeout(200)
    n2=A.evaluate("()=>window.sukli.get().txs.filter(t=>!t.deleted).length"); print('delete/undo counts:',n1,n2)
    # --- cross-currency transfer PHP -> JPY
    A.evaluate("()=>window.sukli.openEntry({})"); A.wait_for_selector('#entry'); A.click('[data-e="kind"][data-v="transfer"]')
    A.select_option('#f-acct',label='Wallet · PHP'); A.select_option('#f-to',label='Japanese Currency · JPY'); A.wait_for_timeout(100)
    A.fill('#f-amount','1000'); A.check('#f-conv'); A.fill('#f-toamt','2580'); A.click('[data-e="save"]'); A.wait_for_timeout(300)
    bal=A.evaluate("""()=>import('./js/core.js').then(c=>{const d=c.get(),b=c.balances(d);const g=n=>d.accounts.find(a=>a.name===n);return {wallet:b.get(g('Wallet').id),yen:b.get(g('Japanese Currency').id)}})""")
    print('after transfer (Wallet was 0, Yen was 46217.05-1234.5-850+...):',bal)
    # --- reconcile
    A.goto('http://localhost:8123/index.html#/accounts'); A.wait_for_timeout(300)
    A.click('.row.acct:has-text("Maribank")'); A.wait_for_selector('[data-ad=edit]'); A.click('[data-ad=edit]'); A.wait_for_selector('#recon'); A.fill('#recon input[name=real]','12000'); A.click('#recon .btn'); A.wait_for_timeout(300)
    while A.locator('.scrim').count(): A.locator('.scrim [data-close]').last.click(); A.wait_for_timeout(100)
    print('Maribank after correction:',A.evaluate("""()=>import('./js/core.js').then(c=>{const d=c.get();return c.balances(d).get(d.accounts.find(a=>a.name==='Maribank').id)})"""))
    # --- budget
    A.goto('http://localhost:8123/index.html#/reports'); A.wait_for_timeout(300)
    A.click('.gdet summary >> nth=0'); A.click('[data-act="budget"] >> nth=0'); A.fill('.sheet input[name=v]','5000'); A.click('.sheet .btn:not(.ghost)'); A.wait_for_timeout(300)
    print('budgets:',A.evaluate("()=>window.sukli.get().budgets.map(b=>[b.group,b.amount])"))
    A.screenshot(path=S+'t-reports-budget.png')
    # --- export csv
    A.goto('http://localhost:8123/index.html#/settings'); A.wait_for_timeout(300)
    with A.expect_download() as dl: A.click('[data-act="export-csv"]')
    path=dl.value.path(); txt=open(path,encoding='utf-8-sig').read(); print('export lines:',txt.count('\n'))
    A.screenshot(path=S+'t-settings.png',full_page=True)
    # --- Drive sync device A
    A.fill('#clientid','test-client.apps.googleusercontent.com'); A.press('#clientid','Tab')
    A.click('[data-act="sync"]'); A.wait_for_timeout(1200)
    print('A sync status:',A.inner_text('#syncstatus'),'| drive files:',[f['name'] for f in DRIVE.values()])
    # --- device B: fresh, different entry, sync merges
    ctxB,B=newpg(b); B.goto('http://localhost:8123/index.html'); B.wait_for_selector('#first-file',state='attached')
    B.evaluate("""()=>import('./js/core.js').then(c=>c.commit(d=>{c.seedCategories(d);d.accounts.push(c.stamp({id:'b-acct',name:'Wallet',cur:'PHP',type:'cash',open:0,include:true}));d.txs.push(c.stamp({id:'b-tx',kind:'expense',date:'2026-10-17 12:00:00',name:'only on B',amount:99,cur:'PHP',fx:1,cat:d.categories[0].id,acct:'b-acct',notes:'',items:[]}));d.settings.driveClientId='test-client.apps.googleusercontent.com'}))""")
    B.goto('http://localhost:8123/index.html#/settings'); B.wait_for_selector('[data-act="sync"]'); B.click('[data-act="sync"]'); B.wait_for_timeout(1500)
    print('B sync status:',B.inner_text('#syncstatus'))
    print('B has A data & its own:',B.evaluate("()=>{const d=window.sukli.get();return {tx:d.txs.length,hasB:d.txs.some(t=>t.id==='b-tx'),accts:d.accounts.length}}"))
    A.click('[data-act="sync"]'); A.wait_for_timeout(1500)
    print('A after 2nd sync has B entry:',A.evaluate("()=>window.sukli.get().txs.some(t=>t.id==='b-tx')"),'| client id leaked to drive?', any('test-client' in f['body'] for f in DRIVE.values()))
    # --- JSON restore round-trip
    with A.expect_download() as dl2: A.click('[data-act="export-json"]')
    js=json.load(open(dl2.value.path())); print('json backup txs:',len(js['txs']),'v',js['v'])
    b.close()
print('ERRORS:',[e for e in errs if 'unmocked' not in e][:8])
