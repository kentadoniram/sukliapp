# v15.54: Model Computation Guide, Outlook additions
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(3000)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(800)
    ok('Settings has a button for the Model Computation Guide', pg.evaluate("[...document.querySelectorAll('[data-act=open-modelguide]')].length")==1)
    pg.evaluate("document.querySelector('[data-act=open-modelguide]').click()"); pg.wait_for_timeout(1200)
    t=pg.evaluate("document.body.textContent")
    heads=pg.evaluate("[...document.querySelectorAll('.sgsec h3')].map(e=>e.textContent)")
    ok('guide has 12 numbered sections %s'%len(heads), len(heads)==12)
    for k in ['(used)','Fixed value','Honest range','Straight run-rate','Safe per day','Weekday index','leave-one-out','Replayed on your history','10%','median of those monthly sums']:
        ok('guide mentions '+k, k in t)
    ok('how the method is chosen shows the rule and a result', 'at least 6 tests' in t and 'Result:' in t)
    ok('guide shows px-free money values', t.count('₱')>40)
    pg.goto('http://localhost:8123/#/outlook'); pg.wait_for_timeout(1500)
    o=pg.evaluate("document.body.textContent")
    ok('Outlook shows Safe to Spend', 'Safe to Spend' in o and 'Per day until' in o)
    ok('Outlook shows how close past forecasts were', 'How Close Past Forecasts Were' in o and 'Typical miss' in o)
    ok('Outlook range sentence says how it was found', 'Likely between' in o)
    pg.wait_for_timeout(500)
    log=pg.evaluate("import('/js/core.js').then(c=>c.get().settings.forecastLog)")
    ok('opening Outlook records next month forecast %s'%list((log or {}).keys()), bool(log) and len(log)==1)
    ok('no page errors %s'%errs, not errs)
