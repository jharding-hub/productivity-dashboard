// ═══════════════════════════════════════════════════════════════════
// Centerpost — shared client-side configuration
// These are PUBLIC browser identifiers, not secrets.
// Security is enforced by Firebase Security Rules and OAuth redirects.
// ═══════════════════════════════════════════════════════════════════

var CENTERPOST_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCgNToGWHbZI8s8OnhF1Z9l2BMXXtfHuC0",
  authDomain: "productivity-dashboard-f8488.firebaseapp.com",
  projectId: "productivity-dashboard-f8488",
  storageBucket: "productivity-dashboard-f8488.firebasestorage.app",
  messagingSenderId: "921593287670",
  appId: "1:921593287670:web:eda2ab0cb829ca850f6dd7"
};

var GOOGLE_CLIENT_ID = '1065593793454-57q4unojejuafv4rihajmoas77ucr6q8.apps.googleusercontent.com';

var JARVIS_PROXY_URL = 'https://centerpost-jarvis.medicjth.workers.dev';

var SENTRY_DSN = 'https://fa11403c0d7a9449b1749d199dc90395@o4511667943505920.ingest.us.sentry.io/4511668027129856';

// R12: same git short hash sw.js's CACHE_VERSION gets stamped with at build
// time (see scripts/stamp-sw.js), exposed here too so Settings can show
// which web commit is actually bundled into a native build (F21 -- native
// can silently ship a stale www/ resync with no way to tell from the UI).
var CENTERPOST_WEB_BUILD = 'centerpost-__COMMIT__';
