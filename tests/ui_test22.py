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
    pg.goto(U+'#/accounts'); pg.wait_for_timeout(500)
    pg.click('[data-act=aview][data-k=group][data-v=type]'); pg.wait_for_timeout(300)
    row=pg.locator('.row.acct', has_text='Bank').first
    row.click(); pg.wait_for_selector('#ad'); pg.click('#ad [data-ad=edit]'); pg.wait_for_selector('#acct-form')
    pg.fill('[name=apy]','3.65'); pg.fill('[name=interestFrom]','2026-10-18'); ok('tax default shown 20', pg.input_value('[name=taxPct]')=='20')
    pg.click('#acct-form button:text-is("Save")'); pg.wait_for_timeout(800)
    pg.wait_for_selector('#ad'); t=pg.inner_text('#ad'); ok('interest box mentions tax', 'after 20% tax' in t)
    pg.click('#ad [data-ad=edit]'); pg.wait_for_selector('#acct-form'); print('APY', pg.input_value('[name=apy]'), pg.input_value('[name=taxPct]'), pg.inner_text('#acct-form')[:80]); pg.keyboard.press('Escape'); pg.wait_for_timeout(500); print('AD', pg.locator('#ad').count(), 'Interest' in pg.inner_text('#ad'), errs);r=pg.locator('#ad button.row[data-act=edit]').first; r.click(); pg.wait_for_selector('#it-pct'); ok('interest detail opens', 'Credited' in pg.inner_text('.sheet >> nth=-1'))
    pg.fill('#it-pct','0'); pg.click('[data-go]'); pg.wait_for_timeout(600)
    ok('retax toast', 'updated' in pg.inner_text('.toast'))
    pg.wait_for_selector('#ad'); ok('now no tax in box', 'after 20% tax' not in pg.inner_text('#ad'))
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
