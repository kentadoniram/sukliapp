# v13.19 to v13.35 features, one browser and one imported CSV for all of them (merged from ui_test75, 78, 81, 84, 86, 90).
from playwright.sync_api import sync_playwright
import json
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)

def part0(p,b,ctx,pg,errs):
    # v13.19: Count by group on an entry (Advanced only) and the Spending by group page
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.goto('http://localhost:8123/#/spend'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('empty page explains how it works', 'Count by group' in t and 'rough' in t)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('entry offers Count by group', pg.locator('[data-e=counts-on]').count()==1)
    pg.click('[data-e=counts-on]'); pg.wait_for_timeout(300)
    ok('one row appears', pg.locator('.cnt').count()==1)
    # pieces reject a decimal and say why
    pg.fill('#f-what','Lawson'); pg.fill('#f-amount','500')
    pg.evaluate("(()=>{const s=document.querySelector('.cnt-g'); s.value='drinks'; s.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.fill('.cnt-n','1.5'); pg.click('#btns .btn'); pg.wait_for_timeout(400)
    ok('a decimal count of pieces is refused with a reason', pg.locator('#err:not([hidden])').count()==1 and 'whole' in pg.inner_text('#err').lower())
    pg.fill('.cnt-n','3'); pg.click('[data-e=count-add]'); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const s=document.querySelectorAll('.cnt-g')[1]; s.value='snacks'; s.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.locator('.cnt-n').nth(1).fill('2'); pg.click('#btns .btn'); pg.wait_for_timeout(700)
    saved=pg.evaluate("(async()=>{const m=await import('/js/core.js');const t=m.get().txs.filter(x=>!x.deleted&&x.counts&&x.counts.length)[0];return t&&t.counts})()")
    ok('counts saved as typed: %s'%saved, saved==[{'g':'drinks','n':3},{'g':'snacks','n':2}])
    # weights keep real decimals
    pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js');m.addGroup('beef','kg')})()")
    r=pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js'),c=await import('/js/core.js');return [m.countLines(c.get(),[{g:'beef',n:'0,35'}]),m.countLines(c.get(),[{g:'beef',n:'0'}]),m.countLines(c.get(),[{g:'',n:'2'}])]})()")
    ok('0,35 kg stays 0.35', r[0].get('lines')==[{'g':'beef','n':0.35}]); ok('zero refused', 'error' in r[1]); ok('count without a group refused', 'error' in r[2])
    # many receipts: page shows about amounts with ranges
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');const d0=c.get();const acct=d0.accounts.find(a=>!a.deleted&&a.include).id;const cat=d0.categories.find(x=>!x.deleted&&x.kind==='expense').id;
      c.commit(d=>{const T=c.nowStamp().slice(0,8);for(let i=0;i<24;i++){const dr=1+(i%3),sn=i%4,rm=i%2;const total=dr*140+sn*190+rm*540+(i%5);
      d.txs.push(c.stamp({id:'s'+i,kind:'expense',date:T+String(1+(i%27)).padStart(2,'0')+' 12:00:00',name:'Shop'+(i%2),amount:total,cur:c.HOME,fx:1,cat,acct,counts:[{g:'drinks',n:dr},...(sn?[{g:'snacks',n:sn}]:[]),...(rm?[{g:'ready meals',n:rm}]:[])]}))}})})()""")
    pg.goto('http://localhost:8123/#/spend'); pg.wait_for_timeout(2500)
    t=pg.inner_text('#view'); print(t[:500].replace('\n',' | '))
    ok('page lists groups with about and a range', 'about' in t and ' to ' in t and 'drinks' in t.lower() and 'ready meals' in t.lower())
    ok('says estimates never change totals', 'never change' in t)
    pg.click('[data-act=spend-range][data-k=all]'); pg.wait_for_timeout(2500); ok('period chip works', pg.locator('.chip.on:text-is("All")').count()==1)
    # Simple mode hides it
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='simple'})})()"); pg.wait_for_timeout(500)
    pg.click('[data-act=add]'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('Simple mode hides Count by group', not pg.locator('#countsrow').is_visible())
    ok('no errors %s'%errs, not errs)

def part1(p,b,ctx,pg,errs):
    # v13.25: read a Pasmo / Suica Wallet screenshot (text is injected: the reading itself is covered by the walletparse test and a real screenshot)
    TXT="""23:28
    Balance
    ¥809 Add Money
    Latest Transactions
    Kawasaki Station ¥528 >
    From Kita-Senju Station — Tran...
    2 hours ago
    Kita-Senju Station ¥1,393 >
    From Tobu-nikko Station — Tr...
    3 hours ago
    Kawasaki, Kanagawa ¥494 >
    Purchase
    Yesterday
    Shibuya, Tokyo +¥5,000 >
    Credit
    Saturday
    Kawasaki Station ¥341 >"""
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'pm1',name:'Pasmo',cur:'JPY',type:'cash',open:1000,include:true,archived:false}))})})()")
    pg.evaluate("window.__walletText="+__import__('json').dumps(TXT))
    open('/tmp/blank.png','wb').write(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082'))
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); ok('menu offers it', 'Scanner' in pg.inner_text('.drawer') and 'Read a Pasmo Screenshot' in pg.inner_text('.drawer', timeout=2000) or 'Read a Pasmo Screenshot' in pg.evaluate("document.querySelector('.drawer').textContent"))
    pg.evaluate("document.querySelector('.drawer [data-act=wallet-scan]').click()"); pg.wait_for_timeout(600); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=8000)
    t=pg.inner_text('.sheet'); ok('rows listed with stations', 'Kita-Senju to Kawasaki' in t and 'Tobu-Nikko to Kita-Senju' in t and 'Purchase: Kawasaki, Kanagawa' in t)
    ok('balance shown', '809' in t); ok('cut-off row reported', '1 row' in t)
    ok('four rows ticked (top-up included)', pg.locator('.wsl input:checked').count()==4 and pg.locator('.wssrc').count()==1)
    ok('offers to set the starting balance', pg.locator('.wsbal').count()==1 and pg.locator('#ws-bal:checked').count()==1)
    pg.click('[data-act=ws-add]'); pg.wait_for_timeout(700)
    bal=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.balances(c.get()).get('pm1')})()"); ok('card ends at the wallet balance 809 (%s)'%bal, abs(bal-809)<0.01)
    tx=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(t=>!t.deleted&&t.notes==='From a Wallet screenshot').map(t=>[t.name,t.amount,t.from||'',t.to||'',t.flag||'',t.acct,t.kind,t.toAcct||''])})()")
    ok('four entries saved %s'%tx, len(tx)==4 and any(x[0].startswith('Pasmo') or '- Pasmo' in x[0] for x in tx) and ['Train: Kita-Senju - Kawasaki',528,'Kita-Senju','Kawasaki','','pm1','expense',''] in tx and any(x[0]=='Purchase: Kawasaki, Kanagawa' and x[4]=='review' for x in tx))
    # a second screenshot of the same rides adds nothing: they are known now
    pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); pg.evaluate("document.querySelector('.drawer [data-act=wallet-scan]').click()"); pg.wait_for_timeout(600); pg.wait_for_selector('#ws-file',state='attached',timeout=5000); pg.set_input_files('#ws-file','/tmp/blank.png'); pg.wait_for_selector('.wslist',timeout=8000)
    ok('second time: balance already matches', pg.locator('.wsbal').count()==0 and 'will match the wallet' in pg.inner_text('.sheet'))
    ok('same rides are not offered again', pg.locator('.wsl input:checked').count()==0 and 'already in your entries' in pg.inner_text('.sheet'))
    ok('no errors %s'%errs, not errs)

def part2(p,b,ctx,pg,errs):
    # v13.32: "Paid for others" with several people (equal, amounts, percent, with or without your own share) and the Owed to You history
    def J(pg,js): return pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.titleCase=false})})()")
    J(pg,"c.commit(d=>{d.settings.mode='advanced';for(const [i,n] of [['pplana','Ana'],['pplben','Ben'],['pplcy','Cy']])d.accounts.push(c.stamp({id:i,name:n,cur:d.settings.homeCur||'PHP',type:'owed',open:0,include:true,archived:false}))})")
    def open_entry(name,amt):
        pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
        pg.fill('#f-what',name); pg.fill('#f-amount',amt); pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    def pick(i,who): pg.locator('.oth-who').nth(i).select_option(who); pg.wait_for_timeout(150)
    def save(): pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(1200)
    def rows(name): return J(pg,"return c.get().txs.filter(x=>!x.deleted&&(x.name||'').includes('%s')).map(x=>[x.kind,x.amount,x.toAcct||'',!!x.splitId])"%name)
    # A: one person, equal, you are included
    open_entry('UT A dinner','1200'); pick(0,'pplana'); save(); r=rows('UT A dinner')
    ok('A: your half is the expense, Ana owes her half %s'%r, sorted(r)==sorted([['expense',600,'',True],['transfer',600,'pplana',True]]))
    # B: three people, equal, you are not part of it
    pg.wait_for_timeout(1500); open_entry('UT B bill','900'); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pick(0,'pplana'); pick(1,'pplben'); pick(2,'pplcy'); pg.evaluate("document.querySelector('.oth-me').click()"); pg.wait_for_timeout(200)
    ok('B: summary says you are not part of it', 'not part of it' in pg.inner_text('#oth-sum') and '300' in pg.inner_text('#oth-sum'))
    save(); r=rows('UT B bill')
    ok('B: three transfers of 300 and no expense %s'%r, sorted(r)==sorted([['transfer',300,'pplana',True],['transfer',300,'pplben',True],['transfer',300,'pplcy',True]]))
    gid=J(pg,"return new Set(c.get().txs.filter(x=>!x.deleted&&(x.name||'').includes('UT B bill')).map(x=>x.splitId)).size"); ok('B: all three share one bill id', gid==1)
    # C: unequal amounts, you included
    pg.wait_for_timeout(1500); open_entry('UT C bill','1000'); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=amount]').click()"); pg.wait_for_timeout(200)
    pick(0,'pplana'); pick(1,'pplben'); pg.locator('.oth-n').nth(0).fill('300'); pg.locator('.oth-n').nth(1).fill('200'); pg.wait_for_timeout(150)
    ok('C: summary shows your part 500', '500' in pg.inner_text('#oth-sum'))
    save(); r=rows('UT C bill'); ok('C: expense 500, Ana 300, Ben 200 %s'%r, sorted(r)==sorted([['expense',500,'',True],['transfer',300,'pplana',True],['transfer',200,'pplben',True]]))
    # D: percentages, not included: must add to 100
    pg.wait_for_timeout(1500); open_entry('UT D bill','1000'); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=pct]').click()"); pg.wait_for_timeout(200)
    pick(0,'pplana'); pick(1,'pplben'); pg.locator('.oth-n').nth(0).fill('25'); pg.locator('.oth-n').nth(1).fill('25'); pg.evaluate("document.querySelector('.oth-me').click()"); pg.wait_for_timeout(200)
    save(); ok('D: 50 percent in total is refused when you are not part of it', len(rows('UT D bill'))==0 and pg.locator('#err').is_visible())
    pg.locator('.oth-n').nth(0).fill('50'); pg.locator('.oth-n').nth(1).fill('50'); pg.wait_for_timeout(150); save(); r=rows('UT D bill')
    ok('D: two transfers of 500 %s'%r, sorted(r)==sorted([['transfer',500,'pplana',True],['transfer',500,'pplben',True]]))
    # history on the Owed to You tab
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(900)
    ok('names are tappable', pg.locator('[data-act=owed-hist]').count()>=3)
    pg.evaluate("document.querySelector('[data-act=owed-hist][data-id=pplana]').click()"); pg.wait_for_selector('.ohist'); t=pg.inner_text('.sheet')
    ok('history lists how they came to owe you, with details %s'%t[:0], t.count('Lent')>=4 and 'Part of: UT A dinner' in t and 'Still owed' in t and 'owed after' in t)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    J(pg,"const t=c.get().txs.find(x=>!x.deleted&&x.kind==='transfer'&&x.toAcct==='pplana'&&x.name.includes('UT A'));c.commit(d=>{d.txs.push(c.stamp({id:'pb1',kind:'transfer',amount:200,toAmount:200,cur:t.cur,fx:t.fx,date:'2099-01-01 10:00:00',name:'Ana paid back',cat:'',acct:'pplana',toAcct:t.acct,lentBack:true,debtPay:false}))})")
    pg.goto('http://localhost:8123/#/owed'); pg.wait_for_timeout(700); pg.evaluate("document.querySelector('[data-act=owed-hist][data-id=pplana]').click()"); pg.wait_for_selector('.ohist'); t=pg.inner_text('.sheet')
    ok('payment back shows in the history', 'Paid back' in t and '200' in t)
    ok('no errors %s'%errs, not errs)

def part3(p,b,ctx,pg,errs):
    # v13.31: clearer account and investment wording, shared coins, live price id suggestion, buy/sell/convert labels
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced'})})()")
    # 1-2 account form wording
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount(null,{})})()"); pg.wait_for_selector('#acct-form')
    t=pg.inner_text('#acct-form'); ok('bank: balance on the opening date explained', 'Balance on the Opening Date' in t and 'Starting today?' in t)
    pg.select_option('#acct-form select[name=type]','card'); pg.wait_for_timeout(200)
    t=pg.inner_text('#acct-form'); ok('card: amount you owe now, not limit or available credit', 'Amount You Owe Now' in t and 'not your credit limit' in t)
    pg.fill('#acct-form [name=name]','Owe Card'); pg.fill('#acct-form [name=open]','45000'); pg.evaluate("document.querySelector('#acct-form').requestSubmit()"); pg.wait_for_timeout(800)
    op=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.name==='Owe Card');return a&&a.open})()"); ok('owed 45000 kept as a negative balance (%s)'%op, op==-45000)
    # 3-6 add asset
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'Zed',wallet:'Spot'})})()"); pg.wait_for_selector('#ic')
    t=pg.inner_text('#ic'); ok('trading account wording and explanation', 'Trading Account Inside the Platform' in t and 'buy and sell coins directly' in pg.inner_text('#wal-h').lower())
    pg.select_option('#ic select[name=wallet]','Futures'); pg.wait_for_timeout(100); ok('Futures explains leverage and risk', 'higher risk' in pg.inner_text('#wal-h'))
    ok('tooltips on Ticker, Name, Price Currency, Live Price ID', pg.locator('#ic .tipbtn').count()>=4)
    pg.fill('#ic [name=coin]','usdc'); pg.wait_for_timeout(200); ok('USDC suggests usd-coin', pg.input_value('#ic [name=cg]')=='usd-coin' and 'usd-coin' in pg.inner_text('#cg-h'))
    pg.fill('#ic [name=coin]','btc'); pg.wait_for_timeout(200); ok('changing the ticker changes the suggestion', pg.input_value('#ic [name=cg]')=='bitcoin')
    pg.fill('#ic [name=cg]','my-own'); pg.fill('#ic [name=coin]','eth'); pg.wait_for_timeout(200); ok('a typed id is not overwritten', pg.input_value('#ic [name=cg]')=='my-own')
    pg.fill('#ic [name=cg]',''); pg.fill('#ic [name=coin]','usdt'); pg.select_option('#ic select[name=wallet]','Spot'); pg.evaluate("document.querySelector('#ic').requestSubmit()"); pg.wait_for_timeout(900)
    # same coin in another trading account of the same platform: offered in one tap, shares details
    pg.evaluate("(async()=>{const m=await import('/js/invest.js');m.addAsset({platform:'Zed',wallet:'Earn'})})()"); pg.wait_for_selector('#ic'); pg.wait_for_timeout(200)
    ok('coin already on the platform offered as a chip', pg.locator('#tkchips [data-tk=USDT]').count()==1)
    pg.evaluate("document.querySelector('#tkchips [data-tk=USDT]').click()"); pg.wait_for_timeout(200)
    ok('shared coin note, cg id filled', 'already set up' in pg.inner_text('#tk-note') and pg.input_value('#ic [name=cg]')=='tether')
    pg.evaluate("document.querySelector('#ic').requestSubmit()"); pg.wait_for_timeout(900)
    n=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.filter(a=>!a.deleted&&a.exchange==='Zed'&&a.cur==='USDT').map(a=>a.wallet)})()"); ok('one USDT balance per trading account %s'%n, sorted(n)==['Earn','Spot'])
    # 7-8 trade labels
    pg.evaluate("(async()=>{const m=await import('/js/trades.js');m.openTrade({side:'buy'})})()"); pg.wait_for_selector('#tr'); pg.wait_for_timeout(300)
    t=pg.inner_text('#tr'); ok('quantity and price show the coin and currency', 'Quantity (' in t and 'Price (' in t and 'Units' not in t and 'per unit' not in t)
    ok('pair is shown', '/' in pg.inner_text('#pair') and 'buying' in pg.inner_text('#pair'))
    pg.click('[data-side=convert]'); pg.wait_for_timeout(300)
    t=pg.inner_text('#tr'); ok('convert wording', 'Quantity (' in t and 'Value in' in t and 'Amount you' not in t and 'Worth in' not in t)
    pg.click('#tr [data-fm=fixed]'); pg.wait_for_timeout(150)
    order=pg.evaluate("[...document.querySelectorAll('#tr .field > span, #tr label > span')].filter(x=>x.offsetParent).map(x=>x.textContent.trim())")
    i=[k for k,x in enumerate(order) if x.startswith('Pay the Fee From')]; j=[k for k,x in enumerate(order) if x.startswith('Fee Amount')]; q=[k for k,x in enumerate(order) if x.startswith('Quantity')]
    ok('Pay the Fee From comes after the quantities and the fee %s'%order, i and j and q and i[0]>j[0] and i[0]>q[0])
    ok('no errors %s'%errs, not errs)

def part4(p,b,ctx,pg,errs):
    # v13.34: shared bill shown once and edited as one; Earn platform timezones
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';
      d.accounts.push(c.stamp({id:'wal',name:'Wallet Z',type:'cash',cur:'PHP',open:10000,include:true,archived:false}));
      for(const n of ['Ann','Ben','Cy']) d.accounts.push(c.stamp({id:'p'+n,name:n,type:'owed',cur:'PHP',open:0,include:false,archived:false}));
      const g='g1',dt=c.nowStamp();
      d.txs.push(c.stamp({id:'m1',kind:'expense',date:dt,acct:'wal',cur:'PHP',amount:1000,fx:1,name:'Grocery Receipt',paidFor:{total:4000,who:'Ann, Ben, Cy',me:true},splitId:g}));
      for(const n of ['Ann','Ben','Cy']) d.txs.push(c.stamp({id:'l'+n,kind:'transfer',date:dt,acct:'wal',toAcct:'p'+n,cur:'PHP',amount:1000,toAmount:1000,fx:1,name:'Paid for '+n+': Grocery Receipt',lent:true,splitId:g}))})})()""")
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(700)
    t=pg.inner_text('#app') if pg.locator('#app').count() else pg.inner_text('body')
    ok('bill shown once with the whole 4,000', t.count('Grocery Receipt')==1 and '4,000' in t)
    ok('bar says 4 shares', 'Shared bill: 4 shares' in t)
    pg.click('.splitbar'); pg.wait_for_timeout(300)
    t=pg.inner_text('body'); ok('open shows each person', all(n in t for n in ['Ann','Ben','Cy','You']))
    pg.click('.splitkid >> nth=1'); pg.wait_for_selector('#sb'); pg.wait_for_timeout(300)
    pg.fill('#sb [data-sb=name]','Big Shop'); pg.press('#sb [data-sb=name]','Tab')
    pg.fill('#sb [data-sb=total]','8000'); pg.press('#sb [data-sb=total]','Tab'); pg.wait_for_timeout(300)
    v=pg.evaluate("[...document.querySelectorAll('#sb [data-sb=share]')].map(x=>x.value)"); ok('shares doubled %s'%v, v==['2000','2000','2000'])
    pg.fill('#sb [data-sb=share] >> nth=0','9000'); pg.press('#sb [data-sb=share] >> nth=0','Tab'); pg.click('#sb [data-sb=save]'); pg.wait_for_timeout(300)
    ok('too much is refused', 'more than the whole bill' in pg.inner_text('#sb'))
    pg.fill('#sb [data-sb=share] >> nth=0','2000'); pg.press('#sb [data-sb=share] >> nth=0','Tab'); pg.click('#sb [data-sb=save]'); pg.wait_for_timeout(500)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();return d.txs.filter(t=>t.splitId==='g1').map(t=>[t.id,t.name,t.amount])})()")
    ok('all parts renamed and add to 8000 %s'%r, all('Big Shop' in x[1] for x in r) and abs(sum(x[2] for x in r)-8000)<0.01)
    # platform timezone
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');
      c.commit(d=>{d.accounts.push(c.stamp({id:'be',name:'Binance Earn USDT',wallet:'Earn',cur:'USDT',type:'crypto',exchange:'Binance',open:0,include:false,archived:false}),c.stamp({id:'ge',name:'Bitget Earn USDT',wallet:'Earn',cur:'USDT',type:'crypto',exchange:'Bitget',open:0,include:false,archived:false}))});
      const d=c.get();const ms=Date.UTC(2026,10,3,16,30);
      const a=e.tzOf(d,d.accounts.find(x=>x.id==='be')),b=e.tzOf(d,d.accounts.find(x=>x.id==='ge'));
      c.commit(x=>{x.settings.platformTz={Binance:-5}});
      return [a,b,e.tzOf(c.get(),c.get().accounts.find(x=>x.id==='be')),e.e8Label(ms,0),e.e8Label(ms,8)]})()""")
    ok('defaults Binance 0, Bitget 8, changeable, labels differ %s'%r, r==[0,8,-5,'2026-11-03 16:30','2026-11-04 00:30'])
    ok('no errors %s'%errs, not errs)

def part5(p,b,ctx,pg,errs):
    # v13.35: category pick-or-create, new category visible at once, item quantity, owed delete, one-line lists, Title Case
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/'"); pg.wait_for_timeout(300); del errs[:]; pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{delete d.settings.titleCase})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'w90',name:'W90',type:'cash',cur:'PHP',open:5000,include:true,archived:false}))})})()")
    # 1 category form
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openCategoryForm({kind:'expense'})})()"); pg.wait_for_selector('#catform'); pg.wait_for_timeout(300)
    ok('existing groups offered as chips', pg.locator('#gchips .chip').count()>=3)
    g=pg.inner_text('#gchips .chip >> nth=0'); pg.click('#gchips .chip >> nth=0'); pg.wait_for_timeout(200)
    ok('tap fills the group %s'%g, pg.input_value('#catform [name=g]')==g)
    ok('existing categories of the group offered', pg.locator('#nchips .chip').count()>=1)
    ok('no keyword suggestions on a new category', pg.locator('#kchips').count()==0)
    pg.fill('#catform [name=g]','Brand New Group'); pg.fill('#catform [name=n]','Zebra Care'); pg.wait_for_timeout(200)
    ok('typing a new group says it will be created', 'will be created' in pg.inner_text('#gchips'))
    pg.click('#catform .btn:not(.ghost)'); pg.wait_for_timeout(600)
    # 4 shows at once in a new entry
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'w90'}})})()"); pg.wait_for_selector('#catrow'); pg.wait_for_timeout(500)
    ok('new category in the entry chips at once', 'Zebra Care' in pg.inner_text('#catrow'))
    pg.keyboard.press('Escape')
    # keyword suggestions when editing
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');const d=c.get();const cat=d.categories.find(x=>x.name==='Zebra Care');
      c.commit(x=>{for(let i=0;i<3;i++)x.txs.push(c.stamp({id:'z'+i,kind:'expense',date:'2026-10-0'+(i+1)+' 10:00:00',acct:'w90',cur:'PHP',amount:100,fx:1,name:'Groomer visit '+i,cat:cat.id}))});
      const m=await import('/js/entry.js');m.openCategoryForm({id:cat.id})})()""")
    pg.wait_for_selector('#kchips'); pg.wait_for_timeout(300)
    ok('keyword suggestions from entries %s'%pg.inner_text('#kchips'), 'groomer' in pg.inner_text('#kchips').lower())
    pg.click('#kchips .chip >> nth=0'); ok('tap adds the word', 'groomer' in pg.input_value('#catform [name=k]').lower())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 3 item quantity
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{acct:'w90'}})})()"); pg.wait_for_selector('#itemsrow'); pg.wait_for_timeout(400)
    pg.click('[data-e=items-on]'); pg.wait_for_timeout(200)
    pg.fill('.item .in-n','Rice'); pg.fill('.item .in-a','50'); pg.press('.item .in-a','Tab')
    pg.click('.item [data-e=item-q][data-v="0:1"]'); pg.wait_for_timeout(200)
    ok('plus makes 2 and the line says 2 x 50 = 100 %s'%pg.inner_text('.item .qty b'), pg.inner_text('.item .qty b')=='2' and '100' in pg.inner_text('.item .iline'))
    pg.fill('#f-amount','100'); pg.wait_for_timeout(200)
    print('LEFT',pg.inner_text('#itemleft')); ok('items add up to the total', 'add up' in pg.inner_text('#itemleft'))
    pg.click('.item [data-e=item-q][data-v="0:-1"]'); pg.click('.item [data-e=item-q][data-v="0:-1"]'); pg.wait_for_timeout(200)
    ok('minus stops at 1', pg.inner_text('.item .qty b')=='1')
    pg.click('.item [data-e=item-q][data-v="0:1"]'); pg.fill('#f-what','grocery shopping'); pg.press('#f-what','Tab'); pg.wait_for_timeout(200)
    ok('Title Case on leaving the field', pg.input_value('#f-what')=='Grocery Shopping')
    pg.click('#btns [data-e=save]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.name==='Grocery Shopping');return t&&t.items[0]})()"); ok('saved with quantity %s'%r, r and r['q']==2 and r['amt']==100 and r['u']==50)
    # 2 paid for others sizes
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'pp90',name:'Test Person',type:'owed',cur:'PHP',open:0,include:false,archived:false}))});const m=await import('/js/entry.js');m.openEntry({preset:{acct:'w90'}})})()"); pg.wait_for_selector('[data-e=oth-on]',state='attached'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=amount]').click()"); pg.wait_for_timeout(300)
    h=pg.evaluate("[document.querySelector('.oth-who').getBoundingClientRect().height,document.querySelector('.oth-n').getBoundingClientRect().height,document.querySelector('.oth-who').getBoundingClientRect().width,document.querySelector('.oth-n').getBoundingClientRect().width]")
    ok('name and amount boxes tall and balanced %s'%h, h[0]>=44 and h[1]>=44 and h[2]<260 and h[3]>60)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 5 owed delete
    pg.evaluate("location.hash='#/owed'"); pg.wait_for_timeout(600)
    pg.evaluate("(async()=>{const u=await import('/js/ui.js');u.ACT['owed-del']({dataset:{id:'pp90'}})})()"); pg.wait_for_timeout(400)
    ok('no records: asks to remove', 'Remove' in pg.inner_text('body') and 'no records' in pg.inner_text('body'))
    pg.click('text=Remove >> nth=-1'); pg.wait_for_timeout(600)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.find(x=>x.id==='pp90').deleted})()"); ok('person removed', r)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'pp91',name:'Test Two',type:'owed',cur:'PHP',open:0,include:false,archived:false}));
      d.txs.push(c.stamp({id:'lt91',kind:'transfer',date:c.nowStamp(),acct:'w90',toAcct:'pp91',cur:'PHP',amount:300,toAmount:300,fx:1,name:'Paid for Test Two',lent:true}))});
      const u=await import('/js/ui.js');u.ACT['owed-del']({dataset:{id:'pp91'}})})()""")
    pg.wait_for_timeout(400); t=pg.inner_text('body'); ok('with records: warns and offers Hide and Delete', 'Hide Person' in t and 'Delete Person and Records' in t and 'still owes' in t)
    pg.click('[data-hide]'); pg.wait_for_timeout(500)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();return [d.accounts.find(x=>x.id==='pp91').archived,!!d.txs.find(x=>x.id==='lt91').deleted]})()"); ok('hide keeps the records %s'%r, r==[True,False])
    # 6-8 one-line rows
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.merchants=['Life','Seven Eleven Kawasaki Station Branch']});location.hash='#/settings'})()"); pg.wait_for_timeout(700)
    h=pg.evaluate("(()=>{const r=document.querySelector('#merch-set .row');return r&&r.getBoundingClientRect().height})()")
    ok('merchant row is one line (%s px)'%h, h and h<48)
    pg.evaluate("location.hash='#/outlook'"); pg.wait_for_timeout(700)
    ok('no errors %s'%errs, not errs)

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    print('--- ui_test75.py'); part0(p,b,ctx,pg,errs)
    print('--- ui_test78.py'); part1(p,b,ctx,pg,errs)
    print('--- ui_test81.py'); part2(p,b,ctx,pg,errs)
    print('--- ui_test84.py'); part3(p,b,ctx,pg,errs)
    print('--- ui_test86.py'); part4(p,b,ctx,pg,errs)
    print('--- ui_test90.py'); part5(p,b,ctx,pg,errs)
    b.close()
print('fails',res.count(False))
