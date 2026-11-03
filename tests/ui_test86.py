# v13.34: shared bill shown once and edited as one; Earn platform timezones
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';
      d.accounts.push(c.stamp({id:'wal',name:'Wallet Z',type:'cash',cur:'PHP',open:10000,include:true,archived:false}));
      for(const n of ['Ann','Ben','Cy']) d.accounts.push(c.stamp({id:'p'+n,name:n,type:'owed',cur:'PHP',open:0,include:false,archived:false}));
      const g='g1',dt=c.nowStamp();
      d.txs.push(c.stamp({id:'m1',kind:'expense',date:dt,acct:'wal',cur:'PHP',amount:1000,fx:1,name:'Grocery Receipt',paidFor:{total:4000,who:'Ann, Ben, Cy',me:true},splitId:g}));
      for(const n of ['Ann','Ben','Cy']) d.txs.push(c.stamp({id:'l'+n,kind:'transfer',date:dt,acct:'wal',toAcct:'p'+n,cur:'PHP',amount:1000,toAmount:1000,fx:1,name:'Paid for '+n+': Grocery Receipt',lent:true,splitId:g}))})})()""")
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(700)
    t=pg.inner_text('#app') if pg.locator('#app').count() else pg.inner_text('body')
    ok('bill shown once with the whole 4,000', t.count('Grocery Receipt')==1 and '4,000' in t)
    ok('bar says 4 shares', 'Shared bill: 4 shares' in t)
    pg.click('.splitbar'); pg.wait_for_timeout(300)
    t=pg.inner_text('body'); ok('open shows each person', all(n in t for n in ['Ann','Ben','Cy','You']))
    pg.click('.splitkid >> nth=1'); pg.wait_for_selector('#sb'); pg.wait_for_timeout(300)
    pg.fill('#sb [data-sb=name]','Big Shop'); pg.press('#sb [data-sb=name]','Tab')
    pg.fill('#sb [data-sb=total]','8000'); pg.press('#sb [data-sb=total]','Tab'); pg.wait_for_timeout(300)
    v=pg.evaluate("[...document.querySelectorAll('#sb [data-sb=share]')].map(x=>x.value)"); ok('shares doubled %s'%v, v==['2000','2000','2000'])
    pg.fill('#sb [data-sb=share] >> nth=0','9000'); pg.press('#sb [data-sb=share] >> nth=0','Tab'); pg.click('#sb [data-sb=save]'); pg.wait_for_timeout(300)
    ok('too much is refused', 'more than the whole bill' in pg.inner_text('#sb'))
    pg.fill('#sb [data-sb=share] >> nth=0','2000'); pg.press('#sb [data-sb=share] >> nth=0','Tab'); pg.click('#sb [data-sb=save]'); pg.wait_for_timeout(500)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();return d.txs.filter(t=>t.splitId==='g1').map(t=>[t.id,t.name,t.amount])})()")
    ok('all parts renamed and add to 8000 %s'%r, all('Big Shop' in x[1] for x in r) and abs(sum(x[2] for x in r)-8000)<0.01)
    # platform timezone
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');
      c.commit(d=>{d.accounts.push(c.stamp({id:'be',name:'Binance Earn USDT',wallet:'Earn',cur:'USDT',type:'crypto',exchange:'Binance',open:0,include:false,archived:false}),c.stamp({id:'ge',name:'Bitget Earn USDT',wallet:'Earn',cur:'USDT',type:'crypto',exchange:'Bitget',open:0,include:false,archived:false}))});
      const d=c.get();const ms=Date.UTC(2026,10,3,16,30);
      const a=e.tzOf(d,d.accounts.find(x=>x.id==='be')),b=e.tzOf(d,d.accounts.find(x=>x.id==='ge'));
      c.commit(x=>{x.settings.platformTz={Binance:-5}});
      return [a,b,e.tzOf(c.get(),c.get().accounts.find(x=>x.id==='be')),e.e8Label(ms,0),e.e8Label(ms,8)]})()""")
    ok('defaults Binance 0, Bitget 8, changeable, labels differ %s'%r, r==[0,8,-5,'2026-11-03 16:30','2026-11-04 00:30'])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
