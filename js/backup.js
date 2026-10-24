// Local backup reminder. A web page cannot save files by itself, so Sukli reminds you at the time you choose
// (when the app is open) and one tap downloads the backup. Turning the app into an Android app later can make this automatic.
import { get, commitQuiet } from './core.js';
import { ACT, esc } from './ui.js';

const DEF = { mode: 'daily', time: '20:00' };
export const backupCfg = (db) => ({ ...DEF, ...(db.settings.backupRemind || {}) });

export function backupDue(db, now = new Date()) {
  const c = backupCfg(db);
  if (c.mode === 'off') return false;
  const [h, m] = String(c.time).split(':').map(Number);
  const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0);
  if (now < slot) return false;
  if (now.getTime() < (db.settings.backupSnooze || 0)) return false;
  const last = db.settings.lastLocalBackup || 0;
  if (last >= slot.getTime()) return false;
  return c.mode === 'daily' || now.getTime() - last > 7 * 864e5;
}

function nudge() {
  const old = document.getElementById('backupnudge'); if (old) old.remove();
  if (!backupDue(get())) return;
  const el = document.createElement('div');
  el.id = 'backupnudge'; el.className = 'nudge'; el.setAttribute('role', 'status');
  el.innerHTML = `<span><strong>Time to back up</strong><small>Download a copy of your data and keep it somewhere safe.</small></span>
    <button type="button" class="btn sm" data-act="export-json">Download</button><button type="button" class="btn sm ghost" data-act="backup-later">Later</button>`;
  document.body.appendChild(el);
}
export function initBackup() {
  const orig = ACT['export-json'];
  ACT['export-json'] = (...a) => { if (orig) orig(...a); commitQuiet((d) => { d.settings.lastLocalBackup = Date.now(); }); nudge(); };
  ACT['backup-later'] = () => { commitQuiet((d) => { d.settings.backupSnooze = Date.now() + 3 * 3600e3; }); nudge(); };
  document.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.bk; if (!k) return;
    commitQuiet((d) => { d.settings.backupRemind = { ...(d.settings.backupRemind || {}), [k]: e.target.value }; d.settings.backupSnooze = 0; });
    nudge();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) nudge(); });
  setInterval(nudge, 10 * 60 * 1000);   // also at the chosen time if the app stays open
  nudge();
}
export const backupSection = (db) => {
  const c = backupCfg(db), last = db.settings.lastLocalBackup;
  return `<section><h2>Backup reminder</h2><p class="hint">${last ? 'Last download: ' + esc(new Date(last).toLocaleString()) + '. ' : 'No backup downloaded yet. '}A reminder appears when the app is open after the time you choose.</p>
    <div class="bkrow"><label class="field inline"><span>Remind me</span><select data-bk="mode">${[['daily', 'Every day'], ['weekly', 'Every week'], ['off', 'Never']].map(([v, l]) => `<option value="${v}" ${c.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field inline"><span>At</span><input type="time" data-bk="time" value="${esc(c.time)}" data-noclear="1"></label></div></section>`;
};
