import sys, json, time
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/e0191d68-b6bd-5145-8d10-9c3cd7e19bda/scratchpad/'
CSV='/mnt/user-data/uploads/Transactions.csv'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='en-US',timezone_id='Asia/Tokyo',service_workers='block',accept_downloads=True)
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(('console.'+m.type,m.text)) if m.type in('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.screenshot(path=S+'s1-first.png')
    pg.set_input_files('#first-file',CSV)
    pg.wait_for_selector('#setup',timeout=20000)
    pg.screenshot(path=S+'s2-setup.png')
    print('setup rows',pg.locator('.setrow').count())
    pg.click('#setup .btn'); pg.wait_for_timeout(300)
    pg.screenshot(path=S+'s3-home.png')
    print('home strip:',pg.inner_text('.strip').replace('\n',' | '))
    print('spendable:',pg.inner_text('.spendable').replace('\n',' | ')[:200])
    # tabular figures check
    w=pg.evaluate("""()=>{const m=(t)=>{const s=document.createElement('span');s.style.cssText='font:700 30px "Schibsted Grotesk";font-feature-settings:"tnum" 1;position:absolute;visibility:hidden';s.textContent=t;document.body.appendChild(s);const w=s.getBoundingClientRect().width;s.remove();return w};return [m('1111'),m('8888')]}""")
    print('tnum widths 1111 vs 8888:',w)
    print('fonts loaded:',pg.evaluate("document.fonts.check('16px \"Schibsted Grotesk\"')"))
    # ledger
    pg.click('.tabs a[href="#/ledger"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=S+'s4-ledger.png')
    pg.fill('#q','life'); pg.wait_for_timeout(200)
    print('search life rows:',pg.locator('#ledger-list .row').count())
    pg.screenshot(path=S+'s5-search.png')
    # add flow: known name
    pg.click('.fab'); pg.wait_for_selector('#entry')
    pg.screenshot(path=S+'s6-add-empty.png')
    pg.fill('#f-what','Life Tsukagoshi'); pg.wait_for_timeout(200)
    print('suggestions:',pg.locator('#sugg button').count(), '| cat chips:',pg.locator('#catrow .chip.cat').all_inner_texts())
    pg.click('#sugg button >> nth=0') if pg.locator('#sugg button').count() else None
    pg.fill('#f-amount','1234.5'); pg.wait_for_timeout(200)
    pg.screenshot(path=S+'s7-add-filled.png')
    # split into items
    pg.click('[data-e="items-on"]')
    rows=pg.locator('.item')
    pg.fill('.item >> nth=0 >> .in-n','Banana'); pg.fill('.item >> nth=0 >> .in-a','200')
    pg.click('[data-e="item-add"]')
    pg.fill('.item >> nth=1 >> .in-n','Shampoo'); pg.fill('.item >> nth=1 >> .in-a','400')
    pg.wait_for_timeout(200)
    print('item left:',pg.inner_text('#itemleft'))
    pg.screenshot(path=S+'s8-items.png')
    pg.fill('.item >> nth=1 >> .in-a','1034.5'); print('item left now:',pg.inner_text('#itemleft'))
    pg.click('[data-e="save"]'); pg.wait_for_timeout(400)
    tx=pg.evaluate("()=>{const d=window.sukli.get();const t=d.txs.filter(t=>!t.deleted).sort((a,b)=>b.updatedAt-a.updatedAt)[0];const c=d.categories.find(c=>c.id===t.cat);const a=d.accounts.find(a=>a.id===t.acct);return {name:t.name,amount:t.amount,cat:c&&c.name,acct:a&&a.name,cur:t.cur,fx:t.fx,items:t.items.length,flag:t.flag}}")
    print('saved tx:',tx)
    # new unknown name -> review
    pg.click('.fab'); pg.wait_for_selector('#entry')
    pg.fill('#f-amount','850'); pg.fill('#f-what','zzqx widget'); pg.wait_for_timeout(200)
    pg.click('[data-e="save"]'); pg.wait_for_timeout(400)
    print('review count:',pg.evaluate("()=>window.sukli.get().txs.filter(t=>!t.deleted&&t.flag==='review').length"))
    # bulk add
    pg.goto('http://localhost:8123/index.html#/review'); pg.wait_for_timeout(500)
    pg.screenshot(path=S+'s9-review.png')
    # transfer between currencies
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_timeout(300)
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.click('[data-e="kind"][data-v="transfer"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=S+'s10-transfer.png')
    pg.click('#entry .iconbtn, .sheet-head .iconbtn')
    # accounts, reports, settings
    for name,hash_ in [('s11-accounts','accounts'),('s12-reports','reports'),('s13-settings','settings')]:
        pg.goto('http://localhost:8123/index.html#/'+hash_); pg.wait_for_timeout(500); pg.screenshot(path=S+name+'.png',full_page=True)
    # persistence: reload
    pg.reload(); pg.wait_for_timeout(600)
    print('after reload tx count:',pg.evaluate("()=>window.sukli.get().txs.length"))
    # dark
    pg2=ctx.new_page(); pg2.emulate_media(color_scheme='dark'); pg2.goto('http://localhost:8123/index.html#/home'); pg2.wait_for_timeout(600); pg2.screenshot(path=S+'s14-dark.png')
    b.close()
print('ERRORS:',json.dumps(errs,indent=1)[:2500])
