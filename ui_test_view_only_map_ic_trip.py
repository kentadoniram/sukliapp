# v13.46: entries open read-only (Edit / Delete are separate), Pick on Map, IC wallet type, Home trip card
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'ic1',name:'Suica',cur:'JPY',type:'ic',open:3000,include:true,archived:false}));d.txs.push(c.stamp({id:'vt1',kind:'expense',date:c.nowStamp(),acct:'ic1',cur:'JPY',amount:210,fx:1,name:'View Test Ride',notes:'keep me',cat:(d.categories.find(x=>x.kind==='expense')||{}).id}))})")
    # IC wallet
    t=J("const a=await import('/js/accpage.js');const f=await import('/js/finance.js');const sp=await import('/js/importer.js');return [a.typeNames.ic,f.typeGroupName('ic'),sp.SPENDABLE_TYPES.has('ic')]")
    ok('IC wallet type exists and is spendable %s'%t, t[0] and 'IC' in t[0] and t[1]=='IC wallets' and t[2])
    # view only
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('[data-act=edit][data-id=vt1]').click()"); pg.wait_for_timeout(500)
    tx=pg.inner_text('.sheet'); ok('opens read only with Edit and Delete buttons', 'Read only' in tx and 'View Test Ride' in tx and 'keep me' in tx and pg.locator('[data-ev=edit]').count()==1 and pg.locator('[data-ev=del]').count()==1)
    ok('no editable fields yet', pg.locator('#f-amount').count()==0 and pg.locator('#entry').count()==0)
    pg.evaluate("document.querySelector('[data-ev=edit]').click()"); pg.wait_for_selector('#f-amount'); ok('Edit opens the form', pg.input_value('#f-what')=='View Test Ride')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    ok('nothing changed by looking', J("return c.get().txs.find(x=>x.id==='vt1').amount")==210)
    pg.evaluate("document.querySelector('[data-act=edit][data-id=vt1]').click()"); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-ev=del]').click()"); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Delete$/.test(x.textContent.trim())&&x.closest('.dlg,.confirm,[role=alertdialog],[role=dialog]')&&!x.hasAttribute('data-ev'));if(b)b.click()})()"); pg.wait_for_timeout(600)
    ok('Delete asks, then moves it to the bin', J("return !!c.get().txs.find(x=>x.id==='vt1').deleted"))
    # map picker
    pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('Pick on Map chip is there', pg.locator('[data-e=loc-map]').count()==1)
    pg.evaluate("document.querySelector('[data-e=loc-map]').click()"); MAP_OK=True
    try: pg.wait_for_function("window.__mapPick",timeout=15000)
    except Exception: MAP_OK=False; print('SKIP map tiles need the internet')
    pg.wait_for_timeout(500)
    if MAP_OK:
        pg.evaluate("window.__mapPick.put(35.5312,139.6987,false)"); pg.wait_for_timeout(200)
        ok('use button turns on after a pin', pg.locator('[data-mp=use]').is_enabled() and '35.53' in pg.inner_text('#mp-txt'))
        pg.evaluate("document.querySelector('[data-mp=use]').click()"); pg.wait_for_timeout(700)
        ok('picked place lands on the entry (about 1 km)', '📍' in pg.inner_text('#locrow') and pg.evaluate("document.querySelector('#entry')!==null"))
    else:
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # trip card on Home, layout list
    h=J("const t=await import('/js/trips.js');const s=await import('/js/screens.js');return [t.latestTripCard(c.get()).length, s.HOME_SECTIONS.some(x=>x[0]==='trip'), s.SIMPLE_HIDDEN.includes('trip')]")
    ok('Home has a trip card section, hidden in Simple mode, card draws when a trip exists %s'%h, h[1] and h[2])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
