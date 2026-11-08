# v15.10: investment asset icons (manual pictures kept, renamed imports, unknown coins) and "Platform (Wallet) Asset" names
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      const mk=(id,name,cur,wallet,extra={})=>d.accounts.push(c.stamp({id,name,cur,type:'crypto',exchange:'Bitget',wallet,open:50,include:true,archived:false,...extra}));
      mk('t1','Bitget USDT','USDT','Spot'); mk('t2','Bitget USDT','USDT','Earn'); mk('t3','Bitget USD','USD','Spot'); mk('t4','USDGO','USDGO','Spot'); mk('t5','Bitget USD','USD','Spot',{icon:'plane'}); mk('t6','My BTC','BTC','Spot',{icon:'heart'});
      d.accounts.push(c.stamp({id:'t8',name:'Bitget USD',cur:'USD',type:'crypto',open:5,include:true,archived:false}));
      d.accounts.push(c.stamp({id:'t7',name:'Binance Margin USDT',cur:'USDT',type:'crypto',exchange:'Binance',wallet:'Margin',open:5,include:true,archived:false}));
    })})()""")
    r=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),m=await import('/js/curpicker.js');const db=c.get(),t=db.settings.tickers||{};const g=id=>db.accounts.find(a=>a.id===id);
      return {imp:m.assetIcon(g('t8'),t),impLabel:c.accLabel(g('t8')),labels:['t1','t2','t3','t4','t7'].map(i=>c.accLabel(g(i))),
        usdt:m.assetIcon(g('t1'),t).html.includes('usdt.svg'), usd:m.assetIcon(g('t3'),t), usdgo:m.assetIcon(g('t4'),t), manual:m.assetIcon(g('t5'),t), manualBtc:m.assetIcon(g('t6'),t)}})()""")
    print(r['labels'])
    ok('names read Platform (Where) Asset', r['labels']==['Bitget (Spot) USDT','Bitget (Earn) USDT','Bitget (Spot) USD','Bitget (Spot) USDGO','Binance (Margin) USDT'])
    ok('imported asset renamed Bitget USD: no flag, label Bitget (Spot) USD %s'%r['imp'], '🇺🇸' not in r['imp']['html'] and r['imp']['coin'] and r['impLabel']=='Bitget (Spot) USD')
    ok('USDT keeps its logo', r['usdt'])
    ok('renamed Bitget USD is not a US flag', '🇺🇸' not in r['usd']['html'] and r['usd']['coin'])
    ok('USDGO shows a coin badge, not a flag or flag letter', r['usdgo']['coin'] and 'usdlike' in r['usdgo']['html'])
    ok('a picture you chose is kept over the BTC logo and the code', r['manualBtc'].get('manual') and 'btc.svg' not in r['manualBtc']['html'] and r['manual'].get('manual'))
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.hold',state='attached',timeout=8000); pg.wait_for_timeout(500)
    rows=pg.evaluate("[...document.querySelectorAll('.hold')].map(r=>[r.querySelector('strong').innerText.trim(), r.querySelector('.badge').innerHTML.includes('<img')?'img':r.querySelector('.badge').innerHTML.includes('<svg')?'svg':r.querySelector('.badge').innerText.trim()])")
    print(rows[:12])
    ok('Bitget rows show no US flag', not any('🇺🇸' in x[1] and 'Bitget' in x[0] for x in rows))
    pass
    # picker
    pg.evaluate("(async()=>{const m=await import('/js/acctpicker.js');window.__pick=null;m.openAccountPicker({title:'Move to'},id=>window.__pick=id)})()"); pg.wait_for_selector('#aclist .row')
    names=pg.evaluate("[...document.querySelectorAll('#aclist .row strong')].map(x=>x.innerText.trim())")
    ok('picker lists Bitget (Spot) USDT, Bitget (Earn) USDT, Binance (Margin) USDT', all(n in names for n in ['Bitget (Spot) USDT','Bitget (Earn) USDT','Binance (Margin) USDT']))
    pg.screenshot(path='/tmp/inv_picker.png')
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
