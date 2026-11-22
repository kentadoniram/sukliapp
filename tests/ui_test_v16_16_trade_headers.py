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
    ok('Home header: small title beside the menu', pg.locator('.t1top .areatitle.on').inner_text().strip() == 'Home')
    ys = pg.evaluate("(()=>{const y=(s)=>document.querySelector(s).getBoundingClientRect().top;return [y('.t1top .burger'),y('.t1top .hbar .eyebtn, .t1top .hbar [data-act=eye]'),y('.t1top .mscard')]})()")
    ok('bell/eye/month sit on the row below the menu %s' % ys, ys[1] > ys[0] + 20 and abs(ys[1] - ys[2]) < 30)
    ok('Home title is large', float(pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.areatitle.on')).fontSize)")) >= 22)
    ok('no blue dot beside the title', pg.evaluate("getComputedStyle(document.querySelector('.areatitle.on'),'::before').content") in ('none', 'normal'))
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(600)
    ok('Investments header shows its label beside the menu', 'Investments' in pg.locator('.t1top .areatitle.on').inner_text())
    hh = pg.evaluate("(()=>{window.__h=0;return 0})()")
    inv = pg.evaluate("(()=>{const e=document.querySelector('.inv-card .sc-front');if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.height),getComputedStyle(e).backgroundImage.indexOf('gradient')>=0,!!document.querySelector('.inv-card .sc-spark'),getComputedStyle(document.querySelector('.inv-card .sc-net b')).fontSize]})()")
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(600)
    home = pg.evaluate("(()=>{const e=document.querySelector('.main-home-card .sc-front');return [Math.round(e.getBoundingClientRect().height),getComputedStyle(e).backgroundImage,getComputedStyle(document.querySelector('.main-home-card .sc-net b')).fontSize]})()")
    ok('Investments card: same height, type size and graph as Home %s %s' % (inv, home[0]), inv and abs(inv[0] - home[0]) <= 2 and inv[1] and inv[2] and inv[3] == home[2])
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(600)
    ok('Investments card has its own colours', inv and pg.evaluate("getComputedStyle(document.querySelector('.inv-card .sc-front')).backgroundImage") != home[1])
    # trade form
    pg.evaluate("async()=>{const t=await import('/js/trades.js');t.openTrade({platform:'Bitget'});}"); pg.wait_for_timeout(600)
    ok('platform is chosen once in a bar at the top', 'Bitget' in pg.locator('#tr-platbar').inner_text() and pg.locator('#tr-platbar').is_visible())
    ok('asset tiles show YOU GET / YOU PAY WITH', pg.locator('#cap-a').inner_text() == 'YOU GET' and pg.locator('#cap-c').inner_text() == 'YOU PAY WITH')
    pg.fill('input[name=qty]', '0.01'); pg.fill('input[name=price]', '98400'); pg.wait_for_timeout(200)
    ok('total is worked out', abs(float(pg.input_value('input[name=total]')) - 984) < 1e-6)
    ok('action button names the trade', pg.locator('.tr-go').inner_text().startswith('Buy 0.01'))
    pg.click('[data-know=total]'); pg.fill('input[name=total]', '492'); pg.wait_for_timeout(200)
    ok('"I know the Total" works out the quantity', abs(float(pg.input_value('input[name=qty]')) - 0.005) < 1e-9)
    ok('the three fee options are always shown and there is no Edit button on Fee', pg.locator('[data-fm]').count() == 3 and pg.locator('[data-fm=none]').is_visible() and not pg.locator('#tr-feerow').count() and not pg.locator('#feedet').is_visible())
    pg.click('[data-fm=pct]'); pg.fill('input[name=fee]', '0.1'); pg.wait_for_timeout(200)
    ok('fee amount and responsibility sit side by side', abs(pg.locator('[name=fee]').bounding_box()['y'] - pg.locator('[data-resp=maker]').bounding_box()['y']) < 40 and pg.locator('#feedet').is_visible())
    ok('Record button is a normal primary button, not a floating block', not pg.locator('.tr-foot').count() and pg.locator('.tr-go').locator('xpath=..').get_attribute('class').startswith('btnrow') and pg.locator('.tr-go.btn:not(.ghost)').count() == 1)
    pg.click('#tile-a'); pg.wait_for_timeout(400)
    ok('picker lists what you hold on this platform first', pg.locator('.tr-pick .tr-ph b').first.inner_text().startswith('On Bitget') and pg.locator('.tr-pick .tr-prow').count() >= 2)
    pg.click('.tr-pick .tr-prow:has-text("BNB")'); pg.wait_for_timeout(400)
    ok('picking a coin updates the tile', 'BNB' in pg.locator('#tile-a').inner_text())
    pg.click('[data-side=convert]'); pg.wait_for_timeout(300)
    ok('Convert shows CONVERT FROM / INTO', pg.locator('#cap-b').is_visible())
    ok('no script errors %s' % errs, not errs)
    b.close()
print('%d/%d passed' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
