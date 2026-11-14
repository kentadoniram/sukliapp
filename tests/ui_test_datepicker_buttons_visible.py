# v15.37: Cancel and Set stay visible in the date picker even with the clock open on a small phone
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(375,667),(402,874)]:
        pg=b.new_page(viewport={'width':w,'height':h})
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
        pg.evaluate("import('/js/datepicker.js').then(m=>m.openDatePicker('2026-11-14 10:30:00',()=>{},{title:'When Was It?'}))"); pg.wait_for_selector('#dp'); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('#dp-clock-toggle, [data-clock], #dp-clockbtn')&&0")
        # open the clock: find the button that toggles it
        btn=pg.locator('#dp [data-clock], #dp #dp-clk, #dp [data-e=clock], #dp button:has-text("Clock")')
        if btn.count(): btn.first.click(); pg.wait_for_timeout(300)
        has=pg.locator('#dp-clock').count()
        def vis():
            return pg.evaluate("(()=>{const o=document.querySelector('#dp [data-ok]').getBoundingClientRect(),c=document.querySelector('#dp [data-no]').getBoundingClientRect();return [o.bottom<=innerHeight+1&&o.top>=0,c.bottom<=innerHeight+1&&c.top>=0]})()")
        ok('%dx%d clock open=%s: Cancel and Set in view %s'%(w,h,bool(has),vis()), all(vis()))
        pg.close()
    b.close()
