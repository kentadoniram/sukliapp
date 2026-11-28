# v16.49: Accounts "Earned so far" (banks/e-wallets only, clickable) and Investment Earn vs normal-account earnings are independent
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
    pg.evaluate("document.querySelector('#setup')&&0")
    pg.wait_for_function("document.querySelector('#app, main')", timeout=20000)
    y=pg.evaluate("new Date().getFullYear()")
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{const h=d.settings.homeCurrency||'PHP';
      d.accounts.push(c.stamp({id:'z-bank',name:'Zq Bank',cur:h,type:'bank',open:0,include:true,archived:false}));
      d.accounts.push(c.stamp({id:'z-inv',name:'Zq Inv',cur:'USDT',type:'crypto',exchange:'Binance',open:0,include:true,archived:false}));
    })}""")
    def E(): return pg.evaluate("""async()=>{const c=await import('/js/core.js'),m=await import('/js/earnedsofar.js'),a=await import('/js/accpage.js');const e=m.earnedSoFar(c.get(),a.inInvestAcct);return {t:e.total,k:Object.fromEntries(Object.entries(e.by).map(([k,v])=>[k,v.length]))}}""")
    def invEarned(): return pg.evaluate("""async()=>{const c=await import('/js/core.js'),t=await import('/js/tokenperf.js');const f=t.earnedPred(c.get());return c.get().txs.filter(f).length}""")
    e0=E(); i0=invEarned()
    pg.evaluate("""async(y)=>{const c=await import('/js/core.js');c.commit(d=>{const h=d.settings.homeCurrency||'PHP';
      const mk=(id,x)=>d.txs.push(c.stamp(Object.assign({id,kind:'income',amount:10,cur:h,fx:1,acct:'z-bank',date:y+'-03-01 12:00:00',name:'z',cat:'',fee:0,notes:'',labels:'',items:[]},x)));
      mk('z-int',{auto:true}); mk('z-gift',{overpaid:true}); mk('z-cb',{cashbackOf:'x'});
      d.txs.push(c.stamp({id:'z-disc',kind:'expense',amount:90,cur:h,fx:1,acct:'z-bank',date:y+'-03-02 12:00:00',name:'z',cat:'',fee:0,notes:'',labels:'',items:[],adj:{base:100,disc:{mode:'pct',v:'10'},tax:{mode:'pct',v:'0'},discAmt:10,taxAmt:0,total:90}}));
      d.txs.push(c.stamp({id:'z-iint',kind:'income',amount:5,cur:'USDT',fx:1,acct:'z-inv',date:y+'-03-01 12:00:00',name:'z',auto:true,cat:'',fee:0,notes:'',labels:'',items:[]}));
    })}""",y)
    e1=E(); i1=invEarned()
    ok('bank interest, gift, cashback, discount each counted once', all(e1['k'][k]-e0['k'][k]==1 for k in ('interest','gift','cashback','discount')))
    ok('investment-account interest is not in Earned so far', e1['k']['interest']-e0['k']['interest']==1 and e1['t']-e0['t']>=39.9)
    ok('only the investment entry changed Investments Earned', i1-i0==1)
    pg.evaluate("location.hash='#/accounts'"); pg.wait_for_selector('.nwearn',timeout=5000)
    ok('row sits under Spendable now', pg.evaluate("()=>{const s=document.querySelector('.nwsp:not(.nwearn)').getBoundingClientRect(),e=document.querySelector('.nwearn').getBoundingClientRect();return e.top>=s.bottom-1&&Math.abs(e.left-s.left)<2}"))
    pg.click('.nwearn'); pg.wait_for_selector('.sheet, .popcard',timeout=4000)
    txt=pg.inner_text('body')
    ok('window lists the four kinds', all(k in txt for k in ('Bank interest','Paid back extra','Cashback','Discounts')))
    ok('no horizontal overflow', pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
    pg.screenshot(path='/tmp/claude-0/earned49.png')
    ok('no page errors', not errs)
    b.close()
print(sum(res),'/',len(res)); raise SystemExit(0 if all(res) else 1)
