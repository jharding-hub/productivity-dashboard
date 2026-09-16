// ═══════════════════════════════════════════════════════════════════════
// journal-crypto.js — client-side encryption for journal entries
// ═══════════════════════════════════════════════════════════════════════
//
// Self-contained WebCrypto helper. legacy.js calls window.JournalCrypto to
// encrypt entry bodies and to prove the PIN without ever storing the PIN.
//
// ── Doc v2 (current): wrapped data key ────────────────────────────────
//   DEK  — a random AES-GCM-256 Data Encryption Key. Encrypts every entry
//          body. Generated once and NEVER changes for the life of the
//          journal.
//   KEK  — a Key Encryption Key derived from the PIN (Argon2id). Its only
//          job is to encrypt the DEK; it never touches an entry.
//   doc.wrapped = AES-GCM(KEK, base64(DEK))
//
//   Three things fall out of that split, all of which v1 got wrong:
//     1. Changing the PIN rewrites 32 bytes, not every entry. v1 re-encrypted
//        the whole journal on every PIN change.
//     2. The weekly encrypted snapshots in users/{uid}/data/journalBackup
//        stay readable forever. Under v1 a PIN change silently orphaned up
//        to 7 older snapshots, because each was sealed under the key that
//        was current when it was taken.
//     3. A second wrapping of the same DEK gives a real recovery path —
//        doc.recovery.wrapped = AES-GCM(KEK_recovery, base64(DEK)), where
//        KEK_recovery comes from a 100-bit printed code. Forgetting the PIN
//        stops being unrecoverable.
//
//   The stable DEK is the standard trade-off: a PIN change re-seals access,
//   it does not re-key the data. That is right for "I forgot it" and "I want
//   a longer one"; it is NOT a revocation for a PIN an attacker already used
//   to extract the DEK. Nothing in the app claims otherwise.
//
// ── Why Argon2id ──────────────────────────────────────────────────────
//   PBKDF2-SHA256 runs on hardware built to accelerate SHA-256, which is why
//   a GPU gets tens of millions of guesses per second against it. Argon2id
//   is memory-hard: the same GPU gets roughly a hundred. At m=64MiB t=3 the
//   honest cost is ~120ms on a laptop, which no user perceives, so there is
//   no reason to keep paying PBKDF2's weakness.
//
//   This does NOT make a 4-digit PIN strong. 10,000 guesses is 10,000
//   guesses. It buys roughly four orders of magnitude, and the recovery code
//   is what makes a LONGER pin safe to recommend.
//
// ── Doc v1 (legacy, still readable) ───────────────────────────────────
//   Key = PBKDF2(pin, salt) → AES-GCM-256 used directly on entry bodies.
//   Every v1 path below is preserved verbatim so an existing journal still
//   opens; legacy.js migrates it to v2 on the first successful unlock.
//
// Entry bodies are unchanged across versions: base64(iv ‖ ciphertext), fresh
// random IV per encryption. Only the body is encrypted — date, project and
// mood stay cleartext so filtering works without unlocking.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  // PBKDF2 work factor (v1 docs, and the fallback when Argon2 is missing).
  // Stored alongside the ciphertext so old docs stay readable after a bump.
  var PBKDF2_ITERATIONS = 310000;
  // Argon2id cost. m is in KiB. Stored per-doc for the same reason.
  var ARGON2_PARAMS = { m: 65536, t: 3, p: 1 };
  var SALT_BYTES = 16;
  var IV_BYTES = 12;
  var DEK_BYTES = 32;
  var VERIFIER_PLAINTEXT = 'centerpost-journal-verifier-v1';

  // Crockford base32: no I, L, O or U, so a handwritten code can't be
  // misread. 256 is an exact multiple of 32, so byte % 32 is unbiased.
  var RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var RECOVERY_CHARS = 20;   // 20 × 5 bits = 100 bits of entropy
  var RECOVERY_GROUP = 5;

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

  // ── v1 key derivation (PBKDF2) ────────────────────────────────────────
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

  // v1 + native: same PBKDF2 derivation via deriveBits so the caller ALSO
  // gets the raw 32 bytes, for iOS Keychain custody behind Face ID.
  // One derivation, not two.
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

  // Raw AES key bytes (base64) → non-extractable AES-GCM key. Used by the
  // biometric unlock path, which gets the DEK back from the Keychain.
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

  // ── verifier ──────────────────────────────────────────────────────────
  // v1: proves the PIN-derived key is right. v2: proves the DEK is right,
  // which is what the biometric path needs — it gets a DEK from the Keychain
  // with no PIN to check it against. A wrong PIN is caught earlier and more
  // cheaply, by the GCM tag on the wrapped DEK failing to authenticate.
  function makeVerifier(key) {
    return encryptText(key, VERIFIER_PLAINTEXT);
  }
  function checkVerifier(key, verifierB64) {
    return decryptText(key, verifierB64)
      .then(function (txt) {
        return txt === VERIFIER_PLAINTEXT;
      })
      .catch(function () {
        return false; // GCM auth failure = wrong key
      });
  }

  // ── v2: Argon2id KEK derivation ───────────────────────────────────────
  // argon2.min.js (hash-wasm, vendored) sets window.hashwasm. It is loaded
  // by a plain <script defer> like this file, so by the time a user can tap
  // the journal it is there. If it somehow is not, argon2Available() is
  // false and callers decide: at CREATE time fall back to PBKDF2 and record
  // kdf:'pbkdf2' in the doc; at UNLOCK time of an argon2id doc, surface an
  // error and ask for a reload. Never silently substitute a different KDF on
  // unlock — that yields a wrong key and looks exactly like a wrong PIN.
  function argon2Available() {
    return !!(typeof window !== 'undefined' && window.hashwasm && window.hashwasm.argon2id);
  }

  function deriveBitsArgon2(secret, saltBytes, params) {
    var p = params || ARGON2_PARAMS;
    return window.hashwasm.argon2id({
      password: String(secret),
      salt: saltBytes,
      parallelism: p.p || 1,
      iterations: p.t || 3,
      memorySize: p.m || 65536,
      hashLength: DEK_BYTES,
      outputType: 'binary',
    });
  }

  // Derive a wrapping key from a low-entropy secret (the PIN) or a
  // high-entropy one (the recovery code). kdf is 'argon2id' or 'pbkdf2';
  // the doc records which was used so this is never guessed.
  function deriveKek(secret, saltB64, kdf, params) {
    var saltBytes = fromB64(saltB64);
    if (kdf === 'pbkdf2') {
      return deriveKey(secret, saltBytes, (params && params.iterations) || PBKDF2_ITERATIONS);
    }
    if (!argon2Available()) {
      return Promise.reject(new Error('argon2-unavailable'));
    }
    return deriveBitsArgon2(secret, saltBytes, params).then(function (bits) {
      return crypto.subtle.importKey(
        'raw',
        bits,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });
  }

  // ── v2: the data key ──────────────────────────────────────────────────
  // Returns the working key AND its raw bytes. The raw copy is needed to
  // wrap it, and on native to hand to the Keychain; callers drop it after.
  function newDek() {
    var raw = crypto.getRandomValues(new Uint8Array(DEK_BYTES));
    var rawB64 = toB64(raw.buffer);
    return importRawKey(rawB64).then(function (key) {
      return { key: key, rawB64: rawB64 };
    });
  }

  // Seal the DEK under a KEK. The base64 of the DEK is what gets encrypted,
  // so this reuses the same audited AES-GCM path as an entry body.
  function wrapDek(kek, dekRawB64) {
    return encryptText(kek, dekRawB64);
  }

  // Open a sealed DEK. A wrong PIN fails the GCM tag and rejects — that
  // authentication IS the PIN check, so v2 needs no separate verifier probe
  // on the unlock path.
  function unwrapDek(kek, wrappedB64) {
    return decryptText(kek, wrappedB64).then(function (rawB64) {
      return importRawKey(rawB64).then(function (key) {
        return { key: key, rawB64: rawB64 };
      });
    });
  }

  // ── v2: recovery code ─────────────────────────────────────────────────
  function newRecoveryCode() {
    var bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_CHARS));
    var out = '';
    for (var i = 0; i < RECOVERY_CHARS; i++) {
      if (i > 0 && i % RECOVERY_GROUP === 0) out += '-';
      out += RECOVERY_ALPHABET.charAt(bytes[i] % RECOVERY_ALPHABET.length);
    }
    return out;
  }

  // Accept what a human actually types back: any case, any grouping, and the
  // four letters Crockford drops folded onto the digits they resemble.
  function normalizeRecoveryCode(s) {
    return String(s || '')
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/U/g, 'V');
  }

  window.JournalCrypto = {
    PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
    ARGON2_PARAMS: ARGON2_PARAMS,
    DOC_VERSION: 2,
    RECOVERY_LENGTH: RECOVERY_CHARS,
    isSupported: function () {
      return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
    },
    argon2Available: argon2Available,
    // Fresh per-user salt, stored (base64) in the journal document.
    randomSaltB64: function () {
      return toB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer);
    },
    // ── v1 surface (migration + native Keychain) ──
    deriveKey: function (pin, saltB64, iterations) {
      return deriveKey(pin, fromB64(saltB64), iterations);
    },
    deriveKeyWithRaw: function (pin, saltB64, iterations) {
      return deriveKeyWithRaw(pin, fromB64(saltB64), iterations);
    },
    importRawKey: importRawKey,
    encryptText: encryptText,
    decryptText: decryptText,
    makeVerifier: makeVerifier,
    checkVerifier: checkVerifier,
    // ── v2 surface ──
    deriveKek: deriveKek,
    newDek: newDek,
    wrapDek: wrapDek,
    unwrapDek: unwrapDek,
    newRecoveryCode: newRecoveryCode,
    normalizeRecoveryCode: normalizeRecoveryCode,
  };
})();
