# v13.16: "Pasmo" stays as typed; case-insensitive suggestions; zero earn rows not listed
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_timeout(800)
    r=pg.evaluate("""async function(){const R=await import('/js/route.js'),P=await import('/js/predict.js');
      const tx=(n,d)=>({id:n+d,name:n,kind:'expense',cat:'c1',acct:'a1',amount:100,cur:'JPY',date:d});
      const m=P.buildModel([tx('GU','2026-01-01'),tx('Gulay','2026-01-02'),tx('Rice','2026-01-03')],'expense',[]);
      return {bare:['Pasmo','pasmo','Suica','IC card','Train','Bus','Train commute'].map(R.bareMode),
        gu:P.suggest(m,'Gu').map(x=>x.name),GU:P.suggest(m,'gU').map(x=>x.name)};}""")
    print(r)
    ok('Pasmo/Suica/IC card kept as typed', r['bare'][:4]==[False]*4)
    ok('Train/Bus still plain vehicle words', r['bare'][4:]==[True]*3)
    ok('Gu offers GU and Gulay', set(r['gu'])=={'GU','Gulay'})
    ok('gU offers both too', set(r['GU'])=={'GU','Gulay'})
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
