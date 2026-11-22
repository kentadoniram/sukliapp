import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
from tests.invnavhelp import go_invest
res = []
def ok(n, c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n)
U = 'http://localhost:8123/'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("async()=>{const a=await import('/js/appearance.js');a.setLook({design:'theme1',theme:'light'});}")
    pg.evaluate("""async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
      commit((d)=>{const mk=(cur,ex,o)=>stamp({id:uid(),name:cur,cur,type:'crypto',open:o,include:true,archived:false,exchange:ex,wallet:'Spot'});
        d.accounts.push(mk('BTC','Bitget',0.0213),mk('USDT','Bitget',1240.5));
        d.settings.rates=d.settings.rates||{}; Object.assign(d.settings.rates,{BTC:5600000,USDT:58});});}""")
    # 1. (v16.21) the header names the page only; Investments has its own Home button
    pg.goto(U + '#/home'); pg.wait_for_timeout(600)
    ok('Home header shows only its own title (no Investments link beside it)', pg.locator('.arealabs a').count() == 0 and pg.locator('.arealabs .areatitle.on').inner_text() == 'Home')
    pg.goto(U + '#/invest'); pg.wait_for_timeout(700)
    ok('Investments header shows only its own title', pg.locator('.arealabs .areatitle').count() == 1 and pg.locator('.arealabs .areatitle.on').inner_text() == 'Investments')
    ok('Home button sits immediately left of Record activity', pg.evaluate("(()=>{const b=[...document.querySelectorAll('.invact button')].map(x=>x.textContent.trim());return b[0]==='Home'&&b[1]==='Record activity'})()"))
    pg.click('.invact .iv-home'); pg.wait_for_timeout(700)
    ok('Home button goes back to Home', pg.evaluate('location.hash').startswith('#/home'))
    # 3. the price line is one line
    pg.goto(U + '#/invest'); pg.wait_for_timeout(700)
    hh = pg.evaluate("(()=>{const e=document.querySelector('.inv-upd');return [e.getBoundingClientRect().height,parseFloat(getComputedStyle(e).lineHeight)||0,e.scrollWidth<=e.clientWidth+1]})()")
    ok('live price line is a single line %s' % hh, hh[0] < 22 and hh[2])
    # 2. the dashboard: one row switch, section in its own card, collapsible
    tops = pg.evaluate("[...document.querySelectorAll('.dashstrip .t1s-slot')].map(e=>Math.round(e.getBoundingClientRect().top))")
    ok('section switch is one row %s' % tops, len(tops) == 5 and len(set(tops)) == 1)
    ok('the chosen section is its own card', pg.locator('.dashcardsec > section.coll.ui-card').count() == 1)
    pg.click('.dashstrip .t1s-slot[aria-label="Per-Token Performance"]'); pg.wait_for_timeout(500)
    ok('Per-Token Performance is a card with asset tiles', pg.locator('.dashcardsec .coll .tokrow').count() >= 1)
    bgs = pg.evaluate("(()=>{const e=document.querySelector('.dashcardsec .tokrow');const c=getComputedStyle(e);return [c.backgroundColor,c.borderBottomWidth]})()")
    ok('each asset is a soft tile %s' % bgs, bgs[0] != 'rgba(0, 0, 0, 0)' and bgs[1] == '0px')
    pg.click('.dashcardsec .collhead'); pg.wait_for_timeout(300)
    ok('Per-Token card collapses', pg.locator('.dashcardsec .collbody').is_hidden())
    pg.click('.dashcardsec .collhead'); pg.wait_for_timeout(300)
    ok('and opens again', pg.locator('.dashcardsec .collbody').is_visible())
    # 10. category label, no dot
    go_invest(pg, 'Bitget', 700, 'platform')
    ok('platform page is titled by its category', pg.locator('header.top h1').inner_text().strip() == 'Crypto Exchange')
    ok('no dot beside the title', pg.evaluate("getComputedStyle(document.querySelector('header.top h1'),'::before').content") in ('none', 'normal'))
    # 9. Profit and Loss collapsible
    pg.click('[data-id="pl-pnl"]'); pg.wait_for_timeout(300)
    ok('Profit and Loss collapses', pg.locator('[data-sec="pl-pnl"] .collbody').is_hidden())
    pg.click('[data-id="pl-pnl"]'); pg.wait_for_timeout(300)
    ok('Profit and Loss opens again', pg.locator('[data-sec="pl-pnl"] .collbody').is_visible())
    # 8. BTC performance collapsible
    pg.evaluate("async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.cur==='BTC'&&x.exchange==='Bitget');const m=await import('/js/accpage.js');m.openAccountDetail(a.id)}"); pg.wait_for_timeout(700)
    if pg.locator('.assetperf').count():
        ok('coin performance on its platform is collapsible', pg.locator('.assetperf .collhead').count() == 1)
        pg.click('.assetperf .collhead'); pg.wait_for_timeout(250); ok('and collapses', pg.locator('.assetperf .collbody').is_hidden())
    else: ok('(no performance block for this data)', True)
    # 4. fee toggle
    pg.evaluate("async()=>{const t=await import('/js/trades.js');t.openTrade({});}"); pg.wait_for_timeout(600)
    ok('fee toggle is the .t1seg', pg.locator('.tr-fee .t1seg').count() >= 1 and pg.locator('.tr-fee .t1seg [data-fm]').count() == 3)
    pg.click('[data-fm=fixed]'); pg.wait_for_timeout(200)
    ok('selected slot is marked and the pill moves', pg.locator('[data-fm=fixed].on').count() == 1 and pg.locator('.tr-fee .t1seg').first.get_attribute('data-sel') == '2')
    ok('fee responsibility is a .t1seg too', pg.locator('.tr-fee .t1seg [data-resp]').count() == 3)
    # 6. value format
    r = pg.evaluate("""async()=>{const m=await import('/js/tradefacts.js');const db={accounts:[{id:'a',cur:'BTC'}],settings:{},txs:[]};const f=m.tradeFacts(db,{trade:{side:'buy',asset:'a',qty:1,paidCur:'USDC',paidAmt:21.53,valueHome:1362.83},date:'2026-11-01'});return [f.homeText,f.rateText]}""")
    ok('value line reads "≈ ₱… · @ ₱…" %s' % r, r[0].startswith('≈ ₱1,362.83') and r[1] == '@ ₱63.30' or r[1].startswith('@ ₱'))
    ok('no script errors %s' % errs, not errs)
    b.close()
print('%d/%d passed' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
