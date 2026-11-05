# v13.47: Merchant + Branch on one row; Split/Count cancel goes back to its link; items layout and smart suggestions; Paid-for-others boxes; Investments show 2 decimals
from playwright.sync_api import sync_playwright
import re
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';const cat=d.categories.find(x=>x.kind==='expense');const acc=d.accounts.find(x=>!x.deleted&&x.include);d.txs.push(c.stamp({id:'g1',kind:'expense',date:c.nowStamp(),acct:acc.id,cur:acc.cur,amount:900,fx:1,name:'Grocery',cat:cat.id,items:[{n:'Rice',amt:'400',q:1,cat:cat.id},{n:'Meat',amt:'500',q:1,cat:cat.id}]}))})")
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    Y=lambda sel: pg.evaluate("(s)=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().top):null}",sel)
    ok('Merchant and Branch share one row', Y('[data-e=merchpick]') is not None and abs(Y('[data-e=merchpick]')-Y('#branchcell .acctbtn'))<3)
    # items
    pg.fill('#f-what','Grocery'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=items-on]').click()"); pg.wait_for_timeout(400)
    chips=pg.locator('[data-e=item-sug]').all_inner_texts(); ok('suggests items from the earlier Grocery entry %s'%chips, any('Rice' in c for c in chips) and any('Meat' in c for c in chips))
    pg.evaluate("[...document.querySelectorAll('[data-e=item-sug]')].find(x=>/Rice/.test(x.textContent)).click()"); pg.wait_for_timeout(300)
    ok('tapping a chip fills the item name', pg.input_value('.item .in-n')=='Rice')
    yn=Y('.item .in-n'); yc=pg.evaluate("(()=>{const k=[...document.querySelector('.item').children].filter(e=>e.getBoundingClientRect().height>10&&e!==document.querySelector('.item .in-n'));return Math.round(k[0].getBoundingClientRect().top)})()"); ya=Y('.item .in-a'); yq=Y('.item .qty')
    ok('row 1 = name and category, row 2 = amount with the quantity buttons %s'%[yn,yc,ya,yq], abs(yn-yc)<4 and ya>yn+20 and abs(ya-yq)<4)
    pg.fill('.item .in-n','Meat'); pg.wait_for_timeout(300)
    ok('typing Meat picks a category', J("return c.get().categories.length>0") and pg.evaluate("document.querySelector('.item .in-c').value")!='' )
    pg.evaluate("document.querySelector('[data-e=item-del]').click()"); pg.wait_for_timeout(300)
    ok('removing the only item goes back to the Split into items link', pg.locator('[data-e=items-on]').count()==1 and pg.locator('[data-e=item-add]').count()==0)
    pg.evaluate("document.querySelector('[data-e=counts-on]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=count-del]').click()"); pg.wait_for_timeout(300)
    ok('same for Count by group', pg.locator('[data-e=counts-on]').count()==1 and pg.locator('[data-e=count-add]').count()==0)
    # paid for others boxes
    J("c.commit(d=>{d.accounts.push(c.stamp({id:'pa',name:'Ana',cur:d.settings.homeCur||'PHP',type:'owed',open:0,include:true,archived:false}))})")
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=amount]').click()"); pg.wait_for_timeout(300)
    ha=pg.evaluate("document.querySelector('.amtwrap').getBoundingClientRect().height"); hb=pg.evaluate("document.querySelector('.oth-n').getBoundingClientRect().height")
    pg.evaluate("document.querySelector('[data-e=oth-mode][data-v=pct]').click()"); pg.wait_for_timeout(300)
    hc=pg.evaluate("document.querySelector('.oth-n').getBoundingClientRect().height")
    ok('Set Each Amount and Percentages boxes are as tall as Amount %s'%[ha,hb,hc], abs(ha-hb)<3 and abs(ha-hc)<3)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # investments: 2 decimals
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(800)
    txt=pg.inner_text('#view') if pg.locator('#view').count() else pg.inner_text('body')
    amts=re.findall(r'[+−-]?[₱¥$€][\d,]+(?:\.\d+)?',txt); bad=[a for a in amts if not re.search(r'\.\d\d$',a)]
    ok('Investments money is always 2 decimals (%d amounts, odd: %s)'%(len(amts),bad[:4]), len(amts)>5 and not bad)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
