# Sukli (working title)

A private money tracker that runs entirely in the browser. Your data stays on your device, with an optional backup to a hidden folder in your own Google Drive. No server, no subscription, no AI service: the category guesser is a small model that learns from your own entries and runs on the phone.

## What it does

- **Home** shows the month at a glance: came in / went out / left over, a pace chart against last month, a few plain-language observations (above or below your usual, categories far from normal, unusually large entries), where the money went, where it came from, and the last six months. Tap any group to open its entries, categories, history and comparison.
- **Categories** are yours to add, rename and regroup (Settings, Categories), for spending and income. Give a category keywords and the app guesses it immediately; it also learns from every entry.
- **Eye button** (top right) hides every amount on screen and masks the amount you type. Remembered on this device only.
- **Other currencies** show a small peso equivalent (turn off under Settings, Display).

## Put it online (free)

1. Unzip this folder.
2. Go to https://app.netlify.com/drop and drag the whole folder onto the page. You get an address like `https://something.netlify.app`.
   (GitHub Pages also works: upload the folder to a repository and turn on Pages.)
3. Open that address on your phone.
   - iPhone: Safari, Share, Add to Home Screen. **Do this before importing**, because the Home Screen app keeps its own separate storage from Safari tabs, as far as I know.
   - Android: browser menu, Install app.

## First run

- Choose **Import my Bluecoins export (CSV)**. Accounts, balances, categories and all entries come across. Importing the same file again skips entries that are already here.
- A sheet then asks you to confirm which accounts count toward "Spendable now". Crypto, loans and people are off by default.

## Cloud sync with Supabase (free, recommended)

Keeps your phone and your Mac in step. Each entry is one row in a database that only you can read; only changed rows are sent.

1. Create a free project at supabase.com. Open **SQL Editor**, paste the contents of `supabase.sql` (also shown in the app under Settings, Set up Supabase), press Run.
2. **Project Settings, API**: copy the Project URL and the *anon public* key.
3. In the app: Settings, Cloud sync. Paste both, enter your email and a password, press **Create account**. (If Supabase asks for email confirmation, confirm it, or turn off *Confirm email* under Authentication, Providers, Email.)
4. **Import the Bluecoins CSV on one device only**, then sign in on the other devices, which pull everything. Importing separately on two devices would create duplicate entries.

Free projects pause after a week with no use; press Restore in the Supabase dashboard. Entries also live on each device, so nothing is lost while it is paused.

## Google backup (optional)

Settings, then **How to get a client ID** (also written out in the app). In short: create a free Google Cloud project, enable the Drive API, create a Web OAuth client with your Netlify address as the authorised origin, add yourself as a test user, paste the client ID into Settings, tap **Back up now**.
The app asks only for its own hidden folder (`drive.appdata`) and keeps one snapshot per day for 14 days. Both phones sync through the same file and merge by entry.

## Files

- `index.html`, `styles.css`, `sw.js` (offline), `manifest.webmanifest`, `supabase.sql`
- `js/core.js` data and maths, `js/importer.js` CSV in and out, `js/predict.js` category guesser, `js/cloud.js` Supabase sync, `js/drive.js` Google backup
- `js/entry.js` add/edit sheet, `js/screens.js` screens, `js/app.js` shell
- `fonts/` Schibsted Grotesk (SIL Open Font License, see `LICENSE-font.txt`)

## Known limits

- Cloud sync and Google backup have only been tested against simulated servers, not the real services. The Supabase setup script was checked with PostgreSQL's own parser for syntax only.
- Rates and the "left out of spending" list do not sync between devices yet.
- Google sign-in has only been tested against a simulated Drive, not real Google. Sign-in tokens are short-lived, so auto-backup may sometimes ask you to tap **Back up now**.
- Receipts are entered by hand for now (split into items on the entry sheet). Photo reading is the next piece.
- Crypto balances are shown as money moved in and out, not market value.
