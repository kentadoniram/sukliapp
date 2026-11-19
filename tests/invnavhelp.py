# v16.6: the Investments page is now Overview / <platform> / Calendar / Accounts.
# Older tests that looked at a platform card on the old single page open the platform tab instead.
def go_invest(pg, plat=None, wait=900, sec='platform'):
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_timeout(300)
    pg.evaluate("""async([p,s])=>{const m=await import('/js/invnav.js');if(p){m.INV.plat=p;localStorage.setItem('sukli-invplat',p)}m.INV.sec=s;localStorage.setItem('sukli-invsec',s);window.dispatchEvent(new Event('sukli-render'))}""", [plat, sec])
    pg.wait_for_timeout(wait)
    pg.evaluate("document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
