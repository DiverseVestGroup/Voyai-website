// TripMade service worker (2026-10-28).
// Makes tripmade.co installable and lets the site open with no signal.
// Pages are always fetched fresh when online (so a new upload of index.html
// shows straight away); the last good copy is used only when offline.
// Supabase, Make, partner sites and photos are never cached here.
const CACHE = 'tm-shell-v1';
const SHELL = ['/', '/manifest.json', '/favicon-192.png', '/logo-512.png', '/apple-touch-icon.png', '/favicon.ico'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/plugins/rangePlugin.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(SHELL.concat(LIBS).map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages (any tripmade.co address, e.g. /inbox): network first, saved copy offline.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); }
      return res;
    }).catch(() => caches.match('/').then((r) => r || new Response('<h1>You\'re offline</h1><p>Open TripMade again when you have signal.</p>', { headers: { 'Content-Type': 'text/html' } }))));
    return;
  }

  // Our own icons: cache first.
  if (url.origin === self.location.origin && /\.(png|ico|json)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
    return;
  }

  // Script/style libraries and Google Fonts: use the saved copy, refresh in the background.
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
  // Everything else (Supabase, Make, partners, photos): straight to the network.
});
