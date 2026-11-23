import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  [' + str(x)[:220] + ']'))
U = 'http://localhost:8123/'
SEED = """async()=>{const c=await import('/js/core.js');const {uid,stamp,commit}=c;
  commit((d)=>{const mk=(cur,ex,w,o)=>stamp({id:uid(),name:cur,cur,type:'crypto',open:o,include:true,archived:false,exchange:ex,wallet:w});
    d.accounts.push(mk('BTC','Bitget','Spot',0.5),mk('ETH','Binance','Spot',2),mk('BGB','Bitget','Spot',300));
    d.accounts.push(stamp({id:'cashjp',name:'Wallet JP',cur:'JPY',type:'cash',open:200000,include:true,archived:false}));
    d.accounts.push(stamp({id:'benphp',name:'Ben',person:'Ben',cur:'PHP',type:'owed',open:0,include:true,archived:false}));
    d.settings.rates=d.settings.rates||{}; Object.assign(d.settings.rates,{BTC:5600000,ETH:200000,BGB:300,JPY:0.4});
    const cat=d.categories.find(x=>!x.deleted&&x.kind==='expense'); d.txs.push(stamp({id:'tg1',kind:'expense',date:'2026-11-20',name:'Fuji',amount:500,cur:'PHP',fx:1,cat:cat.id,acct:'benphp',toAcct:'',labels:'daytrip, fuji, hike',items:[],createdAt:1}));});}"""
for design in ('theme1', 'legacy'):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(U); pg.wait_for_selector('#first-file', state='attached'); pg.set_input_files('#first-file', '/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
        pg.evaluate("async(d)=>{const a=await import('/js/appearance.js');a.setLook({design:d,theme:'light'});}", design); pg.evaluate(SEED); pg.wait_for_timeout(300); n = design + ': '
        # 1 Investments > Accounts folds in place
        pg.goto(U + '#/invest'); pg.wait_for_timeout(900); pg.click('[data-act=inv-sec][data-v=accounts]'); pg.wait_for_timeout(600)
        ok(n + 'every category is a collapsible section on this page', pg.locator('.invacc > [data-sec^="ia-"]').count() == 4 and pg.locator('.invcat').count() == 0)
        ok(n + 'no separate category page / back link', pg.locator('.invback').count() == 0)
        pg.click('[data-sec="ia-crypto"] > .collrow .collhead'); pg.wait_for_timeout(250)
        ok(n + 'a category collapses', pg.locator('[data-sec="ia-crypto"] > .collbody').is_hidden())
        pg.click('[data-sec="ia-crypto"] > .collrow .collhead'); pg.wait_for_timeout(250)
        ok(n + 'platforms are inside, folded', pg.locator('[data-sec^="ia-crypto-"]').count() >= 2 and pg.locator('[data-sec="ia-crypto-Bitget"] > .collbody').is_hidden())
        pg.click('[data-sec="ia-crypto-Bitget"] > .collrow .collhead'); pg.wait_for_timeout(250)
        ok(n + 'a platform expands in place to its products; still on Investments', pg.locator('[data-sec="ia-crypto-Bitget"] .invprod').count() >= 2 and pg.evaluate('location.hash').startswith('#/invest'))
        pg.locator('[data-sec="ia-crypto-Bitget"] [data-act=inv-plat]').click(); pg.wait_for_timeout(700)
        ok(n + 'Open <platform> goes to that platform tab', pg.locator('.plat-hero').count() == 1)
        # 2 categories sheet
        pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openCategoryPicker('expense',()=>{})}"); pg.wait_for_selector('#catlist .catgroup'); pg.wait_for_timeout(300)
        ng, npl = pg.locator('#catlist .catgroup').count(), pg.locator('#catlist .grpplus').count()
        ok(n + 'a + beside every group %d/%d' % (npl, ng), ng > 3 and ng == npl)
        g = pg.locator('#catlist .catgroup').first; gname = g.locator('.ghname').inner_text()
        g.locator('.grpplus').click(); pg.wait_for_selector('#catform')
        ok(n + 'the + opens New category with that group already filled', pg.input_value('#catform input[name=g]') == gname, gname)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pos = pg.evaluate("(()=>{const nb=document.querySelector('.sheet-body > .newcat'),sb=nb.closest('.sheet'),r=nb.getBoundingClientRect(),s=sb.getBoundingClientRect();return {pos:getComputedStyle(nb).position,vis:r.bottom<=s.bottom+2&&r.top>=s.top}})()")
        ok(n + '+ New category stays in view (sticky, visible without scrolling)', pos['pos'] == 'sticky' and pos['vis'], pos)
        pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove());document.body.classList.remove('noscroll')")
        # 3 icons
        ic = pg.evaluate("async()=>{const m=await import('/js/caticons.js');return [m.ICONS.cablecar&&m.ICONS.cablecar[0],m.ICONS.chairlift&&m.ICONS.chairlift[0],m.guessIcon('Mt Fuji ropeway','Transportation'),m.guessIcon('Ski lift ticket','Transportation'),m.ICON_KEYS.includes('cablecar')&&m.ICON_KEYS.includes('chairlift')]}")
        ok(n + 'cable car and chairlift icons exist and are guessed from names %s' % ic, ic == ['Cable Car', 'Chairlift', 'cablecar', 'chairlift', True])
        # 4 tags pill
        pg.goto(U + '#/ledger'); pg.wait_for_timeout(900)
        pill = pg.locator('.row', has_text='Fuji').first.locator('.tagpill')
        ok(n + 'an entry with 3 tags shows a # pill with the count', pill.count() == 1 and pill.inner_text().strip() == '#3', pill.count())
        vis = pg.evaluate("(()=>{const e=document.querySelector('.tagpill'),r=e.getBoundingClientRect();return r.width>0&&r.right<=innerWidth})()")
        ok(n + 'the pill is on screen', vis)
        # 5 lend in a new currency
        pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',debt:true,flow:'lend',acctTouched:true,acct:'cashjp',toAcct:'benphp',amount:'10000'}})}"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
        pg.click('[data-e=save]'); pg.wait_for_timeout(600)
        txt = pg.inner_text('.confirm-text') if pg.locator('.confirm-text').count() else ''
        ok(n + 'warns that a new currency will be added for the person', 'JPY' in txt and 'new currency' in txt and 'Ben' in txt, txt)
        before = pg.evaluate("async()=>{const c=await import('/js/core.js');return c.get().accounts.filter(a=>!a.deleted&&a.name==='Ben').length}")
        pg.click('[data-yes]'); pg.wait_for_timeout(900)
        info = pg.evaluate("async()=>{const c=await import('/js/core.js'),d=c.get();const bens=d.accounts.filter(a=>!a.deleted&&a.name==='Ben');const t=d.txs.filter(x=>!x.deleted&&x.lent).pop();return {n:bens.length,curs:bens.map(a=>a.cur).sort().join(),t:t&&{amount:t.amount,cur:t.cur,toAmount:t.toAmount,to:(bens.find(a=>a.id===t.toAcct)||{}).cur}}}")
        ok(n + 'JPY account added under Ben (PHP kept) %s' % info, before == 1 and info['n'] == 2 and info['curs'] == 'JPY,PHP')
        ok(n + 'the entry is ¥10,000 into Ben JPY, nothing converted to PHP', info['t'] and info['t']['amount'] == 10000 and info['t']['cur'] == 'JPY' and info['t']['to'] == 'JPY' and info['t']['toAmount'] == 10000, info)
        pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',debt:true,flow:'lend',acctTouched:true,acct:'cashjp',toAcct:'benphp',amount:'500'}})}"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(500)
        pg.click('[data-e=save]'); pg.wait_for_timeout(900)
        info2 = pg.evaluate("async()=>{const c=await import('/js/core.js'),d=c.get();return {warn:!!document.querySelector('.confirm-text'),bens:d.accounts.filter(a=>!a.deleted&&a.name==='Ben').length,lent:d.txs.filter(x=>!x.deleted&&x.lent).length}}")
        ok(n + 'a currency the person already has: no warning, no extra account', not info2['warn'] and info2['bens'] == 2 and info2['lent'] == 2, info2)
        ok(n + 'no script errors', not errs, errs[:2])
        b.close()
print('%d/%d' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
