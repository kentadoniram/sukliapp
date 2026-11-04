// The Earn schedule window of an Earn account: settings, subscriptions, today's hours and the daily history. Times follow each platform’s own clock.
import { get, commit, stamp, fmt, CUR, walletOf } from './core.js';
import { esc, sheet, toast, ACT } from './ui.js';
import { cfgOf, e8, e8Ms, e8Label, logOf, subscriptions, H, runEarn, tzOf, tzName, earnStartOf, defaultFrom } from './earn.js';
const dec = (cur) => Math.max(2, Math.min(8, (CUR[cur] || { dec: 8 }).dec));
const num = (n, cur) => fmt(n, cur);
export function openEarn(id) {
  let pick = '09:00';
  const s = sheet('<div id="ew"></div>', { title: 'Subscription Settings', wide: true }), root = s.el.querySelector('#ew'), open = new Set();
  const set = (patch) => { commit((d) => { const x = d.accounts.find((q) => q.id === id); x.earn = { ...(x.earn || {}), ...patch }; stamp(x); if (x.earn.on) runEarn(d); }); draw(); };
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
      <label class="field"><span>Yearly Rate (APY, %)</span><input data-ew="apy" inputmode="decimal" value="${c.apy || ''}" placeholder="e.g. 4.5"></label></div>
      <p class="hint">Binance and Bybit use UTC+0, Bitget UTC+8. It applies to every Earn product on ${esc(a.exchange || 'this platform')}. Changing it only affects new times: entries already recorded keep theirs.</p>
      ${true ? `<label class="field"><span>When Does Earning Start?</span><select data-ew="startRule"><option value="nextHour" ${c.startRule !== 'midnight' ? 'selected' : ''}>At the next full hour</option><option value="midnight" ${c.startRule === 'midnight' ? 'selected' : ''}>At the next midnight (${tz})</option></select></label>
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
  root.addEventListener('change', (e) => { const k = e.target.dataset.ew; if (!k) return; const v = e.target.value;
    if (k === 'apy') return set({ apy: Math.max(0, parseFloat(v) || 0) });
    if (k === 'firstLagH') return set({ [k]: Math.max(0, parseInt(v, 10) || 0) });
    if (k === 'from') return set({ from: v });
    if (k === 'startRule') return set({ startRule: v === 'midnight' ? 'midnight' : 'nextHour' });
    if (k === 'tz') { const a = get().accounts.find((x) => x.id === id); commit((d) => { const m = (d.settings.platformTz = d.settings.platformTz || {}); m[a.exchange || a.name] = +v; }); return draw(); }
  });
  root.addEventListener('click', (e) => { const b = e.target.closest('button[data-ew]'); if (!b) return; const k = b.dataset.ew, c = cfgOf(get().accounts.find((x) => x.id === id));
    if (k === 'day') { open.has(b.dataset.v) ? open.delete(b.dataset.v) : open.add(b.dataset.v); draw(); }
    if (k === 'suby') return set({ subOn: true });
    if (k === 'subn') return set({ subOn: false });
    if (k === 'pickdep') { import('./datepicker.js').then((m) => m.openDatePicker(`2000-01-01 ${cfgOf(get().accounts.find((x) => x.id === id)).depTime || '15:09'}:00`, (v) => set({ depTime: String(v).slice(11, 16) }), { time: true, title: 'Deposit Time' })); return; }
    if (k === 'done') { s.close(); toast('Subscription settings saved.'); return; }
    if (k === 'delslot') set({ slots: c.slots.filter((t) => t !== b.dataset.v) });
    if (k === 'pickslot') { import('./datepicker.js').then((m) => m.openDatePicker(`2000-01-01 ${pick}:00`, (v) => { pick = String(v).slice(11, 16); draw(); }, { time: true, title: 'Choose a time' })); return; }
    if (k === 'addslot') { const t = pick; if (!/^\d\d:\d\d$/.test(t)) { toast('Pick a time first.'); return; } set({ slots: [...new Set([...(c.slots || []), t])] }); } });
}
ACT['earn-open'] = (el) => openEarn(el.dataset.id);
