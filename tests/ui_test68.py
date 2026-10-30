# v13.7: folded Look and Feel sections, minor Simple-mode hiding (nothing deleted, Advanced shows everything)
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
J=lambda pg,js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    # Look and Feel folds
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('details.sgroup[data-sgroup=look]'); pg.wait_for_timeout(300)
    subs=pg.eval_on_selector_all('details.ssub','d=>d.map(x=>[x.dataset.ssub,x.open])'); ok('Look and Feel has folded sections: %s'%subs, len(subs)>=3 and all(not o for _,o in subs))
    ok('Mode stays open, not folded', pg.locator('details.sgroup[data-sgroup=look] [data-act=set-mode]').first.is_visible())
    pg.click('details.ssub >> nth=0 >> summary'); pg.wait_for_timeout(300); ok('tapping a heading opens it', pg.eval_on_selector('details.ssub','d=>d.open'))
    ok('open state remembered on this device', 'Tabs' in (pg.evaluate("localStorage.getItem('sukli-ssub')") or '') or len(pg.evaluate("JSON.parse(localStorage.getItem('sukli-ssub')||'[]')"))==1)
    # Advanced (default): everything visible
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); t=pg.inner_text('.drawer'); ok('Advanced menu has Investments, Analytics, Cash flow', all(x in t for x in ['Investments','Analytics','Cash flow','Outlook','Loan planner'])); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # Simple
    J(pg,"c.commit(d=>{d.settings.mode='simple'})"); pg.wait_for_timeout(500)
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); t=pg.inner_text('.drawer'); ok('Simple menu hides Investments, Analytics, Cash flow, Outlook, Loan planner', not any(x in t for x in ['Investments','Analytics','Cash flow','Outlook','Loan planner']))
    ok('Simple menu keeps Debts, Owed to you, Accounts, Settings and offers Advanced', all(x in t for x in ['Debts','Owed to you','Accounts','Settings','Show all options (Advanced)']))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300); ok('Simple entry form hides the Merchant row', not pg.is_visible('#merchrow'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('#simplelist'); pg.evaluate("document.querySelectorAll('details.sgroup').forEach(d=>d.open=true)"); pg.wait_for_timeout(200)
    ok('Settings says what is hidden', 'Hidden in Simple mode' in pg.inner_text('#simplelist'))
    ok('Name matching and Cloud sync hidden in Simple', not pg.locator('#nmatch').is_visible())
    ok('data is untouched', J(pg,"return c.get().txs.length")>1000)
    # an entry that already has a merchant keeps showing it
    J(pg,"c.commit(d=>{const t=d.txs.find(x=>!x.deleted&&x.kind==='expense');t.merchant='Shopee';c.stamp(t);window.__mid=t.id})"); 
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#ledger-list'); pg.evaluate("(async()=>{const m=await import('/js/entry.js');const c=await import('/js/core.js');m.openEntry({id:window.__mid})})()"); pg.wait_for_selector('#merchrow'); pg.wait_for_timeout(300); ok('an existing merchant stays visible in Simple', pg.is_visible('#merchrow') and 'Shopee' in pg.inner_text('#merchrow'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # back to Advanced shows all
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('#simplelist'); pg.evaluate("document.querySelectorAll('details.sgroup').forEach(d=>d.open=true)"); pg.click('[data-act=set-mode][data-v=advanced]'); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('details.sgroup').forEach(d=>d.open=true)")
    ok('Advanced shows Name matching again', pg.locator('#nmatch').is_visible())
    ok('no errors', not errs)
print('fails=%d'%len([r for r in res if not r]))
