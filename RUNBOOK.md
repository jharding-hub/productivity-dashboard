# Centerpost Runbook

Operational procedures that must not live only in someone's head.
Project: `productivity-dashboard-f8488` · Firestore database: `(default)`

## Firestore backups

Configured 2026-07-03 per the architecture evaluation (rec 4.1), via the
Firebase console (Firestore → Disaster recovery):

- **Schedule:** daily automatic backup, 98-day retention.
- **Point-in-time recovery: enabled**, 7-day window — restores any
  minute-granularity moment in the last week, covering corruption between
  daily snapshots. Earliest recoverable version: 2026-07-03.
- **Verify the schedule:** `gcloud firestore backups schedules list --database='(default)'`
- **Verify backups exist:** `gcloud firestore backups list --format="table(name, database, state)"`
- Backups do NOT include security rules or TTL policies — rules live in the
  Firebase console and are unaffected by restores.

## Practice restore (verify backups actually work — repeat yearly)

1. `gcloud firestore backups list` → copy a BACKUP_ID and LOCATION.
2. Restore to a throwaway database (the live `(default)` DB is untouched):
   ```bash
   gcloud firestore databases restore \
     --source-backup=projects/productivity-dashboard-f8488/locations/LOCATION/backups/BACKUP_ID \
     --destination-database='restore-test'
   ```
3. Inspect: Google Cloud console → Firestore → database picker → `restore-test`
   → confirm `users/{uid}/data/dashboard` holds real state.
4. Clean up so the copy stops costing storage:
   ```bash
   gcloud firestore databases delete --database='restore-test'
   ```

Practice restore log (date · result):
- _not yet performed_

## Disaster recovery — restoring lost/corrupted production data

A restore cannot overwrite `(default)` directly. The path is restore → export → import:

1. Restore the newest good backup to a named database (steps above), e.g.
   `restore-20260703`.
2. Export the restored database to a Cloud Storage bucket (create the bucket
   once: `gcloud storage buckets create gs://productivity-dashboard-f8488-dr --location=LOCATION`):
   ```bash
   gcloud firestore export gs://productivity-dashboard-f8488-dr/dr-20260703 --database='restore-20260703'
   ```
3. Import into production — this overwrites matching documents in `(default)`:
   ```bash
   gcloud firestore import gs://productivity-dashboard-f8488-dr/dr-20260703 --database='(default)'
   ```
4. Verify in the app, then delete the named database and the bucket contents.

If only ONE user's data was damaged, prefer surgical repair: restore to a named
database, read that user's `users/{uid}/data/dashboard` doc from it, and write
it back to `(default)` by hand (console or a one-off script) instead of a full
import.

## Backfilling missing user profiles

Invite-code signups before commit 22b6ef2 have an Auth account but no
`users/{uid}` Firestore profile (the old signup write was denied by the
`create` rule). `scripts/backfill-profiles.mjs` creates the missing docs.

1. Firebase console → Project settings → Service accounts → **Generate new
   private key**. Save it OUTSIDE the repo (e.g. `~/keys/centerpost-sa.json`).
   The key is gitignored, but never move it into the repo.
2. Dry run first (writes nothing):
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=~/keys/centerpost-sa.json node scripts/backfill-profiles.mjs
   ```
3. Review the "would create" list, then apply:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=~/keys/centerpost-sa.json node scripts/backfill-profiles.mjs --commit
   ```
4. Verify in the admin panel that the previously-missing users now appear, and
   re-grant AI tiers as needed. Backfilled docs carry a `backfilledAt` field.

## Uptime monitoring

- `https://centerpost.app/health.json` returns 200 with `{"status":"ok"}` —
  static file, served from public/. UptimeRobot monitors it plus the root URL.
- If monitors alert: check GitHub Pages status, then Cloudflare DNS, then
  whether the last `make deploy` finished cleanly (gh-pages branch).
