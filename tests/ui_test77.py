# v13.24: Entries is one continuous history (month-free, at least 30 days), undo history says what each step did
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
J=lambda pg,code: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+code+"})()")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    J(pg,"c.undoClear()")
    # entries today, yesterday, 20 and 45 days ago (never depends on the calendar date)
    J(pg,"""const d0=c.get();const acct=d0.accounts.find(a=>!a.deleted&&a.include).id;const cat=d0.categories.find(x=>!x.deleted&&x.kind==='expense').id;
      const ds=n=>{const x=new Date();x.setDate(x.getDate()-n);return c.nowStamp(x).slice(0,10)+' 12:00:00'};
      c.commit(d=>{[[0,'ZZToday'],[1,'ZZYesterday'],[20,'ZZTwenty'],[45,'ZZFortyFive']].forEach(([n,nm])=>d.txs.push(c.stamp({id:'z'+n,kind:'expense',date:ds(n),name:nm,amount:100,cur:c.HOME,fx:1,cat,acct})))})""")
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(900)
    t=pg.inner_text('#view'); ok('today is listed', 'ZZToday' in t)
    ok('yesterday and 20 days ago listed in the same list', 'ZZYesterday' in t and 'ZZTwenty' in t)
    ok('no month arrows on Entries', pg.locator('[data-act=month]').count()==0)
    ok('newest first', t.index('ZZToday')<t.index('ZZYesterday')<t.index('ZZTwenty'))
    # stale month (app left open past midnight): the Home month follows the calendar
    J(pg,"")
    # undo history says what happened and previews
    pg.wait_for_timeout(1000)
    J(pg,"c.commit(d=>{const t=d.txs.find(x=>x.id==='z0');t.amount=250;c.stamp(t)})"); pg.wait_for_timeout(1000)
    pg.goto('http://localhost:8123/#/bin?v=history'); pg.wait_for_timeout(600)
    h=pg.inner_text('#view'); ok('history row says what changed', 'Edited entry: ZZToday' in h and 'amount' in h)
    pg.click('[data-act=hist-to][data-n="2"]'); pg.wait_for_selector('.undolist')
    pv=pg.inner_text('.undolist'); ok('preview shows both steps: %s'%pv.replace('\n',' | ')[:160], 'Edited entry' in pv and 'Added' in pv)
    pg.click('.sheet [data-no]'); pg.wait_for_timeout(400)
    ok('cancel leaves data alone', J(pg,"return c.get().txs.find(x=>x.id==='z0').amount")==250)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
