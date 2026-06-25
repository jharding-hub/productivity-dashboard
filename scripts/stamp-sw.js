#!/usr/bin/env node
// Replaces the __COMMIT__ placeholder in dist/sw.js with the git short hash.
// Falls back to a base-36 timestamp if git is unavailable.

const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const swPath = join(root, 'dist', 'sw.js');

let commit;
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {
  commit = Date.now().toString(36);
}

const original = readFileSync(swPath, 'utf8');
const stamped = original.replace('centerpost-__COMMIT__', `centerpost-${commit}`);

if (original === stamped) {
  console.error('stamp-sw: placeholder not found in dist/sw.js');
  process.exit(1);
}

writeFileSync(swPath, stamped);
console.log(`stamp-sw: CACHE_VERSION = centerpost-${commit}`);
