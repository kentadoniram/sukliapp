# v13.28: card reminder opens the payment window; Safe to spend (money minus what is already owed)
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(()=>{const s=window.sukli;s.commit(d=>{d.settings.mode='advanced';const home=d.settings.homeCur||'PHP';d.accounts.push({id:'cardsafe',name:'Safe Card',cur:home,type:'card',open:0,include:false,archived:false,stmtDay:11,dueDay:1,limit:900000,updatedAt:Date.now()});
      d.txs.push({id:'cs1',kind:'expense',amount:12345,cur:home,fx:1,date:new Date().toISOString().slice(0,10)+' 12:00:00',name:'Card buy',cat:d.categories.find(c=>!c.deleted).id,acct:'cardsafe',updatedAt:Date.now()});});})()""")
    s=pg.evaluate("(async()=>{const m=await import('/js/safe.js');const c=await import('/js/core.js');const r=m.safeToSpend(c.get());return [r.money,r.committed,r.safe,r.items.map(x=>x.name)]})()")
    ok('card owed counts as committed %s'%s, s[1]>=12345-0.01 and 'Safe Card' in s[3] and abs(s[0]-s[1]-s[2])<0.01)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(900)
    t=pg.inner_text('#view'); ok('Home shows Safe to spend', 'Safe to spend' in t and 'already owed' in t)
    pg.evaluate("document.querySelector('[data-act=safe-info]').click()"); pg.wait_for_selector('.sheet'); ok('breakdown lists the card', 'Safe Card' in pg.inner_text('.sheet') and 'Safe to spend' in pg.inner_text('.sheet'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const b=document.createElement('button');b.dataset.act='card-pay';b.dataset.id='cardsafe';b.id='tmpb';document.body.appendChild(b);b.click();})()"); pg.wait_for_timeout(800)
    tx=pg.inner_text('.sheet, #entry, .entry') if pg.locator('.sheet, #entry, .entry').count() else ''
    ok('payment window opens as a debt payment', 'I paid a debt' in tx or 'Paid from' in tx)
    ok('amount filled with what is owed', '12,345' in tx or '12345' in pg.evaluate("document.body.innerText.replace(/,/g,'')"))
    ok('no errors %s'%errs, not errs)
    print('fails', res.count(False)); b.close()
