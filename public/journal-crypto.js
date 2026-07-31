// ═══════════════════════════════════════════════════════════════════════
// journal-crypto.js — client-side encryption for journal entries
// ═══════════════════════════════════════════════════════════════════════
//
// Phase 1 of R3 (journal hardening). Self-contained WebCrypto helper that
// legacy.js will call to encrypt entry bodies and verify the PIN without ever
// storing the PIN itself. Loading this file has NO effect on the app until
// legacy.js starts calling window.JournalCrypto (Phase 2).
//
// Model:
//   - Key = PBKDF2(pin, per-user random salt) → AES-GCM-256.
//   - The PIN is never stored. A "verifier" (a known constant encrypted under
//     the key) is stored instead; a wrong PIN fails to decrypt it, so unlock
//     works even when the journal has zero entries.
//   - Each entry body is encrypted with its own random IV; the packed value is
//     base64(iv ‖ ciphertext).
//   - The PIN is treated as an arbitrary string, so any length (4-digit or a
//     longer passphrase) works with no change here.
//
// Note on strength: a short numeric PIN has a small keyspace; PBKDF2 slows an
// offline attacker but cannot make a 4-digit PIN strong. This decisively fixes
// ACCIDENTAL exposure (a Firestore/localStorage/export leak is no longer
// plaintext); a longer PIN is what raises the bar against a determined
// attacker who has exfiltrated the ciphertext.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  // PBKDF2 work factor. Bumpable later — the value used is stored alongside the
  // ciphertext so old entries stay decryptable after a bump.
  var PBKDF2_ITERATIONS = 310000;
  var SALT_BYTES = 16;
  var IV_BYTES = 12;
  var VERIFIER_PLAINTEXT = 'centerpost-journal-verifier-v1';

  // ── base64 <-> ArrayBuffer (binary-safe) ──────────────────────────────
  function toB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function fromB64(str) {
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // ── key derivation ────────────────────────────────────────────────────
  function deriveKey(pin, saltBytes, iterations) {
    return crypto.subtle
      .importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey'])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: iterations || PBKDF2_ITERATIONS,
            hash: 'SHA-256',
          },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false, // key is non-extractable — it never leaves memory
          ['encrypt', 'decrypt']
        );
      });
  }

  // R8 phase 2 (biometric key custody): same PBKDF2 derivation, but via
  // deriveBits so the caller ALSO gets the raw 32 bytes -- needed exactly once
  // per unlock on native, to hand the key to the iOS Keychain behind Face ID.
  // One derivation, not two: the raw bits are imported as the (still
  // non-extractable) working key, so this costs the same as deriveKey().
  // The raw copy's custody rules are the caller's responsibility: on native it
  // goes to the Keychain bridge and is dropped; on web it must be discarded.
  function deriveKeyWithRaw(pin, saltBytes, iterations) {
    return crypto.subtle
      .importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits'])
      .then(function (baseKey) {
        return crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: iterations || PBKDF2_ITERATIONS,
            hash: 'SHA-256',
          },
          baseKey,
          256
        );
      })
      .then(function (bits) {
        return importRawKey(toB64(bits)).then(function (key) {
          return { key: key, rawB64: toB64(bits) };
        });
      });
  }

  // Import raw AES key bytes (base64) as a non-extractable AES-GCM key --
  // the biometric unlock path: Keychain releases the bytes, this turns them
  // back into a working key, and the caller verifies via checkVerifier.
  function importRawKey(rawB64) {
    return crypto.subtle.importKey(
      'raw',
      fromB64(rawB64),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ── encrypt / decrypt one string ──────────────────────────────────────
  function encryptText(key, plaintext) {
    var iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    return crypto.subtle
      .encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(String(plaintext)))
      .then(function (ct) {
        var ctBytes = new Uint8Array(ct);
        var packed = new Uint8Array(iv.length + ctBytes.length);
        packed.set(iv, 0);
        packed.set(ctBytes, iv.length);
        return toB64(packed.buffer);
      });
  }
  function decryptText(key, packedB64) {
    var packed = fromB64(packedB64);
    var iv = packed.slice(0, IV_BYTES);
    var ct = packed.slice(IV_BYTES);
    return crypto.subtle
      .decrypt({ name: 'AES-GCM', iv: iv }, key, ct)
      .then(function (pt) {
        return dec.decode(pt);
      });
  }

  // ── PIN verifier (proves the key is correct without storing the PIN) ──
  function makeVerifier(key) {
    return encryptText(key, VERIFIER_PLAINTEXT);
  }
  function checkVerifier(key, verifierB64) {
    return decryptText(key, verifierB64)
      .then(function (txt) {
        return txt === VERIFIER_PLAINTEXT;
      })
      .catch(function () {
        return false; // GCM auth failure = wrong PIN
      });
  }

  window.JournalCrypto = {
    PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
    isSupported: function () {
      return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
    },
    // Fresh per-user salt, stored (base64) in the journal document.
    randomSaltB64: function () {
      return toB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer);
    },
    // Derive an AES-GCM key from a PIN + the stored base64 salt.
    deriveKey: function (pin, saltB64, iterations) {
      return deriveKey(pin, fromB64(saltB64), iterations);
    },
    // R8 phase 2: same derivation, but also returns the raw key bytes (b64)
    // for native Keychain custody. → {key, rawB64}
    deriveKeyWithRaw: function (pin, saltB64, iterations) {
      return deriveKeyWithRaw(pin, fromB64(saltB64), iterations);
    },
    // R8 phase 2: raw Keychain bytes → non-extractable working key.
    importRawKey: importRawKey,
    encryptText: encryptText,
    decryptText: decryptText,
    makeVerifier: makeVerifier,
    checkVerifier: checkVerifier,
  };
})();
