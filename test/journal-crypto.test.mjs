// Tests for public/journal-crypto.js — the v2 wrapped-data-key scheme and the
// v1 paths that must keep working so existing journals still open.
//
// Run: npm run test:journal
//
// These matter more than most tests in this repo: the journal is the one
// store with no server-side recovery, so a key-handling bug is permanent
// data loss, not a visual regression.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Load both browser scripts the way a browser would. Evaluating through
// new Function() means `module`/`exports` are not in scope, so the UMD in
// argon2.min.js takes its global branch and defines window.hashwasm.
globalThis.window = globalThis;
new Function(readFileSync('public/argon2.min.js', 'utf8'))();
new Function(readFileSync('public/journal-crypto.js', 'utf8'))();
const JC = globalThis.JournalCrypto;

// Cheap Argon2 cost for tests. The shipped cost is exercised once, below.
const FAST = { m: 1024, t: 1, p: 1 };

test('module loads with Argon2 available', () => {
  assert.ok(JC, 'JournalCrypto missing');
  assert.equal(JC.isSupported(), true);
  assert.equal(JC.argon2Available(), true, 'argon2.min.js did not expose hashwasm');
  assert.equal(JC.DOC_VERSION, 2);
});

test('entry bodies round-trip under a data key', async () => {
  const dek = await JC.newDek();
  const body = 'Rough day. Slept badly, still shipped the merge fix.';
  const sealed = await JC.encryptText(dek.key, body);
  assert.notEqual(sealed, body);
  assert.equal(await JC.decryptText(dek.key, sealed), body);
});

test('a fresh IV is used per encryption', async () => {
  const dek = await JC.newDek();
  const a = await JC.encryptText(dek.key, 'same text');
  const b = await JC.encryptText(dek.key, 'same text');
  assert.notEqual(a, b, 'identical plaintext produced identical ciphertext');
});

test('the data key wraps and unwraps with the right PIN', async () => {
  const salt = JC.randomSaltB64();
  const dek = await JC.newDek();
  const kek = await JC.deriveKek('4821', salt, 'argon2id', FAST);
  const wrapped = await JC.wrapDek(kek, dek.rawB64);

  const kek2 = await JC.deriveKek('4821', salt, 'argon2id', FAST);
  const opened = await JC.unwrapDek(kek2, wrapped);
  assert.equal(opened.rawB64, dek.rawB64);
});

test('a wrong PIN fails to unwrap rather than yielding a wrong key', async () => {
  const salt = JC.randomSaltB64();
  const dek = await JC.newDek();
  const kek = await JC.deriveKek('4821', salt, 'argon2id', FAST);
  const wrapped = await JC.wrapDek(kek, dek.rawB64);

  const bad = await JC.deriveKek('4822', salt, 'argon2id', FAST);
  await assert.rejects(() => JC.unwrapDek(bad, wrapped));
});

test('changing the PIN keeps the data key, so entries are never re-encrypted', async () => {
  const dek = await JC.newDek();
  const sealed = await JC.encryptText(dek.key, 'entry written under the old PIN');

  const salt1 = JC.randomSaltB64();
  const kek1 = await JC.deriveKek('1111', salt1, 'argon2id', FAST);
  const wrapped1 = await JC.wrapDek(kek1, dek.rawB64);

  // Rewrap the SAME data key under a new PIN — this is what changeJournalPin does.
  const opened = await JC.unwrapDek(await JC.deriveKek('1111', salt1, 'argon2id', FAST), wrapped1);
  const salt2 = JC.randomSaltB64();
  const kek2 = await JC.deriveKek('999999', salt2, 'argon2id', FAST);
  const wrapped2 = await JC.wrapDek(kek2, opened.rawB64);

  const after = await JC.unwrapDek(await JC.deriveKek('999999', salt2, 'argon2id', FAST), wrapped2);
  assert.equal(after.rawB64, dek.rawB64, 'data key changed across a PIN change');
  // The ciphertext was never rewritten, and still opens.
  assert.equal(await JC.decryptText(after.key, sealed), 'entry written under the old PIN');
});

test('an old encrypted snapshot survives a PIN change (the v1 orphaning bug)', async () => {
  // v1 sealed each snapshot under the key current at snapshot time, so a PIN
  // change stranded every older weekly backup. Under v2 the data key is
  // stable, so a snapshot taken two PINs ago still opens with today's PIN.
  const dek = await JC.newDek();
  const snapshot = await JC.encryptText(dek.key, 'journal as of eight weeks ago');

  let salt = JC.randomSaltB64();
  let wrapped = await JC.wrapDek(await JC.deriveKek('0000', salt, 'argon2id', FAST), dek.rawB64);
  for (const pin of ['1234', '567890', '31415926']) {
    const opened = await JC.unwrapDek(await JC.deriveKek(pinBefore(pin), salt, 'argon2id', FAST), wrapped);
    salt = JC.randomSaltB64();
    wrapped = await JC.wrapDek(await JC.deriveKek(pin, salt, 'argon2id', FAST), opened.rawB64);
    pinBefore.last = pin;
  }
  const finalKey = await JC.unwrapDek(await JC.deriveKek('31415926', salt, 'argon2id', FAST), wrapped);
  assert.equal(await JC.decryptText(finalKey.key, snapshot), 'journal as of eight weeks ago');
});
function pinBefore(next) {
  const order = { '1234': '0000', '567890': '1234', '31415926': '567890' };
  return order[next];
}

test('the recovery code opens the same data key as the PIN', async () => {
  const dek = await JC.newDek();
  const sealed = await JC.encryptText(dek.key, 'only recoverable if this works');

  const pinSalt = JC.randomSaltB64();
  const recSalt = JC.randomSaltB64();
  const code = JC.newRecoveryCode();
  await JC.wrapDek(await JC.deriveKek('4821', pinSalt, 'argon2id', FAST), dek.rawB64);
  const recWrapped = await JC.wrapDek(
    await JC.deriveKek(JC.normalizeRecoveryCode(code), recSalt, 'argon2id', FAST), dek.rawB64);

  // The user forgot the PIN entirely and types the printed code back in.
  const viaRecovery = await JC.unwrapDek(
    await JC.deriveKek(JC.normalizeRecoveryCode(code), recSalt, 'argon2id', FAST), recWrapped);
  assert.equal(viaRecovery.rawB64, dek.rawB64);
  assert.equal(await JC.decryptText(viaRecovery.key, sealed), 'only recoverable if this works');
});

test('a wrong recovery code is rejected', async () => {
  const dek = await JC.newDek();
  const recSalt = JC.randomSaltB64();
  const code = JC.newRecoveryCode();
  const wrapped = await JC.wrapDek(
    await JC.deriveKek(JC.normalizeRecoveryCode(code), recSalt, 'argon2id', FAST), dek.rawB64);
  const other = JC.newRecoveryCode();
  const wrongKek = await JC.deriveKek(JC.normalizeRecoveryCode(other), recSalt, 'argon2id', FAST);
  await assert.rejects(() => JC.unwrapDek(wrongKek, wrapped));
});

test('recovery codes have the documented shape and no ambiguous letters', () => {
  const code = JC.newRecoveryCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/, code);
  assert.equal(JC.normalizeRecoveryCode(code).length, JC.RECOVERY_LENGTH);
  assert.doesNotMatch(code, /[ILOU]/, 'ambiguous letter in a code meant to be read aloud');
});

test('recovery codes are not repeated', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(JC.newRecoveryCode());
  assert.equal(seen.size, 200);
});

test('recovery code entry tolerates how people actually retype it', () => {
  const canonical = JC.normalizeRecoveryCode('K4M2X-9PQR7-3TWVB-6HNZ8');
  assert.equal(JC.normalizeRecoveryCode('k4m2x 9pqr7 3twvb 6hnz8'), canonical);
  assert.equal(JC.normalizeRecoveryCode('K4M2X9PQR73TWVB6HNZ8'), canonical);
  // Confusable characters fold onto the Crockford originals.
  assert.equal(JC.normalizeRecoveryCode('0'), JC.normalizeRecoveryCode('O'));
  assert.equal(JC.normalizeRecoveryCode('1'), JC.normalizeRecoveryCode('I'));
  assert.equal(JC.normalizeRecoveryCode('1'), JC.normalizeRecoveryCode('L'));
  assert.equal(JC.normalizeRecoveryCode('V'), JC.normalizeRecoveryCode('U'));
});

test('a v1 journal still opens with the v1 paths', async () => {
  const salt = JC.randomSaltB64();
  const key = await JC.deriveKey('4821', salt, 1000);
  const verifier = await JC.makeVerifier(key);
  const sealed = await JC.encryptText(key, 'written back when v1 shipped');

  const again = await JC.deriveKey('4821', salt, 1000);
  assert.equal(await JC.checkVerifier(again, verifier), true);
  assert.equal(await JC.decryptText(again, sealed), 'written back when v1 shipped');

  const wrong = await JC.deriveKey('0000', salt, 1000);
  assert.equal(await JC.checkVerifier(wrong, verifier), false);
});

test('a v1 journal migrates to v2 with every entry intact', async () => {
  // Exactly what legacy.js does on the first unlock of a v1 doc.
  const pin = '4821';
  const v1Salt = JC.randomSaltB64();
  const v1Key = await JC.deriveKey(pin, v1Salt, 1000);
  const bodies = ['first entry', 'second entry, longer', 'third — with an em dash and emoji 🌤'];
  const v1Entries = [];
  for (const b of bodies) v1Entries.push({ enc: await JC.encryptText(v1Key, b) });

  // Migrate: read everything under the old key, mint a DEK, re-seal.
  const plain = [];
  for (const e of v1Entries) plain.push(await JC.decryptText(v1Key, e.enc));
  const dek = await JC.newDek();
  const v2Entries = [];
  for (const p of plain) v2Entries.push({ enc: await JC.encryptText(dek.key, p) });
  const newSalt = JC.randomSaltB64();
  const wrapped = await JC.wrapDek(await JC.deriveKek(pin, newSalt, 'argon2id', FAST), dek.rawB64);
  const verifier = await JC.makeVerifier(dek.key);

  // Reopen from nothing but the doc and the same PIN.
  const reopened = await JC.unwrapDek(await JC.deriveKek(pin, newSalt, 'argon2id', FAST), wrapped);
  assert.equal(await JC.checkVerifier(reopened.key, verifier), true);
  const out = [];
  for (const e of v2Entries) out.push(await JC.decryptText(reopened.key, e.enc));
  assert.deepEqual(out, bodies);
});

test('the biometric path verifies a data key with no PIN present', async () => {
  // Native stores the DEK bytes in the Keychain; on return there is no PIN to
  // check them against, so the verifier under the DEK is what proves them.
  const dek = await JC.newDek();
  const verifier = await JC.makeVerifier(dek.key);
  const fromKeychain = await JC.importRawKey(dek.rawB64);
  assert.equal(await JC.checkVerifier(fromKeychain, verifier), true);

  const strangerDek = await JC.newDek();
  const stranger = await JC.importRawKey(strangerDek.rawB64);
  assert.equal(await JC.checkVerifier(stranger, verifier), false);
});

test('the kdf is honoured, never guessed', async () => {
  const salt = JC.randomSaltB64();
  const dek = await JC.newDek();
  // A doc created on a browser where Argon2 failed to load records pbkdf2.
  const kek = await JC.deriveKek('4821', salt, 'pbkdf2', { iterations: 1000 });
  const wrapped = await JC.wrapDek(kek, dek.rawB64);
  const same = await JC.deriveKek('4821', salt, 'pbkdf2', { iterations: 1000 });
  assert.equal((await JC.unwrapDek(same, wrapped)).rawB64, dek.rawB64);

  // Opening it with the other KDF must fail loudly, not return junk.
  const mismatched = await JC.deriveKek('4821', salt, 'argon2id', FAST);
  await assert.rejects(() => JC.unwrapDek(mismatched, wrapped));
});

test('the shipped Argon2 cost produces a usable key', async () => {
  const salt = JC.randomSaltB64();
  const dek = await JC.newDek();
  const t0 = Date.now();
  const kek = await JC.deriveKek('4821', salt, 'argon2id', JC.ARGON2_PARAMS);
  const ms = Date.now() - t0;
  const wrapped = await JC.wrapDek(kek, dek.rawB64);
  const again = await JC.deriveKek('4821', salt, 'argon2id', JC.ARGON2_PARAMS);
  assert.equal((await JC.unwrapDek(again, wrapped)).rawB64, dek.rawB64);
  assert.ok(ms < 3000, `shipped Argon2 cost took ${ms}ms, too slow for an unlock`);
  console.log(`    shipped Argon2id cost: ${ms}ms`);
});
