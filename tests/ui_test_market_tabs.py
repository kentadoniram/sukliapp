# v15.35: user-made market tabs on Investments filter the list; All shows everything
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'mp2a',name:'MP2 Savings',cur:'PHP',type:'invest',invtab:true,open:50000,include:true,archived:false}),c.stamp({id:'stk1',name:'Index Fund',cur:'JPY',type:'invest',invtab:true,open:100000,include:true,archived:false}));d.settings.marketTabs=[{id:'t1',name:'MP2',ids:['mp2a']}]})})()""")
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    t=pg.inner_text('.invpage'); ok('both shown on All', 'MP2 Savings' in t and 'Index Fund' in t)
    ok('tab strip lists All and MP2', pg.locator('.mktbar .wtab').count()==2)
    pg.locator('.mktbar .wtab', has_text='MP2').click(); pg.wait_for_timeout(500)
    t=pg.inner_text('.invpage'); ok('MP2 tab shows only MP2 Savings', 'MP2 Savings' in t and 'Index Fund' not in t)
    pg.locator('.mktbar .wtab', has_text='All').click(); pg.wait_for_timeout(500)
    ok('All back to both', 'Index Fund' in pg.inner_text('.invpage'))
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
