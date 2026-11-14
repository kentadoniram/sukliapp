# v15.37: "Pick a Place" can search by name (Nominatim, only when Search is pressed)
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    r=pg.evaluate("""(async()=>{const g=await import('/js/geo.js');
      const f=async(u)=>({ok:true,status:200,json:async()=>[{display_name:'Yurakucho Station, Chiyoda, Tokyo, Japan',lat:'35.6751',lon:'139.7628'}]});
      const a=await g.searchPlaces('yurakucho',f); const e=await g.searchPlaces('  ',f); const n=await g.searchPlaces('x',async()=>({ok:true,status:200,json:async()=>[]})); const o=await g.searchPlaces('x',async()=>{throw new Error('x')});
      return [a.list&&a.list[0].text,a.list&&a.list[0].la,e.err,n.err,o.err]})()""")
    print(r)
    ok('search returns places', r[0].startswith('Yurakucho Station') and abs(r[1]-35.6751)<1e-6)
    ok('empty / none / offline answers', r[2]=='empty' and r[3]=='none' and r[4]=='offline')
    ok('mappick loads without errors', pg.evaluate("import('/js/mappick.js').then(()=>true)") and not errs)
    b.close()
