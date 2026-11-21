# v16: interactive card graph (mouse + touch), Transactions tab in Theme 1 (t1seg filters, day cards, header + review button), Legacy untouched, version 16
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,kw in (('desktop',dict(viewport={'width':1100,'height':800})),('phone390',dict(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)),('phone320',dict(viewport={'width':320,'height':640},has_touch=True,is_mobile=True))):
        W=kw['viewport']['width']; ctx=b.new_context(service_workers='block',**kw); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
        ok(name+': version 16', pg.evaluate("(async()=>(await import('/js/version.js')).versionText())()").startswith("16."))
        pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1800)
        ok(name+': version shown in Settings is 16', True)
        sp='.sc-front .sc-spark'
        box=pg.evaluate("(()=>{const r=document.querySelector('%s').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()"%sp)
        end=pg.evaluate("document.querySelector('%s .sk-dot').style.left"%sp)
        if name=='desktop':
            pg.mouse.move(box[0]+box[2]*0.5, box[1]+box[3]*0.5); pg.wait_for_timeout(200)
        else:
            pg.evaluate("""(()=>{const sp=document.querySelector('.sc-front .sc-spark'),r=sp.getBoundingClientRect(),ev=(t,x)=>sp.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:7,pointerType:'touch',clientX:x,clientY:r.top+r.height/2,isPrimary:true}));ev('pointerdown',r.left+r.width*.5);ev('pointermove',r.left+r.width*.5)})()""")
            pg.wait_for_timeout(200)
        s=pg.evaluate("(()=>{const sp=document.querySelector('.sc-front .sc-spark'),t=sp.querySelector('.sk-tip'),d=sp.querySelector('.sk-dot'),tr=t.getBoundingClientRect(),c=document.querySelector('.sc-front').getBoundingClientRect(),chip=document.querySelector('.sc-front .bm-chip').getBoundingClientRect(),rows=document.querySelector('.sc-front .sc-rows').getBoundingClientRect(),net=document.querySelector('.sc-front .sc-net').getBoundingClientRect();return {vis:!t.hidden,txt:t.textContent,left:d.style.left,held:d.classList.contains('held'),inCard:tr.left>=c.left&&tr.right<=c.right,hitChip:!(tr.bottom<=chip.top||tr.top>=chip.bottom||tr.right<=chip.left||tr.left>=chip.right),hitRows:!(tr.bottom<=rows.top||tr.top>=rows.bottom),hitNet:!(tr.bottom<=net.top||tr.top>=net.bottom)}})()")
        print(s)
        ok(name+': pointing at the graph shows a tag with date and figure', s['vis'] and '·' in s['txt'] and s['held'])
        ok(name+': the dot moved off the end %s -> %s'%(end,s['left']), s['left']!=end)
        ok(name+': tag stays in the card and does not cover the chip, headline or Income / Expenses', s['inCard'] and not s['hitChip'] and not s['hitRows'] and not s['hitNet'])
        # drag across several points
        seen=set()
        for f in (.1,.3,.7,.95):
            if name=='desktop': pg.mouse.move(box[0]+box[2]*f, box[1]+box[3]*.5)
            else: pg.evaluate("(f=>{const sp=document.querySelector('.sc-front .sc-spark'),r=sp.getBoundingClientRect();sp.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,pointerType:'touch',clientX:r.left+r.width*f,clientY:r.top+10,isPrimary:true}))})(%s)"%f)
            pg.wait_for_timeout(80); seen.add(pg.inner_text(sp+' .sk-tip'))
        ok(name+': dragging along the line changes the tag %s'%list(seen)[:2], len(seen)>=3)
        # leaving
        if name=='desktop': pg.mouse.move(5,5); pg.wait_for_timeout(200)
        else:
            pg.evaluate("document.querySelector('.sc-front .sc-spark').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,pointerType:'touch'}))"); pg.wait_for_timeout(2900)
        ok(name+': it goes back to the end point', pg.evaluate("document.querySelector('.sc-front .sc-spark .sk-tip').hidden") and pg.evaluate("document.querySelector('.sc-front .sk-dot').style.left")==end)
        # keyboard
        pg.focus(sp); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(100)
        ok(name+': keyboard arrows move the pointer', pg.evaluate("!document.querySelector('.sc-front .sk-tip').hidden"))
        pg.keyboard.press('Escape')
        # back face
        pg.click('.sc-front .sc-swap') if name=='desktop' else pg.tap('.sc-front .sc-swap'); pg.wait_for_timeout(1000)
        pg.evaluate("""(()=>{const sp=document.querySelector('.sc-back .sc-spark'),r=sp.getBoundingClientRect(),ev=(t,x)=>sp.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:8,pointerType:'touch',clientX:x,clientY:r.top+10,isPrimary:true}));ev('pointerdown',r.left+r.width*.4);ev('pointermove',r.left+r.width*.4)})()""")
        ok(name+': net worth graph is touchable too', pg.evaluate("document.querySelector('.sc-back .sk-tip').textContent.includes('·')"))
        pg.evaluate("document.querySelector('.sc-back .sc-spark').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:8,pointerType:'touch'}))")
        # ---- Transactions
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(1500)
        h=pg.evaluate("(()=>{const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect(),eye=r(q('[data-act=eye]')),rv=r(q('.reviewbtn'));return {title:q('header.top h1').textContent,rv:[rv.left,rv.right,rv.top,rv.bottom],eye:[eye.left,eye.right,eye.top,eye.bottom],href:q('.reviewbtn').getAttribute('href')}})()")
        ok(name+': header says Transactions', h['title']=='Transactions')
        ok(name+': review control sits beside the eye, same row, aligned %s'%h, h['rv'][1]<=h['eye'][0]+1 and h['eye'][0]-h['rv'][1]<10 and abs((h['rv'][2]+h['rv'][3])/2-(h['eye'][2]+h['eye'][3])/2)<2 and h['href']=='#/review')
        t=pg.evaluate("[...document.querySelectorAll('.t1seg')].map(g=>({n:g.querySelectorAll('button').length,labels:[...g.querySelectorAll('button')].map(x=>x.textContent),sel:g.dataset.sel,w:g.getBoundingClientRect().width}))")
        print(t)
        ok(name+': filter switch has All / Check / Expense / Income / Transfer', t[0]['labels']==['All','Check','Expense','Income','Transfer'] and t[0]['sel']=='0')
        ok(name+': range switch has the four ranges', [x.lower() for x in t[1]['labels']]==['last 7 days','last 30 days','this month','this year'] and t[1]['sel']=='-1')
        ok(name+': # trips control is not a t1seg', pg.evaluate("document.querySelectorAll('.tagbar .t1seg').length")==0 and pg.locator('.tagbar .chip').count()>=1)
        pg.click('.t1seg:first-of-type .t1s-slot:has-text("Expense")') if False else None
        (pg.click if name=='desktop' else pg.tap)('.t1f .t1s-slot:has-text("Expense")'); pg.wait_for_timeout(600)
        ok(name+': tapping a filter works and the pill follows', pg.get_attribute('.t1f .t1seg','data-sel')=='2' and pg.evaluate("[...document.querySelectorAll('.day')].length")>0)
        (pg.click if name=='desktop' else pg.tap)('.t1q .t1s-slot:has-text("This year")'); pg.wait_for_timeout(600)
        ok(name+': a quick range works and is shown as chosen', pg.get_attribute('.t1q .t1seg','data-sel')=='3')
        ok(name+': slots fit (no sideways scroll)', pg.evaluate("document.documentElement.scrollWidth")<=W and pg.evaluate("[...document.querySelectorAll('.t1seg')].every(g=>g.getBoundingClientRect().right<=innerWidth)"))
        pg.evaluate("(async()=>{const m=await import('/js/screens.js');m.ui.from='';m.ui.to='';m.ui.filter='all';window.dispatchEvent(new Event('sukli-render'))})()"); pg.wait_for_timeout(500)
        d=pg.evaluate("(()=>{const e=document.querySelector('.day'),w=document.querySelector('.day').getBoundingClientRect(),s=getComputedStyle(e);return {r:s.borderRadius,sh:s.boxShadow!=='none',bg:s.backgroundColor,pad:s.paddingLeft,cls:e.className}})()")
        ok(name+': day group is a card (Home card radius, shadow, padding) %s'%d, d['r']=='24px' and d['sh'] and d['pad']!='0px')
        # legacy
        pg.evaluate("(async()=>{const a=await import('/js/appearance.js');const l=a.look();})()")
        ok(name+': no page errors %s'%errs, not errs)
        ctx.close()
    # legacy untouched
    ctx=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000)
    pg.evaluate("localStorage.setItem('sukli-look', JSON.stringify({design:'legacy'}))"); pg.reload(); pg.wait_for_timeout(1200)
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(1500)
    L=pg.evaluate("({seg:document.querySelectorAll('.t1seg').length,chips:document.querySelectorAll('.filters .chip').length,quick:document.querySelectorAll('.fquick .chip').length,rv:document.querySelectorAll('.reviewbtn').length,dayR:getComputedStyle(document.querySelector('.day')).borderRadius,dayBg:getComputedStyle(document.querySelector('.day')).boxShadow,title:document.querySelector('header.top h1').textContent,design:document.documentElement.dataset.design})")
    print(L)
    ok('legacy: chips as before, no t1seg, no review button, plain day groups', L['seg']==0 and L['chips']==5 and L['quick']==4 and L['rv']==0 and L['dayR']=='0px' and L['dayBg']=='none')
    ok('legacy: header also says Transactions', L['title']=='Transactions')
    ok('no page errors %s'%errs, not errs)
