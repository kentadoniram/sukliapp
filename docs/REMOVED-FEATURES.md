# Removed from the screens (code kept) — to deal with later

Hidden in v12ab (12.52) because new users would not understand them. The code is still in the repo; only the Settings sections are switched off by `js/features.js` (`REMOVED_UI`).

| Feature | Where the code is | Why hidden | To bring back |
|---|---|---|---|
| Google backup (Drive hidden folder, Google client ID, "Back up now", auto backup) | `js/drive.js`, `ACT.sync`, `ACT.gsetup`, boot `initBackup`/`scheduleSync` in `js/app.js` | Needs a Google Cloud client ID; confusing for new users | `localStorage.setItem('sukli.legacy','1')`, reload. Later: a one-tap Google sign-in with no client ID |
| Cloud sync (Supabase project URL + anon key, sync now, auto sync) | `js/cloud.js`, `supabase.sql`, `config.js` | Needs your own Supabase project | same flag. Later: hosted sync without setup |
| Google sign-in through Supabase | `signInWithGoogle` in `js/cloud.js`, `handleOAuthReturn` | Depends on Cloud sync | same flag |
| Email sign-in and "Create account" (sign-up) | `signIn`, `signUp`, `signOut` in `js/cloud.js` | Could not be verified end to end here (sandbox has no Supabase), so removed with Cloud sync | same flag; test with a real project first |

Kept: "Backup reminder" and the CSV / JSON export and restore in "Your data". The boot code still runs, so anyone who set up sync earlier keeps working; it simply has no screen.
