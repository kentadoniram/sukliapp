import json, re, time, itertools
from urllib.parse import urlparse, parse_qs, unquote
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
CSV='/mnt/user-data/uploads/Transactions.csv'; S='/tmp/claude-0/-home-claude/e0191d68-b6bd-5145-8d10-9c3cd7e19bda/scratchpad/'
URL='https://mock.supabase.co'; errs=[]
M={'users':{}, 'access':{}, 'refresh':{}, 'rows':{}, 'clock':0, 'gets':0, 'confirm':False, 'table':True, 'online':True}
def tick():
    M['clock']+=1; return (datetime(2026,10,17,12,0,0)+timedelta(seconds=M['clock'])).strftime('%Y-%m-%dT%H:%M:%S.%f+00:00')
def mk_session(u):
    a='at%d'%len(M['access']); r='rt%d'%len(M['refresh']); M['access'][a]=u['id']; M['refresh'][r]=u['id']
    return {'access_token':a,'refresh_token':r,'expires_in':3600,'user':{'id':u['id'],'email':u['email']}}
def J(route,code,obj): route.fulfill(status=code,content_type='application/json',body=json.dumps(obj))
def handler(route):
    r=route.request; u=urlparse(r.url)
    if u.netloc!='mock.supabase.co': return route.continue_()
    if not M['online']: return route.abort()
    h=r.headers; path=u.path; q=parse_qs(u.query)
    if 'apikey' not in h: return J(route,401,{'message':'No API key found in request'})
    if h['apikey']!='anon-key': return J(route,401,{'message':'Invalid API key'})
    body=json.loads(r.post_data) if r.post_data else None
    if path=='/auth/v1/signup':
        e=body['email']
        if e in M['users']: return J(route,400,{'error_code':'user_already_exists','msg':'User already registered'})
        M['users'][e]={'id':'u-'+str(len(M['users'])+1),'email':e,'pw':body['password']}
        if M['confirm']: return J(route,200,{'id':M['users'][e]['id'],'email':e})
        return J(route,200,mk_session(M['users'][e]))
    if path=='/auth/v1/token':
        g=q['grant_type'][0]
        if g=='password':
            us=M['users'].get(body['email'])
            if not us or us['pw']!=body['password']: return J(route,400,{'error_code':'invalid_credentials','msg':'Invalid login credentials'})
            return J(route,200,mk_session(us))
        if g=='refresh_token':
            uid=M['refresh'].get(body['refresh_token'])
            if not uid: return J(route,400,{'error':'invalid_grant','error_description':'Invalid Refresh Token'})
            us=[x for x in M['users'].values() if x['id']==uid][0]; return J(route,200,mk_session(us))
    if path=='/rest/v1/records':
        if not M['table']: return J(route,404,{'code':'PGRST205','message':"Could not find the table 'public.records' in the schema cache"})
        tok=h.get('authorization','').replace('Bearer ','')
        uid=M['access'].get(tok)
        if not uid: return J(route,401,{'message':'JWT expired','code':'PGRST303'})
        if r.method=='GET':
            M['gets']+=1
            rows=[v for (u2,c,i),v in M['rows'].items() if u2==uid]
            if 'synced_at' in q: rows=[x for x in rows if x['synced_at']>unquote(q['synced_at'][0])[3:]]
            rows.sort(key=lambda x:(x['synced_at'],x['id'])); off=int(q.get('offset',['0'])[0]); lim=int(q.get('limit',['1000'])[0])
            return J(route,200,[{k:x[k] for k in ('coll','id','data','updated_at','synced_at')} for x in rows[off:off+lim]])
        if r.method=='POST':
            assert 'merge-duplicates' in h.get('prefer',''), 'missing Prefer'
            for x in body:
                assert 'user_id' not in x
                k=(uid,x['coll'],x['id']); old=M['rows'].get(k)
                if old and x['updated_at']<old['updated_at']: continue
                M['rows'][k]={**x,'synced_at':tick()}
            return route.fulfill(status=201,body='')
    route.fulfill(status=404,body='unmocked '+r.method+' '+r.url)
def newdev(b):
    ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',timezone_id='Asia/Tokyo',service_workers='block')
    ctx.add_init_script("localStorage.setItem('sukli.legacy','1')"); pg=ctx.new_page(); pg.route('**/*',handler)
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    return pg
def cfg(pg,email,pw,action):
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('#c-url')
    pg.fill('#c-url',URL); pg.fill('#c-key','anon-key')
    if pg.locator('#c-email').count():
        pg.fill('#c-email',email); pg.fill('#c-pass',pw); pg.click('[data-act="%s"]'%action)
    pg.wait_for_timeout(1500)
def stat(pg): return pg.inner_text('#cloudstatus')
def bal(pg,name):
    return pg.evaluate("(n)=>import('./js/core.js').then(c=>{const d=c.get();const a=d.accounts.find(a=>a.name===n);return Math.round(c.balances(d).get(a.id)*100)/100})",name)
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newdev(b); A.goto('http://localhost:8123/index.html'); A.wait_for_selector('#first-file',state='attached')
    A.set_input_files('#first-file',CSV); A.wait_for_selector('#setup'); A.click('#setup .btn'); A.wait_for_timeout(300)
    # confirm-email path
    M['confirm']=True; cfg(A,'me@example.com','secret1','cloud-signup'); print('1 confirm msg:',A.locator('.toast').inner_text()[:90])
    M['confirm']=False
    A.goto('http://localhost:8123/index.html#/settings'); A.wait_for_selector('#c-pass'); A.fill('#c-pass','wrong'); A.click('[data-act="cloud-signin"]'); A.wait_for_timeout(600); print('2 wrong pw:',A.locator('.toast').inner_text())
    A.fill('#c-pass','secret1'); A.click('[data-act="cloud-signin"]'); A.wait_for_timeout(2500)
    print('3 A after sign in:',stat(A) if A.locator('#cloudstatus').count() else 'n/a', '| server rows:',len(M['rows']))
    kinds={}; 
    for (u,c,i) in M['rows']: kinds[c]=kinds.get(c,0)+1
    print('   by collection:',kinds,'| signed in label:',A.inner_text('#view p:has(b)')[:40])
    B=newdev(b); B.goto('http://localhost:8123/index.html'); B.wait_for_selector('#first-file',state='attached')
    B.goto('http://localhost:8123/index.html#/settings'); B.wait_for_selector('#c-url')
    # B has no data: first-run hides tabs but settings is reachable
    g0=M['gets']; cfg(B,'me@example.com','secret1','cloud-signin'); print('4 B status:',stat(B),'| GET pages:',M['gets']-g0)
    B.goto('http://localhost:8123/index.html#/home'); B.wait_for_timeout(500)
    print('   B counts:',B.evaluate("()=>{const d=window.sukli.get();return [d.txs.length,d.accounts.length,d.categories.length]}"),'A counts:',A.evaluate("()=>{const d=window.sukli.get();return [d.txs.length,d.accounts.length,d.categories.length]}"))
    print('   balances equal Maribank:',bal(A,'Maribank'),bal(B,'Maribank'),'| Yen:',bal(A,'Japanese Currency'),bal(B,'Japanese Currency'))
    # edit + delete on A, sync, B sees it
    A.evaluate("""()=>import('./js/core.js').then(c=>c.commit(d=>{const t=d.txs.find(t=>t.name==='Mcdo'&&!t.deleted);t.amount=111.11;c.stamp(t);const u=d.txs.find(t=>t.name==='Pandesal'&&!t.deleted);u.deleted=true;c.stamp(u);}))""")
    A.wait_for_timeout(6000)  # auto-sync debounce (4s)
    print('5 auto-sync server has edit:',any(v['data'].get('amount')==111.11 for v in M['rows'].values()))
    B.goto('http://localhost:8123/index.html#/settings'); B.wait_for_selector('[data-act="cloud-sync"]'); B.click('[data-act="cloud-sync"]'); B.wait_for_timeout(1500)
    print('   B sees edit:',B.evaluate("()=>window.sukli.get().txs.some(t=>t.amount===111.11)"),'| deleted pandesal count live:',B.evaluate("()=>window.sukli.get().txs.filter(t=>t.name==='Pandesal'&&!t.deleted).length"),'vs A',A.evaluate("()=>window.sukli.get().txs.filter(t=>t.name==='Pandesal'&&!t.deleted).length"))
    print('   B status:',stat(B))
    # older write must lose
    tid=B.evaluate("""()=>import('./js/core.js').then(c=>{let id;c.commit(d=>{const t=d.txs.find(t=>t.amount===111.11);t.amount=5.55;t.updatedAt=1000;id=t.id});return id})""")
    B.wait_for_timeout(6000)
    srv=[v for k,v in M['rows'].items() if k[2]==tid][0]['data']['amount']
    print('6 stale local edit does not overwrite newer server copy:',srv==111.11,'| B restored to newer copy:',B.evaluate("(id)=>window.sukli.get().txs.find(t=>t.id===id).amount",tid)==111.11)
    # the server-side guard itself: push an older row directly
    k=[k for k in M['rows'] if k[2]==tid][0]; before=M['rows'][k]['data']['amount']
    B.evaluate("""(id)=>import('./js/core.js').then(async c=>{const s=JSON.parse(localStorage.getItem('sukli-auth'));await fetch('https://mock.supabase.co/rest/v1/records?on_conflict=user_id,coll,id',{method:'POST',headers:{apikey:'anon-key',Authorization:'Bearer '+s.access_token,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{coll:'txs',id,data:{id,amount:1},updated_at:5}])})})""",tid)
    print('   server guard keeps newer row:',M['rows'][k]['data']['amount']==before)
    # expired access token -> refresh
    M['access'].clear(); A.evaluate("()=>{const s=JSON.parse(localStorage.getItem('sukli-auth'));s.expires_at=Date.now()-1;localStorage.setItem('sukli-auth',JSON.stringify(s))}")
    A.evaluate("""()=>import('./js/core.js').then(c=>c.commit(d=>{const t=d.txs.find(t=>t.name==='Craft boss');t.notes='after refresh';c.stamp(t)}))"""); A.wait_for_timeout(6000)
    print('7 token refresh then push worked:',any(v['data'].get('notes')=='after refresh' for v in M['rows'].values()))
    # 401 mid-session (token revoked but not expired)
    M['access'].clear()
    A.evaluate("""()=>import('./js/core.js').then(c=>c.commit(d=>{const t=d.txs.find(t=>t.name==='Craft boss');t.notes='after 401';c.stamp(t)}))"""); A.wait_for_timeout(6000)
    print('8 retry after 401 worked:',any(v['data'].get('notes')=='after 401' for v in M['rows'].values()))
    # failure messages
    M['table']=False; A.goto('http://localhost:8123/index.html#/settings'); A.wait_for_selector('[data-act="cloud-sync"]'); A.click('[data-act="cloud-sync"]'); A.wait_for_timeout(800); print('9 missing table:',A.locator('.toast').inner_text()[:80])
    M['table']=True; M['online']=False; A.click('[data-act="cloud-sync"]'); A.wait_for_timeout(800); print('10 offline:',A.locator('.toast').inner_text()[:80])
    M['online']=True
    # sign out keeps local data
    n=A.evaluate("()=>window.sukli.get().txs.length"); A.click('[data-act="cloud-signout"]'); A.wait_for_timeout(500)
    print('11 after sign out: local txs kept:',A.evaluate("()=>window.sukli.get().txs.length")==n,'| sign-in form shown:',A.locator('#c-pass').count()==1)
    # focus is not stolen when moving between settings boxes
    A.fill('#c-url',URL); A.click('#c-key',click_count=3); A.keyboard.type('anon-key'); A.wait_for_timeout(400); print('12 key typed after url blur:',A.input_value('#c-key')=='anon-key')
    A.goto('http://localhost:8123/index.html#/settings'); A.wait_for_selector('#c-url'); A.screenshot(path=S+'t3-settings.png')
    b.close()
print('ERRORS:',[e for e in errs if 'Failed to load resource' not in e][:6])
