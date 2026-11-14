# v15.35: Loan Setup wizard: four steps, past payments recorded, account + borrowed entry
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{(await import('/js/loanwizard.js')).openLoanWizard()})()"); pg.wait_for_selector('#lw',timeout=5000)
    ok('step 1 shown', 'What and who' in pg.inner_text('#lw'))
    pg.fill('#lw-lender','Test Bank'); pg.click('[data-e=lw-next]')
    ok('Next disabled until amount and length', pg.locator('[data-e=lw-next]').is_disabled())
    pg.fill('#lw-principal','120000'); pg.fill('#lw-rate','0'); pg.fill('#lw-months','12'); pg.wait_for_timeout(200)
    ok('live monthly 10,000 %s'%pg.inner_text('#lw-live'), '10,000' in pg.inner_text('#lw-live'))
    pg.click('[data-e=lw-next]'); pg.fill('#lw-start','2026-08-15'); pg.fill('#lw-done','2'); pg.click('[data-e=lw-next]')
    ok('review shows already paid', 'Already paid' in pg.inner_text('#lw'))
    pg.click('[data-e=lw-save]'); pg.wait_for_timeout(800)
    R=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();const a=d.accounts.find(x=>x.loan&&x.loan.lender==='Test Bank');return {a:!!a,n:a?d.txs.filter(t=>!t.deleted&&(t.acct===a.id||t.toAcct===a.id)).length:0,dates:a?d.txs.filter(t=>t.toAcct===a.id&&!t.loan).map(t=>t.date.slice(0,10)):[]}})()")
    ok('loan account, borrowed entry and 2 payments %s'%R, R['a'] and R['n']==3 and R['dates']==['2026-09-15','2026-10-15'])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
