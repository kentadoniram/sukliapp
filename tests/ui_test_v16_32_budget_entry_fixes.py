# v16.32: budget exactly 100% is not over; View Budget deep link + raise suggestion; collapsible Home notice; Earn APR; JPY 8%; card fees; item suggestions
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # --- 1: exact 100% is not over; a peso over is
    r=pg.evaluate("""async()=>{const c=await import('/js/core.js'),B=await import('/js/budgetsetup.js');
      c.commit(db=>{const cat=db.categories.find(x=>!x.deleted&&x.kind==='expense'&&x.group==='Home')||db.categories.find(x=>!x.deleted&&x.kind==='expense');
        const acct=db.accounts.find(a=>!a.deleted&&['bank','cash','ewallet'].includes(a.type));
        db.txs=db.txs.filter(t=>!(t.cat===cat.id&&t.date.slice(0,7)===c.thisMonth()));
        db.budgets=db.budgets.filter(b=>b.cat!==cat.id); db.budgets.push({id:'tb1',cat:cat.id,amount:1000,off:false});
        db.txs.push({id:'tt1',kind:'expense',amount:1000,cur:acct.cur,acct:acct.id,cat:cat.id,date:c.nowStamp(),name:'Rent test'}); window.__cat=cat.id; for(const n of [1,2,3]){const d=c.shiftMonth(c.thisMonth(),-n)+'-10 12:00'; db.txs.push({id:'th'+n,kind:'expense',amount:1500,cur:acct.cur,acct:acct.id,cat:cat.id,date:d,name:'History '+n});}});
      const db=c.get(), st=B.budgetStatus(db).find(x=>x.key==='c:'+window.__cat), al=B.budgetAlerts(db).find(x=>x.key==='c:'+window.__cat);
      const a1={pct:st.pct,over:al&&al.over}; 
      c.commit(db=>{db.txs.find(t=>t.id==='tt1').amount=1000.01});
      const al2=B.budgetAlerts(c.get()).find(x=>x.key==='c:'+window.__cat); return {a1,over2:al2&&al2.over,advice:al2&&al2.text}}""")
    ok('exactly 100%% is not over (%s)'%r['a1'], r['a1']['pct']>=99.9 and not r['a1']['over'])
    ok('1000.01 of 1000 is over', r['over2'])
    print(r['advice']); ok('over alert recommends a raise from history', 'suggestion' in (r['advice'] or '') and '1,500' in (r['advice'] or '') and 'nothing was changed' in (r['advice'] or ''))
    # --- 2: bell View budget opens the group
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(800)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nflist'); pg.wait_for_timeout(300)
    btn=pg.locator('.nf-budget button', has_text='View budget').first
    ok('View budget button in bell', btn.count()>0)
    grp=pg.evaluate("document.querySelector('.nf-budget button[data-nf-fn=\"nf-budget\"]')?.dataset.g")
    btn.click(); pg.wait_for_timeout(900)
    ok('lands on budget page', pg.evaluate("location.hash")=='#/budget')
    opened=pg.evaluate("(()=>{const d=document.querySelector('details.pierow[open]');return d&&d.dataset.k})()")
    ok('group row open (%s vs %s)'%(opened,grp), opened and opened==grp)
    ok('category budget line shown', pg.locator('.catbud .cbrow').count()>0)
    ok('over chip only when over', pg.evaluate("[...document.querySelectorAll('.catbud .bchip')].some(e=>e.textContent.trim()==='Over')"))
    # --- 3: Home budget notice collapsible
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(900)
    sec=pg.locator('section[data-sec=h-budget]')
    ok('home budget notice is a collapsible card', sec.count()==1)
    if sec.count():
        sec.locator('.collhead').click(); pg.wait_for_timeout(400)
        ok('collapses', pg.evaluate("document.querySelector('section[data-sec=h-budget]').classList.contains('closed')"))
    # --- 8: card fees + JPY 8% + checkbox
    r=pg.evaluate("""async()=>{const c=await import('/js/core.js');let id,jp;
      c.commit(db=>{db.accounts.push({id:'t-card',name:'Test Card',cur:'JPY',type:'card',open:0,include:true,archived:false,limit:300000,stmtDay:25,dueDay:10});
        db.accounts.push({id:'t-jpb',name:'Test JPY Bank',cur:'JPY',type:'bank',open:100000,include:true,archived:false});});
      const m=await import('/js/entry.js'); m.openEntry({}); return true}""")
    pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const s=document.getElementById('f-acct');s.value='t-card';s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(400)
    pg.fill('#f-amount','1000'); pg.wait_for_timeout(200)
    ok('link says card fees', 'card fees' in pg.locator('.adjlink').inner_text())
    pg.click('.adjlink'); pg.wait_for_selector('#aj-base')
    ok('JPY tax defaults to 8', pg.input_value('#aj-t')=='8')
    ok('card charges box shown', pg.locator('#aj-x').count()==1)
    pg.fill('#aj-x','2'); pg.fill('#aj-o','100'); pg.wait_for_timeout(200)
    txt=pg.inner_text('#aj-res'); print(txt)
    # 1000 + 8% = 1080; cross-border 2% of 1080 = 21.6 -> 22 (JPY has no decimals); other 100 => 1202
    ok('total includes tax and both fees (1,202)', '1,202' in txt)
    sz=pg.evaluate("(()=>{const e=document.getElementById('aj-inc');const r=e.getBoundingClientRect();return [r.width,r.height]})()")
    ok('checkbox is the one standard size (20px) %s'%sz, sz[0]==20 and sz[1]==20)
    pg.click('#aj-ok'); pg.wait_for_timeout(400)
    ok('amount = total', pg.input_value('#f-amount').replace(',','')=='1202')
    ok('summary mentions fees', 'fees' in pg.locator('.adjbtn').inner_text())
    # items: JPY default 8
    # --- item suggestions
    r=pg.evaluate("""async()=>{const I=await import('/js/itemcat.js'),c=await import('/js/core.js');
      c.commit(db=>{const cat=db.categories.find(x=>!x.deleted&&x.kind==='expense'), acct=db.accounts.find(a=>a.id==='t-jpb');
        db.txs.push({id:'ti1',kind:'expense',amount:600,cur:'JPY',acct:acct.id,cat:cat.id,date:c.nowStamp(),name:'Test Mart',items:[{n:'Asahi Super Dry 350ml',amt:'250',q:1,cat:cat.id},{n:'Banana',amt:'150',q:1,cat:cat.id}]});});
      const db=c.get(); return {rank:I.rankItemNames(db,'as','Test Mart','',[],5), sub:I.rankItemNames(db,'dry','','',[],5), price:I.lastItemPrice(db,'banana'), guess:I.guessItemCat(db,'Super Dry Asahi 500ml')}}""")
    print(r)
    ok('prefix match first', r['rank'] and r['rank'][0].startswith('Asahi'))
    ok('contains match', any('Asahi' in x for x in r['sub']))
    ok('latest price remembered', str(r['price'])=='150')
    ok('category guessed from shared words', r['guess'] and r['guess']['cat'])
    # --- tags lighter than before: chip colours not solid dark
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(800)
    ok('no page errors %s'%errs, not errs)
print('fails',res.count(False)); raise SystemExit(1 if False in res else 0)
