// ─────────────────────────────────────────────────────────────────────
// One-off ops script: create missing users/{uid} profile docs.
//
// Why: invite-code signups before commit 22b6ef2 were denied their profile
// write by the Firestore `create` rule (missing admin/disabled fields), so
// those accounts exist in Firebase Auth but have no Firestore profile. This
// lists every Auth user and creates a minimal profile for any that lack one.
// The Admin SDK bypasses security rules, so it can write these directly.
//
// SAFE BY DEFAULT: dry-run unless you pass --commit.
//
//   Requires a service-account key (NEVER commit it):
//     Firebase console → Project settings → Service accounts →
//     "Generate new private key". Save it OUTSIDE the repo, then:
//
//   Dry run (shows what it would create, writes nothing):
//     GOOGLE_APPLICATION_CREDENTIALS=~/keys/centerpost-sa.json \
//       node scripts/backfill-profiles.mjs
//
//   Commit the changes:
//     GOOGLE_APPLICATION_CREDENTIALS=~/keys/centerpost-sa.json \
//       node scripts/backfill-profiles.mjs --commit
// ─────────────────────────────────────────────────────────────────────
import admin from 'firebase-admin';

const COMMIT = process.argv.includes('--commit');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const auth = admin.auth();
const db = admin.firestore();

let scanned = 0, missing = 0, created = 0;

async function run() {
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      scanned++;
      const ref = db.collection('users').doc(user.uid);
      const snap = await ref.get();
      if (snap.exists) continue;
      missing++;
      const profile = {
        email: user.email || null,
        admin: false,
        disabled: user.disabled === true,
        createdAt: user.metadata.creationTime
          ? admin.firestore.Timestamp.fromDate(new Date(user.metadata.creationTime))
          : admin.firestore.FieldValue.serverTimestamp(),
        lastActive: null,
        backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (COMMIT) {
        await ref.set(profile);
        created++;
        console.log(`  created  ${user.uid}  ${user.email || '(no email)'}`);
      } else {
        console.log(`  would create  ${user.uid}  ${user.email || '(no email)'}`);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`\nScanned ${scanned} Auth users · ${missing} missing profiles · ` +
    (COMMIT ? `${created} created.` : 'dry run, nothing written. Re-run with --commit to apply.'));
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
