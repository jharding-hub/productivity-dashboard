import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Source maps are generated and uploaded to Sentry only when a token is
// present (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in the shell —
// the token is a secret and must never live in the repo). Without the
// token the build is unchanged and no .map files land in dist/.
const uploadToSentry = !!process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    react(),
    ...(uploadToSentry
      ? [sentryVitePlugin({
          sourcemaps: { filesToDeleteAfterUpload: 'dist/**/*.map' },
        })]
      : []),
  ],
  base: '/',
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: uploadToSentry ? 'hidden' : false,
  },
  server: {
    open: '/',
  },
});
