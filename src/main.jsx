import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';

// Build stamp — survives minification (real assignment, not a comment) so
// changing it forces Vite to emit a new /assets/index-<hash>.js. Bump it to
// break a stuck Cloudflare Pages deploy that's serving a missing asset.
window.__CP_BUILD = '2026-07-14a';

// DSN comes from config.js (public identifier, not a secret). Init before
// render so the global error handlers cover everything on the page,
// including legacy.js.
if (window.SENTRY_DSN) {
  Sentry.init({
    dsn: window.SENTRY_DSN,
    environment: location.hostname === 'centerpost.app' ? 'production' : 'development',
    // Wellness data must never reach Sentry: journal and AI-chat text
    // travels in HTTP bodies, so body collection stays off.
    dataCollection: {
      userInfo: false,
      httpBodies: [],
      genAI: { inputs: false, outputs: false },
    },
    // Drop known-benign iOS WKWebView × IndexedDB noise events. WebKit's IDB
    // implementation is flaky across backgrounding/foregrounding and app
    // suspension (long-standing WebKit engine bug, not app code -- see
    // bugs.webkit.org #197050/#235579, firebase-js-sdk #1670/#2232). Firebase
    // Auth's/Firestore's IDB persistence hits it in a couple of message
    // variants; both are non-fatal (Auth re-reads / Firestore re-syncs on
    // resume) and confirmed 2026-07-24 to leave the app working fine when it
    // fires. Matched narrowly on message text so real errors still report.
    beforeSend(event, hint) {
      try {
        const ex = hint && hint.originalException;
        let msg = ex && typeof ex === 'object' && ex.message ? String(ex.message)
                : typeof ex === 'string' ? ex : '';
        if (!msg && event.exception && event.exception.values) {
          msg = event.exception.values.map((v) => (v && v.value) || '').join(' ');
        }
        if (!msg && event.message) msg = String(event.message);
        const benignIDBNoise = [
          'without an in-progress transaction',
          'An internal error was encountered in the Indexed Database server',
        ];
        if (benignIDBNoise.some((s) => msg.indexOf(s) !== -1)) return null;
      } catch (_e) { /* never let the filter break reporting */ }
      return event;
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
