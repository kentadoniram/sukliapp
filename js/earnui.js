// The Earn schedule window of an Earn account: settings, subscriptions, today's hours and the daily history. Times follow each platform’s own clock.
import { get, commit, stamp, fmt, CUR, walletOf } from './core.js';
import { esc, sheet, toast, ACT } from './ui.js';
import { button } from './components.js';
import { apyHistOf, apyAt, dayHours, cfgOf, e8, e8Ms, e8Label, logOf, subscriptions, H, runEarn, tzOf, tzName, earnStartOf, defaultFrom } from './earn.js';
const dec = (cur) => Math.max(2, Math.min(8, (CUR[cur] || { dec: 8 }).dec));
const num = (n, cur) => fmt(n, cur);
export function openEarn(id, focus = '') {
  let pick = '09:00';
  const s = sheet('<div id="ew"></div>', { title: 'Subscription Settings', wide: true }), root = s.el.querySelector('#ew'), open = new Set();
  const set = (patch) => { commit((d) => { const x = d.accounts.find((q) => q.id === id); x.earn = { ...(x.earn || {}), ...patch }; stamp(x); if (x.earn.on) runEarn(d); }); draw(); };
  // APR history: every rate with the exact time it took effect (the platform's clock), how long it lasted, and what it earned
  const dur = (ms) => { const h = Math.round(ms / H); return h < 1 ? 'under an hour' : h < 48 ? `${h} h` : `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}`; };
  const aprHistory = (db, a, c, off, tz, log, cur) => {
    const h = apyHistOf(c), now = Date.now(), hours = [...log.hours.map((x) => [x.h, x.amt]), ...log.days.flatMap((d) => d.hours)];
    const rows = (h.length ? h : (c.apy > 0 ? [{ at: 0, apy: c.apy }] : [])).map((x, i, l) => { const end = i + 1 < l.length ? l[i + 1].at : null, earned = hours.filter(([t]) => t - H >= x.at && (end === null || t - H < end)).reduce((q, y) => q + y[1], 0);
      return { ...x, i, end, earned, n: hours.filter(([t]) => t - H >= x.at && (end === null || t - H < end)).length }; });
    return `<div class="cardbox" id="aprhist"><b>APR History</b><p class="hint">Each rate with the exact time it took effect (${esc(tz)}). Earnings are worked out hour by hour with the rate that applied in that hour.</p>
      ${rows.length ? `<ul class="calfacts aprlist">${rows.map((r) => `<li><span><b>${r.apy}%</b> APR<br><small class="muted">${r.at ? `From ${esc(e8Label(r.at, off))}` : 'From the start'} → ${r.end === null ? 'now' : esc(e8Label(r.end, off))} · ${r.at ? dur((r.end === null ? now : r.end) - r.at) : (r.end === null ? 'all along' : `until ${esc(e8Label(r.end, off))}`)}<br>Earned in this period: ${num(r.earned, cur)} (${r.n} hours)</small></span>
        <span class="aprbtns">${button({ label: 'Edit', kind: 'link', attr: { 'data-ew': 'aprEdit', 'data-v': r.i } })}${rows.length > 1 ? button({ label: 'Remove', kind: 'danger-link', attr: { 'data-ew': 'aprDel', 'data-v': r.i } }) : ''}</span></li>`).join('')}</ul>` : '<p class="muted">No rate yet. Type the current rate above, or add one here.</p>'}
      <div class="btnrow left">${button({ label: 'Add an APR Change', kind: 'ghost', size: 'sm', attr: { 'data-ew': 'aprAdd' } })}</div></div>`;
  };
  const aprSheet = (idx) => {
    const db = get(), a = db.accounts.find((x) => x.id === id), c = cfgOf(a), off = tzOf(db, a), hist = apyHistOf(c), cur0 = idx != null ? hist[idx] : null, first = !!(cur0 && !cur0.at), t0 = cur0 && cur0.at ? cur0.at : Date.now(), e0 = e8(t0, off);
    let when = `${e0.day} ${e0.hm}`;   // the moment the exchange changed the rate, on the platform's clock
    const atOf = () => e8Ms(when.slice(0, 10), when.slice(11, 16) || '00:00', off);
    const full = (t) => (t % H === 0 ? t : (Math.floor(t / H) + 1) * H);   // the first hour that starts after (or at) the change
    const sh = sheet(`<label class="field"><span>New Yearly Rate (APR, %)</span><input id="ah-apy" inputmode="decimal" value="${cur0 ? cur0.apy : ''}" placeholder="e.g. 4.5"></label>
      ${first ? '<p class="hint">This is the first rate. It applies from the start.</p>' : `<div class="field"><span>When Did the Rate Change? (${esc(tzName(off))})</span>
        <button type="button" class="btn ghost tbtn ahwhen" id="ah-when"></button>
        <div class="btnrow left tight">${button({ label: 'Now', kind: 'link', id: 'ah-now' })}${button({ label: 'Earlier Today', kind: 'link', id: 'ah-today' })}</div></div>
      <div class="cardbox" id="ah-calc"></div>`}
      <p class="hint">Earnings are worked out again from the moment the rate changes. Hours before it keep their old rate. A change in the middle of an hour never pays for that part-hour at the new rate.</p>
      <div class="btnrow">${button({ label: 'Save', kind: 'primary', id: 'ah-save' })}</div>`, { title: idx != null ? 'Edit APR Change' : 'Add an APR Change' });
    const paint = () => {
      const w = sh.el.querySelector('#ah-when'); if (!w) return;
      const at = atOf(), f = full(at), mid = at % H !== 0, old = apyAt({ apyHist: hist.filter((_, k) => k !== idx), apy: c.apy }, at + H);
      w.textContent = `🗓 ${e8Label(at, off)}`;
      sh.el.querySelector('#ah-calc').innerHTML = `<b>What Happens</b><p class="hint">${mid ? `The change came at <b>${esc(e8Label(at, off))}</b>, in the middle of an hour. The hour in progress (until ${esc(e8Label(f, off))}) is not counted at the new rate and keeps <b>${old}%</b>.<br>The new rate counts from the first full hour, <b>${esc(e8Label(f, off))}</b>, and is paid when that hour ends.` : `The change is exactly on the hour. The new rate counts from <b>${esc(e8Label(at, off))}</b> and is paid when that hour ends.`}</p>`;
    };
    if (!first) {
      paint();
      sh.el.querySelector('#ah-when').onclick = () => import('./datepicker.js').then((m) => m.openDatePicker(`${when.slice(0, 10)} ${when.slice(11, 16)}:00`, (v) => { when = String(v).slice(0, 16); paint(); }, { time: true, title: 'When Did the Rate Change?' }));
      sh.el.querySelector('#ah-when').setWhen = (v) => { when = String(v).slice(0, 16); paint(); };   // also used by tests
      sh.el.querySelector('#ah-now').onclick = () => { const e = e8(Date.now(), off); when = `${e.day} ${e.hm}`; paint(); };
      sh.el.querySelector('#ah-today').onclick = () => { const e = e8(Date.now(), off); when = `${e.day} 00:00`; paint(); };
    }
    sh.el.querySelector('#ah-save').onclick = () => {
      const apy = parseFloat(String(sh.el.querySelector('#ah-apy').value).replace(/,/g, '')); if (!Number.isFinite(apy) || apy < 0) { toast('Type the rate, for example 4.5.'); return; }
      const at = first ? 0 : atOf();
      commit((d) => { const x = d.accounts.find((q) => q.id === id), e = (x.earn = { ...(x.earn || {}) }); let h = apyHistOf(e); if (!h.length && e.apy > 0) h = [{ at: 0, apy: +e.apy }];
        if (idx != null) h[idx] = { at, apy }; else h.push({ at, apy });
        h.sort((p, q) => p.at - q.at); e.apyHist = h; e.apy = h.filter((y) => y.at <= Date.now()).pop() ? h.filter((y) => y.at <= Date.now()).pop().apy : h[0].apy; stamp(x); if (e.on) runEarn(d); });
      sh.close(); draw(); toast('Saved. Earnings from that time were worked out again.'); };
  };
  const draw = () => {
    const db = get(), a = db.accounts.find((x) => x.id === id); if (!a) { s.close(); return; }
    const c = cfgOf(a), off = tzOf(db, a), tz = tzName(off), log = (db.settings.earnLog || {})[id] || { hours: [], days: [] }, now = Date.now(), cur = a.cur;
    const srcs = db.accounts.filter((x) => !x.deleted && x.id !== id && x.cur === cur && (x.exchange || '') === (a.exchange || ''));
    const subs = c.on ? subscriptions(db, a).filter((x) => !x.open).slice(-6).reverse() : [];
    const today = e8(now, off).day, todayH = log.hours.filter((x) => e8(x.h - 1, x.z != null ? x.z : off).day === today).sort((p, q) => q.h - p.h), tsum = todayH.reduce((t, x) => t + x.amt, 0);
    const hrs = (arr, zz = off) => `<ul class="calfacts">${arr.map((x) => `<li><span>${esc(e8Label(x[0] != null ? x[0] : x.h, zz))}</span><b>${num(x[1] != null ? x[1] : x.amt, cur)}</b></li>`).join('')}</ul>`;
    const dflt = defaultFrom(db, a), fromId = c.from && srcs.some((x) => x.id === c.from) ? c.from : (dflt ? dflt.id : '');
    if (c.subOn && !c.from && fromId) { commit((d) => { const y = d.accounts.find((q) => q.id === id); y.earn = { ...(y.earn || {}), from: fromId }; stamp(y); }); }
    const depT = c.depTime || (c.slots || []).slice().sort()[0] || '15:09', dm = e8Ms('2026-01-04', depT, 0), dsub = dm, dstart = earnStartOf(dsub, { ...c, startLagH: 0 }, 0), dfirst = dstart + c.firstLagH * H, hm = (ms) => e8(ms, 0).hm + (e8(ms, 0).day > '2026-01-04' ? ' (next day)' : '');
    root.innerHTML = `
      
      <p class="hint">${esc(a.name)} · every time here uses the clock of ${esc(a.exchange || 'this platform')}, not this phone’s clock. Now: <b>${esc(e8Label(now, off))} (${tz})</b>. Hourly earnings are worked out while the On/Off switch beside Subscription Settings (on the account page) is On. It is now <b>${c.on ? 'On' : 'Off'}</b>.</p>
      <div class="two"><label class="field"><span>Timezone</span><select data-ew="tz">${Array.from({ length: 27 }, (_, i) => i - 12).map((z) => `<option value="${z}" ${z === off ? 'selected' : ''}>${tzName(z)}</option>`).join('')}</select></label>
      <label class="field"><span>Current Yearly Rate (APR, %)</span><input data-ew="apy" inputmode="decimal" value="${c.apy || ''}" placeholder="e.g. 4.5"></label></div>
      <p class="hint">Binance and Bybit use UTC+0, Bitget UTC+8. Changing the rate here starts a new period from now and keeps the earlier ones. To fix a past rate or its time, use APR History below: the hours after it are worked out again.</p>
      ${aprHistory(db, a, c, off, tz, log, cur)}
      ${true ? `<label class="field"><span>Pay Interest To</span><select data-ew="payTo"><option value="spot" ${c.payTo !== 'earn' ? 'selected' : ''}>Spot (same coin)</option><option value="earn" ${c.payTo === 'earn' ? 'selected' : ''}>This Earn account</option></select></label>
      <label class="field"><span>When Does Earning Start?</span><select data-ew="startRule"><option value="nextHour" ${c.startRule !== 'midnight' ? 'selected' : ''}>At the next full hour</option><option value="midnight" ${c.startRule === 'midnight' ? 'selected' : ''}>At the next midnight (${tz})</option></select></label>
      <div class="two"><div class="field"><span>Deposit Time</span><button type="button" class="btn ghost sm tbtn" data-ew="pickdep">🕒 ${esc(depT)}</button></div>
      <label class="field"><span>First Accrual (Hours After Earning Starts)</span><input data-ew="firstLagH" inputmode="numeric" value="${c.firstLagH}"></label></div>
      <div class="cardbox"><b>What These Mean</b>
        <p class="hint"><b>Deposit Time</b> is the clock time your coins really arrive in this Earn product at the exchange (in ${tz}). It is not when you tap here. The exchange never pays for the hour in progress, so earning starts later (next full hour, or the next midnight if you chose that).</p>
        <p class="hint"><b>First Accrual</b> is how many hours after earning starts the first payout is recorded. Most products record it 1 hour later, then every hour.</p>
        <p class="hint">Example: deposited at <b>${esc(depT)}</b> → earning starts <b>${esc(hm(dstart))}</b> → first accrual <b>${esc(hm(dfirst))}</b>.</p></div>
      <div class="subhead"><h3>Automatic Subscription</h3><div class="yn" role="group" aria-label="Automatic Subscription"><button type="button" class="chip ${c.subOn ? 'on' : ''}" data-ew="suby" aria-pressed="${!!c.subOn}">Yes</button><button type="button" class="chip ${!c.subOn ? 'on' : ''}" data-ew="subn" aria-pressed="${!c.subOn}">No</button></div></div>
      <p class="hint">${c.subOn ? 'At each time below, everything available in the account you move from is subscribed to Earn. No amount to set.' : 'Choose Yes to move all available coins into Earn on its own, at set times.'}</p>
      ${c.subOn ? `<label class="field"><span>Move From</span><select data-ew="from">${srcs.map((x) => `<option value="${x.id}" ${x.id === fromId ? 'selected' : ''}>${esc(x.name)} (${esc(walletOf(x))})</option>`).join('') || '<option value="">No other account with this coin on this platform</option>'}</select></label>
      <div class="chips">${(c.slots || []).slice().sort().map((t) => `<button type="button" class="chip" data-ew="delslot" data-v="${t}">${t} ✕</button>`).join('') || '<span class="muted">No times yet.</span>'}</div>
      <div class="addtime"><span class="muted">Add a time (${tz})</span><button type="button" class="btn ghost sm tbtn" data-ew="pickslot">🕒 ${esc(pick)}</button><button type="button" class="btn sm" data-ew="addslot">Add</button></div>
      <p class="hint">Sukli runs this when you open the app. If it was closed at a set time, the subscription is still recorded at that exact time, so earnings count from then.</p>` : ''}
      <div class="btnrow"><button type="button" class="btn primary" data-ew="done">Done</button></div>
      ${subs.length ? `<h3>Latest Subscriptions</h3><ul class="calfacts">${subs.map((x) => `<li><span>${num(x.amt, cur)}${x.auto ? ' · auto' : ''}<br><small class="muted">Subscribed ${esc(e8Label(x.sub, off))} · earning starts ${esc(e8Label(x.start, off))} · first accrual ${esc(e8Label(x.first, off))}</small></span></li>`).join('')}</ul>` : ''}
      <h3>Today So Far <small class="muted">${esc(today)}</small></h3>
      <p><b>${num(tsum, cur)}</b> in ${todayH.length} hours. It becomes one entry after midnight (${tz}).</p>${todayH.length ? hrs(todayH) : ''}
      <h3>Daily History</h3>
      ${log.days.length ? log.days.slice(0, 60).map((d) => `<div class="cardbox"><button type="button" class="linkbtn" data-ew="day" data-v="${d.day}">${open.has(d.day) ? '▾' : '▸'} ${esc(d.day)} · ${num(d.amt, cur)} · ${d.hours.length} hours</button>${open.has(d.day) ? hrs(d.hours.slice().reverse(), d.z != null ? d.z : off) : ''}</div>`).join('') : '<p class="empty">No finished days yet.</p>'}` : ''}`;
  };
  draw();
  if (focus === 'apr') setTimeout(() => { const t = root.querySelector('#aprhist'); if (t) t.scrollIntoView({ block: 'start' }); }, 60);
  root.addEventListener('change', (e) => { const k = e.target.dataset.ew; if (!k) return; const v = e.target.value;
    if (k === 'apy') { const nv = Math.max(0, parseFloat(v) || 0); commit((d) => { const x = d.accounts.find((q) => q.id === id), e = (x.earn = { ...(x.earn || {}) }); let h = apyHistOf(e); if (!h.length && e.apy > 0) h = [{ at: 0, apy: +e.apy }];
        if ((h.length ? h[h.length - 1].apy : 0) !== nv || !h.length) h.push({ at: h.length ? Date.now() : 0, apy: nv }); e.apyHist = h; e.apy = nv; stamp(x); if (e.on) runEarn(d); }); return draw(); }
    if (k === 'firstLagH') return set({ [k]: Math.max(0, parseInt(v, 10) || 0) });
    if (k === 'from') return set({ from: v });
    if (k === 'payTo') return set({ payTo: v === 'earn' ? 'earn' : 'spot' });
    if (k === 'startRule') return set({ startRule: v === 'midnight' ? 'midnight' : 'nextHour' });
    if (k === 'tz') { const a = get().accounts.find((x) => x.id === id); commit((d) => { const m = (d.settings.platformTz = d.settings.platformTz || {}); m[a.exchange || a.name] = +v; }); return draw(); }
  });
  root.addEventListener('click', (e) => { const b = e.target.closest('button[data-ew]'); if (!b) return; const k = b.dataset.ew, c = cfgOf(get().accounts.find((x) => x.id === id));
    if (k === 'aprAdd') return aprSheet(null);
    if (k === 'aprEdit') return aprSheet(+b.dataset.v);
    if (k === 'aprDel') { const i = +b.dataset.v; commit((d) => { const x = d.accounts.find((q) => q.id === id), e = x.earn; const h = apyHistOf(e); h.splice(i, 1); if (h.length) h[0] = { at: 0, apy: h[0].apy }; e.apyHist = h; e.apy = h.filter((y) => y.at <= Date.now()).pop() ? h.filter((y) => y.at <= Date.now()).pop().apy : (h[0] ? h[0].apy : 0); stamp(x); if (e.on) runEarn(d); }); return draw(); }
    if (k === 'day') { open.has(b.dataset.v) ? open.delete(b.dataset.v) : open.add(b.dataset.v); draw(); }
    if (k === 'suby') return set({ subOn: true });
    if (k === 'subn') return set({ subOn: false });
    if (k === 'pickdep') { import('./datepicker.js').then((m) => m.openDatePicker(`2000-01-01 ${cfgOf(get().accounts.find((x) => x.id === id)).depTime || '15:09'}:00`, (v) => set({ depTime: String(v).slice(11, 16) }), { time: true, title: 'Deposit Time' })); return; }
    if (k === 'done') { s.close(); toast('Subscription settings saved.'); return; }
    if (k === 'delslot') set({ slots: c.slots.filter((t) => t !== b.dataset.v) });
    if (k === 'pickslot') { import('./datepicker.js').then((m) => m.openDatePicker(`2000-01-01 ${pick}:00`, (v) => { pick = String(v).slice(11, 16); draw(); }, { time: true, title: 'Choose a time' })); return; }
    if (k === 'addslot') { const t = pick; if (!/^\d\d:\d\d$/.test(t)) { toast('Pick a time first.'); return; } set({ slots: [...new Set([...(c.slots || []), t])] }); } });
}
ACT['earn-open'] = (el) => openEarn(el.dataset.id, el.dataset.focus || '');

// tapping a day's "Interest Earned" entry: the hours behind it (the total is still growing while the day is open)
export function openEarnDay(t) {
  const db = get(), a = db.accounts.find((x) => x.id === t.earnAcct), d = dayHours(db, t), z = d.z != null ? d.z : (a ? tzOf(db, a) : 0), cur = t.cur;
  const rows = d.hours.slice().reverse(), tot = d.hours.reduce((q, x) => q + x[1], 0);
  sheet(`<p class="hint">${esc(a ? a.name : 'Earn')} · ${esc(t.earnDay)} on the platform clock (${tzName(z)}). ${d.done ? 'This day is finished.' : '<b>Still adding up:</b> a new hour is added at the top of every hour until midnight.'}</p>
    <div class="facts three"><div><span>Hours</span><b>${rows.length}</b></div><div><span>Total So Far</span><b class="cg">${fmt(tot, cur)}</b></div><div><span>Credited To</span><b>${esc((db.accounts.find((x) => x.id === t.acct) || {}).name || '')}</b></div></div>
    ${rows.length ? `<ul class="calfacts">${rows.map((x) => `<li><span>${esc(e8Label(x[0], z))}</span><b>${fmt(x[1], cur)}</b></li>`).join('')}</ul>` : '<p class="muted">The hours are no longer kept for this day.</p>'}`, { title: 'Interest Earned', wide: true });
}
