// BUMP THIS on every deploy. The activate step deletes every cache that does
// not match, which is what stops an old copy of the app sticking on the phone.
const CACHE = 'journal-v1';

// Relative URLs throughout, so the app works from a GitHub Pages subpath
// (/<repo>/app/) exactly as it does from a domain root.
const PRECACHE = [
  './',
  './index.html',
  './folders.html',
  './folder.html',
  './note.html',
  './bin.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/db.js',
  './js/model.js',
  './js/ui.js',
  './js/notes-page.js',
  './js/folders-page.js',
  './js/folder-page.js',
  './js/editor-page.js',
  './js/bin-page.js',
  './js/register-sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages go to the network first so a fresh deploy is picked up as soon as
  // there is a connection, and fall back to the cache when there isn't one.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else is served from the cache; the cache name carries the
  // version, so a deploy replaces these wholesale rather than ageing out.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
