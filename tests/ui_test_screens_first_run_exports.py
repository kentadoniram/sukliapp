# v15.16: screen sizes, steady entry form, first screen, clear button and exports, transfer labels (merged from five tests that each used their own browser setup)
import re, json
from playwright.sync_api import sync_playwright

def part_phone_sizes():
    CSV='/home/claude/Transactions.csv'; res=[]
    def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
    ROUTES=['home','ledger','calendar','accounts','budget','cashflow','outlook','analytics','invest','settings']
    UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    SMALL="[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]),select,textarea')].filter(e=>e.getBoundingClientRect().width>0&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.name||e.id||e.className)"
    OVER="(()=>{const W=innerWidth;return [document.documentElement.scrollWidth>W+1,[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>W+1)&&getComputedStyle(e).position!=='fixed'&&!e.closest('svg,.wkv,.chips,.qp,.fquick,.ratebox,.scrollx,.seg,.nmap')}).length]})()"
    with sync_playwright() as p:
        b=p.chromium.launch()
        ctx=b.new_context(viewport={'width':402,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block')
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
        for w in (320,360,402):
            pg.set_viewport_size({'width':w,'height':874}); small=[]; over=[]
            for r in ROUTES:
                pg.goto('http://localhost:8123/#/'+r); pg.wait_for_timeout(450)
                pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.wait_for_timeout(100)
                small+= [f'{r}:{x}' for x in pg.evaluate(SMALL)]
                o=pg.evaluate(OVER)
                if o[0] or o[1]: over.append(f'{r}:{o}')
            ok(f'[{w}] no field under 16px (Safari would zoom in): {small}', not small)
            ok(f'[{w}] no sideways scroll on any screen: {over}', not over)
            pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(400)
            g=pg.evaluate("(()=>{const a=[...document.querySelectorAll('.fdbtn')].map(e=>e.getBoundingClientRect());return [a.length,a[0]&&a[1]&&a[0].right<=a[1].left-6,a[0]&&a[0].width>=90]})()")
            ok(f'[{w}] date range buttons sit apart and are wide enough', g[0]==2 and g[1] and g[2])
        # zoom guards
        pg.set_viewport_size({'width':402,'height':874})
        pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(300)
        pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-amount'); pg.click('[data-e=calc]'); pg.wait_for_timeout(250)
        ta=pg.evaluate("[getComputedStyle(document.querySelector('.keypad button')).touchAction,getComputedStyle(document.body).touchAction]")
        ok(f'keypad has touch-action manipulation: {ta}', ta[0]=='manipulation')
        # tap the same key twice quickly, page must not change scale
        sc0=pg.evaluate("visualViewport.scale")
        for _ in range(4): pg.tap('.keypad button[data-v="7"]',timeout=3000)
        ok('same key tapped four times keeps the scale', pg.evaluate("visualViewport.scale")==sc0 and pg.input_value('#f-amount')=='7777')
        # keyboard-sized screen: nothing moves while typing
        pg.set_viewport_size({'width':402,'height':540})
        pg.wait_for_timeout(300)
        POS="(()=>{const o=document.querySelector('#f-what').getBoundingClientRect().top;const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top-o),Math.round(r.height)]};return JSON.stringify([q('#f-amount'),q('.keypad button'),q('#whenrow'),q('#acctrow')])})()"
        p0=pg.evaluate(POS); st=True
        pg.tap('#f-what'); pg.keyboard.type('Life Tsukagoshi',delay=20); pg.wait_for_timeout(500)
        st = pg.evaluate(POS)==p0
        for k in ['1','2','+','3','⌫','=']:
            pg.tap(f'.keypad button[data-v="{k}"]'); 
            if pg.evaluate(POS)!=p0: st=False
        ok('entry form stays put with a short (keyboard) screen', st)
        # caret alignment: text box content is vertically centred
        c=pg.evaluate("(()=>{const e=document.querySelector('#f-what');const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return [r.height,parseFloat(cs.lineHeight)||0,parseFloat(cs.paddingTop),parseFloat(cs.paddingBottom)]})()")
        ok(f'text box height {c[0]} with equal top/bottom padding', c[0]>=44 and c[2]==c[3])
        ok('no page errors', not errs)
        b.close()


def part_entry_form_steady():
    CSV='/home/claude/Transactions.csv'; res=[]
    def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
    POS="(()=>{const o=document.querySelector('#f-what').getBoundingClientRect().top;const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top-o),Math.round(r.left),Math.round(r.height)]};return JSON.stringify([q('#f-what'),q('#f-amount'),q('.keypad button'),q('.keypad button:last-child'),q('#whenrow')])})()"
    with sync_playwright() as p:
        b=p.chromium.launch()
        for vw,vh in ((390,844),(1100,800)):
            pg=b.new_page(viewport={'width':vw,'height':vh},service_workers='block'); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
            pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
            pg.evaluate("""(async()=>{const m=await import('/js/core.js');const s=new Date().toISOString().slice(0,10);m.commit(d=>{const a=d.accounts.find(x=>!x.deleted&&x.type!=='card'&&x.type!=='loan');for(let i=0;i<8;i++){const t=new Date(Date.now()-i*864e5).toISOString().slice(0,10);d.txs.push(m.stamp({id:'w'+i,kind:'expense',acct:a.id,amount:100+i*150,cur:a.cur,fx:1,date:t+' 09:00:00',name:'wk'+i,cat:(d.categories.find(c=>c.kind==='expense')||{}).id}))}})})()""")
            pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(400)
            pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-amount')
            pg.click('[data-e=calc]'); pg.wait_for_timeout(250)
            p0=pg.evaluate(POS)
            pg.click('#f-what'); pg.keyboard.type('Life Tsuk',delay=30); pg.wait_for_timeout(500)
            ok(f'[{vw}] typing the name moves nothing', pg.evaluate(POS)==p0)
            steady=True
            for k in ['1','2','3','+','4','5','⌫','⌫','6','=']:
                pg.click(f'.keypad button[data-v="{k}"]'); 
                if pg.evaluate(POS)!=p0: steady=False
            pg.wait_for_timeout(600)
            ok(f'[{vw}] keys, result line and guesses never shift the keypad', steady and pg.evaluate(POS)==p0)
            ok(f'[{vw}] no amount-based "Fits" tab', 'Fits' not in pg.inner_text('#freq'))
            # speed: 30 key taps
            import time
            t=time.time()
            for i in range(30): pg.evaluate("document.querySelector('.keypad button[data-v=\"7\"]').click()")
            pg.evaluate("document.querySelector('.keypad button[data-v=\"C\"]').click()")
            dt=time.time()-t
            ok(f'[{vw}] keys answer quickly ({dt:.2f}s for 31)', dt<2.0)
            # clear button beside the calculator
            pg.click('.keypad button[data-v="8"]'); pg.wait_for_timeout(100)
            geo=pg.evaluate("(()=>{const x=document.querySelector('.amtx').getBoundingClientRect(),c=document.querySelector('.calcbtn').getBoundingClientRect(),i=document.querySelector('#f-amount').getBoundingClientRect();return [x.right<=c.left+1, Math.abs((x.top+x.height/2)-(c.top+c.height/2))<8, x.left>=i.right-1, getComputedStyle(document.querySelector('.amtx')).visibility]})()")
            ok(f'[{vw}] x sits next to the calculator button, outside the typing area', geo[0] and geo[1] and geo[2] and geo[3]=='visible')
            pg.click('.amtx'); pg.wait_for_timeout(100)
            ok(f'[{vw}] x clears the amount', pg.input_value('#f-amount')=='' and pg.evaluate("getComputedStyle(document.querySelector('.amtx')).visibility")=='hidden')
            pg.keyboard.press('Escape')
            # Home chart coloured, Entries not
            pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(700)
            ok(f'[{vw}] Home week chart is coloured', pg.locator('.week .wb i[style*=hsl], .week .wtrack i[style*=hsl]').count()>=3)
            pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(500)
            ok(f'[{vw}] Entries days are not coloured', pg.locator('.dtot[style*=hsl]').count()==0)
            w=pg.evaluate("[...document.querySelectorAll('.fdbtn')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.width]})")
            ok(f'[{vw}] date range boxes are small and apart', len(w)==2 and w[1][0]-w[0][1]>=6)
            # accounts sorting: assets/debts first, then kinds
            pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(500)
            pg.select_option('[data-aview=sort]','cat'); pg.wait_for_timeout(400)
            tops=pg.evaluate("[...document.querySelectorAll('.topgrp .tophead h2')].map(h=>h.textContent)")
            kinds=pg.evaluate("[...document.querySelectorAll('.topgrp.assets .collhead h2')].map(h=>h.textContent.replace(/\\s+/g,' '))")
            ok(f'[{vw}] assets before debts', tops[:1]==['Assets'])
            ok(f'[{vw}] assets split by kind (Cash, Bank, E-wallet…)', any('Cash' in k for k in kinds) and not any('Cash and bank' in k for k in kinds))
            ok(f'[{vw}] no page errors', not errs)
        b.close()


def part_first_screen_tips():
    CSV='/home/claude/Transactions.csv'; res=[]
    def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
    UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    URL='http://localhost:8123/'
    with sync_playwright() as p:
        b=p.chromium.launch()
        ctx=b.new_context(viewport={'width':402,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(URL); pg.wait_for_selector('.welcome')
        t=pg.inner_text('#view')
        ok('first screen has the two buttons', pg.locator('[data-act=wz-new]').inner_text()=='I am new' and 'budget app before' in pg.locator('[data-act=wz-old]').inner_text())
        ok('first screen is short', len(t)<260)
        ok('restore-backup button is there', pg.locator('#first-json').count()==1)
        # used before: the old window
        pg.tap('[data-act=wz-old]'); pg.wait_for_timeout(300)
        ok('"used a budget app" shows the old welcome', 'Start: add my first account' in pg.inner_text('#view') and pg.locator('#first-file').count()==1)
        pg.tap('[data-act=wz-home]'); pg.wait_for_timeout(300)
        # I am new: one question at a time
        pg.tap('[data-act=wz-new]'); pg.wait_for_timeout(300); ok('mode choice comes first', 'How do you want Sukli' in pg.inner_text('#view')); pg.tap('[data-act=wz-lvl][data-v=simple]'); pg.wait_for_timeout(300)
        ok('question 1 alone: What did you spend?', 'What did you spend?' in pg.inner_text('#view') and 'How much?' not in pg.inner_text('#view') and 'Question 1 of 5' in pg.inner_text('#view'))
        ok('Next is off until you answer', pg.locator('#wz-next').is_disabled())
        pg.tap('#wz-what'); pg.keyboard.type('Lunch'); pg.wait_for_timeout(150)
        ok('Next turns on after typing', not pg.locator('#wz-next').is_disabled())
        pg.tap('#wz-next'); pg.wait_for_timeout(300)
        ok('question 2: How much?', 'How much?' in pg.inner_text('#view') and 'rough' in pg.inner_text('#view'))
        pg.tap('#wz-amt'); pg.keyboard.type('800'); pg.tap('#wz-next'); pg.wait_for_timeout(300)
        ok('question 3: How did you pay?', 'How did you pay?' in pg.inner_text('#view') and pg.locator('#wz-next').is_disabled())
        pg.tap('[data-act=wz-pay][data-v=cash]'); pg.wait_for_timeout(250); pg.tap('#wz-next'); pg.wait_for_timeout(300)
        v=pg.inner_text('#view')
        ok('question 4: current value, not subtracted again', 'How much is in it now?' in v and 'not' in v and 'after this payment' in v)
        pg.tap('#wz-now'); pg.keyboard.type('4200'); pg.tap('#wz-next'); pg.wait_for_timeout(300)
        labels=pg.eval_on_selector_all('[data-act=wz-when]','bs=>bs.map(b=>b.textContent)')
        ok(f'question 5: rough times offered: {labels}', 'When was it?' in pg.inner_text('#view') and labels[:4]==['Just now','1 hour ago','6 hours ago','Yesterday'] and 'Pick a date' in labels[4])
        ok('last button says Save', 'Save my first entry' in pg.locator('#wz-next').inner_text())
        pg.tap('[data-act=wz-when][data-v="1"]'); pg.wait_for_timeout(250); pg.tap('#wz-next'); pg.wait_for_timeout(700)
        r=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const d=c.get();const a=d.accounts[0],t=d.txs[0];const bal=c.balances(d).get(a.id);const cat=d.categories.find(x=>x.id===t.cat);return {n:d.accounts.length,m:d.txs.length,open:a.open,bal,type:a.type,name:t.name,amt:t.amount,cat:cat&&cat.name,age:(Date.now()-new Date(t.date.replace(' ','T')).getTime())/3600e3}})()""")
        ok(f'account and entry created: {r}', r['n']==1 and r['m']==1 and r['name']=='Lunch' and r['amt']==800 and r['cat']=='Dining out')
        ok('starting balance 5000, balance now exactly what you typed (4200)', r['open']==5000 and abs(r['bal']-4200)<0.001)
        ok('about one hour ago', 0.9<r['age']<1.2)
        ok('tabs are shown after the first entry', not pg.evaluate("document.getElementById('tabs').hidden"))
        # empty-state wording on Home and Entries (account exists, entry removed in a second profile)
        ok('no script errors (new flow)', not errs)
        ctx.close()
        # card: "now" is what you owe
        ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_selector('.welcome')
        r=pg.evaluate("""(async()=>{const w=await import('/js/welcome.js'),c=await import('/js/core.js');w.createFirst({what:'Taxi',amount:1000,pay:'card',now:6000,date:'2026-10-25 09:00:00'});const d=c.get();return [c.balances(d).get(d.accounts[0].id),d.accounts[0].type,w.guessCat('lunch at ramen')[1],w.guessCat('zzz')]})()""")
        ok(f'credit card: you owe 6000 after the payment, shown as -6000: {r}', abs(r[0]+6000)<0.001 and r[1]=='card' and r[2]=='Dining out' and r[3] is None)
        ctx.close()
        # restore own JSON backup on a fresh install
        ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_selector('.welcome')
        pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
        snap=pg.evaluate("JSON.stringify(window.sukli.get())"); cnt=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length"); ctx.close()
        open('/tmp/sukli-own-backup.json','w').write(snap)
        ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL); pg.wait_for_selector('#first-json',state='attached')
        pg.set_input_files('#first-json','/tmp/sukli-own-backup.json'); pg.wait_for_timeout(1500)
        got=pg.evaluate("window.sukli.get().txs.filter(t=>!t.deleted).length")
        ok(f'own backup restores on the first screen: {got} of {cnt}', got==cnt and cnt>50 and pg.locator('.welcome').count()==0)
        ok('tabs back after restore', not pg.evaluate("document.getElementById('tabs').hidden"))
        open('/tmp/bad.json','w').write('{"hello":1}')
        ctx2=b.new_context(viewport={'width':402,'height':874},service_workers='block'); p2=ctx2.new_page(); p2.goto(URL); p2.wait_for_selector('#first-json',state='attached'); p2.set_input_files('#first-json','/tmp/bad.json'); p2.wait_for_timeout(600)
        ok('a wrong file is refused politely and nothing changes', 'Sukli backup' in p2.inner_text('.toast') and p2.locator('.welcome').count()==1); ctx2.close()
        # Budget pie: only the pie redraws
        pg.goto(URL+'#/budget'); pg.wait_for_selector('#bpie'); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('#view').firstElementChild.dataset.mark='kept'; document.querySelector('.bwarn, [data-bscope]').dataset.mark='kept'")
        h0=pg.evaluate("document.querySelector('#bpie').innerHTML.length")
        pg.click('[data-act=pieby][data-v=category]'); pg.wait_for_timeout(300)
        kept=pg.evaluate("document.querySelectorAll('[data-mark=kept]').length")
        ok(f'By category changes the pie but not the rest of the page: kept {kept}', kept==2 and pg.evaluate("document.querySelector('[data-act=pieby][data-v=category]').classList.contains('on')") and pg.evaluate("document.querySelector('[data-act=pieby][data-v=group]').getAttribute('aria-pressed')")=='false')
        pg.click('[data-act=pieby][data-v=group]'); pg.wait_for_timeout(300)
        ok('and back to By group', pg.evaluate("document.querySelector('[data-act=pieby][data-v=group]').classList.contains('on')") and pg.evaluate("document.querySelectorAll('[data-mark=kept]').length")==2)
        # haptic hook: a tap flips the hidden switch (iPhone gets a tap from that)
        pg.add_init_script('Object.defineProperty(navigator,"vibrate",{value:undefined,configurable:true})'); pg.goto(URL+'#/home'); pg.reload(); pg.wait_for_timeout(700)
        sw=lambda: pg.evaluate("(()=>{const i=document.getElementById(document.querySelector('label.fbswitch').htmlFor);return i?i.checked:null})()")
        seq=[]
        for _ in range(3): pg.click('header [data-act=eye]'); pg.wait_for_timeout(200); seq.append(sw())
        ok(f'each tap flips the hidden haptic switch (iPhone buzz): {seq}', None not in seq and seq[0]!=seq[1] and seq[1]!=seq[2])
        ok('no script errors (restore, budget)', not errs)
        ctx.close()
        # empty-state wording
        ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_selector('.welcome')
        pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.push(c.stamp({id:'a1',name:'Wallet',type:'cash',cur:c.HOME,open:1000,openDate:'2026-10-01',include:true}))})})()"""); pg.wait_for_timeout(500)
        pg.goto(URL+'#/home'); pg.wait_for_timeout(600); h=pg.inner_text('#view')
        ok(f'Home empty text is short ({len(h)} chars)', len(h)<520 and 'Tap the round' not in h and 'Next step' in h)
        pg.click('.nextstep .tipbtn'); pg.wait_for_timeout(200)
        ok('the tip opens only on tap and holds the explanation', 'Tap the round' in pg.inner_text('.nextstep + .tipbox, .tipbox'))
        pg.goto(URL+'#/ledger'); pg.wait_for_timeout(500); e=pg.inner_text('#ledger-list')
        ok(f'Entries empty message is one short line: {e!r}', e.startswith('No entries yet') and 'Tap the round' not in e)
        pg.click('#ledger-list .tipbtn'); pg.wait_for_timeout(200)
        ok('Entries tip opens on tap', 'round + button' in pg.inner_text('#ledger-list + .tipbox, .tipbox'))
        ctx.close()


def part_clear_button_exports():
    CSV='/home/claude/Transactions.csv'; res=[]
    def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
    UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    ALIGN="""(sel)=>{const f=document.querySelector(sel),b=document.querySelector('.clearx');if(!f||!b||b.hidden)return null;const r=f.getBoundingClientRect(),c=b.getBoundingClientRect();return {dx:Math.round(r.right-c.right),dy:Math.round((c.top+c.height/2)-(r.top+r.height/2)),inside:c.left>=r.left&&c.right<=r.right}}"""
    with sync_playwright() as p:
        b=p.chromium.launch()
        for vw in (320,402):
            ctx=b.new_context(viewport={'width':vw,'height':874},device_scale_factor=3,is_mobile=True,has_touch=True,user_agent=UA,service_workers='block',accept_downloads=True)
            pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
            pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
            # ---- clear button on the Entries search box
            pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#q'); pg.tap('#q'); pg.keyboard.type('coffee'); pg.wait_for_timeout(250)
            a=pg.evaluate(ALIGN,'#q')
            ok(f'[{vw}] x shows inside the search box, right edge, centred: {a}', a and a['inside'] and 0<=a['dx']<=14 and abs(a['dy'])<=2)
            pg.tap('.clearx'); pg.wait_for_timeout(250)
            ok(f'[{vw}] x empties the box and hides itself', pg.input_value('#q')=='' and pg.evaluate("document.querySelector('.clearx').hidden"))
            # ---- layout shift above the field: the x must follow without any scroll event
            pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-what')
            pg.tap('#f-what'); pg.keyboard.type('Starbucks'); pg.wait_for_timeout(300)
            a=pg.evaluate(ALIGN,'#f-what'); ok(f'[{vw}] x on the What was it? box: {a}', a and a['inside'] and 0<=a['dx']<=14 and abs(a['dy'])<=2)
            pg.evaluate("(()=>{const d=document.createElement('div');d.id='shim';d.style.height='57px';document.querySelector('#f-what').closest('.field').before(d)})()"); pg.wait_for_timeout(250)
            a=pg.evaluate(ALIGN,'#f-what'); ok(f'[{vw}] x follows when the layout above moves: {a}', a and a['inside'] and 0<=a['dx']<=14 and abs(a['dy'])<=2)
            # field scrolled out of sight: x must not float over other things
            pg.evaluate("document.querySelector('#shim').style.height='3000px'; document.querySelector('.sheet-body').scrollTop=1500"); pg.wait_for_timeout(350)
            vis=pg.evaluate("(()=>{const f=document.querySelector('#f-what').getBoundingClientRect(),sb=document.querySelector('.sheet-body').getBoundingClientRect(),b=document.querySelector('.clearx'),c=b.getBoundingClientRect();return [f.bottom<sb.top||f.top>sb.bottom,b.hidden||c.bottom<sb.top||c.top>sb.bottom]})()")
            ok(f'[{vw}] x hides when its field is scrolled out of view: {vis}', vis[0] and vis[1])
            pg.evaluate("document.querySelector('#shim').remove(); document.querySelector('.sheet-body').scrollTop=0"); pg.wait_for_timeout(300)
            pg.tap('#f-what'); pg.wait_for_timeout(200); pg.tap('.clearx'); pg.wait_for_timeout(200)
            ok(f'[{vw}] x clears the entry name', pg.input_value('#f-what')=='')
            # amount x sits between the number and the calculator button
            pg.fill('#f-amount','1234'); pg.dispatch_event('#f-amount','input'); pg.wait_for_timeout(200)
            g=pg.evaluate("(()=>{const i=document.querySelector('#f-amount').getBoundingClientRect(),x=document.querySelector('.amtx').getBoundingClientRect(),c=document.querySelector('[data-e=calc]').getBoundingClientRect();return [Math.round(x.left-i.right)>=-2,x.right<=c.left+1,Math.abs((x.top+x.height/2)-(i.top+i.height/2))<=3]})()")
            ok(f'[{vw}] amount x sits beside the calculator button and is centred: {g}', all(g))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            if pg.locator('.scrim').count(): pg.evaluate("document.querySelector('[data-close]').click()")
            # ---- Entries: Clear all on the same row as the two pickers
            pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_selector('#acctfilter'); pg.wait_for_timeout(300)
            r=pg.evaluate("(()=>{const t=s=>Math.round(document.querySelector(s).getBoundingClientRect().top);const q=s=>document.querySelector(s).getBoundingClientRect();return [t('#acctfilter'),t('#lf-cat'),t('[data-act=f-clear]'),q('#acctfilter').width,q('#lf-cat').width,document.documentElement.scrollWidth<=innerWidth+1]})()")
            ok(f'[{vw}] All accounts, All categories and Clear all are on one row: {r}', abs(r[0]-r[1])<=4 and abs(r[1]-r[2])<=6 and r[3]>=90 and r[4]>=80 and r[5])
            # ---- the Spent total says what it covers
            pg.click('[data-act=filter][data-v=expense]'); pg.wait_for_timeout(300)
            pg.evaluate("document.querySelector('[data-act=f-range][data-v=\"y\"]').click()"); pg.wait_for_timeout(400)
            t=pg.inner_text('#lsum')
            ok(f'[{vw}] summary names the dates covered: {t[:140]!r}', 'Dates covered:' in t and ' to ' in t and 'Total spent' in t)
            ok(f'[{vw}] summary shows an amount, not only a count', re.search(r'[₱¥$]\s?[\d,]+',t) is not None)
            pg.click('[data-act=f-clear]'); pg.click('[data-act=filter][data-v=expense]'); pg.wait_for_timeout(300)
            t=pg.inner_text('#lsum') if pg.locator('#lsum').count() else ''
            ok(f'[{vw}] with no range it says all dates: {t[:100]!r}', 'Dates covered: all dates' in t)
            ok(f'[{vw}] no script errors', not errs)
            ctx.close()
        # ---- export file names
        ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block',accept_downloads=True); pg=ctx.new_page()
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
        pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('[data-act=export-csv]'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        names=[]
        for sel in ('export-csv','export-json'):
            with pg.expect_download() as dl: pg.evaluate(f"document.querySelector('[data-act={sel}]').click()")
            names.append(dl.value.suggested_filename)
        ok(f'CSV name has date and HHMM: {names[0]}', re.fullmatch(r'sukli-\d{4}-\d{2}-\d{2}-([01]\d|2[0-3])[0-5]\d\.csv',names[0]))
        ok(f'JSON name has date and HHMM: {names[1]}', re.fullmatch(r'sukli-backup-\d{4}-\d{2}-\d{2}-([01]\d|2[0-3])[0-5]\d\.json',names[1]))
        ctx.close()


def part_entry_transfer_labels():
    CSV='/home/claude/Transactions.csv'
    errs=[]; res=[]
    def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
    with sync_playwright() as p:
        b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
        pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
        pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
        names=pg.evaluate("()=>import('./js/core.js').then(c=>c.get().accounts.filter(a=>!a.deleted).map(a=>a.name+' · '+a.cur))")
        # transfer with a blank label
        pg.evaluate("()=>window.sukli.openEntry({})"); pg.wait_for_selector('#entry'); pg.click('[data-e="kind"][data-v="transfer"]')
        pg.select_option('#f-acct',label=names[0]); pg.select_option('#f-to',label=names[1]); pg.wait_for_timeout(100)
        ph=pg.get_attribute('#f-what','placeholder'); ok('placeholder shows the two accounts', names[0].split(' · ')[0] in ph and names[1].split(' · ')[0] in ph)
        pg.fill('#f-amount','100'); pg.click('[data-e="save"]'); pg.wait_for_timeout(400)
        last=pg.evaluate("()=>import('./js/core.js').then(c=>{const t=c.get().txs.filter(t=>t.kind==='transfer'&&!t.deleted).sort((a,b)=>a.updatedAt<b.updatedAt?1:-1)[0];return {n:t.name,auto:t.autoName,flag:t.flag}})")
        print(' transfer saved as',last); ok('blank transfer label becomes From - To', last['n']==names[0].split(' · ')[0]+' - '+names[1].split(' · ')[0] and not last['flag'])
        # expense with no label: category Grocery, usual amount -> label from history, goes to Review
        pg.evaluate("()=>window.sukli.openEntry({})"); pg.wait_for_selector('#entry'); pg.fill('#f-amount','350')
        pg.fill('#f-what','Grocery'); pg.wait_for_timeout(300)
        ch=pg.locator('#catrow [data-e=cat]:has-text("Grocery")')
        if ch.count(): ch.first.click(); pg.wait_for_timeout(200)
        pg.fill('#f-what',''); pg.dispatch_event('#f-what','input'); pg.click('[data-e="save"]'); pg.wait_for_timeout(400)
        e=pg.evaluate("()=>import('./js/core.js').then(c=>{const t=c.get().txs.filter(t=>t.kind==='expense'&&!t.deleted).sort((a,b)=>a.updatedAt<b.updatedAt?1:-1)[0];return {n:t.name,auto:t.autoName,flag:t.flag}})")
        print(' expense saved as',e); ok('blank expense label is guessed and put on Review', e['n'] and e['auto'] and e['flag']=='review')
        # Save stays reachable in a short viewport (keyboard open)
        pg.set_viewport_size({'width':390,'height':480})
        pg.evaluate("()=>window.sukli.openEntry({})"); pg.wait_for_selector('#entry'); pg.focus('#f-notes'); pg.wait_for_timeout(500)
        box=pg.locator('#btns [data-e=save]').bounding_box(); ok('Save button inside the visible area', box and box['y']>=0 and box['y']+box['height']<=480)
        print('ERRS',errs); ok('no script errors', not errs)
        b.close()
    print(sum(res),'/',len(res))


for fn in [part_phone_sizes, part_entry_form_steady, part_first_screen_tips, part_clear_button_exports, part_entry_transfer_labels]:
    fn()
