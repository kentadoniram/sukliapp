// Comparing two names: show what Sukli knows about each, why it asked, and three answers with their consequences.
//   Same       one thing. Category, amount and account guesses are shared.
//   Related    same family, its own category (coffee beans and coffee matcha). Remembered with a closeness, never copies a category.
//   Different  unrelated. Not compared again.
import { get, commitQuiet, fmt } from './core.js';
import { esc, ACT, toast } from './ui.js';
import { norm, learnSame, learnApart, learnRelated, relStrength, nameRules, pairId } from './merchants.js';
import { textWeight } from './simgraph.js';
import { canon } from './textnorm.js';

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
export function facts(db, name) {
  const k = norm(name), rows = db.txs.filter((t) => !t.deleted && t.kind !== 'transfer' && t.name && norm(t.name) === k);
  if (!rows.length) return { n: 0 };
  const cm = new Map(db.categories.map((c) => [c.id, c.name])), cats = new Map();
  for (const t of rows) cats.set(t.cat, (cats.get(t.cat) || 0) + 1);
  const top = [...cats.entries()].sort((a, b) => b[1] - a[1])[0], last = rows.reduce((m, t) => (t.date > m.date ? t : m), rows[0]);
  const cur = rows[0].cur, amt = med(rows.map((t) => t.amount));
  return { n: rows.length, cat: top ? cm.get(top[0]) || '' : '', catShare: top ? top[1] / rows.length : 0, amount: fmt(amt, cur), last: last.date.slice(0, 10) };
}
const line = (f) => (f.n ? `${f.n}× · ${f.cat ? 'usually ' + esc(f.cat) : 'no category'}${f.n > 1 ? ` · typically ${esc(f.amount)}` : ''} · last ${esc(f.last)}` : 'new name, no history yet');
function why(a, b) {
  const ka = canon(a), kb = canon(b), w = Math.round(textWeight(ka, kb) * 100);
  const ta = ka.split(' '), tb = kb.split(' '), common = ta.filter((t) => t.length >= 2 && tb.includes(t));
  return `Looks alike: ${w}% spelling${common.length ? `, shared word${common.length > 1 ? 's' : ''} “${esc(common.join(' '))}”` : ''}.`;
}
export function compareCard(db, a, b) {
  const fa = facts(db, a), fb = facts(db, b), at = `data-a="${esc(a)}" data-b="${esc(b)}"`;
  const diffCat = fa.n && fb.n && fa.cat && fb.cat && fa.cat !== fb.cat;
  return `<div class="nmcard cmp" ${at}>
    <div class="cmpnames"><div><small class="muted">${fa.n ? 'Name' : 'You typed'}</small><b>${esc(a)}</b><span class="muted">${line(fa)}</span></div>
      <div class="cmpvs" aria-hidden="true">vs</div>
      <div><small class="muted">In your history</small><b>${esc(b)}</b><span class="muted">${line(fb)}</span></div></div>
    <p class="cmpwhy">${why(a, b)}${diffCat ? ` They are in different categories (${esc(fa.cat)} and ${esc(fb.cat)}), so “Same” would mix them.` : ''}</p>
    <div class="cmpbtns">
      <button type="button" class="cmpb" data-act="nm-same" ${at}><b>Same</b><small>One thing. Guesses are shared.</small></button>
      <button type="button" class="cmpb" data-act="nm-rel" ${at}><b>Related</b><small>Same family, own category.</small></button>
      <button type="button" class="cmpb" data-act="nm-diff" ${at}><b>Different</b><small>Unrelated. Don’t ask again.</small></button>
    </div></div>`;
}
// names you called related to this one, for a quiet hint in the entry sheet
export function relatedNames(db, name) {
  const k = norm(name), out = [];
  for (const pk of nameRules().related || []) {
    const [x, y] = pk.split('|'); const other = x === k ? y : y === k ? x : null; if (!other) continue;
    const f = facts(db, other); out.push({ name: other, w: relStrength(x, y), cat: f.cat || '', n: f.n });
  }
  return out.sort((p, q) => q.w - p.w);
}

const done = (el, html) => { const c = el.closest('.nmcard'); if (c) { c.classList.add('done'); c.innerHTML = html; } };
ACT['nm-same'] = (el) => { commitQuiet((d) => learnSame(d, el.dataset.a, el.dataset.b)); toast('Counted as one thing.', { ms: 2500 }); done(el, `<p class="cmpwhy">✓ <b>${esc(el.dataset.a)}</b> and <b>${esc(el.dataset.b)}</b> are now one thing. Change it in Settings, Names &amp; learning.</p>`); };
ACT['nm-diff'] = (el) => { commitQuiet((d) => learnApart(d, el.dataset.a, el.dataset.b)); toast('Kept as different things.', { ms: 2500 }); done(el, `<p class="cmpwhy">✓ Kept apart. I won’t ask about these two again.</p>`); };
ACT['nm-rel'] = (el) => {
  const a = el.dataset.a, b = el.dataset.b; commitQuiet((d) => learnRelated(d, a, b, 0.6));
  const at = `data-a="${esc(a)}" data-b="${esc(b)}"`;
  done(el, `<p class="cmpwhy">✓ Related: each keeps its own category. How close are they?</p>
    <div class="chips">${[['A little', 0.3], ['Somewhat', 0.6], ['Nearly the same', 0.85]].map(([l, w]) => `<button type="button" class="chip ${w === 0.6 ? 'on' : ''}" data-act="nm-relw" data-w="${w}" ${at}>${l}</button>`).join('')}</div>`);
};
ACT['nm-relw'] = (el) => {
  commitQuiet((d) => learnRelated(d, el.dataset.a, el.dataset.b, +el.dataset.w));
  el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); toast('Saved.', { ms: 1500 });
};
