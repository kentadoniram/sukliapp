# v15.48: Worth Knowing cards (discovery, evidence, why it matters, what you could do), history, dismiss
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1500)
    n=pg.locator('.ins.worth > li').count(); ok('Worth Knowing shows 1 to 3 findings (%d)'%n, 1<=n<=3)
    ok('each has a label saying how sure it is', pg.locator('.ins.worth .wkbadge').count()==n and all(t in ('COUNTED','ESTIMATE','PROJECTION') for t in [x.upper() for x in pg.locator('.ins.worth .wkbadge').all_inner_texts()]))
    ok('closed by default, only the headline shows', pg.locator('.ins.worth details[open]').count()==0 and not pg.locator('.ins.worth .wkbody').first.is_visible())
    titles=pg.locator('.ins.worth summary strong').all_inner_texts()
    ok('headlines are sentences, not templates of the same words', len(set(titles))==len(titles) and all(len(t)>30 for t in titles))
    pg.locator('.ins.worth summary').first.click(); pg.wait_for_timeout(200)
    t=pg.locator('.ins.worth .wkbody').first.inner_text()
    ok('opening shows the evidence, why it matters and what you could do', 'WHAT THE NUMBERS SHOW' in t.upper() and 'WHY IT MATTERS' in t.upper() and 'WHAT YOU COULD DO' in t.upper())
    log=pg.evaluate("window.sukli.get().settings.worthLog||{}"); sigs=[k for k in log if not k.startswith('~')]
    ok('what was shown is written to the history', len(sigs)==n and all(log[k]['last'] for k in sigs))
    # same day, reload: same items
    pg.reload(); pg.wait_for_selector('.ins.worth'); pg.wait_for_timeout(800)
    ok('after a reload the same findings are shown', pg.locator('.ins.worth summary strong').all_inner_texts()==titles)
    # dismiss the first one
    pg.locator('.ins.worth summary').first.click(); pg.wait_for_timeout(200)
    pg.locator('.ins.worth [data-act=worth-dismiss]').first.click(); pg.wait_for_timeout(600)
    left=pg.locator('.ins.worth summary strong').all_inner_texts() if pg.locator('.ins.worth').count() else []
    ok('a dismissed finding is gone', titles[0] not in left)
    ok('and remembered as dismissed', pg.evaluate("Object.values(window.sukli.get().settings.worthLog||{}).some(x=>x.off)"))
    pg.reload(); pg.wait_for_selector('#view'); pg.wait_for_timeout(800)
    left=pg.locator('.ins.worth summary strong').all_inner_texts() if pg.locator('.ins.worth').count() else []
    ok('and it stays gone after a reload', titles[0] not in left)
    ok('no errors %s'%errs, not errs)
