from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
U='http://localhost:8123/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto(U); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    # planner
    pg.goto(U+'#/accounts'); pg.wait_for_selector('[data-act=loan-plan]'); pg.click('[data-act=loan-plan]'); pg.wait_for_selector('#lp')
    pg.select_option('#lp [name=kind]','home'); pg.fill('#lp [name=principal]','1200000'); pg.fill('#lp [name=rate]','6'); pg.fill('#lp [name=months]','120'); pg.fill('#lp [name=fees]','12000'); pg.fill('#lp [name=lateFee]','3'); pg.fill('#lp [name=dueDay]','5')
    pg.wait_for_timeout(300); t=pg.inner_text('#lp-out')
    ok('planner shows monthly, interest and net', '13,32' in t and '1,188,000' in t and 'interest alone' in t and 'late payment' in t)
    pg.click('[data-rec]'); pg.wait_for_timeout(300); ok('asks to confirm fees', 'deducted upfront' in pg.inner_text('.confirm-text'))
    pg.click('[data-yes]'); pg.wait_for_timeout(700)
    pg.goto(U+'#/accounts'); pg.wait_for_timeout(500)
    pg.click('[data-act=aview][data-v=class]'); pg.wait_for_timeout(300)
    tx=pg.inner_text('#view'); ok('assets/debts grouping with the new loan', 'Liabilities' in tx and 'Home loan' in tx)
    pg.locator('.row.acct', has_text='Home loan').first.click(); pg.wait_for_selector('#ad'); pg.wait_for_timeout(300)
    d=pg.inner_text('#ad'); ok('loan box with plan and due info', 'Monthly payment' in d and 'Received after fees' in d and ('due' in d.lower()))
    pg.click('#ad [data-act=loan-charge]'); pg.wait_for_selector('#lc'); pg.select_option('#lc [name=what]','Late fee'); pg.fill('#lc [name=amt]','400'); pg.click('#lc .btn:not(.ghost)'); pg.wait_for_timeout(600)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto(U+'#/home'); pg.wait_for_timeout(800)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1200)
    h=pg.inner_text('#view'); ok('financial loss card', 'Money lost to fees and interest' in h and 'Loan fees' in h and 'Late fee' in h)
    # no interest on debts
    pg.goto(U+'#/accounts'); pg.wait_for_timeout(300); pg.locator('.row.acct', has_text='Home loan').first.click(); pg.wait_for_selector('#ad'); pg.click('#ad [data-ad=edit]'); pg.wait_for_selector('#acct-form')
    ok('interest hidden for loans', pg.locator('#intfields').is_hidden())
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # smart label hint
    pg.goto(U+'#/home'); pg.wait_for_timeout(400); pg.click('.fab'); pg.wait_for_selector('#entry'); pg.type('#f-name','Loan Payment',delay=20); pg.wait_for_timeout(300)
    ok('smart hint for Loan Payment', pg.locator('[data-e=smart][data-v=loanpay]').count()==1)
    pg.click('[data-e=smart][data-v=loanpay]'); pg.wait_for_timeout(500)
    ok('switched to transfer into the loan', pg.locator('.swapbtn').count()==1 and 'Home loan' in pg.inner_text('.two.sw'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.type('#f-name','credit to cash',delay=20); pg.wait_for_timeout(300)
    ok('smart hint for credit to cash', pg.locator('[data-e=smart][data-v=cash]').count()==1)
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
