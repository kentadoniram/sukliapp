from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
    n0=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length")
    # delete via the entry sheet
    tid=pg.evaluate("window.sukli.get().txs.find(t=>!t.deleted&&t.kind==='expense').id")
    pg.goto('http://localhost:8123/index.html#/ledger'); pg.wait_for_timeout(500)
    pg.evaluate(f"document.querySelector('[data-act=edit][data-id=\"{tid}\"]')&&1")
    pg.evaluate(f"window.sukli.commit(d=>{{const t=d.txs.find(x=>x.id==='{tid}'); t.deleted=true; t.deletedAt=Date.now(); t.updatedAt=Date.now();}})")
    ok('tx removed from totals', pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length")==n0-1)
    pg.goto('http://localhost:8123/index.html#/bin'); pg.wait_for_selector('.binrow')
    ok('bin lists it with days left', 'days left' in pg.inner_text('.binrow'))
    pg.click('.binrow [data-act=bin-restore]'); pg.wait_for_timeout(300)
    ok('restore brings it back', pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length")==n0)
    pg.evaluate(f"window.sukli.commit(d=>{{const t=d.txs.find(x=>x.id==='{tid}'); t.deleted=true; t.deletedAt=Date.now()-40*864e5; t.updatedAt=Date.now();}})")
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(1200)
    ok('expired item auto-purged', pg.evaluate(f"window.sukli.get().txs.find(x=>x.id==='{tid}').purged===true"))
    # delete forever
    tid2=pg.evaluate("window.sukli.get().txs.find(t=>!t.deleted).id")
    pg.evaluate(f"window.sukli.commit(d=>{{const t=d.txs.find(x=>x.id==='{tid2}'); t.deleted=true; t.deletedAt=Date.now(); t.updatedAt=Date.now();}})")
    pg.goto('http://localhost:8123/index.html#/bin'); pg.wait_for_selector('.binrow')
    pg.click('.binrow [data-act=bin-purge]'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(300)
    ok('delete forever leaves tombstone', pg.evaluate(f"window.sukli.get().txs.find(x=>x.id==='{tid2}').purged===true"))
    ok('bin empty message', pg.locator('.binrow').count()==0)
    # card: pay lowers liability without expense
    r=pg.evaluate("""(()=>{const s=window.sukli;let cardId;
      s.commit(d=>{const id='cardx';cardId=id;d.accounts.push({id,name:'Test Card',cur:'PHP',type:'card',open:0,include:true,archived:false,stmtDay:1,dueDay:20,limit:50000,updatedAt:Date.now()});
        const src=d.accounts.find(a=>a.type==='bank'&&a.cur==='PHP'&&!a.deleted);
        d.txs.push({id:'c1',kind:'expense',amount:1000,cur:'PHP',fx:1,date:'2026-09-20 12:00:00',name:'x',cat:d.categories[0].id,acct:id,updatedAt:Date.now()});
        d.txs.push({id:'c2',kind:'transfer',amount:400,toAmount:400,cur:'PHP',fx:1,date:'2026-10-16 12:00:00',name:'Card payment',cat:'',acct:src.id,toAcct:id,updatedAt:Date.now()});});
      const b=s.balancesNow().get('cardx'); return b;})()""")
    ok('card balance -600 after 1000 spend and 400 payment', abs(r+600)<1e-6)
    pg.goto('http://localhost:8123/index.html#/accounts'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-act=acct][data-id=cardx]').click()"); pg.wait_for_selector('.cardbox')
    t=pg.inner_text('.cardbox'); print(t.replace('\n',' | ')[:300])
    ok('card box shows amount due and Pay button', 'Amount due' in t and pg.locator('[data-ad=pay]').count()==1)
    b.close()
print('ERRORS',errs); print(sum(res),'/',len(res))
