import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  [' + str(x)[:200] + ']'))
U = 'http://localhost:8123/'
SEED = """async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
  commit((d)=>{const mk=(cur,ex,w,o)=>stamp({id:uid(),name:cur,cur,type:'crypto',open:o,include:true,archived:false,exchange:ex,wallet:w});
    d.accounts.push(mk('BTC','Bitget','Spot',0.5),mk('USDT','Bitget','Spot',100),mk('ETH','Kraken2','Spot',2));
    d.settings.rates=d.settings.rates||{}; Object.assign(d.settings.rates,{BTC:5600000,USDT:58,ETH:200000});
    const day=(n)=>{const x=new Date(Date.now()-n*864e5);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
    d.settings.tickers=d.settings.tickers||{}; d.settings.tickers.BTC={ticker:'BTC',price:5600000,history:[{date:day(3),price:5000000,ts:1},{date:day(1),price:5000000,ts:2},{date:day(0),price:5500000,ts:3}]};});}"""
for design in ('theme1', 'legacy'):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
        pg.evaluate("async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}", design)
        pg.evaluate(SEED); pg.wait_for_timeout(300); n = design + ': '
        # 1 one card per platform
        pg.goto(U + '#/accounts'); pg.wait_for_timeout(800)
        names = pg.evaluate("[...document.querySelectorAll('.accinv .invplat .ic-t')].map(e=>e.textContent)")
        ok(n + 'each platform has its own card %s' % names, 'Bitget' in names and 'Kraken2' in names and len(names) == len(set(names)) and pg.locator('.accinv .invplat').count() == len(names))
        ok(n + 'no single grouped investment list remains', pg.locator('.invblock .calfacts.wtots').count() == 0)
        # 3 switch
        sw = pg.locator('[data-act=accside]')
        ok(n + 'Assets / Liabilities switch with two choices', sw.count() == 2 and pg.locator('[data-act=accside][aria-pressed=true]').inner_text() == 'Assets')
        if design == 'theme1': ok(n + 'it is the Theme 1 .t1seg', pg.locator('.accside .t1seg').count() == 1)
        ok(n + 'Assets view shows investments and no liability rows', pg.locator('.accinv').count() == 1 and pg.evaluate("[...document.querySelectorAll('.topgrp h2')].every(h=>h.textContent!=='Liabilities')"))
        pg.click('[data-act=accside][data-v=liabs]'); pg.wait_for_timeout(400)
        ok(n + 'Liabilities view hides assets and investment cards', pg.locator('.accinv').count() == 0 and pg.locator('.topgrp.assets').count() == 0 and pg.locator('.topgrp.liabs').count() == 1)
        pg.reload(); pg.wait_for_timeout(1200)
        ok(n + 'the choice is remembered', pg.locator('[data-act=accside][aria-pressed=true]').inner_text() == 'Liabilities')
        pg.click('[data-act=accside][data-v=assets]'); pg.wait_for_timeout(400)
        # card opens platform in Investments
        pg.locator('.accinv .invplat', has_text='Bitget').click(); pg.wait_for_timeout(900)
        ok(n + 'tapping a platform card opens that platform in Investments', pg.evaluate('location.hash').startswith('#/invest') and pg.locator('.invpage.sec-platform').count() == 1 and 'Bitget' in pg.locator('.plat-hero').inner_text())
        # 2 platform card
        t = pg.locator('.plat-hero').inner_text()
        ok(n + 'platform card shows Total asset value, Daily PnL and Overall PnL', 'Total asset value' in t and 'Daily PnL' in t and 'Overall PnL' in t)
        # BTC 0.5: price 5,000,000 -> 5,500,000 today = +250,000 ; USDT has no history so it adds nothing
        ok(n + 'Daily PnL = units at yesterday close x price move (+250,000 on 0.5 BTC)', '250,000' in t and '+' in t, t.replace('\n', ' | '))
        ok(n + 'Daily PnL is not the overall PnL', pg.locator('.plat-hero .dpnl, .plat-hero .dpnl-l').count() >= 1 and pg.locator('.plat-hero .opnl-l, .plat-hero .sc-row').count() >= 1)
        if design == 'theme1':
            ok(n + 'it is the same card kind as the Home card', pg.locator('.plat-hero.main-home-card.inv-card').count() == 1 and pg.locator('.plat-hero .sc-rows .sc-row').count() == 2)
        ok(n + 'no script errors', not errs)
        b.close()
# 4 header
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, one in ((390, False), (560, True)):
        pg = b.new_context(service_workers='block', viewport={'width': w, 'height': 800}).new_page(); pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
        pg.evaluate("async()=>{const a=await import('/js/appearance.js');a.setLook({design:'theme1',theme:'light'});}"); pg.goto(U + '#/home'); pg.wait_for_timeout(700)
        g = pg.evaluate("(()=>{const r=s=>{const e=document.querySelector(s).getBoundingClientRect();return {l:e.left,t:e.top,c:e.top+e.height/2,h:e.height,r:e.right}};return {bu:r('.t1top .burger'),be:r('.bellbtn'),ey:r('.t1top .hbar .eyebtn, .t1top .hbar [data-act=eye]'),mo:r('.t1top .mscard')}})()")
        cen = [g['be']['c'], g['ey']['c'], g['mo']['c']]
        ok('header %d: bell, eye and month share one centre line' % w, max(cen) - min(cen) < 1.5)
        if one: ok('header %d wide: they sit on the burger row' % w, abs(g['be']['c'] - g['bu']['c']) < 1.5)
        else: ok('header %d narrow: second row starts under the burger (left edges match)' % w, abs(g['be']['l'] - g['bu']['l']) < 1.5)
        ok('header %d: month selector ends at the right edge like the cards' % w, g['mo']['r'] > w - 24)
        ok('header %d: no sideways scroll' % w, pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        pg.goto(U + '#/invest'); pg.wait_for_timeout(700)
        g2 = pg.evaluate("(()=>{const r=s=>{const e=document.querySelector(s).getBoundingClientRect();return {l:e.left,c:e.top+e.height/2}};return {bu:r('.t1top .burger'),ey:r('.t1top .hbar .eyebtn, .t1top .hbar [data-act=eye]'),ch:r('.t1top .hbar .curchip')}})()")
        ok('Investments header %d: eye and currency chip on one centre line' % w, abs(g2['ey']['c'] - g2['ch']['c']) < 1.5 and (one or abs(g2['ey']['l'] - g2['bu']['l']) < 1.5))
print('%d/%d' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
