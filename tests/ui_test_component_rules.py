# v15.13: guard rails for the component system. Counts may only go DOWN; lower the numbers when you move screens over.
import re, glob
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
BUTTONS_BASELINE=64      # hand-written <button in js/*.js outside components.js
FIELDS_BASELINE=103      # hand-written <label class="field in js/*.js outside components.js (use textField / selectField / field)
CARDRULE_BASELINE=0     # rules in styles.css with their own fill + outline + corner (not using the card-kind table)
HEX_BASELINE=21           # raw hex colours in styles.css outside :root blocks
css=open('design.css').read()+open('styles.css').read()   # v16.11: the design layer (design.css) defines the tokens, styles.css uses them
styles_only=open('styles.css').read()
js={f:open(f).read() for f in glob.glob('js/*.js')}
# 1. every var(--x) used in the CSS exists (set in CSS or by the app at run time)
SET_AT_RUNTIME={'--fs','--vvh','--vvt','--coin','--d','--heat','--pc'}
used=set(re.findall(r'var\((--[a-z0-9-]+)',css)); defined=set(re.findall(r'(--[a-z0-9-]+)\s*:',css))|SET_AT_RUNTIME
ok('every colour/size token used in styles.css is defined %s'%sorted(used-defined), not (used-defined))
ok('no hex fallbacks hiding a missing token', len(re.findall(r'var\(--[a-z0-9-]+, *#[0-9a-fA-F]{3,8}\)',css))<=3)
# 2. ratchets
nb=sum(len(re.findall(r'<button',t)) for f,t in js.items() if not f.endswith('components.js'))
ok('hand-written buttons %d (limit %d)'%(nb,BUTTONS_BASELINE), nb<=BUTTONS_BASELINE)
nfl=sum(len(re.findall(r'<label class="field',t)) for f,t in js.items() if not f.endswith('components.js'))
ok('hand-written field labels %d (limit %d)'%(nfl,FIELDS_BASELINE), nfl<=FIELDS_BASELINE)
noroot=re.sub(r'/\*.*?\*/','',re.sub(r':root[^{]*\{[^}]*\}','',css),flags=re.S)
nh=len(re.findall(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b',noroot))
ok('raw hex colours outside :root %d (limit %d)'%(nh,HEX_BASELINE), nh<=HEX_BASELINE)
# v16.11 ratchets: sizes, radii and gaps come from the design layer, not from numbers typed into styles.css
raw_fs=len(re.findall(r'(?<![-\w])font-size:\s*calc\([\d.]+px \* var\(--fs',styles_only))
ok('no raw font-size calc() in styles.css, use var(--fz-N) from design.css (%d)'%raw_fs, raw_fs==0)
raw_r=len(re.findall(r'border-radius:\s*(?:6|8|10|12|14|16|18|22|99|999)px\s*(?:;|}|!)',styles_only))
ok('no raw 6/8/10/12/14/16/18/22/999px radius in styles.css, use the radius scale (%d)'%raw_r, raw_r==0)
raw_h=len(re.findall(r'(?<![-\w])min-height:\s*(?:2[6-9]|[3-5]\d|6[0-2])px',styles_only))
ok('no raw min-height of 26 to 62px in styles.css, use var(--h-N) or a role like --h-field (%d)'%raw_h, raw_h==0)
nchip=len(re.findall(r'(?m)^\.chip\s*\{',styles_only))
ok('.chip has exactly one base definition (%d)'%nchip, nchip==1)
raw_g=len(re.findall(r'(?<![-\w])gap:\s*(?:2|4|6|8|10|12)px\s*;',styles_only))
ok('no raw single gap of 2/4/6/8/10/12px, use the spacing scale (%d)'%raw_g, raw_g==0)
# v16.12: a card-like rule (fill + outline + corner) must take its look from the card-kind table in design.css (var(--cd-*)); controls are the ones left
nc=len([1 for sel,body in re.findall(r'(?m)^([^\n{}@]+?)\s*\{([^{}]*)\}',styles_only) if re.search(r'(?<![-\w])border:\s*1px solid',body) and 'border-radius' in body and re.search(r'background:\s*var\(--(sheet|tint)\b',body) and 'var(--cd-' not in body])
ok('rules that draw their own fill + outline + corner instead of the card-kind or control-kind table: %d (limit %d)'%(nc,CARDRULE_BASELINE), nc<=CARDRULE_BASELINE)
# 3. the helpers produce the classes the CSS expects
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    h=pg.evaluate("""(async()=>{const c=await import('/js/components.js');return {
      primary:c.button({label:'Save',kind:'primary',act:'x'}), ghost:c.button({label:'Cancel',kind:'ghost',size:'sm',e:'y',v:3}), danger:c.button({label:'Remove',kind:'danger'}),
      link:c.button({label:'Edit',kind:'link',cls:'rm'}), icon:c.button({label:'Close',kind:'icon',icon:'x'}),
      seg:c.seg({options:[{label:'A',value:'a'},{label:'B',value:'b'}],value:'b',e:'pick',aria:'Pick'}), seg3:c.seg({options:[{label:'A',value:1},{label:'B',value:2},{label:'C',value:3}],value:1,data:'fm'}),
      tog:c.toggle({label:'Tax',on:true,e:'t'}), box:c.box({title:'Items',cancel:{e:'off'},hint:'hi',body:'<i>x</i>',cls:'items'}), field:c.field({label:'Name',control:'<input>'}), xss:c.button({label:'<b>',kind:'chip'})}})()""")
    ok('primary button', 'class="btn"' in h['primary'] and 'data-act="x"' in h['primary'] and 'type="button"' in h['primary'])
    ok('ghost small button with data-e and value', 'btn ghost sm' in h['ghost'] and 'data-e="y"' in h['ghost'] and 'data-v="3"' in h['ghost'])
    ok('danger, link with extra class, icon has a label', 'btn danger' in h['danger'] and 'linkbtn rm' in h['link'] and 'aria-label="Close"' in h['icon'] and '<svg' in h['icon'])
    ok('seg: two options equal, second on, aria-pressed', 'seg sm two' in h['seg'] and h['seg'].count('<button')==2 and 'class="on"' in h['seg'] and 'aria-pressed="true"' in h['seg'] and 'aria-label="Pick"' in h['seg'])
    ok('seg with three options and data-fm', 'seg sm three' in h['seg3'] and 'data-fm="2"' in h['seg3'])
    ok('toggle is pressed', 'class="tog on"' in h['tog'] and 'aria-pressed="true"' in h['tog'])
    ok('box has title, Cancel, hint and body', 'othbox items' in h['box'] and '<b>Items</b>' in h['box'] and 'data-e="off"' in h['box'] and 'class="hint"' in h['box'] and '<i>x</i>' in h['box'])
    ok('field wraps label and control', 'class="field' in h['field'] and '<span>Name</span><input>' in h['field'])
    ok('labels are escaped', '&lt;b&gt;' in h['xss'])
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
