# Helpers for forms whose <select> is hidden behind the shared picker (js/picker.js).
def choose(pg, sel, text=None, value=None):
    """Pick an option the way the user ends up with it: set the hidden select and fire change."""
    pg.evaluate("""([sel,text,value])=>{const s=document.querySelector(sel);const o=[...s.options].find(o=>value!=null?o.value===value:o.textContent.includes(text));if(!o)throw new Error('no option '+(text||value)+' in '+sel);s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}""",[sel,text,value])
def open_menu(pg, kind, nth=0):
    pg.click(f'#view [data-act=inv-add] >> nth={nth}'); pg.wait_for_selector(f'.sheet [data-k={kind}]'); pg.click(f'.sheet [data-k={kind}]')

def open_all(pg):
    """Settings sections are folded <details> (v13.7) and collapsible cards re-collapse: open them all so controls inside can be clicked."""
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelectorAll('.collbody[hidden]').forEach(e=>e.hidden=false)")
    pg.wait_for_timeout(150)

def patch():
    patch_reveal()
    """Many forms now hide the <select> behind the shared picker (js/picker.js), so select_option cannot click it. This makes
    page.select_option set the hidden select and fire input + change, the way the picker does. If the select is not found it falls back."""
    from playwright.sync_api import Page
    if getattr(Page.select_option, '_patched', False): return
    orig = Page.select_option
    JS = """([sel,v,label,idx])=>{const s=document.querySelector(sel);if(!s||s.tagName!=='SELECT')return false;
      const o=[...s.options];let m=null;if(v!=null)m=o.find(x=>x.value===v)||o.find(x=>x.textContent.trim()===v);
      if(!m&&label!=null)m=o.find(x=>x.textContent.trim()===label);if(!m&&idx!=null)m=o[idx];if(!m)return false;
      s.value=m.value;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));return true;}"""
    def sel(self, selector, value=None, **kw):
        v = value if isinstance(value, str) else None
        if isinstance(value, dict): kw = {**value, **kw}
        if self.evaluate(JS, [selector, v if v is not None else kw.get('value'), kw.get('label'), kw.get('index')]): return []
        return orig(self, selector, value, **kw)
    sel._patched = True
    Page.select_option = sel

REVEAL = """(sel)=>{let el=null;try{el=document.querySelector(sel)}catch(e){return false}
  if(!el)return false;let n=el,k=0;while(n&&n!==document.body){if(n.tagName==='DETAILS'&&!n.open){n.open=true;k++}
  if(n.classList&&n.classList.contains('collbody')&&n.hidden){n.hidden=false;k++}n=n.parentElement}return k>0}"""
def patch_reveal():
    """Settings sections are folded <details>, cards collapse: open whatever hides a control before the test clicks or waits for it."""
    from playwright.sync_api import Page
    if getattr(Page.click, '_revealed', False): return
    def wrap(name):
        orig = getattr(Page, name)
        def f(self, selector, *a, **kw):
            if isinstance(selector, str) and not selector.startswith(('xpath=', 'text=')):
                try: self.evaluate(REVEAL, selector)
                except Exception: pass
            return orig(self, selector, *a, **kw)
        f._revealed = True; setattr(Page, name, f)
    for n in ('click', 'fill', 'tap', 'check', 'uncheck', 'press', 'dblclick', 'type', 'hover'): wrap(n)
    ow = Page.wait_for_selector
    def w(self, selector, *a, **kw):
        st = kw.get('state', 'visible')
        if st == 'visible':
            try: ow(self, selector, state='attached', timeout=kw.get('timeout', 30000))
            except Exception: pass
            try: self.evaluate(REVEAL, selector)
            except Exception: pass
        return ow(self, selector, *a, **kw)
    Page.wait_for_selector = w
