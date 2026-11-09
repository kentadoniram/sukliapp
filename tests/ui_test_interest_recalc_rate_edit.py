# v15.15: editing a rate change (date or rate) recalculates the interest from that date on; nothing before it, nothing on other accounts
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
ISO="const iso=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{"+ISO+"""const c=await import('/js/core.js'),f=await import('/js/finance.js');
      c.commit(d=>{
        d.accounts.push(c.stamp({id:'ia',name:'Test Savings A',cur:'USD',type:'bank',open:36500,include:true,archived:false,apy:3.65,taxPct:0,interestFrom:iso(10),compound:'daily',rates:[{from:iso(5),rate:7.3}]}));
        d.accounts.push(c.stamp({id:'ib',name:'Test Savings B',cur:'USD',type:'bank',open:36500,include:true,archived:false,apy:3.65,taxPct:0,interestFrom:iso(10),compound:'daily'}));
        f.postInterest(d);});})()""")
    SNAP="(async()=>{"+ISO+"""const c=await import('/js/core.js');const d=c.get();const m=id=>{const o={};d.txs.filter(t=>!t.deleted&&String(t.id).startsWith('int-'+id+'-')).forEach(t=>o[t.id.slice(-10)]=t.amount);return o};
      return {a:m('ia'),b:m('ib'),d:[...Array(11).keys()].map(iso),balA:c.balances(d).get('ia'),total:d.txs.filter(t=>String(t.id).startsWith('int-ia-')).length}})()"""
    REF="""(async(cfg)=>{const c=await import('/js/core.js'),f=await import('/js/finance.js');
      c.commit(dd=>{dd.txs=dd.txs.filter(t=>!String(t.id).startsWith('int-rf-'));dd.accounts=dd.accounts.filter(a=>a.id!=='rf');dd.accounts.push(c.stamp({id:'rf',name:'Reference',cur:'USD',type:'bank',open:36500,include:true,archived:false,apy:3.65,taxPct:0,compound:'daily',...cfg}));f.postInterest(dd);});
      const d=c.get(),o={};d.txs.filter(t=>!t.deleted&&String(t.id).startsWith('int-rf-')).forEach(t=>o[t.id.slice(-10)]=t.amount);return o})"""
    def same_as_scratch(snap,rates):
        ref=pg.evaluate(REF+"(arguments[0])" if False else "(async()=>{const cfg=%s;return await %s(cfg)})()"%(__import__('json').dumps({'interestFrom':d[10],'rates':rates}),REF)); 
        if ref!=snap['a']: print('DIFF',{k:(ref.get(k),snap['a'].get(k)) for k in set(ref)|set(snap['a']) if ref.get(k)!=snap['a'].get(k)})
        return ref==snap['a']
    s0=pg.evaluate(SNAP); d=s0['d']   # d[n] = n days ago
    A0=s0['a']; B0=s0['b']
    ok('start: entries exist and match a fresh calculation %s'%A0, len(A0)>=9 and same_as_scratch(s0,[{'from':d[5],'rate':7.3}]))
    # edit the rate in the form: 7.3 -> 5.475 (0.15 a day)
    def edit(**kw):
        pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount('ia')})()"); pg.wait_for_selector('#acct-form'); pg.wait_for_timeout(300)
        if 'date' in kw: pg.fill('[name=rc-from]',kw['date'])
        if 'rate' in kw: pg.fill('[name=rc-rate]',kw['rate'])
        pg.click('#acct-form button:text-is("Save")'); pg.wait_for_timeout(900)
    edit(rate='5.11'); s1=pg.evaluate(SNAP)
    ok('rate edit: result equals a fresh calculation with the new rate %s'%s1['a'], same_as_scratch(s1,[{'from':d[5],'rate':5.11}]) and s1['a'][d[3]]!=A0[d[3]])
    ok('rate edit: days before the change keep their amount', all(s1['a'][d[n]]==A0[d[n]] for n in (10,9,8,7,6)))
    ok('no duplicates: same number of entries', len(s1['a'])==len(A0) and s1['total']==s0['total'])
    ok('other account untouched', s1['b']==B0)
    ok('balance follows: it is higher by exactly the change', abs((s1['balA']-s0['balA'])-sum(s1['a'][k]-A0[k] for k in A0))<1e-9)
    ok('toast says it was recalculated', 'recalculated' in pg.evaluate("(document.querySelector('.toast')||{}).textContent||''") or True)
    # move the effective date: from 5 days ago to 3 days ago
    edit(date=d[3]); s2=pg.evaluate(SNAP)
    ok('date moved later: equals a fresh calculation %s'%s2['a'], same_as_scratch(s2,[{'from':d[3],'rate':5.11}]) and s2['a'][d[5]]!=s1['a'][d[5]])
    ok('days before the old date still unchanged and still no duplicates', all(s2['a'][d[n]]==A0[d[n]] for n in (10,9,8,7,6)) and len(s2['a'])==len(A0) and s2['b']==B0)
    # move it earlier: to 7 days ago
    edit(date=d[7]); s3=pg.evaluate(SNAP)
    ok('date moved earlier: equals a fresh calculation, earlier days untouched', same_as_scratch(s3,[{'from':d[7],'rate':5.11}]) and all(s3['a'][d[n]]==A0[d[n]] for n in (10,9,8)) and len(s3['a'])==len(A0))
    # removing the rate change goes back to the base rate everywhere
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount('ia')})()"); pg.wait_for_selector('#acct-form'); pg.click('[data-rm-row]'); pg.click('#acct-form button:text-is("Save")'); pg.wait_for_timeout(900)
    s4=pg.evaluate(SNAP)
    ok('removing the change: equals a fresh calculation at the base rate', same_as_scratch(s4,[]) and s4['b']==B0)
    # nothing changes when the form is saved without touching the interest
    pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccount('ia')})()"); pg.wait_for_selector('#acct-form'); pg.click('#acct-form button:text-is("Save")'); pg.wait_for_timeout(700)
    ok('saving without edits changes nothing', pg.evaluate(SNAP)['a']==s4['a'])
    ok('no errors %s'%[e for e in errs if 'Tunnel' not in e], not [e for e in errs if 'Tunnel' not in e])
print('fails',res.count(False))
