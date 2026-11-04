// The Earn schedule window of an Earn account: settings, subscriptions, today's hours and the daily history. Times follow each platform’s own clock.
import { get, commit, stamp, fmt, CUR, walletOf } from './core.js';
import { esc, sheet, toast, ACT } from './ui.js';
import { cfgOf, e8, e8Label, logOf, subscriptions, H, runEarn, tzOf, tzName } from './earn.js';
const dec = (cur) => Math.max(2, Math.min(8, (CUR[cur] || { dec: 8 }).dec));
const num = (n, cur) => fmt(n, cur);
export function openEarn(id) {
  let pick = '09:00';
  const s = sheet('<div id="ew"></div>', { title: 'Earn schedule', wide: true }), root = s.el.querySelector('#ew'), open = new Set();
  const set = (patch) => { commit((d) => { const x = d.accounts.find((q) => q.id === id); x.earn = { ...(x.earn || {}), ...patch }; stamp(x); if (x.earn.on) runEarn(d); }); draw(); };
  const draw = () => {
    const db = get(), a = db.accounts.find((x) => x.id === id); if (!a) { s.close(); return; }
    const c = cfgOf(a), off = tzOf(db, a), tz = tzName(off), log = (db.settings.earnLog || {})[id] || { hours: [], days: [] }, now = Date.now(), cur = a.cur;
    const srcs = db.accounts.filter((x) => !x.deleted && x.id !== id && x.cur === cur && (x.exchange || '') === (a.exchange || ''));
    const subs = c.on ? subscriptions(db, a).filter((x) => !x.open).slice(-6).reverse() : [];
    const today = e8(now, off).day, todayH = log.hours.filter((x) => e8(x.h - 1, x.z != null ? x.z : off).day === today).sort((p, q) => q.h - p.h), tsum = todayH.reduce((t, x) => t + x.amt, 0);
    const hrs = (arr, zz = off) => `<ul class="calfacts">${arr.map((x) => `<li><span>${esc(e8Label(x[0] != null ? x[0] : x.h, zz))}</span><b>${num(x[1] != null ? x[1] : x.amt, cur)}</b></li>`).join('')}</ul>`;
    root.innerHTML = `
      <p class="hint">${esc(a.name)} · every time here uses the clock of ${esc(a.exchange || 'this platform')}, not this phone’s clock. Now: <b>${esc(e8Label(now, off))} (${tz})</b>.</p>
      <label class="field"><span>Platform Timezone (${esc(a.exchange || 'This Platform')})</span><select data-ew="tz">${Array.from({ length: 27 }, (_, i) => i - 12).map((z) => `<option value="${z}" ${z === off ? 'selected' : ''}>${tzName(z)}</option>`).join('')}</select></label>
      <p class="hint">Binance and Bybit use UTC+0, Bitget UTC+8. This applies to every Earn product on ${esc(a.exchange || 'this platform')}. Changing it only affects new subscription times and new hours: entries and payouts already recorded keep their times.</p>
      <label class="check"><input type="checkbox" data-ew="on" ${c.on ? 'checked' : ''}> Track hourly earnings for this product</label>
      ${c.on ? `<label class="field"><span>Yearly Rate (APY, %)</span><input data-ew="apy" inputmode="decimal" value="${c.apy || ''}" placeholder="e.g. 4.5"></label>
      <label class="field"><span>When Does Earning Start?</span><select data-ew="startRule"><option value="nextHour" ${c.startRule !== 'midnight' ? 'selected' : ''}>At the next full hour</option><option value="midnight" ${c.startRule === 'midnight' ? 'selected' : ''}>At the next midnight (${tz})</option></select></label>
      <div class="two"><label class="field"><span>Extra Hours Before Earning Starts</span><input data-ew="startLagH" inputmode="numeric" value="${c.startLagH}"></label>
      <label class="field"><span>First Accrual Time (Hours After Earning Starts)</span><input data-ew="firstLagH" inputmode="numeric" value="${c.firstLagH}"></label></div>
      <p class="hint">Example with the next full hour: subscribe at 15:00 or 15:09, earning starts at 16:00 (the hour in progress never counts). The first accrual is recorded 1 hour later, at 17:00, then every hour. With “next midnight”, subscribing on the 4th at 15:09 starts earning at 00:00 on the 5th. All times follow ${esc(a.exchange || 'the platform')}’s clock (${tz}).</p>
      <h3>Automatic Subscription</h3>
      <label class="check"><input type="checkbox" data-ew="subOn" ${c.subOn ? 'checked' : ''}> Move coins into this product on its own, at set times</label>
      ${c.subOn ? `<label class="field"><span>Move From</span><select data-ew="from"><option value="">Choose an account</option>${srcs.map((x) => `<option value="${x.id}" ${x.id === c.from ? 'selected' : ''}>${esc(x.name)} (${esc(walletOf(x))})</option>`).join('')}</select></label>
      <label class="field"><span>Amount (Type All or a Number)</span><input data-ew="subAmt" value="${c.subAmt === 'all' ? 'All' : esc(String(c.subAmt))}"></label>
      <div class="chips">${(c.slots || []).slice().sort().map((t) => `<button type="button" class="chip" data-ew="delslot" data-v="${t}">${t} ✕</button>`).join('') || '<span class="muted">No times yet.</span>'}</div>
      <div class="two"><div class="field"><span>Add a Time (${tz})</span><button type="button" class="btn ghost" data-ew="pickslot">${esc(pick)} 🕒 Choose on the Clock</button></div><button class="btn sm ghost" data-ew="addslot">Add Time</button></div>
      <p class="hint">Sukli runs this when you open the app. If it was closed at a set time, the subscription is still recorded at that exact time, so earnings count from then.</p>` : ''}
      ${subs.length ? `<h3>Latest Subscriptions</h3><ul class="calfacts">${subs.map((x) => `<li><span>${num(x.amt, cur)}${x.auto ? ' · auto' : ''}<br><small class="muted">Subscribed ${esc(e8Label(x.sub, off))} · earning starts ${esc(e8Label(x.start, off))} · first accrual ${esc(e8Label(x.first, off))}</small></span></li>`).join('')}</ul>` : ''}
      <h3>Today So Far <small class="muted">${esc(today)}</small></h3>
      <p><b>${num(tsum, cur)}</b> in ${todayH.length} hours. It becomes one entry after midnight (${tz}).</p>${todayH.length ? hrs(todayH) : ''}
      <h3>Daily History</h3>
      ${log.days.length ? log.days.slice(0, 60).map((d) => `<div class="cardbox"><button type="button" class="linkbtn" data-ew="day" data-v="${d.day}">${open.has(d.day) ? '▾' : '▸'} ${esc(d.day)} · ${num(d.amt, cur)} · ${d.hours.length} hours</button>${open.has(d.day) ? hrs(d.hours.slice().reverse(), d.z != null ? d.z : off) : ''}</div>`).join('') : '<p class="empty">No finished days yet.</p>'}` : ''}`;
  };
  draw();
  root.addEventListener('change', (e) => { const k = e.target.dataset.ew; if (!k) return; const v = e.target.value;
    if (k === 'on' || k === 'subOn') return set({ [k]: e.target.checked });
    if (k === 'apy') return set({ apy: Math.max(0, parseFloat(v) || 0) });
    if (k === 'startLagH' || k === 'firstLagH') return set({ [k]: Math.max(0, parseInt(v, 10) || 0) });
    if (k === 'from') return set({ from: v });
    if (k === 'startRule') return set({ startRule: v === 'midnight' ? 'midnight' : 'nextHour' });
    if (k === 'tz') { const a = get().accounts.find((x) => x.id === id); commit((d) => { const m = (d.settings.platformTz = d.settings.platformTz || {}); m[a.exchange || a.name] = +v; }); return draw(); }
    if (k === 'subAmt') { const t = v.trim(); return set({ subAmt: /^all$/i.test(t) || !t ? 'all' : String(Math.max(0, parseFloat(t.replace(/,/g, '')) || 0) || 'all') }); } });
  root.addEventListener('click', (e) => { const b = e.target.closest('button[data-ew]'); if (!b) return; const k = b.dataset.ew, c = cfgOf(get().accounts.find((x) => x.id === id));
    if (k === 'day') { open.has(b.dataset.v) ? open.delete(b.dataset.v) : open.add(b.dataset.v); draw(); }
    if (k === 'delslot') set({ slots: c.slots.filter((t) => t !== b.dataset.v) });
    if (k === 'pickslot') { import('./datepicker.js').then((m) => m.openDatePicker(`2000-01-01 ${pick}:00`, (v) => { pick = String(v).slice(11, 16); draw(); }, { time: true, title: 'Choose a time' })); return; }
    if (k === 'addslot') { const t = pick; if (!/^\d\d:\d\d$/.test(t)) { toast('Pick a time first.'); return; } set({ slots: [...new Set([...(c.slots || []), t])] }); } });
}
ACT['earn-open'] = (el) => openEarn(el.dataset.id);
