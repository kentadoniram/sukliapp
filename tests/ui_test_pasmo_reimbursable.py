# v15.32 PASMO reimbursable: v15.25: Pasmo purchases: category groups, merchant+branch from the place, split into items, whole-bill discount and tax
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
TXT="""23:28
Balance
¥5,809 Add Money
Latest Transactions
7-Eleven Shinjuku Nishiguchi ¥320 >
Purchase
2 hours ago
Lawson Kawasaki ¥210 >
Purchase
Yesterday"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.categories.push(c.stamp({id:'cvs',name:'Convenience Store',group:'Food & Drinks',kind:'expense'}),c.stamp({id:'fdb',name:'Food and Drinks',group:'Food & Drinks',kind:'expense'}));
      d.accounts.push(c.stamp({id:'pm1',name:'Pasmo',cur:'JPY',type:'ic',open:6000,include:true,archived:false}));
      d.txs.push(c.stamp({id:'h1',kind:'expense',amount:300,cur:'JPY',fx:1,date:'2026-10-01 09:00:00',name:'Snack',cat:'cvs',acct:'pm1',merchant:'7-Eleven',branch:'Shinjuku Nishiguchi'}),
                 c.stamp({id:'h2',kind:'expense',amount:300,cur:'JPY',fx:1,date:'2026-10-02 09:00:00',name:'Snack',cat:'cvs',acct:'pm1',merchant:'7-Eleven',branch:'Tokyo Station'}))})})()""")
    pg.evaluate("window.__walletText="+__import__('json').dumps(TXT))
    open('/tmp/blank.png','wb').write(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082'))
    pg.evaluate("(async()=>{(await import('/js/ui.js')).ACT['wallet-scan']()})()"); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=15000)
    ok('two purchase rows with six group chips each', pg.locator('.wsbuy').count()==2 and pg.locator('.wsbuy').first.locator('.wsgroups .chip, .wsgroups button').count()==6)
    mer=pg.locator('input.wsmer[data-k=merchant]'); br=pg.locator('input.wsmer[data-k=branch]')
    vals=[(mer.nth(i).input_value(),br.nth(i).input_value()) for i in range(2)]
    ok('7-Eleven row: merchant and the branch you already have %s'%vals, any(m=='7-Eleven' and b_=='Shinjuku Nishiguchi' for m,b_ in vals))
    ok('Lawson row: merchant Lawson, branch from the place text %s'%vals, any(m=='Lawson' and b_=='Kawasaki' for m,b_ in vals))
    sel=pg.evaluate("Array.from(document.querySelectorAll('.wscat')).map(s=>s.options[s.selectedIndex].text)")
    ok('convenience store category chosen first %s'%sel, any('Convenience' in x for x in sel))
    pg.locator('.wsgroups').first.get_by_text('Food and Beverages').click(); pg.wait_for_timeout(300)
    ok('group tap shows only that group\'s categories as quick chips', 'Food and Drinks' in pg.locator('.wsquick').first.inner_text())
    pg.locator('[data-act=ws-reimb]').first.click(); pg.wait_for_timeout(300)
    ok('a purchase can be marked Reimbursable', 'Reimbursable: On' in pg.locator('.wsbuy').first.inner_text())
    pg.locator('[data-act=ws-rides]').click(); pg.wait_for_selector('#ws-co'); pg.fill('#ws-co','Acme Corp')
    ok('the rides switch asks who pays you back', pg.locator('#ws-co').input_value()=='Acme Corp')
    pg.locator('[data-act=ws-add]').click(); pg.wait_for_timeout(700)
    flagged=pg.evaluate("window.sukli.get().txs.filter(x=>!x.deleted&&x.reimb).map(x=>[x.name,x.reimb.co,x.reimb.st])")
    ok('exactly the marked purchase is saved as reimbursable, waiting, for Acme Corp %s'%flagged, len(flagged)==1 and flagged[0][1]=='Acme Corp' and flagged[0][2]=='pending' and flagged[0][0].startswith('Purchase'))
    ok('the company is remembered for next time', pg.evaluate("window.sukli.get().settings.lastReimbCo")=='Acme Corp')
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
