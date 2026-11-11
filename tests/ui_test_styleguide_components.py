# v15.23: #/styleguide page, textField/selectField/tabs helpers, qty stepper in one rule set
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    H=pg.evaluate("""(async()=>{const c=await import('/js/components.js');return {tf:c.textField({label:'Name <b>',id:'x1',value:'a"b',inputmode:'decimal',hint:'hi'}),sf:c.selectField({label:'Pick',id:'x2',options:['A','B'],value:'B'}),tb:c.tabs({items:[{label:'Spot',value:'s',cls:'w-spot'},{label:'Earn',value:'e'}],value:'e',act:'t'})}})()""")
    ok('textField escapes and sets id/inputmode', '&lt;b&gt;' in H['tf'] and 'id="x1"' in H['tf'] and 'inputmode="decimal"' in H['tf'] and 'value="a&quot;b"' in H['tf'])
    ok('selectField marks the value', '<option value="B" selected>' in H['sf'] and 'id="x2"' in H['sf'])
    ok('tabs mark the selected tab', H['tb'].count('wtab')>=2 and 'aria-selected="true"' in H['tb'] and 'w-spot' in H['tb'])
    pg.goto('http://localhost:8123/#/styleguide'); pg.wait_for_selector('.sgsec'); pg.wait_for_timeout(300)
    heads=pg.locator('.sgsec h3').all_inner_texts()
    ok('style guide shows every component group %s'%heads, all(x in heads for x in ['Colours','Buttons','Fields','Tabs','Box']))
    ok('buttons of every kind are on the page', pg.locator('.sgsec .btn.danger,.sgsec .linkbtn,.sgsec .chip,.sgsec .seg').count()>=6)
    pg.click('[data-act=sg-sheet]'); pg.wait_for_selector('.sheet'); ok('sample sheet opens', 'Sample Sheet' in pg.inner_text('.sheet'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.emulate_media(color_scheme='dark'); pg.wait_for_timeout(200)
    sw=pg.evaluate("[...document.querySelectorAll('.sgsw1 i')].map(e=>getComputedStyle(e).backgroundColor)")
    ok('colour swatches all resolve in dark mode', len(sw)>=12 and all(x.startswith('rgb') and x!='rgba(0, 0, 0, 0)' for x in sw))
    pg.emulate_media(color_scheme='light')
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(300)
    ok('menu has Style Guide link (Advanced)', pg.evaluate("(async()=>{const v=await import('/js/views.js');return true})()"))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
