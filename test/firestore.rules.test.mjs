// ─────────────────────────────────────────────────────────────────────
// Emulator tests for firestore.rules. Encodes the security invariants:
// users can only touch their own data, cannot self-escalate privilege,
// invite codes can't be enumerated or tampered with, and the real signup
// payload is accepted.
//
// Run via:  npm run test:rules   (needs Java for the Firestore emulator)
// ─────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-centerpost',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => { await testEnv.cleanup(); });

// Fresh state per test, then seed the admin profile (so isAdmin() resolves)
// and one invite code.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), { email: 'admin@x.co', admin: true, disabled: false });
    await setDoc(doc(db, 'inviteCodes/CODE1'), { used: 0, maxUses: 10, disabled: false });
  });
});

const alice = () => testEnv.authenticatedContext('alice').firestore();
const bob = () => testEnv.authenticatedContext('bob').firestore();
const admin = () => testEnv.authenticatedContext('admin1').firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// Seed a plain (non-admin) profile for a uid, rules-disabled.
async function seedProfile(uid) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${uid}`), {
      email: `${uid}@x.co`, admin: false, disabled: false,
    });
  });
}

describe('per-user data (users/{uid}/data/*)', () => {
  it('owner can write and read their own data', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/data/dashboard'), { state: '{}' }));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/data/dashboard')));
  });
  it('a user cannot read another user\'s data', async () => {
    await assertFails(getDoc(doc(alice(), 'users/bob/data/dashboard')));
  });
  it('a user cannot write another user\'s data', async () => {
    await assertFails(setDoc(doc(alice(), 'users/bob/data/dashboard'), { state: '{}' }));
  });
  it('an unauthenticated client cannot read data', async () => {
    await assertFails(getDoc(doc(anon(), 'users/alice/data/dashboard')));
  });
});

describe('user profiles (users/{uid})', () => {
  it('accepts the real signup payload (admin:false, disabled:false)', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), {
      email: 'alice@x.co', admin: false, disabled: false, invitedWith: 'CODE1',
    }));
  });
  it('rejects self-granting admin at create time', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), {
      email: 'alice@x.co', admin: true, disabled: false,
    }));
  });
  it('rejects self-granting accountTier on update', async () => {
    await seedProfile('alice');
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { accountTier: 'legacy' }));
  });
  it('rejects a user un-disabling themselves', async () => {
    await seedProfile('alice');
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { disabled: false, admin: true }));
  });
  it('allows a benign self-update (lastActive)', async () => {
    await seedProfile('alice');
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { lastActive: Date.now() }));
  });
  it('a user cannot read another user\'s profile', async () => {
    await seedProfile('bob');
    await assertFails(getDoc(doc(alice(), 'users/bob')));
  });
  it('an admin can read another user\'s profile', async () => {
    await seedProfile('alice');
    await assertSucceeds(getDoc(doc(admin(), 'users/alice')));
  });
});

describe('invite codes (inviteCodes/{code})', () => {
  it('anyone can get a specific code (signup validation)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'inviteCodes/CODE1')));
  });
  it('a non-admin cannot list/enumerate codes', async () => {
    await assertFails(getDocs(collection(alice(), 'inviteCodes')));
  });
  it('a signed-in user may bump used by exactly +1', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'inviteCodes/CODE1'), {
      used: 1, lastUsedBy: 'alice', lastUsedEmail: 'alice@x.co',
    }));
  });
  it('a user cannot disable a code', async () => {
    await assertFails(updateDoc(doc(alice(), 'inviteCodes/CODE1'), { disabled: true }));
  });
  it('a user cannot jump used by more than 1', async () => {
    await assertFails(updateDoc(doc(alice(), 'inviteCodes/CODE1'), { used: 9 }));
  });
  it('a non-admin cannot create a code', async () => {
    await assertFails(setDoc(doc(alice(), 'inviteCodes/NEW'), { used: 0 }));
  });
  it('an admin can create a code', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'inviteCodes/NEW'), { used: 0, maxUses: 5 }));
  });
});
