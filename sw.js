const CACHE = 'lemon-empire-v4';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './js/game-state.js',
  './js/game-audio.js',
  './js/game-economy.js',
  './js/game-ui.js',
  './js/game-simulation.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './vendor/js/chart.umd.min.js',
  './vendor/fonts/google-fonts.css',
  './vendor/fonts/fredoka-one-400.ttf',
  './vendor/fonts/nunito-400.ttf',
  './vendor/fonts/nunito-600.ttf',
  './vendor/fonts/nunito-700.ttf'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
