// Offline shell: the app is fetched fresh when online and kept in the cache for when you are offline.
const VERSION = 'sukli-v12av';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/finance.js', 'js/stats.js', 'js/merchants.js', 'js/textnorm.js', 'js/simgraph.js', 'js/receipt.js', 'js/sukliCsv.js', 'js/glossary.js', 'js/bulkedit.js', 'js/receiptimg.js', 'js/scan.js', 'js/compare.js', 'js/itemcat.js', 'js/route.js', 'js/rolling.js', 'js/version.js', 'js/label.js', 'js/loans.js', 'js/invest.js', 'js/trades.js', 'js/picker.js', 'js/inputlog.js', 'js/budgetsetup.js', 'js/tradecalc.js', 'js/loancalc.js', 'js/accpage.js', 'js/calc.js', 'js/appearance.js', 'js/core.js', 'js/importer.js', 'js/predict.js', 'js/drive.js', 'js/cloud.js', 'js/features.js', 'js/interest.js', 'js/fxview.js', 'js/tags.js', 'js/jpgloss.js', 'js/welcome.js', 'js/feedback.js', 'js/insights.js', 'js/views.js', 'config.js', 'js/ui.js', 'js/entry.js', 'js/screens.js', 'js/rates.js', 'js/backup.js', 'js/acctpicker.js', 'js/curpicker.js', 'js/datepicker.js', 'js/gestures.js', 'js/bin.js', 'js/analytics.js',
  'fonts/schibsted-grotesk-latin-wght-normal.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first, so a new version shows up on the next open; the cache is only the offline fallback
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; })
    .catch(() => caches.open(VERSION).then((c) => c.match(e.request, { ignoreSearch: true }))));
});
