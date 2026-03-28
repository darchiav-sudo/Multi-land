// Multi Land PWA - Version 2.0.4
const APP_VERSION = '2.0.4';
const CACHE_NAME = 'multi-land-v6';

// Files to cache - add key assets here
const filesToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Standard icons
  '/icons/icon-48.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-1024.svg',
  // Maskable icons
  '/icons/maskable-icon-48.svg',
  '/icons/maskable-icon-192.svg',
  '/icons/maskable-icon-512.svg',
  '/icons/maskable-icon-1024.svg',
  // Core app scripts and styles
  '/src/main.tsx',
  '/appInstall.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(filesToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response
        if (response) {
          return response;
        }

        // Clone the request - request streams can only be read once
        const fetchRequest = event.request.clone();

        // Return the network response
        return fetch(fetchRequest)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response - response streams can only be read once
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // If both cache and network fail, show fallback content
        // This is where we would serve offline.html if needed
        console.log('Fetch failed; returning offline page instead.');
      })
  );
});