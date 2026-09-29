// Cache version. Everything below is network-first, so a normal deploy reaches
// the phone without touching this. Bump it only to force every device to throw
// its stored copy away — see the README for when that is actually needed.
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
  './js/version.js',
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

// 'no-cache' revalidates with the server on every request, so GitHub Pages'
// own HTTP caching can never hand back a file from before the last deploy.
function fromNetwork(url) {
  return fetch(new Request(url, { cache: 'no-cache', credentials: 'same-origin' }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One file failing must not fail the whole install; the fetch handler
    // fills in anything missing the first time it is asked for.
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const response = await fromNetwork(url);
        if (response.ok) await cache.put(url, response);
      } catch { /* offline during install */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  // Pages are stored under their path alone, so a single entry serves
  // note.html?id=… for every note rather than one entry per note opened.
  const cacheKey = isNavigation ? url.origin + url.pathname : request;

  event.respondWith((async () => {
    try {
      const response = await fromNetwork(url.href);
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        // Refreshing the stored copy on every success is what keeps the
        // offline version in step with what was last deployed.
        caches.open(CACHE).then((cache) => cache.put(cacheKey, copy));
      }
      return response;
    } catch {
      const cached = await caches.match(cacheKey);
      if (cached) return cached;
      if (isNavigation) {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
