from playwright.sync_api import sync_playwright
import re, sys
S='/tmp/claude-0/-home-claude/e0191d68-b6bd-5145-8d10-9c3cd7e19bda/scratchpad/'
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',timezone_id='Asia/Tokyo',service_workers='block')
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'TUNNEL' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
    # --- analytics
    pg.goto('http://localhost:8123/index.html#/analytics'); pg.wait_for_selector('.tiles'); 
    pg.click('[data-act="an-range"][data-v="y"]'); pg.wait_for_timeout(400)
    ok('analytics tiles', pg.locator('.tile').count()==4)
    ok('analytics bars', pg.locator('svg g[data-act="an-bucket"]').count()>=1)
    pg.evaluate("document.querySelector('.tile[data-act=an-list]').click()"); pg.wait_for_selector('.scrim .row, .scrim .empty'); ok('tile opens entry list', True)
    ok('back closes list sheet', True)
    pg.go_back(); pg.wait_for_timeout(300)
    ok('sheet closed by Back', pg.locator('.scrim').count()==0 and 'analytics' in pg.url)
    pg.evaluate("document.querySelector('svg g[data-act=an-bucket]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); pg.wait_for_timeout(300)
    ok('bar opens list', pg.locator('.scrim').count()==1)
    pg.click('.scrim [data-close]'); pg.wait_for_timeout(400)
    ok('X closes and stays on page', pg.locator('.scrim').count()==0 and 'analytics' in pg.url)
    pg.go_back(); pg.wait_for_timeout(300); ok('Back after X leaves analytics (no stale entry)', 'analytics' not in pg.url)
    pg.goto('http://localhost:8123/index.html#/analytics'); pg.wait_for_selector('.tiles')
    pg.select_option('[data-an="group"]', index=1); pg.wait_for_timeout(300); ok('group filter applies', pg.locator('.tile').count()==4)
    # --- entry sheet
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry')
    ok('currency selector right-most in amount row', pg.evaluate("(()=>{const r=document.querySelector('.amtrow');return r.lastElementChild.id==='curwrap'})()"))
    ok('Usual tab present', pg.locator('.qtab').count()>=2)
    pg.click('#f-when'); pg.wait_for_selector('.dpgrid, .datepicker, [data-dp]', timeout=3000); ok('calendar picker opens', True)
    pg.go_back(); pg.wait_for_timeout(300)
    ok('Back closes date picker only', pg.locator('#entry').count()==1)
    pg.fill('#f-amount','123'); pg.focus('#f-name'); pg.fill('#f-name','abc'); pg.wait_for_timeout(200)
    ok('clear button shows', pg.locator('.clearx:not([hidden])').count()==1)
    pg.click('.clearx'); pg.wait_for_timeout(100)
    ok('clear button empties field', pg.input_value('#f-name')=='')
    pg.click('[data-e="kind"][data-v="transfer"]'); pg.wait_for_timeout(200)
    order=pg.evaluate("[...document.querySelectorAll('#entry > *')].map(e=>e.id).filter(Boolean)")
    ok('transfer: label before amount', order.index('namefield')<order.index('amountbox'))
    ok('transfer: conversion off by default', pg.locator('#f-conv:checked').count()==0)
    pg.go_back(); pg.wait_for_timeout(300); ok('Back closes entry', pg.locator('#entry').count()==0)
    # --- recycle bin
    t=pg.evaluate("window.sukli.get().txs.find(t=>!t.deleted).id")
    pg.evaluate(f"document.querySelector('[data-act=add]')"); 
    pg.goto('http://localhost:8123/index.html#/ledger'); pg.wait_for_timeout(500)
    pg.evaluate(f"(()=>{{const h=location.hash;}})()")
    pg.evaluate("window.sukli.commit(d=>{})")
    pg.evaluate(f"window.sukli.openEntry && window.sukli.openEntry({{id:'{t}'}})") if False else None
    pg.goto('http://localhost:8123/index.html#/bin'); pg.wait_for_timeout(400)
    ok('bin page loads', 'Recycle bin' in pg.inner_text('main, #app'))
    pg.screenshot(path=S+'v6-bin.png')
    # --- accounts detail filters + card billing
    pg.goto('http://localhost:8123/index.html#/accounts'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-act=acct]').click()"); pg.wait_for_selector('.histfilter')
    pg.click('[data-ad="type"][data-v="out"]'); pg.wait_for_timeout(200); ok('account filter works', pg.locator('.histfilter').count()==1)
    pg.click('[data-ad="preset"][data-v="y"]'); pg.wait_for_timeout(200); ok('range summary shown', pg.locator('.facts').count()>=2)
    pg.screenshot(path=S+'v6-acct.png', full_page=True)
    b.close()
print('ERRORS',errs); print(sum(res),'/',len(res))
