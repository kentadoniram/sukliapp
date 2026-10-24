# v12ad: steady entry form, quick calculator, clear button beside the calculator, Home-only colours, date range size, category sort
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
POS="(()=>{const o=document.querySelector('#f-name').getBoundingClientRect().top;const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top-o),Math.round(r.left),Math.round(r.height)]};return JSON.stringify([q('#f-name'),q('#f-amount'),q('.keypad button'),q('.keypad button:last-child'),q('#whenrow')])})()"
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
        pg.click('#f-name'); pg.keyboard.type('Life Tsuk',delay=30); pg.wait_for_timeout(500)
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
print('SUMMARY', sum(res), 'passed', len(res)-sum(res), 'failed')
