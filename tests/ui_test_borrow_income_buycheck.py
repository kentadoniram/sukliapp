# v15.24: borrowed vs paid vs interest, typed vs learned income, buying check (never a buy/sell verdict). Dates are fixed, not today.
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    R=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),b=await import('/js/borrowing.js');
      const a=c.get().accounts[0];
      c.commit(d=>{d.categories.push({id:'cFL',name:'Interest',group:'Financial loss',kind:'expense'});
        const T=(o)=>d.txs.push(Object.assign({id:'z'+Math.random(),cur:a.cur,acct:a.id,toAcct:a.id},o));
        for(const m of ['2031-03','2031-04']){T({kind:'transfer',debtBorrow:true,amount:1000,date:m+'-05'});T({kind:'transfer',debtPay:true,amount:1500,date:m+'-10'});}
        T({kind:'expense',cat:'cFL',amount:200,fx:1,date:'2031-04-12',notes:'Charged on Card'});
        T({kind:'expense',cat:'cFL',amount:999,fx:1,date:'2031-04-12',notes:'Other'});
        d.settings.incomeTyped=50000;});
      const r=b.borrowReport(c.get(),3,'2031-04');
      const f=(inc)=>b.incomeCheck(c.get(),inc&&{income:inc,months:3});
      const bc=b.buyCheck(c.get(),20000,[{name:'Card',rate:30,owed:5000}]);
      return {rows:r.rows,rep:r.repeated,i1:f(52000).state,i2:f(20000).state,i3:f(null).state,keys:bc.items.map(i=>i.key),debtText:bc.items.find(i=>i.key==='debt').text,all:JSON.stringify(bc)}})()""")
    rows={x['ym']:x for x in R['rows']}
    ok('Apr borrowed 1000, paid 1500, interest 200 only for "Charged on" %s'%rows['2031-04'], rows['2031-04']['borrowed']==1000 and rows['2031-04']['paid']==1500 and rows['2031-04']['interest']==200)
    ok('Feb has nothing', rows['2031-02']['borrowed']==0 and not rows['2031-02']['flag'])
    ok('two flagged months in a row -> repeated', R['rep'] is True and rows['2031-03']['flag'])
    ok('income states match/differs/typed', R['i1']=='match' and R['i2']=='differs' and R['i3']=='typed')
    ok('buying check has four lines and names the costly debt', R['keys']==['emergency','debt','size','swings'] and 'Card' in R['debtText'])
    ok('no buy/sell verdict words', not any(w in R['all'].lower() for w in ['you should buy','you should sell','do not buy','good time']))
    pg.goto('http://localhost:8123/#/debts'); pg.wait_for_selector('.debtpage',timeout=5000); pg.wait_for_timeout(500)
    ok('Debts page shows Your Income card with Change/Remove', pg.locator('[data-income]').count()==1 and pg.locator('[data-act=income-set]').count()==1 and pg.locator('[data-act=income-clear]').count()==1)
    pg.click('[data-act=income-set]'); pg.wait_for_selector('.sheet input[name=v]'); pg.fill('.sheet input[name=v]','65000'); pg.click('.sheet #in-ok'); pg.wait_for_timeout(1700)
    ok('typed income saved', pg.evaluate("(async()=>(await import('/js/core.js')).get().settings.incomeTyped)()")==65000)
    pg.evaluate("(async()=>{(await import('/js/ui.js')).ACT['buy-check']()})()"); pg.wait_for_selector('.sheet input[name=v]'); pg.fill('.sheet input[name=v]','10000'); pg.click('.sheet #bc-ok'); pg.wait_for_selector('[data-bc=swings]',timeout=4000)
    ok('buying check sheet shows four lines', pg.locator('[data-bc]').count()==4)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
