# v16.44b: picture styles in Settings (default duotone, both designs), no auto keyboard, no re-created pop-up / seg on switching
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874},service_workers='block'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    ds=lambda: pg.evaluate("document.documentElement.dataset.icstyle")
    ok('default is duotone (theme1)', ds()=='duotone')
    pg.evaluate("localStorage.setItem('sukli-look',JSON.stringify({design:'legacy'}))"); pg.reload(); pg.wait_for_timeout(1500)
    ok('default is duotone (legacy)', ds()=='duotone')
    pg.evaluate("localStorage.removeItem('sukli-look')"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("location.hash='#/settings'"); pg.wait_for_selector('.icstile'); 
    ok('7 styles offered', pg.locator('.icstile').count()==7)
    ok('duotone tile selected', pg.locator('.icstile[aria-pressed=true]').inner_text().strip().startswith('Duotone'))
    for v in ['solid','gradient','sticker','clay','glass','ring','duotone']:
        pg.click(f'.icstile[data-v={v}]'); pg.wait_for_timeout(250)
        ok(f'style {v} applied', ds()==v)
    pg.evaluate("location.hash='#/accountset'"); pg.wait_for_selector('.asrow'); pg.wait_for_timeout(300)
    ok('badges get --c', pg.evaluate("document.querySelectorAll('[data-ic]').length")>5)
    bg=pg.evaluate("getComputedStyle(document.querySelector('.asrow [data-ic]')||document.querySelector('[data-ic]')).borderRadius")
    ok('duotone tile is a rounded square %s'%bg, bg!='50%')
    # entry
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({})}"); pg.wait_for_selector('#f-amount'); pg.fill('#f-amount','1000')
    pg.evaluate("document.activeElement&&document.activeElement.blur()")
    foc=lambda: pg.evaluate("document.activeElement?document.activeElement.tagName+'#'+document.activeElement.id:''")
    pg.click('[data-e=items-on]'); pg.wait_for_selector('#itembox'); ok('no keyboard when items open %s'%foc(), 'INPUT' not in foc())
    pg.click('#itembox #wdbox [data-e=wd-toggle]'); pg.wait_for_timeout(200); ok('no keyboard on whole-bill discount %s'%foc(), 'INPUT' not in foc())
    pg.click('#itembox [data-e=tax-toggle]'); pg.wait_for_timeout(200); ok('no keyboard on tax %s'%foc(), 'INPUT' not in foc())
    pg.click('[data-e=item-add]'); pg.wait_for_timeout(200); ok('no keyboard on add item %s'%foc(), 'INPUT' not in foc())
    # pop-up must not be rebuilt when a switch is pressed
    pg.evaluate("window.__pc=document.querySelector('#itembox'); window.__anim=0; new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType==1&&(n.matches('.popcard.fresh')||n.querySelector&&n.querySelector('.popcard.fresh')))window.__anim++}))).observe(document.querySelector('#itemsrow'),{childList:true,subtree:true})")
    pg.click('#itembox #f-wdv ~ .t1seg [data-v=amt], #itembox #wdbox .t1seg [data-v=amt]'); pg.wait_for_timeout(300)
    ok('switching mode does not replay the pop-up animation', pg.evaluate("window.__anim")==0 and pg.evaluate("!!document.querySelector('#itembox') && !document.querySelector('#itembox.fresh')"))
    pg.click('#itembox [data-e=items-done]'); pg.wait_for_timeout(200)
    # cashback: seg slides in place
    pg.click('#cbrow [data-e=cb-on]'); pg.wait_for_selector('#f-cbv'); pg.evaluate("window.__s=document.querySelector('#cbrow .t1seg'); window.__i=document.querySelector('#f-cbv')")
    pg.click('#cbrow .t1seg [data-v=pct]'); pg.wait_for_timeout(100)
    ok('cashback seg and input are the same elements after switching', pg.evaluate("window.__s===document.querySelector('#cbrow .t1seg') && window.__i===document.querySelector('#f-cbv') && document.querySelector('#cbrow .t1seg').dataset.sel")=='1')
    # tax sheet: seg stays
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("async()=>{const m=await import('/js/entry.js');m.openEntry({})}"); pg.wait_for_selector('#f-amount'); pg.fill('#f-amount','500')
    pg.click('.adjlink'); pg.wait_for_selector('#adjf'); ok('no keyboard in tax sheet %s'%foc(), 'INPUT' not in foc())
    pg.evaluate("window.__t=document.querySelector('#aj-tseg .t1seg')"); pg.click('#aj-tseg [data-v=amt]'); pg.wait_for_timeout(100)
    ok('tax sheet seg kept (slides, no flash)', pg.evaluate("window.__t===document.querySelector('#aj-tseg .t1seg') && window.__t.dataset.sel")=='1')
    ok('no errors %s'%errs, not errs)
print('%d/%d passed'%(sum(res),len(res)))
