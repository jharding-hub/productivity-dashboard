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
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
