const CACHE_NAME = 'memo-app-cache-v1.3'; // Increment cache version
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js', // Main application script
  '/themes.js', // Themes definition
  '/utils/numberExtractor.js', // Number extraction utility
  '/manifest.json',
  '/icons/icon-192x192.png', // Ensure icons are cached
  '/icons/icon-512x512.png',
  // External CDN resources
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Kaisei+Opti:wght@400;700&family=M+PLUS+1+Code:wght@400;500&display=swap',
  // Note: esm.sh resources for React were removed, as React is no longer used.
  // Add other specific font files from fonts.gstatic.com if needed, though the CSS @import often handles this.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        const cachePromises = urlsToCache.map(urlToCache => {
          return cache.add(urlToCache).catch(err => {
            console.warn(`Failed to cache ${urlToCache}:`, err);
            // For critical resources, you might want to fail the install
            // For non-critical, like some fonts, this warning is okay
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache strategy for Google Fonts and Tailwind CDN: Stale-While-Revalidate
  if (url.origin === 'https://fonts.googleapis.com' || 
      url.origin === 'https://fonts.gstatic.com' ||
      url.origin === 'https://cdn.tailwindcss.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchedResponsePromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
            console.warn(`Network fetch failed for ${event.request.url}:`, err);
            // If network fails, and we have a cached response, use it.
            // This effectively makes it CacheFirst on network failure after initial StaleWhileRevalidate attempt.
            return cachedResponse; 
        });
        return cachedResponse || fetchedResponsePromise;
      })
    );
    return;
  }

  // Cache-first strategy for local assets (HTML, JS, CSS, images, manifest)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Cache hit
        }
        // Cache miss, fetch from network
        return fetch(event.request).then(
          (networkResponse) => {
            if (networkResponse && networkResponse.ok && event.request.method === 'GET') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('Fetching failed for local asset:', event.request.url, error);
          // Optionally, return a fallback offline page if appropriate
          // e.g., if (event.request.mode === 'navigate') return caches.match('/offline.html');
          throw error;
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
