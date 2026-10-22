# Helpers for forms whose <select> is hidden behind the shared picker (js/picker.js).
def choose(pg, sel, text=None, value=None):
    """Pick an option the way the user ends up with it: set the hidden select and fire change."""
    pg.evaluate("""([sel,text,value])=>{const s=document.querySelector(sel);const o=[...s.options].find(o=>value!=null?o.value===value:o.textContent.includes(text));if(!o)throw new Error('no option '+(text||value)+' in '+sel);s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}""",[sel,text,value])
def open_menu(pg, kind, nth=0):
    pg.click(f'#view [data-act=inv-add] >> nth={nth}'); pg.wait_for_selector(f'.sheet [data-k={kind}]'); pg.click(f'.sheet [data-k={kind}]')
