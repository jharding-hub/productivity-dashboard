// ═══════════════════════════════════════════════════════════════════════
// Centerpost Service Worker (network-first HTML + background refresh)
// ═══════════════════════════════════════════════════════════════════════
//
// STRATEGY
//   - HTML pages (index.html, /):  NETWORK-FIRST
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

const CACHE_VERSION = 'centerpost-__COMMIT__';

// Assets to pre-cache on install (offline-ready essentials).
// Failures are tolerated individually — one missing icon won't break install.
//
// kids.html, its manifest, its 4 icons and the Press Start 2P/VT323 fonts were
// dropped 2026-08-11 when Kids Mode was separated from the product. It is no
// longer part of either app, so the app's service worker has no business
// precaching it -- and it is excluded from the native bundle entirely
// (centerpost-sync.sh), where precaching a file that isn't there would be
// pointless anyway. kids.html still works online at /kids.html; it just no
// longer gets offline support from the main app's SW, the same as teacher.html.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './ops',
  './howto',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.0.0/dist/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&display=swap',
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

// First-party app-logic scripts are NOT content-hashed (unlike the Vite
// assets/index-<hash>.js bundle), so stale-while-revalidate can serve an old
// cached copy instantly after a deploy that changed one -- the fresh copy
// only lands in cache for the NEXT load. Route these network-first instead,
// same as HTML, so a deploy takes effect on the very next page load.
// EVERY unhashed module legacy.js consumes at load time must be listed here:
// if legacy.js (network-first) updates but a dependency (sync-merge, date-utils)
// is served stale, legacy.js can call a symbol the old copy lacks and throw at
// init -- a real prod crash (reconcileLifetimeCounter ReferenceError, cc0eee5).
const APP_SCRIPT_PATH = /\/(legacy|config|journal-crypto|quick-add-parser|sync-merge|date-utils)\.js$/;

// A same-origin script/style/asset response whose Content-Type is text/html
// is Cloudflare Pages' SPA fallback wearing that URL -- it answers ANY path
// it can't find (an asset mid-deploy, a hashed filename that's rolled off
// since the last redeploy) with index.html and a 200, not a 404. _headers
// marks /assets/* immutable for a year, so a browser (or this SW's own Cache
// Storage, before this check existed) that happened to ask at exactly the
// wrong instant would trust that HTML as the real CSS/JS forever -- root
// cause of the 2026-08-23 report: Chrome stuck permanently unstyled while
// Safari, which asked at a different moment, was fine. Never treat one of
// these as the real file, and never let it into a cache.
function isPoisonedHTML(req, resp) {
  if (!resp) return false;
  // HTML is the CORRECT content type for navigations and real HTML paths --
  // don't flag those.
  if (req.destination === 'document' || HTML_PATH.test(new URL(req.url).pathname)) return false;
  const ct = resp.headers.get('content-type') || '';
  return ct.includes('text/html');
}

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

  // HTML / navigation requests, and first-party app-logic scripts → network-first
  if (req.mode === 'navigate' ||
      req.destination === 'document' ||
      HTML_PATH.test(url.pathname) ||
      (url.origin === self.location.origin && APP_SCRIPT_PATH.test(url.pathname))) {
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
    // Cloudflare Pages 308-redirects /page.html → /page. A navigation Request
    // carries redirect:'manual', so a redirect surfaces here as an
    // opaqueredirect — hand it straight back so the BROWSER follows it to the
    // clean URL and loads there. (Following it inside the SW via fetch(req.url)
    // returns a redirected response, which is illegal to return for a
    // navigation and fails as ERR_FAILED.) Opaqueredirects have no readable
    // body, so don't try to cache them.
    if (resp && resp.type === 'opaqueredirect') return resp;
    if (resp && resp.ok && !isPoisonedHTML(req, resp)) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  });
  try {
    // Race the network against a 4s timeout
    const fresh = await Promise.race([
      netFetch,
      new Promise((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 4000))
    ]);
    if (fresh && fresh.type === 'opaqueredirect') return fresh;
    if (fresh && fresh.ok && !isPoisonedHTML(req, fresh)) return fresh;
    throw new Error('sw-bad-response');
  } catch (err) {
    // Network slow/failed, or the fallback-HTML poison above — serve cache
    // now; netFetch keeps running and refreshes the cache in the background
    // for the next load (unless IT was poisoned too, in which case it was
    // never written above, so this stays on the last known-good copy).
    const cached = await cache.match(req);
    if (cached && !isPoisonedHTML(req, cached)) return cached;
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
  let cached = await cache.match(req);
  if (cached && isPoisonedHTML(req, cached)) {
    // A poisoned entry cached before this check existed (or one that slipped
    // in some other way) -- drop it so it can't keep being served as the
    // real file, and treat this load as if nothing were cached.
    await cache.delete(req);
    cached = undefined;
  }
  const fetchPromise = fetch(req).then(response => {
    if (response && response.ok && !isPoisonedHTML(req, response)) {
      cache.put(req, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => cached);
  // Serve from cache instantly; fetchPromise updates cache for next time
  return cached || fetchPromise;
}

// ─── Allow page to trigger immediate update on demand ───────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ─── Notifications (R1): focus/open the app when a nudge is tapped ───────
// R16 Phase B: the weekly-review tag also deep-links into the app's own
// Weekly Review modal, not just a generic focus. This can only reach an
// EXISTING client on non-native (the while-open engine can only have shown
// the notification if a tab was already running _notifTick), so the rare
// tab-closed-in-between case just falls back to a plain focus/open -- not
// worth a cold-launch pending-flag scheme for that edge case.
self.addEventListener('notificationclick', e => {
  const tag = e.notification.tag;
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          if (tag === 'weekly-review') c.postMessage({ type: 'openWeeklyReview' });
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
