// Settings > Pictures: one list for accounts and one for merchants. Tap a row to pick a picture or use your own image; "Automatic" goes back to the guess.
import { button } from './components.js';
import { get, commit, stamp, groupColor } from './core.js';
import { ACT, sheet, esc, toast } from './ui.js';
import { acctPic, merchPic, guessAcctIcon, guessMerchIcon, isImg, picHtml, merchIconOf } from './pictures.js';
import { merchantList } from './merchantpick.js';

export const picturesSection = () => `<section id="pic-set"><h2>Pictures</h2>
  <p class="hint">Each account and merchant gets a picture by itself from its name (a bank, a train card, a burger). Change one here. You can also use your own image. Sukli does not include company logos, because logos are trademarks.</p>
  <div class="btnrow left">${button({ label: 'Account Pictures', kind: 'ghost', act: 'pic-list', attr: { 'data-k': 'acct' } })}${button({ label: 'Merchant Pictures', kind: 'ghost', act: 'pic-list', attr: { 'data-k': 'merch' } })}</div></section>`;

const state = (v) => (v ? (isImg(v) ? 'Your own image' : 'Chosen picture') : 'Automatic');
function openList(kind) {
  const draw = () => {
    const db = get();
    const rows = kind === 'acct'
      ? db.accounts.filter((a) => !a.deleted).sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ id: a.id, name: a.name, pic: acctPic(a), sub: state(a.icon), col: groupColor(a.type) }))
      : merchantList(db).map((m) => ({ id: m.name, name: m.name, pic: merchPic(db, m.name), sub: state(merchIconOf(db, m.name)), col: groupColor(m.name) }));
    return rows.length ? `<div class="rows plain picrows">${rows.map((r) => `<button type="button" class="row cur" data-pid="${esc(r.id)}"><i class="badge sm" style="background:${r.col}">${r.pic}</i><span class="rmain"><strong>${esc(r.name)}</strong><small>${r.sub}</small></span></button>`).join('')}</div>` : `<p class="empty">${kind === 'acct' ? 'No accounts yet.' : 'No merchants yet. They appear once you use the Merchant row on an entry.'}</p>`;
  };
  const s = sheet(`<p class="hint">Tap one to change its picture.</p><div id="pic-list">${draw()}</div>
    <div class="btnrow"><button type="button" class="btn ghost" data-reset>Set All to Automatic</button></div>`, { title: kind === 'acct' ? 'Account Pictures' : 'Merchant Pictures', wide: true });
  const redraw = () => { s.el.querySelector('#pic-list').innerHTML = draw(); };
  s.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-reset]')) {
      commit((d) => { if (kind === 'acct') { for (const a of d.accounts) if (a.icon) { a.icon = ''; stamp(a); } } else for (const m of Object.values(d.settings.merchantInfo || {})) delete m.icon; });
      toast('All set to automatic.'); redraw(); return;
    }
    const b = e.target.closest('[data-pid]'); if (!b) return; const id = b.dataset.pid, db = get();
    const cur = kind === 'acct' ? ((db.accounts.find((a) => a.id === id) || {}).icon || '') : merchIconOf(db, id);
    const { openIconLibrary } = await import('./entry.js');
    openIconLibrary(cur, (v) => {
      commit((d) => {
        if (kind === 'acct') { const a = d.accounts.find((x) => x.id === id); if (a) { a.icon = v; stamp(a); } }
        else { const all = (d.settings.merchantInfo = d.settings.merchantInfo || {}), o = (all[id] = all[id] || { branches: {} }); if (v) o.icon = v; else delete o.icon; }
      });
      redraw();
    }, { own: true, title: kind === 'acct' ? 'Account Pictures' : 'Merchant Pictures', hint: `Pick a picture for ${id.length < 30 ? '“' + (kind === 'acct' ? ((db.accounts.find((a) => a.id === id) || {}).name || '') : id) + '”' : 'this one'}.`, auto: 'Automatic (from the name)' });
  });
}
ACT['pic-list'] = (el) => openList(el.dataset.k);
