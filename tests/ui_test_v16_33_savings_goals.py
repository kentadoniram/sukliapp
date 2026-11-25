# v16.33: savings goals: Transfer entries count toward a goal (also a goal in another currency), Home card, edit/delete follow, no-rate warning
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    r=pg.evaluate("""async()=>{const c=await import('/js/core.js');
      c.commit(db=>{const a=db.accounts.find(x=>!x.deleted&&x.cur===c.HOME&&['bank','cash','ewallet'].includes(x.type)),b2=db.accounts.find(x=>!x.deleted&&x.id!==a.id&&x.cur===c.HOME&&['bank','cash','ewallet'].includes(x.type));
        db.goals=[{id:'g1',name:'Japan Trip',target:1000,cur:'USD',created:'2026-01-01',log:[],start:0}];
        window.__ids=[a.id,b2.id]});
      return window.__ids}""")
    a,b2=r
    # transfer through the form: pick the goal, see the conversion hint
    pg.evaluate("""async()=>{const m=await import('/js/entry.js');m.openEntry({});return true}"""); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-e=kind][data-v=transfer]').click()"); pg.wait_for_timeout(500)
    pg.fill('#f-amount','5000'); pg.wait_for_timeout(200)
    ok('goal row visible on a Transfer', pg.locator('#goalrow').is_visible() and pg.locator('#f-goal').count()==1)
    ok('goal option shows its currency', 'Japan Trip (USD)' in pg.evaluate("[...document.querySelectorAll('#f-goal option')].map(o=>o.textContent).join('|')"))
    pg.evaluate("(()=>{const s=document.getElementById('f-goal');s.value='g1';s.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(300)
    h=pg.inner_text('#goalhint'); print(h); ok('hint says what it adds in USD', 'USD' in h or '$' in h)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    r=pg.evaluate("""async(ids)=>{const c=await import('/js/core.js'),S=await import('/js/savings.js');
      c.commit(db=>{db.txs.push({id:'tg1',kind:'transfer',amount:5000,cur:c.HOME,acct:ids[0],to:ids[1],toAmount:5000,date:c.nowStamp(),name:'save',goalId:'g1'})});
      const s1=S.goalStats(c.get(),c.get().goals[0]).saved;
      c.commit(db=>{db.txs.find(t=>t.id==='tg1').amount=10000});
      const s2=S.goalStats(c.get(),c.get().goals[0]).saved;
      c.commit(db=>{db.txs.find(t=>t.id==='tg1').deleted=true});
      const s3=S.goalStats(c.get(),c.get().goals[0]).saved;
      c.commit(db=>{db.txs.find(t=>t.id==='tg1').deleted=false});
      return [s1,s2,s3]}""",[a,b2])
    print(r); ok('transfer counts toward USD goal', r[0]>80 and r[0]<90); ok('editing the transfer updates the goal', abs(r[1]-2*r[0])<0.01); ok('deleting the transfer removes it from the goal', r[2]==0)
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(900)
    ok('Savings card on Home', pg.locator('.savingshome').count()==1 and 'Japan Trip' in pg.inner_text('.savingshome'))
    pg.evaluate("location.hash='#/savings'"); pg.wait_for_timeout(700)
    ok('USD goal shown in USD', '$' in pg.inner_text('.goalnum') or 'USD' in pg.inner_text('.goalnum'))
    ok('no warning while a rate exists', pg.locator('.goalcard .hint').filter(has_text='no exchange rate').count()==0)
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(db=>{db.goals[0].cur='ZZZ'})}"""); pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(300); pg.evaluate("location.hash='#/savings'"); pg.wait_for_timeout(700)
    ok('no-rate goal shows a warning instead of silently switching', pg.locator('.goalcard .hint').filter(has_text='no exchange rate').count()==1)
    ok('no page errors %s'%errs, not errs)
    b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
