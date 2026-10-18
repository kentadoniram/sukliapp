// Backup and two-phone sync through the app's hidden folder in YOUR Google Drive.
// The app can only see files it created itself (scope drive.appdata), never the rest of your Drive.
import { get, replaceAll, mergeDbs, commit } from './core.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const MAIN = 'sukli-data.json';
const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';

let token = null, tokenExp = 0, client = null, busy = false;
export const status = { text: '', ok: null };
const listeners = new Set();
export const onStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function say(text, ok = null) { status.text = text; status.ok = ok; listeners.forEach((f) => f(status)); }

function loadGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = res;
    s.onerror = () => rej(new Error('Could not load Google sign-in. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

// interactive = true must come from a tap (browsers block pop-ups otherwise)
async function ensureToken(interactive) {
  if (token && Date.now() < tokenExp - 60000) return token;
  const id = get().settings.driveClientId;
  if (!id) throw new Error('Paste your Google client ID in Settings first.');
  await loadGIS();
  return new Promise((res, rej) => {
    client = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (r) => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        token = r.access_token;
        tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
        res(token);
      },
      error_callback: (e) => rej(new Error(e.type === 'popup_closed' ? 'Sign-in window was closed.' : (e.message || e.type || 'Sign-in failed.'))),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error('Google Drive said ' + r.status + (r.status === 403 ? ' (is the Drive API enabled for this client ID?)' : ''));
  return r;
}

async function findFile(name) {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const r = await api(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)&pageSize=10`);
  return (await r.json()).files || [];
}

async function putFile(name, body, existingId) {
  const boundary = 'sukli' + Math.random().toString(36).slice(2);
  if (existingId) {
    await api(`${UP}/files/${existingId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    return existingId;
  }
  const meta = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' });
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await api(`${UP}/files?uploadType=multipart`, {
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart,
  });
  return (await r.json()).id;
}

// keep one dated snapshot per day and drop snapshots older than 14 days
async function dailySnapshot(body) {
  const day = new Date().toISOString().slice(0, 10);
  const name = `sukli-backup-${day}.json`;
  const q = encodeURIComponent(`name contains 'sukli-backup-' and trashed=false`);
  const r = await api(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name)&pageSize=100`);
  const files = (await r.json()).files || [];
  const today = files.find((f) => f.name === name);
  await putFile(name, body, today && today.id);
  const keep = new Set();
  for (let i = 0; i < 14; i++) keep.add(`sukli-backup-${new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)}.json`);
  for (const f of files) if (!keep.has(f.name)) await api(`${API}/files/${f.id}`, { method: 'DELETE' }).catch(() => {});
}

export async function syncNow({ interactive = false } = {}) {
  if (busy) return;
  busy = true;
  try {
    say('Syncing…');
    await ensureToken(interactive);
    const files = await findFile(MAIN);
    let local = get();
    if (files.length) {
      const remote = await (await api(`${API}/files/${files[0].id}?alt=media`)).json();
      if (remote && remote.v) {
        const merged = mergeDbs(local, remote);
        merged.settings.lastSync = Date.now();
        replaceAll(merged);
        local = get();
      }
    }
    local.settings.lastSync = Date.now();
    const body = JSON.stringify({ ...local, settings: { ...local.settings, driveClientId: '' } });
    await putFile(MAIN, body, files[0] && files[0].id);
    await dailySnapshot(body);
    commit(() => {});
    say('Backed up ' + new Date().toLocaleString(), true);
  } catch (e) {
    say(e.message || String(e), false);
    throw e;
  } finally { busy = false; }
}

// called after edits; stays quiet if Google needs a tap to sign in again
let timer = null;
export function scheduleSync() {
  const s = get().settings;
  if (!s.autoSync || !s.driveClientId) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    syncNow({ interactive: false }).catch(() => say('Auto-backup needs you to tap “Back up now” (Google asked you to sign in again).', false));
  }, 10000);
}
