// Multi Land Service Worker - No Cache Version
// This is a simplified service worker that doesn't use any caching
// to avoid issues with stale data affecting user authentication and permissions

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installing no-cache version');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activating no-cache version');
  
  // Clear all existing caches to ensure no stale data remains
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('[Service Worker] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[Service Worker] All caches cleared');
      return clients.claim();
    })
  );
});

// Pass through all fetch requests directly to the network
// This ensures fresh data is always loaded with no caching
self.addEventListener('fetch', (event) => {
  console.log('[Service Worker] Fetch pass-through:', event.request.url);
  event.respondWith(fetch(event.request));
});