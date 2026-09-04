// ═══════════════════════════════════════════════════════════════════
// Centerpost — shared client-side configuration (EXAMPLE)
// Copy this file to config.js and fill in your values.
// These are PUBLIC browser identifiers, not secrets.
// ═══════════════════════════════════════════════════════════════════

var CENTERPOST_FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

var GOOGLE_CLIENT_ID = 'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com';

// Calendar OAuth for the NATIVE iOS app -- a second, iOS-TYPE client in the
// same project (bundle id app.centerpost.app). The web client above cannot be
// reused: the Capacitor WebView's origin is capacitor://localhost, and Google
// rejects every non-http(s) OAuth origin outright. Leave empty for web-only
// checkouts; native then explains itself instead of offering a dead button.
var GOOGLE_IOS_CLIENT_ID = '';

var JARVIS_PROXY_URL = 'https://your-worker.your-subdomain.workers.dev';

// Optional — leave empty to disable error reporting.
var SENTRY_DSN = 'https://YOUR_KEY@YOUR_ORG.ingest.us.sentry.io/YOUR_PROJECT_ID';
