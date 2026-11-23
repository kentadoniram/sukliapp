import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  [' + str(x)[:220] + ']'))
U = 'http://localhost:8123/'
with sync_playwright() as p:
    b = p.chromium.launch()
    for design in ('theme1', 'legacy'):
        pg = b.new_context(service_workers='block', viewport={'width': 402, 'height': 874}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
        pg.evaluate("async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}", design); n = design + ': '
        # 1 icon groups
        g = pg.evaluate("async()=>{const m=await import('/js/caticons.js');const g=m.iconGroupsFull();const all=g.flatMap(x=>x[1]);return {t:g.map(x=>x[0]),n:all.length,u:new Set(all).size,k:m.ICON_KEYS.length}}")
        ok(n + 'icons grouped by purpose, each picture once %s' % g['t'], len(g['t']) >= 7 and g['n'] == g['u'] == g['k'], g)
        pg.goto(U + '#/home'); pg.wait_for_timeout(700)
        pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openIconLibrary('',()=>{})}"); pg.wait_for_selector('.icolib'); pg.wait_for_timeout(300)
        heads = pg.evaluate("[...document.querySelectorAll('.icolib h3.icogrp')].map(e=>e.textContent)")
        ok(n + 'the picture library shows group headings %s' % heads[:3], 'Transport & Travel' in heads and 'Food & Drink' in heads and len(heads) >= 7)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        # 2 header one row at iPhone 16 Pro width
        if design == 'theme1':
            for h in ('home', 'invest', 'calendar', 'budget'):
                pg.goto(U + '#/' + h); pg.wait_for_timeout(700)
                r = pg.evaluate("(()=>{const t=document.querySelector('.t1top');const q=[...t.querySelectorAll('.hl,.hbar > *')].map(e=>Math.round(e.getBoundingClientRect().top));return {h:Math.round(t.getBoundingClientRect().height),sw:document.documentElement.scrollWidth,spread:Math.max(...q)-Math.min(...q)}})()")
                ok(n + '%s header is one row at 402px %s' % (h, r), r['h'] <= 72 and r['spread'] <= 12 and r['sw'] <= 402, r)
        # 5 home > accounts Investments button
        pg.goto(U + '#/accounts'); pg.wait_for_timeout(900)
        labs = pg.evaluate("[...document.querySelectorAll('#view .btn.sm, #view [data-act]')].filter(e=>/Investments|Loan planner|Loan setup|Bills|Add account/.test(e.textContent)).map(e=>e.textContent.trim())")
        ok(n + 'Investments is the first button, before Loan planner %s' % labs[:3], labs[:2] == ['Investments', 'Loan planner'])
        pg.click('[data-act=open-inv-accounts]'); pg.wait_for_timeout(900)
        ok(n + 'it opens Investments > Accounts', pg.evaluate('location.hash') == '#/invest' and pg.locator('.invacc').count() == 1)
        # 3/6 platform rows, gradient, no circles
        ok(n + 'platforms are plain rows that open the platform (no expand)', pg.locator('.invacc [data-act=inv-plat]').count() >= 3 and pg.locator('.invacc .platdot, .invacc .invprod').count() == 0 and pg.locator('.invacc .invplatrow .chev').count() >= 3)
        bg = pg.evaluate("[...document.querySelectorAll('.invacc > .coll')].map(e=>getComputedStyle(e).backgroundImage.startsWith('linear-gradient'))")
        ok(n + 'every category card has a gradient background %s' % bg, len(bg) == 4 and all(bg))
        gr = pg.evaluate("new Set([...document.querySelectorAll('.invacc > .coll')].map(e=>getComputedStyle(e).backgroundImage)).size")
        ok(n + 'each category has its own colour', gr == 4, gr)
        bl = pg.evaluate("[...document.querySelectorAll('.invacc > .coll')].map(e=>getComputedStyle(e).borderLeftWidth)")
        ok(n + 'no coloured stripe on the left of a card %s' % bl, all(x in ('0px', '1px') for x in bl) and pg.locator('.invacc .invplatrow').first.evaluate("e=>getComputedStyle(e).borderLeftWidth") == '0px')
        ok(n + 'Home button on this page goes to Home > Accounts', pg.locator('[data-act=go-home-acc]').count() == 1)
        pg.locator('.invacc [data-act=inv-plat]').first.click(); pg.wait_for_timeout(900)
        ok(n + 'a platform row opens the Platform tab', pg.locator('.plat-hero').count() == 1)
        # 7 platform hero name size and graph height
        fs = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.plat-hero .sc-kick b, .plat-hero .phead b')).fontSize)")
        gh = pg.evaluate("(()=>{const e=document.querySelector('.invline');return e?Math.round(e.getBoundingClientRect().height):0})()")
        ok(n + 'exchange name is larger (%spx, was 14)' % fs, fs >= 17)
        ok(n + 'Performance line graph is shorter (%spx)' % gh, 0 < gh <= 125, gh)
        pg.evaluate("async()=>{const m=await import('/js/invnav.js');m.INV.sec='accounts';window.dispatchEvent(new Event('sukli-render'))}"); pg.wait_for_timeout(400)
        pg.click('[data-act=go-home-acc]'); pg.wait_for_timeout(700)
        ok(n + 'Home button lands on Home > Accounts', pg.evaluate('location.hash') == '#/accounts')
        # 4 overview
        pg.evaluate("async()=>{const m=await import('/js/invnav.js');m.INV.sec='overview';m.INV.plat='';}"); pg.goto(U + '#/invest'); pg.wait_for_timeout(800)
        ok(n + 'Overview: Home button first, goes to Home', pg.locator('.invact button').first.inner_text().strip() == 'Home')
        ok(n + 'Markets bar explains itself and has + Market Tab', pg.locator('.mktbar .mkttitle b').inner_text() == 'Markets' and pg.locator('.mktbar [data-act=mkt-add]').count() == 1 and pg.locator('.mktbar .mkttitle small').inner_text().strip() != '')
        ok(n + 'pie button shares the Markets heading row, no row of its own', pg.locator('.mktbar .mkthead .piebtn').count() == 1 and pg.locator('.grprow').count() == 0)
        pg.click('.mktbar [data-act=mkt-add]'); pg.wait_for_selector('#prompt-input, .dlg input, input[type=text]', timeout=4000)
        ok(n + 'no script errors', not errs, errs[:2])
        pg.context.close()
    b.close()
print('%d/%d' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
