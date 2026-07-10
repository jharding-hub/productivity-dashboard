import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';

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
    // Drop a known-benign iOS WKWebView × Firebase noise event: WebKit closes
    // IndexedDB transactions across awaits / when the app is backgrounded, and
    // Firebase Auth's IDB session store then throws "Attempt to get records
    // from database without an in-progress transaction". Non-fatal — Auth
    // re-reads on resume. Matched narrowly so real errors still report.
    beforeSend(event, hint) {
      try {
        const ex = hint && hint.originalException;
        let msg = ex && typeof ex === 'object' && ex.message ? String(ex.message)
                : typeof ex === 'string' ? ex : '';
        if (!msg && event.exception && event.exception.values) {
          msg = event.exception.values.map((v) => (v && v.value) || '').join(' ');
        }
        if (!msg && event.message) msg = String(event.message);
        if (msg.indexOf('without an in-progress transaction') !== -1) return null;
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
