import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  [' + str(x)[:220] + ']'))
U = 'http://localhost:8123/'
SEED = """async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
  commit((d)=>{const mk=(cur,ex,w,o)=>stamp({id:uid(),name:cur,cur,type:'crypto',open:o,include:true,archived:false,exchange:ex,wallet:w});
    d.accounts.push(mk('BTC','Bitget','Spot',0.5),mk('ETH','Binance','Spot',2),mk('BGB','Bitget','Spot',300),mk('MNT','Bybit','Spot',50),mk('BNB','Binance','Spot',1),mk('SOL','Bybit','Spot',4));
    d.settings.rates=d.settings.rates||{}; Object.assign(d.settings.rates,{BTC:5600000,USDT:58,ETH:200000,BGB:300,MNT:50,BNB:35000,SOL:9000});
    d.settings.tickers=d.settings.tickers||{}; d.settings.tickers.BTC={ticker:'BTC',price:5600000,priceDate:'2026-10-25',history:[]};});}"""
for design in ('theme1', 'legacy'):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
        pg.evaluate("async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}", design); pg.evaluate(SEED); pg.wait_for_timeout(300); n = design + ': '
        pg.goto(U + '#/accounts'); pg.wait_for_timeout(900)
        ok(n + 'one Crypto section, not a card per platform', pg.locator('[data-sec="acc-crypto"]').count() == 1 and pg.locator('.accinv .invplat').count() == 0)
        ok(n + 'Crypto section can be collapsed and expanded', pg.locator('[data-sec="acc-crypto"] > .collbody').is_visible())
        pg.click('[data-sec="acc-crypto"] > .collrow .collhead'); pg.wait_for_timeout(300)
        ok(n + 'collapsing hides the platforms', pg.locator('[data-sec="acc-crypto"] > .collbody').is_hidden())
        pg.click('[data-sec="acc-crypto"] > .collrow .collhead'); pg.wait_for_timeout(300)
        plats = pg.evaluate("[...document.querySelectorAll('[data-sec^=\"acc-crypto-\"] .collhead h2')].map(h=>h.textContent)")
        ok(n + 'platforms are listed inside it %s' % plats[:3], any('Bitget' in t for t in plats) and any('Bybit' in t for t in plats))
        ok(n + 'platforms start folded', pg.locator('[data-sec="acc-crypto-Bitget"] > .collbody').is_hidden())
        pg.click('[data-sec="acc-crypto-Bitget"] > .collrow .collhead'); pg.wait_for_timeout(300)
        ok(n + 'a platform expands in place to its products and the page does not change', pg.evaluate('location.hash') == '#/accounts' and pg.locator('[data-sec="acc-crypto-Bitget"] .invprod').count() >= 3)
        cols = pg.evaluate("new Set([...document.querySelectorAll('[data-sec=\"acc-crypto-Bitget\"] .invprod')].map(e=>e.style.getPropertyValue('--pc'))).size")
        ok(n + 'products carry different colours', cols >= 3, cols)
        pg.locator('[data-sec="acc-crypto-Bitget"] .invprod', has_text='BGB').first.click(); pg.wait_for_selector('#ad', timeout=5000)
        ok(n + 'tapping a product opens its sheet (no new page)', pg.evaluate('location.hash') == '#/accounts')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        # performance block
        pg.goto(U + '#/invest'); pg.wait_for_timeout(1200)
        ok(n + 'no cost list: one row per asset with an I paid button', pg.locator('.needcost .needrow').count() >= 5 and pg.locator('.needcost [data-act=inv-cost]').count() >= 5)
        ok(n + 'long list is cut to 4 with a Show more', pg.locator('.needcost > .needlist .needrow').count() == 4 and pg.locator('.needmore summary').count() == 1)
        vals = pg.evaluate("[...document.querySelectorAll('.needcost > .needlist .nval')].map(e=>parseFloat(e.textContent.replace(/[^0-9.]/g,'')))")
        ok(n + 'biggest value first %s' % vals, vals == sorted(vals, reverse=True))
        ok(n + 'price sources: your own prices listed with age and an Update price button', pg.locator('.pricesrc [data-act=inv-ticker]').count() >= 3 and pg.locator('.pricesrc .stale').count() >= 1 and 'days ago' in pg.locator('.pricesrc').inner_text())
        ok(n + 'old wall of text is gone', 'No known cost:' not in pg.inner_text('#view'))
        pg.click('.needcost [data-act=inv-cost]'); pg.wait_for_timeout(600)
        ok(n + 'I paid… still opens the cost form', pg.locator('#ad, .sheet, #ic, dialog').count() >= 1)
        ok(n + 'no script errors', not errs, errs[:2])
        b.close()
print('%d/%d' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
