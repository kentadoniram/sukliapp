// Cloud sync through a free Supabase project (plain fetch, no library).
// Each entry, account, category and budget is one row; only rows that changed travel.
// Sign-in is email + password, and a database rule lets each user see only their own rows.
import { get, commit } from './core.js';
import { CONFIG } from '../config.js';

export const SETUP_SQL = `-- Run this once in Supabase: SQL Editor, paste, Run.
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  coll       text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at bigint      not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, coll, id)
);
create index if not exists records_user_synced on public.records (user_id, synced_at);

alter table public.records enable row level security;
drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- stamps each write with server time, and ignores a write that is older than what is stored
create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_synced_at();
`;

const COLLS = ['accounts', 'categories', 'txs', 'budgets'];
const AUTH_KEY = 'sukli-auth';
const META_KEY = 'sukli-cloud-meta';

export const cloudStatus = { text: '', ok: null };
const listeners = new Set();
export const onCloudStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const say = (text, ok = null) => { cloudStatus.text = text; cloudStatus.ok = ok; listeners.forEach((f) => f(cloudStatus)); };

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } };

export const session = () => lsGet(AUTH_KEY);
export const signedIn = () => !!(session() && session().refresh_token);
export const lastOk = () => (lsGet(META_KEY) || {}).lastOk || 0;

export const configured = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const cfg = () => {
  const c = get().settings.cloud || {};
  const url = String(CONFIG.supabaseUrl || c.url || '').trim().replace(/\/+$/, '');
  const key = String(CONFIG.supabaseKey || c.key || '').trim();
  if (!/^https:\/\/[^/]+$/.test(url) || !key) throw new Error('Add your Supabase project URL and public key first.');
  return { url, key };
};

class CloudError extends Error {}

async function http(path, { method = 'GET', body, headers = {}, auth = true, retry = true } = {}) {
  const { url, key } = cfg();
  const h = { apikey: key, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth) h.Authorization = 'Bearer ' + (await accessToken());
  let r;
  try {
    r = await fetch(url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new CloudError('Cannot reach your Supabase project. Check the connection and the project URL. If you have not used the project for a week, open the Supabase dashboard and press Restore, because free projects pause.');
  }
  if (r.status === 401 && auth && retry) { await refresh(true); return http(path, { method, body, headers, auth, retry: false }); }
  if (!r.ok) {
    let j = {}; try { j = await r.json(); } catch { /* not json */ }
    const msg = j.msg || j.message || j.error_description || j.error || '';
    if (/relation .*records.* does not exist|PGRST205|Could not find the table/i.test(msg + (j.code || ''))) {
      throw new CloudError('The records table is missing. Run the setup SQL in Supabase (Settings, Set up Supabase).');
    }
    if (/invalid login|invalid_credentials/i.test(msg + (j.error_code || ''))) throw new CloudError('Wrong email or password.');
    if (/email not confirmed/i.test(msg)) throw new CloudError('Confirm your email first (check your inbox), or turn off “Confirm email” in Supabase under Authentication.');
    if (/already registered|user_already_exists/i.test(msg + (j.error_code || ''))) throw new CloudError('That email already has an account. Use Sign in.');
    if (/apikey|Invalid API key/i.test(msg)) throw new CloudError('Supabase rejected the public key. Copy the “anon public” key again.');
    throw new CloudError(msg ? `Supabase said: ${msg}` : `Supabase answered ${r.status}.`);
  }
  return r;
}

function storeSession(j) {
  const s = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + ((j.expires_in || 3600) * 1000),
    user: { id: j.user && j.user.id, email: j.user && j.user.email },
  };
  lsSet(AUTH_KEY, s);
  return s;
}

async function refresh(force = false) {
  const s = session();
  if (!s) throw new CloudError('Signed out. Sign in again.');
  if (!force && s.expires_at - Date.now() > 60000) return s;
  try {
    const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token }, auth: false });
    return storeSession({ ...(await r.json()) });
  } catch (e) {
    if (/Cannot reach/.test(e.message)) throw e;   // offline: keep the session
    lsSet(AUTH_KEY, null);
    throw new CloudError('Your sign-in expired. Sign in again.');
  }
}
async function accessToken() { return (await refresh()).access_token; }

export async function signIn(email, password) {
  const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
  const s = storeSession(await r.json());
  commit((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), email, auto: true }; });
  return s;
}

export async function signUp(email, password) {
  const r = await http('/auth/v1/signup', { method: 'POST', body: { email, password }, auth: false });
  const j = await r.json();
  if (!j.access_token) {
    throw new CloudError('Account created. Supabase sent a confirmation email: open it, then press Sign in. (To skip this, turn off “Confirm email” in Supabase under Authentication, Providers, Email.)');
  }
  const s = storeSession(j);
  commit((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), email, auto: true }; });
  return s;
}

// ---------- Google sign-in (through Supabase) ----------
// Supabase sends the person to Google and back to this page with the tokens after the "#".
export function signInWithGoogle() {
  const { url } = cfg();
  const back = location.origin + location.pathname;
  location.href = `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
}

// called once at start-up: if we were just sent back from Google, keep the session. Returns a message to show, or ''.
export async function handleOAuthReturn() {
  const raw = location.hash.replace(/^#\/?/, '');
  const q = new URLSearchParams(raw.includes('=') ? raw : '');
  const qs = new URLSearchParams(location.search);
  const err = q.get('error_description') || qs.get('error_description');
  if (!q.get('access_token') && !err) return '';
  history.replaceState(null, '', location.pathname + '#/home');
  if (err) return /not enabled|provider/i.test(err) ? 'Google sign-in is not switched on in your Supabase project yet. See Settings, Cloud sync, Set up Google sign-in.' : `Google sign-in failed: ${err}`;
  try {
    const { url, key } = cfg();
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + q.get('access_token') } });
    const user = r.ok ? await r.json() : {};
    storeSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_in: +q.get('expires_in') || 3600, user });
    commit((d) => { d.settings.cloud = { ...(d.settings.cloud || {}), email: user.email || '', auto: true }; });
    await cloudSync();
    return `Signed in with Google${user.email ? ' as ' + user.email : ''} and synced.`;
  } catch (e) { return e.message || 'Could not finish Google sign-in.'; }
}

export function signOut() { lsSet(AUTH_KEY, null); lsSet(META_KEY, null); say('Signed out. Entries stay on this device.'); }

// ---------- sync ----------
let busy = false, timer = null, lastRun = 0;

export async function cloudSync() {
  if (busy) return;
  busy = true;
  const started = Date.now();
  try {
    say('Syncing…');
    cfg();
    if (!signedIn()) throw new CloudError('Sign in first.');
    const meta = lsGet(META_KEY) || {};

    // 1. pull what changed on the server since last time (2 minute overlap; merging twice is harmless)
    const since = meta.lastPull ? new Date(new Date(meta.lastPull).getTime() - 120000).toISOString() : null;
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const q = `select=coll,id,data,updated_at,synced_at&order=synced_at.asc,id.asc&limit=1000&offset=${offset}` + (since ? `&synced_at=gt.${encodeURIComponent(since)}` : '');
      const batch = await (await http('/rest/v1/records?' + q)).json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    const remoteStamp = new Map();
    let maxSynced = meta.lastPull || '';
    let pulled = 0;
    commit((d) => {
      const index = {};
      for (const c of COLLS) index[c] = new Map(d[c].map((x, i) => [x.id, i]));
      for (const row of rows) {
        if (row.synced_at > maxSynced) maxSynced = row.synced_at;
        if (!index[row.coll] || !row.data || !row.data.id) continue;
        remoteStamp.set(row.coll + ':' + row.id, row.data.updatedAt || 0);
        const i = index[row.coll].get(row.id);
        if (i === undefined) { d[row.coll].push(row.data); index[row.coll].set(row.id, d[row.coll].length - 1); pulled++; }
        else if ((row.data.updatedAt || 0) > (d[row.coll][i].updatedAt || 0)) { d[row.coll][i] = row.data; pulled++; }
      }
    });

    // 2. push what this device changed since last time
    const out = [];
    const db = get();
    for (const c of COLLS) {
      for (const r of db[c]) {
        if ((r.updatedAt || 0) > (meta.lastPush || 0) && remoteStamp.get(c + ':' + r.id) !== r.updatedAt) {
          out.push({ coll: c, id: r.id, data: r, updated_at: r.updatedAt });
        }
      }
    }
    for (let i = 0; i < out.length; i += 400) {
      await http('/rest/v1/records?on_conflict=user_id,coll,id', {
        method: 'POST', body: out.slice(i, i + 400),
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    }

    lsSet(META_KEY, { lastPull: maxSynced, lastPush: started, lastOk: Date.now() });
    say(`Synced ${new Date().toLocaleTimeString()}. ${pulled} received, ${out.length} sent.`, true);
    lastRun = Date.now();
  } catch (e) {
    say(e.message || String(e), false);
    throw e;
  } finally {
    busy = false;
    const dirty = COLLS.some((c) => get()[c].some((r) => (r.updatedAt || 0) > started));
    if (dirty) cloudSchedule();
  }
}

// after an edit: wait a few seconds, then sync quietly
export function cloudSchedule() {
  const c = get().settings.cloud || {};
  if (busy || !signedIn() || c.auto === false) return;
  clearTimeout(timer);
  timer = setTimeout(() => cloudSync().catch(() => {}), 4000);
}

// on open, on coming back to the app, and when the connection returns
export function cloudInit() {
  const go = () => { const c = get().settings.cloud || {}; if (signedIn() && c.auto !== false && Date.now() - lastRun > 30000) cloudSync().catch(() => {}); };
  setTimeout(go, 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
  window.addEventListener('online', go);
}
