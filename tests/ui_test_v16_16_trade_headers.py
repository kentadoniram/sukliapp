import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
res = []
def ok(n, c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    look = "async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}"
    pg.evaluate(look, 'theme1')
    pg.evaluate("""async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
      commit((d)=>{const mk=(cur,ex,o)=>stamp({id:uid(),name:cur,cur,type:'crypto',open:o,include:true,archived:false,exchange:ex,wallet:'Spot'});
        d.accounts.push(mk('BTC','Bitget',0.0213),mk('USDT','Bitget',1240.5),mk('BNB','Bitget',4.8));
        d.settings.rates=d.settings.rates||{}; Object.assign(d.settings.rates,{BTC:5600000,USDT:58,BNB:2400});});}""")
    # header: title beside the menu, tools on the row below
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(600)
    ok('Home header: small title beside the menu', pg.locator('.t1top .areatitle').inner_text().strip() == 'Home')
    ys = pg.evaluate("(()=>{const y=(s)=>document.querySelector(s).getBoundingClientRect().top;return [y('.t1top .burger'),y('.t1top .hbar .eyebtn, .t1top .hbar [data-act=eye]'),y('.t1top .mscard')]})()")
    ok('bell/eye/month sit on the row below the menu %s' % ys, ys[1] > ys[0] + 20 and abs(ys[1] - ys[2]) < 30)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(600)
    ok('Investments header shows its label beside the menu', 'Investments' in pg.locator('.t1top .areatitle').inner_text())
    # trade form
    pg.evaluate("async()=>{const t=await import('/js/trades.js');t.openTrade({platform:'Bitget'});}"); pg.wait_for_timeout(600)
    ok('platform is chosen once in a bar at the top', 'Bitget' in pg.locator('#tr-platbar').inner_text() and pg.locator('#tr-platbar').is_visible())
    ok('asset tiles show YOU GET / YOU PAY WITH', pg.locator('#cap-a').inner_text() == 'YOU GET' and pg.locator('#cap-c').inner_text() == 'YOU PAY WITH')
    pg.fill('input[name=qty]', '0.01'); pg.fill('input[name=price]', '98400'); pg.wait_for_timeout(200)
    ok('total is worked out', abs(float(pg.input_value('input[name=total]')) - 984) < 1e-6)
    ok('action button names the trade', pg.locator('.tr-go').inner_text().startswith('Buy 0.01'))
    pg.click('[data-know=total]'); pg.fill('input[name=total]', '492'); pg.wait_for_timeout(200)
    ok('"I know the Total" works out the quantity', abs(float(pg.input_value('input[name=qty]')) - 0.005) < 1e-9)
    pg.click('#tr-feerow'); pg.wait_for_timeout(200); ok('Fee row opens the fee panel', pg.locator('#tr-feepanel').is_visible())
    pg.click('[data-fm=pct]'); pg.fill('input[name=fee]', '0.1'); pg.wait_for_timeout(200)
    ok('fee row summarises the fee: %s' % pg.locator('#tr-feeval').inner_text(), '0.1%' in pg.locator('#tr-feeval').inner_text())
    pg.click('#tile-a'); pg.wait_for_timeout(400)
    ok('picker lists what you hold on this platform first', pg.locator('.tr-pick .tr-ph b').first.inner_text().startswith('On Bitget') and pg.locator('.tr-pick .tr-prow').count() >= 2)
    pg.click('.tr-pick .tr-prow:has-text("BNB")'); pg.wait_for_timeout(400)
    ok('picking a coin updates the tile', 'BNB' in pg.locator('#tile-a').inner_text())
    pg.click('[data-side=convert]'); pg.wait_for_timeout(300)
    ok('Convert shows CONVERT FROM / INTO and opens the fee panel', pg.locator('#cap-b').is_visible() and pg.locator('#tr-feepanel').is_visible())
    ok('no script errors %s' % errs, not errs)
    b.close()
print('%d/%d passed' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
