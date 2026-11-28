# v16.53: first funding is not earned; Gains has separate trading and interest blocks; no left borders or divider lines in Investments cards; Buy/Sell have get/pay in one row
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+('' if c else '  ['+str(x)[:200]+']'))
SEED="""async()=>{const c=await import('/js/core.js');const {stamp,commit}=c;
 commit((d)=>{const h=d.settings.homeCurrency||'PHP';const k=d.categories.find(x=>x.group==='Earn'&&x.name==='Interest');
  d.accounts.push(stamp({id:'m2',name:'MP2 Z',cur:h,type:'invest',open:0,include:true,archived:false,invtab:true}));
  d.txs.push(stamp({id:'f1',kind:'income',amount:500,cur:h,fx:1,acct:'m2',date:'2026-03-01 10:00:00',name:'first input',cat:k&&k.id,fee:0,notes:'',labels:'',items:[]}));
  d.txs.push(stamp({id:'f2',kind:'income',amount:12,cur:h,fx:1,acct:'m2',date:'2026-04-01 10:00:00',name:'interest',cat:k&&k.id,fee:0,notes:'',labels:'',items:[]}));
  d.accounts.push(stamp({id:'m3',name:'Opening Z',cur:h,type:'invest',open:300,include:true,archived:false,invtab:true}));
  d.txs.push(stamp({id:'f3',kind:'income',amount:7,cur:h,fx:1,acct:'m3',date:'2026-04-01 10:00:00',name:'interest',cat:k&&k.id,fee:0,notes:'',labels:'',items:[]}));});}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate(SEED)
    r=pg.evaluate("""async()=>{const c=await import('/js/core.js'),t=await import('/js/tokenperf.js');const f=t.earnedPred(c.get());const g=(i)=>f(c.get().txs.find(x=>x.id===i));return [g('f1'),g('f2'),g('f3')]}""")
    ok('the first amount put into an investment account is not earned', r[0]==False, r)
    ok('a later interest entry on the same account is earned', r[1]==True, r)
    ok('with an opening balance, the first entry can be interest', r[2]==True, r)
    pg.evaluate("localStorage.setItem('sukli-dpanels','[\"i-gain\"]')"); pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    t=pg.inner_text('body')
    ok('Gains has a Trading Profit and Loss block and an Interest Earned block', pg.locator('.gblk').count()==2 and 'Interest Earned' in t and 'Trading Profit and Loss' in t, pg.locator('.gblk').count())
    ok('this year / all time are explained', 'This year' in pg.inner_text('.gblk:nth-of-type(2), .gblk >> nth=1') and '1 January to today' in t)
    ok('no separate savings-interest block in Investments', 'Savings interest' not in t and 'Savings Interest' not in t)
    pg.click('.gblk .rowbtn >> nth=0'); pg.wait_for_timeout(500)
    w=pg.inner_text('body')
    ok('Earned this year opens the entries behind it', 'Earned This Year' in w and 'Entries, newest first' in w and 'Days with interest' in w)
    ok('the window lists the interest entry (12)', '12' in w)
    pg.keyboard.press('Escape'); pg.evaluate("document.querySelectorAll('.sheet-close,[data-x]').forEach(b=>b.click())"); pg.wait_for_timeout(300)
    lines=pg.evaluate("""()=>{const o=[];document.querySelectorAll('.invpage .coll *').forEach(e=>{if(!e.offsetWidth||e.matches('button,.btn,.segi,.pkbtn,input,select,svg,svg *,.sk-dot,.dsegm,.segm'))return;const cs=getComputedStyle(e);for(const s of ['Top','Bottom']){if(parseFloat(cs['border'+s+'Width'])>0&&cs['border'+s+'Style']!=='none'&&e.tagName!=='DETAILS'&&!e.closest('details.dayblk'))o.push(e.tagName+'.'+e.className)}});return o}""")
    ok('no divider lines inside Investments cards', not lines, lines[:4])
    left=pg.evaluate("""()=>[...document.querySelectorAll('.invpage .coll, .invpage .nwmain, .invpage .plathero, .invpage .wlt')].filter(e=>e.offsetWidth&&parseFloat(getComputedStyle(e).borderLeftWidth)>0).map(e=>e.className)""")
    ok('no left border on Investments cards', not left, left)
    b.close()
print('fails',res.count(False))
