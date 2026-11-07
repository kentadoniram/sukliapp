# v13.55: day trip vs commute from distance to Home and the travel pattern; macron station names; group tiles
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_timeout(800)
    r=pg.evaluate("""async function(){const D=await import('/js/daytrip.js'),S=await import('/js/stations.js');
      const home={la:35.5313,lo:139.6970};   /* near Kawasaki */
      const at=(y,m,d,h)=>new Date(y,m-1,d,h,0,0);
      const mk=(from,to,when)=>({from,to,when});
      /* weekday commute Kawasaki<->Shinagawa on 4 different weekdays (Nov 2 to 5 2026 are Mon to Thu) */
      const hist=[2,3,4,5].map(d=>mk('Kawasaki','Shinagawa',at(2026,11,d,8)));
      const sat=[mk('Kawasaki','Tobu-Nikko',at(2026,11,7,7)),mk('Tobu-Nikko','Kawasaki',at(2026,11,7,19))];
      const wk=[mk('Kawasaki','Shinagawa',at(2026,11,6,8)),mk('Shinagawa','Kawasaki',at(2026,11,6,19))];
      const near=[mk('Kawasaki','Tokyo',at(2026,11,8,10))];  /* Sunday, about 15 km */
      const unk=[mk('Kawasaki','Foo Town',at(2026,10,25,10)),mk('Foo Town','Bar Town',at(2026,10,25,12))];
      const c=(rides)=>[...D.classifyDays(rides,home,hist).values()][0];
      const noHome=[...D.classifyDays(sat,null,[]).values()][0];
      return {sat:c(sat),wk:c(wk),near:c(near),unk:c(unk),noHome:noHome,
        km:Math.round(S.findStation('Tobu-Nikko')&&(await import('/js/loc.js')).distKm(home,S.findStation('Tobu-Nikko'))),
        k1:S.stationKey('Keikyū Kawasaki')===S.stationKey('Keikyuu Kawasaki'), rep:S.repairStation('Keikyi Kawasaki'), yako:S.repairStation('Yakou')};}""")
    print(r)
    ok('far weekend trip is a day trip', r['sat']['kind']=='daytrip' and r['sat']['km']>100)
    ok('usual weekday route is a commute', r['wk']['kind']=='commute')
    ok('about 15 km on Sunday is only maybe', r['near']['kind']=='maybe')
    ok('unknown stations on a weekday are regular', r['unk']['kind']=='regular')
    ok('no Home: far station gives no distance, no trip', r['noHome']['kind']!='daytrip' and r['noHome']['km'] is None)
    ok('macron spellings share one key', r['k1'])
    ok('Keikyi repaired, Yakou repaired', r['rep']=='Keikyū Kawasaki' and r['yako']=='Yakō')
    pg.goto('http://localhost:8123/'); pg.wait_for_timeout(500)
    ok('group chooser uses tiles', pg.evaluate("""async()=>{const t=await (await fetch('/js/entry.js')).text();return t.includes('chips cattiles grptiles')&&t.includes('<span>${esc(g)}</span></button>');}"""))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
