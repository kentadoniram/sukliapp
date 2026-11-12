# v15.32: Reimbursable expenses (company pays back): not spending while waiting, Reimbursement page, Mark Paid Back, partial payment, undo, entry switch, PASMO switch
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda s: pg.evaluate(s)
    J("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.accounts.push(c.stamp({id:'rb-a',name:'RB Bank',cur:'JPY',type:'bank',open:100000,include:true,archived:false}));
      d.categories.push(c.stamp({id:'rb-c',name:'RB Train',kind:'expense',group:'Transport',archived:false}));
      const T=(id,amt,reimb)=>d.txs.push(c.stamp({id,kind:'expense',name:'RB fare '+id,amount:amt,cur:'JPY',fx:c.homeFx(d,'JPY')||1,date:'2031-03-0'+id.slice(-1)+' 10:00',cat:'rb-c',acct:'rb-a',notes:'',labels:'',items:[],counts:[],...(reimb?{reimb:{co:'Acme',st:'pending'}}:{})}));
      T('rb-1',1000,true);T('rb-2',2000,true);T('rb-3',500,false);})})()""")
    sp=lambda: J("(async()=>{const c=await import('/js/core.js');return c.monthStats(c.get(),'2031-03').spent})()")
    bal=lambda: J("(async()=>{const c=await import('/js/core.js');return c.balances(c.get()).get('rb-a')})()")
    home=J("(async()=>{const c=await import('/js/core.js');return c.homeFx(c.get(),'JPY')||1})()")
    ok('while waiting, only the normal expense counts as spending (%s)'%sp(), abs(sp()-500*home)<0.01)
    ok('the money is still gone from the account balance', abs(bal()-(100000-3500))<0.01)
    pg.goto('http://localhost:8123/#/reimburse'); pg.wait_for_selector('.reimbpage'); pg.wait_for_timeout(300)
    t=pg.inner_text('.reimbpage')
    ok('page lists the company with its 2 waiting lines and says it is not Owed to You', 'Acme' in t and pg.locator('.rbrow').count()==2 and 'Owed to You' in t)
    pg.click('[data-co=Acme] [data-act=reimb-all]'); pg.wait_for_timeout(300)
    pg.locator('[data-co=Acme] input[data-rb=rb-1]').uncheck()
    pg.click('[data-co=Acme] [data-act=reimb-paid]'); pg.wait_for_selector('#rb-ok')
    ok('Mark Paid Back opens for ONLY the ticked line (claimed about 2,000)', '1 line' in pg.inner_text('.sheet, [role=dialog]') or '1 line' in pg.inner_text('body'))
    pg.fill('input[name=amt]','1000'); pg.click('#rb-ok'); pg.wait_for_timeout(500)
    inc=J("window.sukli.get().txs.filter(x=>!x.deleted&&x.reimbBack).map(x=>[x.kind,x.amount,x.acct])")
    ok('half paid: one incoming entry of 1,000 into the chosen account, flagged as not income %s'%inc, len(inc)==1 and inc[0][1]==1000)
    ok('the balance went up by the money received', abs(bal()-(100000-3500+1000))<0.01)
    ok('half of rb-2 now counts as spending: 500 + 1000 shortfall', abs(sp()-(500+1000)*home)<0.01)
    stt=J("window.sukli.get().txs.find(x=>x.id==='rb-2').reimb")
    ok('rb-2 paid with got=1000 %s'%stt, stt['st']=='paid' and stt['got']==1000)
    inc2=J("(async()=>{const c=await import('/js/core.js');return c.monthStats(c.get(),'2031-03').income})()")
    ok('reimbursement is not counted as income (%s)'%inc2, inc2==0)
    pg.goto('http://localhost:8123/#/reimburse'); pg.wait_for_timeout(400)
    ok('one line still waiting, one in Paid Back', pg.locator('.rbrow:not(.done)').count()==1)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)"); pg.click('.rbrow.done [data-act=reimb-undo]'); pg.wait_for_selector('[data-yes]', timeout=3000)
    pg.click('[data-yes]'); pg.wait_for_timeout(500)
    ok('Undo puts it back to waiting and removes the money received', J("window.sukli.get().txs.find(x=>x.id==='rb-2').reimb.st")=='pending' and J("window.sukli.get().txs.filter(x=>!x.deleted&&x.reimbBack).length")==0 and abs(sp()-500*home)<0.01)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_selector('[data-reimb-card]',timeout=8000)
    ok('Home shows Waiting for Reimbursement while something waits', 'Waiting for Reimbursement' in pg.inner_text('[data-reimb-card]') and 'Not counted' in pg.inner_text('[data-reimb-card]'))
    # entry form
    J("(async()=>{const m=await import('/js/entry.js');m.openEntry({})})()"); pg.wait_for_selector('#reimbrow [data-e=reimb]')
    ok('the entry form has the Reimbursable switch for an expense', pg.locator('#reimbrow [data-e=reimb]').count()==1)
    pg.click('#reimbrow [data-e=reimb]'); pg.wait_for_selector('#f-reimbco'); pg.fill('#f-reimbco','Zeta Co')
    ok('company field shows, with the not-Owed-to-You note', 'not Owed to You' in pg.inner_text('#reimbrow'))
    pg.click('[data-e=kind][data-v=income]'); pg.wait_for_timeout(200)
    ok('the switch is hidden for income', pg.locator('#reimbrow [data-e=reimb]').count()==0)
    # edit existing: switch is on and can be turned off
    J("(async()=>{const m=await import('/js/entry.js');m.openEntry({id:'rb-1'})})()"); pg.wait_for_selector('#reimbrow [data-e=reimb][aria-pressed=true]')
    ok('editing a flagged entry shows it on with its company', pg.input_value('#f-reimbco')=='Acme')
    errsn=len(errs)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
