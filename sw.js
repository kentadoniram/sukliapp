// Offline shell: serve the app from cache, refresh it quietly in the background.
const VERSION = 'sukli-v7f';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/finance.js', 'js/accpage.js', 'js/calc.js', 'js/appearance.js', 'js/core.js', 'js/importer.js', 'js/predict.js', 'js/drive.js', 'js/cloud.js', 'js/insights.js', 'js/views.js', 'config.js', 'js/ui.js', 'js/entry.js', 'js/screens.js', 'js/rates.js', 'js/backup.js', 'js/acctpicker.js', 'js/curpicker.js', 'js/datepicker.js', 'js/gestures.js', 'js/bin.js', 'js/analytics.js',
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
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
