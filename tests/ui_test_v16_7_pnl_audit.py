# v16.7 audit: profit and loss must add up by hand, in a home currency that is not PHP.
import sys, re
from playwright.sync_api import sync_playwright
from tests.invnavhelp import go_invest
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
def money(t, label):
    m=re.search(re.escape(label)+r'[^\n]*\n\s*([+−-])?\$([\d,]+\.\d+)', t); v=float(m.group(2).replace(',','')); return -v if m.group(1) in ('−','-') else v
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(700)
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.txs=[]; d.settings.home='USD'; d.settings.rates=Object.assign({},d.settings.rates,{USD:50,USDT:50,BTC:4985000});
      const A=(id,name,wallet,cur,open)=>d.accounts.push(c.stamp({id,name,cur,type:'crypto',assetType:'crypto',open,include:false,archived:false,exchange:'AudEx',wallet,invtab:true}));
      A('au_u','AudEx Spot USDT','Spot','USDT',2000); A('au_b','AudEx Spot BTC','Spot','BTC',0);
      const earn=(d.categories.find(x=>x.group==='Earn')||d.categories[0]).id;
      d.txs.push(c.stamp({id:'au_buy',kind:'transfer',date:'2026-01-02 10:00:00',acct:'au_u',toAcct:'au_b',amount:1000,cur:'USDT',fx:50,toAmount:0.01,name:'Buy 0.01 BTC',trade:{side:'buy',asset:'au_b',qty:0.01,valueHome:1000,paidCur:'USDT',paidAmt:1000,feeHome:5}}));
      d.txs.push(c.stamp({id:'au_sell',kind:'transfer',date:'2026-01-20 10:00:00',acct:'au_b',toAcct:'au_u',amount:0.002,cur:'BTC',fx:5000000,toAmount:210,name:'Sell 0.002 BTC',trade:{side:'sell',asset:'au_b',qty:0.002,valueHome:210,paidCur:'USDT',paidAmt:210,feeHome:1}}));
      d.txs.push(c.stamp({id:'au_earn',kind:'income',date:'2026-02-01 23:55:00',acct:'au_b',cur:'BTC',amount:0.00017,fx:4985000,cat:earn,name:'Interest Earned',auto:true,earnDay:'2026-02-01',earnAcct:'au_b'}));
      d.txs.push(c.stamp({id:'au_inc',kind:'income',date:'2026-02-05 12:00:00',acct:'au_u',cur:'USDT',amount:4,fx:50,cat:earn,name:'Interest: BTC',invIncome:{asset:'au_b',type:'Interest'}}));
    })}""")
    pg.wait_for_timeout(800)
    go_invest(pg,'AudEx'); t=pg.inner_text('.platpage')
    # by hand: cost of units sold = 1005/0.01*0.002 = 201 ; gain = 210-201-1 = 8
    # still held 0.008 BTC: cost 804, worth 0.008*99700 = 797.60 -> -6.40 ; earned 16.949 (rate saved with the entry) + 4 recorded income
    un=money(t,'Unrealized'); re_=money(t,'Realized sold'); ea=money(t,'Earned'); tot=money(t,'Total profit and loss')
    ok('unrealized = -6.40 (%s)'%un, abs(un+6.40)<0.01)
    ok('realized = +8.00 after cost incl. buying fee and the selling fee (%s)'%re_, abs(re_-8)<0.01)
    ok('earned counts interest at its saved rate and recorded income, in USD (%s)'%ea, abs(ea-(0.00017*4985000/50+4))<0.01)
    ok('total = unrealized + realized + earned (%s)'%tot, abs(tot-(un+re_+ea))<0.011 and abs(tot-(-6.4+8+16.949+4))<0.02)
    hero=pg.inner_text('.plathero'); mm=re.search(r'([+−])\$([\d,]+\.\d+) ·',hero); hv=float(mm.group(2).replace(',',''))*(-1 if mm.group(1)=='−' else 1)
    ok('hero PNL equals the list total (%s vs %s)'%(hv,tot), abs(hv-tot)<0.011)
    r=pg.evaluate("""async()=>{const c=await import('/js/core.js'),tp=await import('/js/tokenperf.js'),tc=await import('/js/tradecalc.js');const db=c.get();const book=tc.tradeBook(db.txs);
      return tp.tokenPerformance(db,book,db.accounts.filter(a=>a.exchange==='AudEx'),c.HOME).find(x=>x.cur==='BTC')}""")
    ok('Token performance agrees (gain %.3f vs %.3f)'%(r['gain'],tot), abs(r['gain']-tot)<0.011)
    go_invest(pg,None,sec='overview'); pg.evaluate("document.querySelector('[data-act=inv-dsw][data-v=i-gain]')&&document.querySelector('[data-act=inv-dsw][data-v=i-gain]').click()"); pg.wait_for_timeout(400)
    o=pg.inner_text('#view'); m=re.search(r'Realized \+ Earned, all time\s*\n?\s*([+−])\$([\d,]+\.\d+)',o)
    ok('Overview Realized + Earned = %s'%(m.group(0).replace('\n',' ') if m else None), m and abs(float(m.group(2))-(8+16.949+4))<0.02)
    ok('no page errors %s'%errs, not errs)
    # audit guard: an entry's rate (t.fx) is per PHP, so money shown in HOME must go through factorFor, never `amount * t.fx`
    import glob
    bad=[]
    for f in glob.glob('/home/claude/sukli/js/*.js'):
        for i,l in enumerate(open(f),1):
            if re.search(r'\*\s*\(?\s*t\.fx\s*(\|\||\))',l) and 'earn.js' not in f and 'habits.js' not in f: bad.append('%s:%d'%(f.split('/')[-1],i))
    ok('no raw amount x fx left in the code %s'%bad, not bad)
