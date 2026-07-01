// ═══════════════════════════════════════════════════════════════════════
// Centerpost Service Worker (network-first HTML + background refresh)
// ═══════════════════════════════════════════════════════════════════════
//
// STRATEGY
//   - HTML pages (index.html, kids.html, /):  NETWORK-FIRST
//       Browser tries the network first (4s timeout). On success, the
//       fresh response is served AND cached. On failure or offline,
//       falls back to the cached copy. This means deploys take effect
//       on the next page load — no more stale HTML.
//   - Static assets (fonts, Firebase SDK, icons, manifests):
//       STALE-WHILE-REVALIDATE
//       Cached copy served instantly for speed; cache is refreshed in
//       the background for next time.
//   - API calls (Firebase, Anthropic, Google OAuth):  PASS-THROUGH
//       Never cached. Always go straight to network.
//
// DEPLOY NOTE
//   CACHE_VERSION is stamped automatically at build time from the git
//   short hash. Never edit it by hand — run `make build` instead.
// ═══════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'centerpost-d3fe05b';

// Assets to pre-cache on install (offline-ready essentials).
// Failures are tolerated individually — one missing icon won't break install.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './kids.html',
  './manifest.json',
  './kids-manifest.json',
  './kids-icon.svg',
  './kids-icon.png',
  './kids-icon-192.png',
  './kids-icon-512.png',
  './ops.html',
  './howto.html',
  './teacher.html',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.0.0/dist/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&display=swap',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

// Hosts that should always go straight to the network (no caching).
// Firebase + auth endpoints must be live, never cached.
const PASS_THROUGH_HOSTS = [
  'firebaseio.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'cloudfunctions.net',
  'api.anthropic.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'accounts.google.com',
  'apis.google.com'
];

// Regex matching HTML/navigation request URLs
const HTML_PATH = /\.html?$|\/$/;

// ─── Install ────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Promise.allSettled so one 404 doesn't fail the whole install
      Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          fetch(url, { cache: 'reload' })
            .then(r => r.ok ? cache.put(url, r) : null)
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting()) // activate immediately, don't wait for old SW
  );
});

// ─── Activate ───────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control of open pages right away
  );
});

// ─── Fetch dispatcher ───────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;

  // Only GETs — POSTs (auth, Firestore writes) always pass through
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Pass-through hosts: don't intercept at all
  if (PASS_THROUGH_HOSTS.some(h => url.hostname.includes(h))) return;

  // HTML / navigation requests → network-first
  if (req.mode === 'navigate' ||
      req.destination === 'document' ||
      HTML_PATH.test(url.pathname)) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Everything else → stale-while-revalidate
  e.respondWith(staleWhileRevalidate(req));
});

// ─── Strategies ─────────────────────────────────────────────────────────

async function networkFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  // One network request. Whenever it resolves — even AFTER our timeout — a
  // successful response refreshes the cache, so a slow load that fell back to
  // stale cache still self-heals (shows the fresh deploy) on the next load.
  const netFetch = fetch(req).then(resp => {
    if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  });
  try {
    // Race the network against a 4s timeout
    const fresh = await Promise.race([
      netFetch,
      new Promise((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 4000))
    ]);
    if (fresh && fresh.ok) return fresh;
    throw new Error('sw-bad-response');
  } catch (err) {
    // Network slow/failed — serve cache now; netFetch keeps running and
    // refreshes the cache in the background for the next load.
    const cached = await cache.match(req);
    if (cached) return cached;
    // Last resort for navigations: only fall back to cached root for
    // root-level requests — don't silently swap ops.html or other pages
    // with the main dashboard
    if (req.mode === 'navigate' || req.destination === 'document') {
      const path = new URL(req.url).pathname;
      if (path === '/' || path === '/index.html') {
        const root = await cache.match('./') || await cache.match('./index.html');
        if (root) return root;
      }
      const cached2 = await cache.match(req);
      if (cached2) return cached2;
    }
    // Genuinely offline with nothing cached
    return new Response(
      '<!DOCTYPE html><html><head><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a1218;color:#e2e8f0;text-align:center;padding:20px;}h1{color:#5be8ff;}</style></head><body><div><h1>Offline</h1><p>This page is not available offline yet.<br>Try reconnecting and reload.</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html' }, status: 503 }
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(response => {
    if (response && response.ok) cache.put(req, response.clone()).catch(() => {});
    return response;
  }).catch(() => cached);
  // Serve from cache instantly; fetchPromise updates cache for next time
  return cached || fetchPromise;
}

// ─── Allow page to trigger immediate update on demand ───────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
