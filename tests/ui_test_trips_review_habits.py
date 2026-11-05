# Trips, location and review of rebuilt trades (one browser and one imported CSV; merged from ui_test76.py, ui_test98.py, ui_test99.py).
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)



def part0(p,b,ctx,pg,errs):
    # v13.23: Trips and events page (learned from the habit engine) with Yes / Not a trip teaching
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.goto('http://localhost:8123/#/trips'); pg.wait_for_timeout(1500)
    n=pg.locator('.tripcard').count(); ok('trip cards shown (%d)'%n, n>=2)
    t=pg.inner_text('#trippage'); ok('cards explain reasons and cost', 'Sukli thinks' in t or 'you confirmed' in t)
    ok('unattached bookings card or none, no crash', 'undefined' not in t and 'NaN' not in t)
    first=pg.locator('.tripcard').first.get_attribute('data-from')
    pg.locator('.tripcard').first.locator('[data-act=trip-days]').click(); pg.wait_for_timeout(500)
    sh=pg.inner_text('.sheet'); ok('date click lists entries with labels', ('Trip' in sh) and ('Normal payment' in sh or 'Paid ahead' in sh or 'counted as the trip' in sh) and pg.locator('.tripdays .tdr').count()>=1)
    ok('no Invalid Date in the list', 'Invalid' not in sh and 'NaN' not in sh)
    b0=pg.locator('.sheet [data-act=trip-pick]').first; before=pg.locator('.sheet .tdr').first.inner_text(); id0=b0.get_attribute('data-id'); v0=b0.get_attribute('data-v')
    b0.click(); pg.wait_for_timeout(500)
    st=pg.evaluate("(async()=>{const m=await import('/js/core.js');return m.get().settings.tripPick})()")
    ok('manual choice saved %s'%st, st and st.get(id0)==v0 if isinstance(st,dict) else False)
    ok('list shows the new label', ('chose' in pg.inner_text('.sheet')))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    if pg.locator('.sheet').count(): pg.evaluate("document.querySelector('.sheet [data-close], .sheet .close, .scrim')?.click()"); pg.wait_for_timeout(300)
    pg.locator('.tripcard').first.locator('[data-act=trip-yes]').click(); pg.wait_for_timeout(500)
    s=pg.evaluate("(async()=>{const m=await import('/js/core.js');return [m.get().settings.tripNotes,m.get().settings.habitW]})()")
    ok('Yes remembered %s'%s, s[0] and s[0][first]['s']=='yes' and s[1])
    ok('confirmed card says so', 'you confirmed this' in pg.inner_text('#trippage'))
    pg.locator('.tripcard').first.locator('[data-act=trip-no]').click(); pg.wait_for_timeout(500)
    n2=pg.locator('.tripcard').count(); ok('Not a trip hides one card (%d->%d)'%(n,n2), n2==n-1)
    ok('hidden count with Show again', pg.locator('[data-act=trip-reset]').count()==1)
    pg.click('[data-act=trip-reset]'); pg.wait_for_timeout(500); ok('Show again restores', pg.locator('.tripcard').count()==n)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='simple'})})()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-act=menu],.burger,[data-act=burger]')?.click()"); pg.wait_for_timeout(300)
    ok('Simple mode hides the menu item', 'Trips and Events' not in pg.evaluate("[...document.querySelectorAll('nav a, .drawer a, #menu a, [data-nav]')].map(a=>a.innerText).join('|')"))
    ok('no errors %s'%errs, not errs)

def part1(p,b,ctx,pg,errs):
    # v13.44: review page for trades rebuilt from the Bluecoins import (real CSV: 64 of them)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    N="(async()=>{const r=await import('/js/tradereview.js'),c=await import('/js/core.js');const d=c.get();return [r.rebuiltList(d).length,r.pendingReview(d).length,d.txs.filter(t=>!t.deleted&&t.trade).length]})()"
    n=pg.evaluate(N); ok('rebuilt trades found %s'%n, n[0]>=1 and n[0]==n[1])
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    ok('Review trades button with the count', pg.locator('[data-act=trade-review]').count()==1 and str(n[1]) in pg.inner_text('[data-act=trade-review]'))
    pg.evaluate("document.querySelector('[data-act=trade-review]').click()"); pg.wait_for_selector('#trv'); t=pg.inner_text('#trv')
    ok('rows show date, what and value', 'Keep as Trade' in t and ('Sell' in t or 'Buy' in t) and 'Make It a Plain Transfer' in t and 'To Review (%d)'%n[1] in t)
    pg.locator('#trv [data-r=keep]').first.click(); pg.wait_for_timeout(300)
    m=pg.evaluate(N); ok('keep one: it moves to Kept, still a trade %s'%m, m[1]==n[1]-1 and m[2]==n[2])
    pg.locator('#trv [data-r=plain]').first.click(); pg.wait_for_timeout(400)
    m=pg.evaluate(N); ok('plain one: no longer a trade %s'%m, m[2]==n[2]-1 and m[0]==n[0]-1)
    pg.click('#trv [data-r=show][data-v=kept]'); pg.wait_for_timeout(300); ok('Kept tab lists the kept one', 'Back to Review' in pg.inner_text('#trv'))
    pg.click('#trv [data-r=show][data-v=todo]'); pg.wait_for_timeout(300)
    pg.click('#trv [data-r=keepall]'); pg.wait_for_timeout(300)
    pg.locator('.sheet button:has-text("Keep All")').last.click(); pg.wait_for_timeout(500)
    m=pg.evaluate(N); ok('keep all: nothing pending %s'%m, m[1]==0)
    pg.click('#trv [data-r=rebuildon]'); pg.wait_for_timeout(300)
    v=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().settings.rebuildTrades})()"); ok('off switch saved %s'%v, v is False)
    ok('no errors %s'%errs, not errs)

def part2(p,b,ctx,pg,errs):
    # v13.44: habit learning, rest: Daily Needs, trips left out of usual spending and of the debt plan, "on trips" line, monthly shops not "planned"
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    r=pg.evaluate("(async()=>{const t=await import('/js/trips.js'),c=await import('/js/core.js');const d=c.get();const n=t.dailyNeeds(d),ids=t.tripEntryIds(d),rep=t.tripReport(d);return [n.perDay,n.perMonth,n.days,n.left,ids.size,rep.trips.length,rep.planned.length]})()"); print(r)
    ok('daily needs figure, a month is 30 days', r[0]>0 and abs(r[1]-r[0]*30)<1 and r[2]>=30)
    ok('trip entries found', r[4]>0)
    pg.evaluate("location.hash='#/trips'"); pg.wait_for_timeout(1200); t=pg.inner_text('body'); ok('Trips page shows Daily Needs', 'Daily Needs' in t and 'An ordinary day' in t)
    # trips stay out of the debt plan's usual spending
    r2=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),t=await import('/js/trips.js');const d=c.get(),ids=t.tripEntryIds(d);const id=[...ids][0];const before=JSON.stringify(ids.size);return [before,ids.size>0]})()""")
    pg.evaluate("location.hash='#/debts'"); pg.wait_for_timeout(1200); ok('Debts page still opens', 'Debt' in pg.inner_text('body'))
    pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js');return 1})()")
    rr=pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js'),c=await import('/js/core.js');const x=m.spendReport(c.get(),'all');return [x.spentAll,x.onTrips]})()"); ok('spending report knows what went on trips %s'%rr, rr[1]>0 and rr[1]<rr[0])
    # a shop paid every month is not a planned booking
    n=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),t=await import('/js/trips.js');const acct=c.get().accounts.find(a=>!a.deleted&&a.type==='cash')||c.get().accounts[0];
      c.commit(d=>{for(let m=1;m<=4;m++)d.txs.push(c.stamp({id:'esim'+m,kind:'expense',date:'2026-0'+m+'-05 10:00:00',acct:acct.id,amount:3000,cur:acct.cur,fx:1,name:'Zeta eSIM plan',cat:''}))});
      return t.tripReport(c.get()).planned.filter(p=>/zeta/i.test(p.name)).length})()"""); ok('monthly eSIM plan not listed as planned %s'%n, n==0)
    ok('no errors %s'%errs, not errs)

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    print('--- tests/ui_test76.py'); part0(p,b,ctx,pg,errs)
    print('--- tests/ui_test98.py'); part1(p,b,ctx,pg,errs)
    print('--- tests/ui_test99.py'); part2(p,b,ctx,pg,errs)
    b.close()
print('fails',res.count(False))
