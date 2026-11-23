from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
def num(s):
    import re
    m=re.search(r'([−-])?₱\s*([\d,]+\.\d+)',s); v=float(m.group(2).replace(',','')); return -v if m.group(1) else v
with sync_playwright() as p:
    b=p.chromium.launch()
    for design in ('theme1','legacy'):
        c=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
        if design=='legacy':
            pg.evaluate("localStorage.setItem('sukli-look', JSON.stringify({design:'legacy'}))"); pg.reload()
        pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(6000)
        n=design+': '
        ok(n+'html design attr', pg.evaluate("document.documentElement.dataset.design")==design)
        labs=pg.evaluate("[...document.querySelectorAll('.tabs a')].map(e=>e.textContent.trim())")
        ok(n+'four sections %s'%labs, len(labs)==4 and labs[0]=='Overview' and labs[2]=='Calendar' and labs[3]=='Accounts' and labs[1] not in ('Platform',''))
        pg.click('.tabs a:has-text("Accounts")'); pg.wait_for_timeout(600)
        cats=pg.evaluate("[...document.querySelectorAll('.invacc > [data-sec^=ia-] > .collrow h2')].map(e=>e.childNodes[0].textContent.trim())")
        ok(n+'four category sections %s'%cats, cats==['Crypto','Stock Market','Government Bonds','Other Investments'])
        ok(n+'platforms sit inside Crypto', pg.locator('[data-sec^="ia-crypto-"]').count()>=3)
        name=pg.evaluate("document.querySelector('[data-sec^=\"ia-crypto-\"] [data-ex]').dataset.ex")
        pg.evaluate("document.querySelector('[data-sec^=\"ia-crypto-\"] > .collrow .collhead').click()"); pg.wait_for_timeout(300); pg.locator('[data-sec^="ia-crypto-"] [data-act=inv-plat]:visible').first.click(); pg.wait_for_timeout(900)
        labs=pg.evaluate("[...document.querySelectorAll('.tabs a')].map(e=>e.textContent.trim())")
        ok(n+'platform tab shows selected name', name in labs[1])
        has=pg.evaluate("({hero:!!document.querySelector('.plat-hero'),graph:!!document.querySelector('.invline svg'),pl:/Profit and Loss/.test(document.body.innerText),met:/Other Metrics/.test(document.body.innerText),tx:/Transactions on/.test(document.body.innerText)})")
        ok(n+'platform page has hero, graph, P&L, metrics, transactions %s'%has, all(has.values()))
        rows=pg.evaluate("[...document.querySelectorAll('.invtx > *')].map(e=>e.textContent)")
        bad=[r for r in rows if name not in r]
        ok(n+'transactions limited to this platform (%d rows, %d off-platform)'%(len(rows),len(bad)), len(rows)>0 and not bad)
        pg.click('.tabs a:has-text("Calendar")'); pg.wait_for_timeout(600)
        ok(n+'calendar shows investment-only note', pg.evaluate("/Regular income and spending stay in the main Calendar/.test(document.body.innerText)"))
        ok(n+'no page errors %s'%errs, not errs)
        c.close()
    # None option
    c=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(500)
    res=pg.evaluate("""async()=>{const m=await import('/js/invest.js');const c=await import('/js/core.js');
      const a=c.get().accounts.find(x=>/gcash/i.test(x.name)); if(!a) return {err:'no gcash'};
      const before=m.exchangeOf({...a,exchange:'',noEx:false,name:'GCash Coins.ph'});
      const after=m.exchangeOf({...a,exchange:'',noEx:true,name:'GCash Coins.ph'});
      return {before,after}}""")
    print(res)
    ok('name guess still works without the flag, off once None is chosen', res.get('before') and res.get('after')=='')
    ok('no page errors %s'%errs, not errs)
