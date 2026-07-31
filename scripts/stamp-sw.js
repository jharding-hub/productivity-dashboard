#!/usr/bin/env node
// Replaces the __COMMIT__ placeholder in dist/sw.js and dist/config.js with
// the git short hash. Falls back to a base-36 timestamp if git is unavailable.
// R12: config.js's copy (CENTERPOST_WEB_BUILD) is what Settings reads to show
// which web commit is actually bundled -- sw.js's CACHE_VERSION is the same
// value but isn't readable from app JS without a service-worker round trip.

const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');

let commit;
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {
  commit = Date.now().toString(36);
}

const targets = ['sw.js', 'config.js'];
for (const name of targets) {
  const filePath = join(root, 'dist', name);
  const original = readFileSync(filePath, 'utf8');
  const stamped = original.replace('centerpost-__COMMIT__', `centerpost-${commit}`);
  if (original === stamped) {
    console.error(`stamp-sw: placeholder not found in dist/${name}`);
    process.exit(1);
  }
  writeFileSync(filePath, stamped);
}
console.log(`stamp-sw: stamped sw.js + config.js at centerpost-${commit}`);
