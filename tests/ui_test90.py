# v13.35: category pick-or-create, new category visible at once, item quantity, owed delete, one-line lists, Title Case
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
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
    b.close()
print('fails',res.count(False))
