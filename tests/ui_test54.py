# v12aq: card billing period filter and posted date
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(()=>{const s=window.sukli;s.commit(d=>{const id='cardz';d.accounts.push({id,name:'Zed Card',cur:'PHP',type:'card',open:0,include:true,archived:false,stmtDay:11,dueDay:1,limit:50000,updatedAt:Date.now()});
      const c=d.categories.find(x=>x.kind==='expense'&&!x.deleted).id, mk=(i,date,amt,extra)=>d.txs.push(Object.assign({id:i,kind:'expense',amount:amt,cur:'PHP',fx:1,date,name:i,cat:c,acct:id,updatedAt:Date.now()},extra||{}));
      mk('pa','2026-10-05 12:00:00',500); mk('pb','2026-10-11 20:00:00',300,{posted:'2026-10-12'}); mk('pc','2026-10-15 12:00:00',200);});})()""")
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('[data-act=acct][data-id=cardz]').click()"); pg.wait_for_selector('select[data-bp]')
    opts=pg.eval_on_selector_all('select[data-bp] option','o=>o.map(x=>[x.value,x.textContent])'); print(opts[:3])
    ok('period list has Current first', len(opts)>=12 and opts[1][1].startswith('Current') and opts[1][0]=='2026-10-12|2026-11-11')
    pg.select_option('select[data-bp]','2026-10-12|2026-11-11'); pg.wait_for_timeout(400)
    t=pg.inner_text('.gdhead ~ .rows.plain') if pg.locator('.gdhead ~ .rows.plain').count() else pg.inner_text('.rows.plain')
    ok('current period has the posted-later entry and the 15th', 'pb' in t and 'pc' in t and 'pa' not in t.replace('past',''))
    ok('row says posted', 'posted' in t)
    ok('statement summary on a card period', pg.locator('.cardbox.stmt').count()==1 and 'Charges (2)' in pg.inner_text('.cardbox.stmt'))
    pg.select_option('select[data-bp]','2026-09-12|2026-10-11'); pg.wait_for_timeout(400)
    st=pg.inner_text('.cardbox.stmt'); ok('closed statement shows owed 500 at the statement date', '500' in st and 'Owed at the statement date' in st and 'Pay by' in st)
    t=pg.inner_text('.rows.plain'); ok('previous period has only the 5th', 'pa' in t and 'pb' not in t and 'pc' not in t)
    pg.click('[data-ad=edit]'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    r=pg.evaluate("window.sukli.cardOwedAtStmt ? 0 : 0")
    # entry form
    pg.evaluate("document.querySelector('[data-ad=add]').click()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
    ok('posted link shown for a card', pg.locator('[data-e=postedon]').count()==1 and pg.is_visible('[data-e=postedon]'))
    pg.click('[data-e=postedon]'); pg.wait_for_timeout(300)
    ok('posted date shown', pg.locator('[data-e=posted]').count()==1)
    pg.fill('#f-amount','123'); pg.click('[data-e=save]'); pg.wait_for_timeout(900)
    tx=pg.evaluate("(()=>{const t=window.sukli.get().txs.filter(x=>x.acct==='cardz'&&Math.abs(x.amount-123)<1e-9)[0];return t?[t.date.slice(0,10),t.posted]:null})()")
    ok('saved with posted day after date %s'%(tx,), tx and tx[1] and tx[1]>tx[0])
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
