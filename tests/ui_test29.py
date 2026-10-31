# Grouped fees: a trade keeps its fee on the same row; fees and losses are shown in Investments; loans are one entry; filters centred and compact
import sys
from playwright.sync_api import sync_playwright
from pkhelp import choose, open_menu
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard')
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic'); pg.fill('#ic [name=ex]','Binance'); pg.fill('#ic [name=coin]','ZZZ'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(600)
    open_menu(pg,'trade'); pg.wait_for_selector('#tr'); choose(pg,'#tr [name=plat]',text='Binance'); choose(pg,'#tr [name=asset]',text='ZZZ')
    pg.fill('#tr [name=qty]','10'); pg.fill('#tr [name=total]','30000'); pg.dispatch_event('#tr [name=total]','input'); pg.fill('#tr [name=fee]','100')
    pg.click('#tr button:text-is("Record")'); pg.wait_for_timeout(500)
    if pg.locator('[data-yes]').count(): pg.click('[data-yes]'); pg.wait_for_timeout(400)
    pg.wait_for_timeout(600); pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('Investments shows Fees and losses', 'Fees and losses' in t)
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(500)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(500); t=pg.inner_text('#view')
    ok('one trade row, fee inside it', 'Buy 10 ZZZ' in t and 'recorded as an expense' in t and 'Trading fee:' not in t)
    ok('no "Financial loss" label in Entries', 'Financial loss' not in t)
    ok('purpose line on rows', 'Expense recorded' in t or 'Income recorded' in t or 'not counted as spending' in t)
    # fee reaches the balances: cash account paid 30,000 + 100
    tx=pg.evaluate("(async()=>{const m=await import('/js/core.js');const d=m.get();const t=d.txs.find(x=>x.trade && /ZZZ/.test(x.name));return {fee:t.fee,by:t.feeBy,amount:t.amount}})()"); print(tx)
    ok('fee stored on the trade', tx['fee']==100 and tx['by'] in ('from','to'))
    # filters: equal width, centred
    boxes=pg.evaluate("[...document.querySelectorAll('.filters .chip')].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.width), getComputedStyle(e).justifyContent]})"); print(boxes)
    ok('filter chips centred', all(b[1]=='center' for b in boxes) and max(w for w,_ in boxes)-min(w for w,_ in boxes)<=6)
    # account page filters in single rows
    pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(600); pg.click('[data-act=acct] >> nth=1'); pg.wait_for_selector('#ad'); pg.wait_for_timeout(400)
    rows=pg.evaluate("[...document.querySelectorAll('#ad .histfilter .seg, #ad .rangebar')].map(s=>new Set([...s.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top))).size)"); print(rows)
    ok('account filters and range each on one row', rows and all(r==1 for r in rows))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
