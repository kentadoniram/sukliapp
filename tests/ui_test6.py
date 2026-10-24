from playwright.sync_api import sync_playwright
import json
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
BASE='http://localhost:8123/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); ctx.add_init_script("localStorage.setItem('sukli.legacy','1')"); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    seen={'authorize':None,'user':0,'post':0}
    def authorize(route):
        seen['authorize']=route.request.url
        route.fulfill(status=302, headers={'Location': BASE+'#access_token=AT123&refresh_token=RT123&expires_in=3600&token_type=bearer&provider_token=x'})
    ctx.route('https://proj.supabase.co/auth/v1/authorize**', authorize)
    ctx.route('https://proj.supabase.co/auth/v1/user', lambda r: (seen.__setitem__('user',seen['user']+1), r.fulfill(json={'id':'u1','email':'me@gmail.com'})))
    def recs(r):
        if r.request.method=='GET': r.fulfill(json=[])
        else: seen['post']+=1; r.fulfill(status=201, body='')
    ctx.route('https://proj.supabase.co/rest/v1/records**', recs)
    pg.goto(BASE); pg.wait_for_selector('#first-file',state='attached')
    pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(300)
    pg.goto(BASE+'#/settings'); pg.wait_for_selector('#c-url')
    pg.fill('#c-url','https://proj.supabase.co'); pg.dispatch_event('#c-url','change'); pg.fill('#c-key','anonkey'); pg.dispatch_event('#c-key','change')
    ok('google button shown when signed out', pg.locator('[data-act=cloud-google]').count()==1)
    pg.click('[data-act=cloud-google]'); pg.wait_for_selector('.toast.show',timeout=10000); pg.wait_for_timeout(500)
    ok('sent to Supabase authorize with provider=google', seen['authorize'] and 'provider=google' in seen['authorize'] and 'redirect_to=' in seen['authorize'])
    t=pg.inner_text('.toast'); ok('came back signed in: '+t, 'Signed in with Google as me@gmail.com' in t)
    ok('tokens removed from address bar', 'access_token' not in pg.evaluate('location.href'))
    s=pg.evaluate("JSON.parse(localStorage.getItem('sukli-auth'))"); ok('session stored', s['refresh_token']=='RT123' and s['user']['email']=='me@gmail.com')
    ok('first sync pushed data', seen['post']>=1)
    pg.goto(BASE+'#/settings'); pg.wait_for_timeout(300); ok('settings shows signed in', 'me@gmail.com' in pg.inner_text('#view'))
    # error return
    ctx2=b.new_context(service_workers='block'); ctx2.add_init_script("localStorage.setItem('sukli.legacy','1')"); pg2=ctx2.new_page()
    pg2.goto(BASE); pg2.wait_for_selector('#first-file',state='attached')
    pg2.goto(BASE+'#error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled'); pg2.reload(); pg2.wait_for_selector('.toast.show',timeout=10000)
    ok('error return explains how to fix: '+pg2.inner_text('.toast')[:80], 'not switched on' in pg2.inner_text('.toast'))
    print('ERRORS',errs); ok('no page errors', not errs); b.close()
print(sum(res),'/',len(res))
