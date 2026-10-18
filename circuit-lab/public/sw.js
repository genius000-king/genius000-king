// Offline cache for the static site.
// Build files under /_next/static/ have content hashes in their names, so a cached copy is never stale:
// they are served from the cache first. Pages and everything else go to the network first and fall back
// to the cache, so a new deployment is picked up on the next visit and the last one still works offline.
const CACHE = 'circuit-lab-v1';

self.addEventListener('install', event =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(['/', '/favicon.svg']))
      .then(() => self.skipWaiting())
  )
);

// files the page fetched before this worker controlled it (the first visit) are added on request
self.addEventListener('message', event => {
  if (event.data?.type !== 'cache') return;
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache =>
        Promise.all(
          event.data.urls.map(url => cache.match(url).then(hit => hit || cache.add(url).catch(() => {})))
        )
      )
  );
});
self.addEventListener('activate', event =>
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

async function cacheFirst(request) {
  const cache = await caches.open(CACHE),
    hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const hit = await cache.match(request, {ignoreSearch: true});
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', event => {
  const {request} = event,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(url.pathname.startsWith('/_next/static/') ? cacheFirst(request) : networkFirst(request));
});
