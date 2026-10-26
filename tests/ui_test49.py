# v12al: tags and events, share backup, buzz test button
import re
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
URL='http://localhost:8123/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block',accept_downloads=True); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.welcome'); pg.click('[data-act=wz-old]'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-what')
    ok('entry form has a tag row with + New tag', pg.locator('#tagsrow [data-e=newtag]').count()==1 and 'Tag or event' in pg.inner_text('#tagsrow'))
    pg.fill('#f-what','Dinner Naha'); pg.dispatch_event('#f-what','input'); pg.fill('#f-amount','3000'); pg.dispatch_event('#f-amount','input')
    pg.click('#tagsrow [data-e=newtag]'); pg.wait_for_selector('input[name=v]'); pg.fill('input[name=v]','Okinawa trip'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok('new tag appears selected', pg.locator('#tagsrow .chip.on').count()==1 and '#Okinawa trip' in pg.inner_text('#tagsrow'))
    pg.click('[data-e=save]'); pg.wait_for_timeout(500)
    lab=pg.evaluate("window.sukli.get().txs.find(t=>t.name==='Dinner Naha').labels")
    ok(f'saved on the entry as a label: {lab!r}', lab=='Okinawa trip')
    # second entry picks the existing tag with one tap
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry()})()"); pg.wait_for_selector('#f-what')
    ok('existing tag offered as a chip', pg.locator('#tagsrow .chip:not(.on)', has_text='#Okinawa trip').count()==1)
    pg.fill('#f-what','Hotel'); pg.dispatch_event('#f-what','input'); pg.fill('#f-amount','12000'); pg.dispatch_event('#f-amount','input')
    pg.click('#tagsrow .chip:has-text("#Okinawa trip")'); pg.click('[data-e=save]'); pg.wait_for_timeout(500)
    n=pg.evaluate("window.sukli.get().txs.filter(t=>t.labels==='Okinawa trip').length"); ok(f'two entries tagged: {n}', n==2)
    # Entries: tag bar, filter, total, row shows the tag, search finds it
    pg.goto(URL+'#/ledger'); pg.wait_for_selector('.tagbar'); pg.wait_for_timeout(300)
    ok('tag bar shows #Okinawa trip', '#Okinawa trip' in pg.inner_text('.tagbar'))
    pg.click('.tagbar [data-act=tag-filter]'); pg.wait_for_timeout(400)
    t=pg.inner_text('#lsum'); rows=pg.locator('#ledger-list .row').count()
    ok(f'tag filter shows only the trip ({rows} rows) and its total: {t[:120]!r}', rows==2 and '#Okinawa trip' in t and '15,000' in t and 'all dates' in t)
    ok('rows show their tag', '#Okinawa trip' in pg.inner_text('#ledger-list'))
    pg.click('[data-act=f-clear]'); pg.wait_for_timeout(300)
    ok('Clear all removes the tag filter', pg.locator('.tagbar .chip.on').count()==0)
    pg.fill('#q','okinawa'); pg.dispatch_event('#q','input'); pg.wait_for_timeout(400)
    ok('search finds entries by tag', pg.locator('#ledger-list .row').count()==2)
    # Bluecoins export keeps the label
    csv=pg.evaluate("(async()=>{const m=await import('/js/importer.js');return m.exportCSV(window.sukli.get())})()")
    ok('CSV export carries the tag in Labels', 'Okinawa trip' in csv)
    # settings: share backup + test buzz
    pg.goto(URL+'#/settings'); pg.wait_for_selector('[data-act=export-share]'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    with pg.expect_download() as dl: pg.evaluate("document.querySelector('[data-act=export-share]').click()")
    ok(f'share backup falls back to a dated download: {dl.value.suggested_filename}', re.fullmatch(r'sukli-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json',dl.value.suggested_filename))
    ok('Test the buzz button exists', pg.locator('[data-act=fb-test]').count()==1)
    pg.evaluate("document.querySelector('[data-act=fb-test]').click()"); pg.wait_for_timeout(200)
    ok('Test the buzz explains what to check', 'System Haptics' in pg.inner_text('.toast'))
    ok('no script errors', not errs)
print('SUMMARY',sum(res),'/',len(res))
