# v13.30: optional location: phone location saved with an entry, home and work learned, far from home as a trip clue
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',geolocation={'latitude':35.5512,'longitude':139.7011},permissions=['geolocation']); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.titleCase=false})})()")
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced'})})()")
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(900)
    ok('Location section is in Settings and off by default', 'Location (Optional)' in pg.inner_text('#view') and pg.locator('[data-act=loc-toggle]').inner_text()=='Turn on')
    pg.evaluate("document.querySelector('[data-act=loc-toggle]').click()"); pg.wait_for_timeout(1200)
    on=pg.evaluate("(async()=>{const c=await import('/js/core.js');return !!c.get().settings.locOn})()"); ok('turned on', on)
    # an entry made now gets a rounded place
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Locatest shop'); pg.fill('#f-amount','300'); pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(2500)
    loc=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>!x.deleted&&x.name==='Locatest shop');return t&&t.loc})()")
    ok('place saved, rounded to 2 decimals %s'%loc, loc and abs(loc['la']-35.55)<0.011 and abs(loc['lo']-139.70)<0.011)
    # learning home and work from seeded entries
    r=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const L=await import('/js/loc.js');
      c.commit(d=>{const cat=d.categories.find(x=>!x.deleted).id,acct=d.accounts.find(x=>!x.deleted).id;let k=0;
        const add=(date,la,lo)=>d.txs.push(c.stamp({id:'L'+(k++),kind:'expense',amount:100,cur:'PHP',fx:1,date,name:'x'+k,cat,acct,loc:{la,lo}}));
        for(let i=1;i<=6;i++) add('2026-09-0'+i+' 21:30:00',35.60+i*0.001,139.60);          // evenings: home
        for(const i of [1,2,3,4,5,8]) add('2026-09-'+String(i).padStart(2,'0')+' 11:00:00',35.68,139.76+i*0.001);   // weekdays by day: work (Tokyo)
      });
      const pl=L.placesOf(c.get());return [pl.home,pl.work,L.farKm(pl,{la:35.2,lo:139.0})]})()""")
    ok('home learned from evenings %s'%r[0], r[0] and r[0]['src']=='learned' and abs(r[0]['la']-35.60)<0.02)
    ok('work learned from weekday daytime %s'%r[1], r[1] and abs(r[1]['la']-35.68)<0.02)
    ok('far place is far (%s km)'%r[2], r[2] and r[2]>60)
    # setting Home by hand wins
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(900); pg.evaluate("document.querySelector('[data-act=loc-sethome]').click()"); pg.wait_for_timeout(1500)
    h=pg.evaluate("(async()=>{const c=await import('/js/core.js');const L=await import('/js/loc.js');return [c.get().settings.homeLoc,L.placesOf(c.get()).home]})()")
    ok('Home set by hand wins %s'%h, h[0] and h[1]['src']=='set')
    # the trip engine: far alone does not flag, far plus new places does; a nearby mall never does
    t=pg.evaluate("""(async()=>{const H=await import('/js/habits.js');const L=await import('/js/loc.js');
      const home={la:35.60,lo:139.60}, pl={home}, rows=[];const day=(i)=>'2026-0'+(i<31?'8':'9')+'-'+String(i<31?i:i-30).padStart(2,'0');
      for(let i=1;i<=60;i++){rows.push({id:'a'+i,date:day(i>30?i:i)+' 12:00:00',amount:800,cur:'JPY',cat:'f',group:'Food',catName:'Food',name:'Usual cafe',labels:'',loc:{la:35.60,lo:139.60}});rows.push({id:'b'+i,date:day(i)+' 19:00:00',amount:900,cur:'JPY',cat:'f',group:'Food',catName:'Food',name:'Usual cafe',labels:'',loc:{la:35.60,lo:139.60}});}
      const far=(d,n)=>{for(let k=0;k<n;k++)rows.push({id:'z'+d+k,date:d+' 1'+k+':00:00',amount:1500,cur:'JPY',cat:'f',group:'Food',catName:'Food',name:'Far place '+d+' '+k,labels:'',loc:{la:35.20,lo:139.00}})};
      far('2026-09-20',3);
      const near=(d,n)=>{for(let k=0;k<n;k++)rows.push({id:'m'+d+k,date:d+' 1'+k+':00:00',amount:1500,cur:'JPY',cat:'f',group:'Food',catName:'Food',name:'Mall shop '+d+' '+k,labels:'',loc:{la:35.62,lo:139.62}})};
      near('2026-09-25',3);
      const res=H.analyzeHabits(rows,{farKm:(loc)=>L.farKm(pl,loc)});
      const d20=res.days.find(x=>x.date==='2026-09-20'), d25=res.days.find(x=>x.date==='2026-09-25');
      return [d20&&d20.why, d20&&d20.out, d25&&d25.why, d25&&d25.out]})()""")
    ok('far day with new places says far from home %s'%t, t[0] and 'far from home' in t[0])
    ok('nearby mall day is not far, not a trip %s'%t, t[2] is not None and 'far from home' not in t[2] and t[3]==False)
    # forget removes places
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(900)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
