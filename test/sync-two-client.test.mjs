// Two-client Firestore-emulator integration test for the reminder/task
// resurrection fix (see CLAUDE.md "Sync invariants" and public/sync-merge.js).
//
// sync-merge.test.mjs already covers reconcileSync as a pure function on
// plain JS objects. This file is the one rung up: it drives the REAL
// reconcileSync against an ACTUAL Firestore emulator doc, through the same
// `state: JSON.stringify(...)` blob shape and firestore.rules the production
// app uses — the "NOT verified: live two-device Firestore path" gap noted
// in the resurrection-fix writeup.
//
// It does NOT exercise legacy.js's save()/load()/onSnapshot glue directly
// (that code is DOM- and global-coupled) — it replicates their contract:
// read the cloud blob, reconcile against local, write the merged blob back.
// A regression in that contract (not just in reconcileSync itself) would
// show up here.
//
// Run via: npm run test:sync-e2e   (needs Java for the Firestore emulator)
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { reconcileSync } = require('../public/sync-merge.js');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-centerpost',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => { await testEnv.cleanup(); });

beforeEach(async () => { await testEnv.clearFirestore(); });

// Two devices signed into the SAME account — matching the real scenario
// (cross-device resurrection), not two different users.
const deviceA = () => testEnv.authenticatedContext('alice').firestore();
const deviceB = () => testEnv.authenticatedContext('alice').firestore();

const DASH = (db) => doc(db, 'users/alice/data/dashboard');

async function readState(db) {
  const snap = await getDoc(DASH(db));
  return snap.exists() ? JSON.parse(snap.data().state) : {};
}
async function writeState(db, stateObj) {
  await setDoc(DASH(db), { state: JSON.stringify(stateObj) });
}

const rem = (id, extra = {}) => Object.assign({ id, text: id, date: '', time: '' }, extra);

describe('two-client sync via the real Firestore emulator', () => {
  it('a stale client writing after a delete does not resurrect the deleted reminder', async () => {
    const A = deviceA(), B = deviceB();

    // Both devices start holding the same three reminders.
    await writeState(A, { reminders: [rem('X'), rem('Y'), rem('Z')], _tombstones: {}, _updatedAt: 1000 });

    // Device B captures its snapshot NOW, before A's delete — this is the
    // "stale tab" precondition that used to cause the bug.
    const localB = await readState(B);

    // Device A dismisses X: removed from the array, recorded as a tombstone,
    // written back (this is exactly what _tombstone(id) + save() do).
    const localA = await readState(A);
    const afterDeleteA = Object.assign({}, localA, {
      reminders: localA.reminders.filter(r => r.id !== 'X'),
      _tombstones: Object.assign({}, localA._tombstones, { X: new Date().toISOString() }),
      _updatedAt: 2000,
    });
    await writeState(A, afterDeleteA);

    // Device B "receives" A's update (the onSnapshot equivalent): re-fetch
    // the cloud doc and reconcile against its own stale local copy using the
    // REAL reconcileSync — this is the exact call load()/onSnapshot make.
    const cloudNow = await readState(B);
    const merged = reconcileSync(localB, cloudNow);
    const bLocalAfterMerge = Object.assign({}, localB, merged, {
      _updatedAt: Math.max(localB._updatedAt || 0, cloudNow._updatedAt || 0),
    });

    // The reconciled in-memory state on B must NOT have resurrected X.
    assert.equal(bLocalAfterMerge.reminders.find(r => r.id === 'X'), undefined);
    assert.ok(bLocalAfterMerge._tombstones.X);

    // B's own subsequent save() pushes this reconciled state back.
    await writeState(B, bLocalAfterMerge);

    // A fresh read (a third device, or A reloading) must still not see X.
    const final = await readState(A);
    assert.equal(final.reminders.find(r => r.id === 'X'), undefined);
    assert.ok(final.reminders.find(r => r.id === 'Y'));
    assert.ok(final.reminders.find(r => r.id === 'Z'));
  });

  it('concurrent adds from both devices both survive (union by id)', async () => {
    const A = deviceA(), B = deviceB();

    await writeState(A, { reminders: [rem('Y')], _tombstones: {}, _updatedAt: 1000 });

    // B captures its snapshot before A's add.
    const localB = await readState(B);

    // A adds W, unaware of anything B is about to do.
    const localA = await readState(A);
    const afterAddA = Object.assign({}, localA, {
      reminders: localA.reminders.concat([rem('W')]),
      _updatedAt: 1100,
    });
    await writeState(A, afterAddA);

    // B independently adds V to ITS OWN (still W-less) local copy.
    const localBWithV = Object.assign({}, localB, {
      reminders: localB.reminders.concat([rem('V')]),
      _updatedAt: 1050,
    });

    // B reconciles against the now-current cloud (which has W) before writing.
    const cloudNow = await readState(B);
    const merged = reconcileSync(localBWithV, cloudNow);
    const bLocalAfterMerge = Object.assign({}, localBWithV, merged, {
      _updatedAt: Math.max(localBWithV._updatedAt || 0, cloudNow._updatedAt || 0),
    });
    await writeState(B, bLocalAfterMerge);

    const final = await readState(A);
    const ids = final.reminders.map(r => r.id).sort();
    assert.deepEqual(ids, ['V', 'W', 'Y']);
  });
});
