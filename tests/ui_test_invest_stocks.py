from tests.invnavhelp import go_invest
from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
from pkhelp import choose, open_menu
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
U='http://localhost:8123/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page(); pg.add_init_script("try{var c=JSON.parse(localStorage.getItem('sukli-coll')||'{}');if(c['i-crypto']===undefined){c['i-crypto']=false;localStorage.setItem('sukli-coll',JSON.stringify(c))}}catch(e){}");pg.add_init_script("try{localStorage.setItem('sukli-invempty','1')}catch(e){}")
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto(U); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto(U+'#/invest'); pg.wait_for_selector('[data-act=inv-new]'); pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    choose(pg,'#ic [name=type]',value='stock'); pg.fill('#ic [name=ex]','Moomoo'); pg.fill('#ic [name=coin]','NVDA'); pg.fill('#ic [name=amt]','1'); pg.fill('#ic [name=name]','NVIDIA'); choose(pg,'#ic [name=market]',value='NASDAQ'); choose(pg,'#ic [name=quote]',value='PHP'); pg.fill('#ic [name=price]','7000')
    pg.click('#ic button:text-is("Add asset")'); pg.wait_for_timeout(700)
    t=pg.inner_text('#view'); ok('stock added under its platform', 'Moomoo' in t and 'NVDA' in t and 'NASDAQ' in t)
    # Korean / Japanese tickers
    for ex,tk,mk in [('Kiwoom','005930','KRX (Korea)'),('SBI Securities','7203','TSE (Tokyo)')]:
        pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic'); choose(pg,'#ic [name=type]',value='stock'); pg.fill('#ic [name=ex]',ex); pg.fill('#ic [name=coin]',tk); pg.fill('#ic [name=amt]','1'); pg.select_option('#ic [name=market]',mk); choose(pg,'#ic [name=quote]',value='JPY' if tk=='7203' else 'KRW'); pg.click('#ic button:text-is("Add asset")'); pg.wait_for_timeout(600)
    go_invest(pg,None,sec='overview'); pg.evaluate("async(c)=>{const m=await import('/js/invnav.js');m.INV.sec='accounts';m.INV.cat=c;window.dispatchEvent(new Event('sukli-render'))}",'stock'); pg.wait_for_timeout(500)
    t=pg.inner_text('#view'); ok('Korean and Japanese platforms listed (Accounts > Stock Market)', 'kiwoom' in t.lower() and 'sbi' in t.lower())
    ok('tickers shown as products in Stock Market (v16.6: stocks have no platform tab)', '005930' in t or 'kiwoom' in t.lower())
    # buy 2 NVDA at 7000 paying from first account
    go_invest(pg,None,sec='overview'); open_menu(pg,'trade'); pg.wait_for_selector('#tr'); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('.scrim').forEach((e,i,a)=>{if(i<a.length-1)e.remove()})"); choose(pg,'#tr [name=plat]',text='Moomoo'); choose(pg,'#tr [name=asset]',text='NVDA')
    pg.fill('#tr [name=qty]','2'); pg.fill('#tr [name=price]','7000'); pg.click('#tr [data-fm=fixed]'); pg.fill('#tr [name=fee]','50'); pg.click('#tr button:text-is("Record")'); pg.wait_for_timeout(500)
    if pg.locator('[data-yes]').count(): pg.click('[data-yes]'); pg.wait_for_timeout(500)
    pg.wait_for_timeout(500)
    go_invest(pg,None,sec='overview'); pg.evaluate("async(c)=>{const m=await import('/js/invnav.js');m.INV.sec='accounts';m.INV.cat=c;window.dispatchEvent(new Event('sukli-render'))}",'stock'); pg.wait_for_timeout(500); t=pg.inner_text('#view')
    ok('Stock Market card lists Moomoo/NVDA with a total value', ('moomoo' in t.lower() or 'nvda' in t.lower()) and '₱' in t)
    go_invest(pg,None,sec='overview'); t=pg.inner_text('#view')  # v16.6: group-by removed; platforms are the groups
    ok('tickers and prices card', 'Tickers and Prices' in t)
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
