// Every same-origin, un-hashed <script> in index.html must be matched by
// APP_SCRIPT_PATH in public/sw.js. Run: npm run test:sw-script
//
// WHY THIS EXISTS: APP_SCRIPT_PATH routes first-party scripts network-first.
// Anything not listed falls through to stale-while-revalidate, so the first
// load after a deploy can run a new legacy.js against an old copy of a
// dependency and throw at init (the reconcileLifetimeCounter ReferenceError,
// cc0eee5). recurrence-engine.js, inline-edit.js and csv-export.js were
// missing from the list until this test was added.
//
// Skipped on purpose:
//   - external origins (the Firebase SDK on gstatic.com): not ours to route
//   - /assets/*: Vite content-hashed bundles bust their own cache
//   - /src/*: the Vite dev entry (/src/main.jsx), rewritten to a hashed
//     /assets/ file at build time
//
// Pure text scan, no dependencies. sw.js is not importable (it is a service
// worker script), so the regex literal is read out of its source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swSource = readFileSync(join(root, 'public', 'sw.js'), 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const ORIGIN = 'https://app.test';

function appScriptPathFrom(source) {
  const m = source.match(/const APP_SCRIPT_PATH = \/(.+)\/([a-z]*);/);
  assert.ok(m, 'APP_SCRIPT_PATH regex literal not found in public/sw.js');
  return new RegExp(m[1], m[2]);
}

// Same-origin script paths that are NOT hashed bundles or the Vite entry.
function localScriptPaths(html) {
  const paths = [];
  for (const m of html.matchAll(/<script\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)) {
    const url = new URL(m[1], ORIGIN);
    if (url.origin !== ORIGIN) continue;
    if (url.pathname.startsWith('/assets/')) continue;
    if (url.pathname.startsWith('/src/')) continue;
    paths.push(url.pathname);
  }
  return paths;
}

function unmatched(html, re) {
  return localScriptPaths(html).filter(p => !re.test(p));
}

test('index.html lists local scripts and sw.js exposes APP_SCRIPT_PATH', () => {
  assert.ok(localScriptPaths(indexHtml).length >= 10, 'expected at least 10 local scripts in index.html');
  assert.ok(appScriptPathFrom(swSource) instanceof RegExp);
});

test('every same-origin script in index.html is network-first in sw.js', () => {
  const missing = unmatched(indexHtml, appScriptPathFrom(swSource));
  assert.deepEqual(
    missing,
    [],
    `Not matched by APP_SCRIPT_PATH in public/sw.js (add them): ${missing.join(', ')}`
  );
});

test('self-check: the old seven-name list is flagged for exactly the files it missed', () => {
  const oldList = /\/(legacy|config|journal-crypto|quick-add-parser|sync-merge|date-utils|day-progress)\.js$/;
  assert.deepEqual(
    unmatched(indexHtml, oldList).sort(),
    ['/argon2.min.js', '/csv-export.js', '/inline-edit.js', '/recurrence-engine.js']
  );
});

test('self-check: external, /assets and /src scripts are ignored', () => {
  const html = [
    '<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>',
    '<script type="module" src="/assets/index-abc123.js"></script>',
    '<script type="module" src="/src/main.jsx"></script>',
    '<script src="/new-thing.js" defer></script>',
  ].join('\n');
  assert.deepEqual(localScriptPaths(html), ['/new-thing.js']);
});
