# Centerpost — Compliance Gaps

**Version:** 1.0
**Date:** 2026-08-06
**Companion to:** `data-inventory.md`

Each gap is something where the code today would contradict, or fail to support, a claim the legal
documents need to make. Severity reflects regulatory and App Store exposure, not effort.

**Legend:** 🔴 blocker (fix before publishing policies or submitting to App Review) ·
🟠 fix soon · 🟡 track · ⚪ verify only (no code change, Joe checks a console)

---

## ✅ G-01 — FIXED + DEPLOYED 2026-08-06

**Resolution.** Option 1 was implemented. Pattern matching moved into Jarvis at request time;
only `{uid, patterns, ts}` is written to KV, and **only when a pattern actually matches** — benign
traffic now leaves no `sec:inputs` record at all. Guardian and the ops console consume the
pre-matched `patterns` array. Legacy `.text` entries written before the deploy are deliberately
ignored rather than re-scanned, so no user prose can surface during the 48-hour drain.

Changed: `jarvis/jarvis-worker.js` (`INJECTION_PATTERNS` added at `:908`, `logRequest` at `:1069`),
`guardian/guardian-worker.js` (`:217`, `:280`, `:409`, `:431`),
`productivity-dashboard/public/ops.html` (`:1107`).

**Verified** by `verify-g01.mjs`, which extracts the real function bodies from the shipped sources
and runs them against an in-memory KV. Six assertions pass: no prompt fragment reaches KV; flagged
entries keep uid + patterns + ts with no `text` field; benign traffic writes nothing; per-UID
request counters still increment; Guardian still raises anomalies from the new shape; legacy
text-bearing entries are ignored.

**Residual disclosure still required:** an operator can see that a UID tripped a named pattern and
when. That is ordinary abuse-detection metadata and is disclosed in the privacy policy and AI
disclosure as such.

**Deployed and confirmed live 2026-08-06.** Jarvis (`0c8c24b1-c3d0-4269-a72c-c1c0574e797e`) and
Guardian (`6afe50f8-008c-40c0-8be2-4d3d261e6e73`) both shipped via `wrangler deploy`; both respond
and correctly reject unauthenticated requests. The `ops.html` fix went live in web commit `b06a408`,
verified 6/6 against the production site. Old text-bearing `sec:inputs` entries from before the
deploy age out on their 48h TTL by **2026-08-08 ~12:30**. Privacy policy §3.5 is now an accurate
description of the running system, not a forward-looking promise.

<details>
<summary>Original finding (retained for the record)</summary>

**What the code does.** `logRequest()` (`centerpost-workers/jarvis/jarvis-worker.js:1041`–`:1069`)
stores the first 200 characters of every user prompt to `sec:inputs:{date}` in KV, keyed to the
user's Firebase UID, with a 48-hour TTL. Guardian then scans those entries for prompt-injection
patterns and, on a match, **emails the first 100 characters plus the UID** to the operator
(`guardian/guardian-worker.js:283`, rendered at `:433`).

**Why it matters.** Axis is a free-text box in a wellness app. A user who types "I keep getting the
urge to spend money when I'm anxious" has just written consumer health data, and a copy now sits in
KV and may land in a personal inbox. Under MHMDA this is collection and *sharing* of consumer
health data outside the disclosed purpose. It also directly contradicts the natural reading of "we
don't read your conversations."

It also survives account deletion by up to 48 hours (`data-inventory.md` §5).

**Recommended fix — pick one, in order of preference:**

1. **Stop storing raw text.** Run the injection patterns *inline* in the Worker at request time and
   store only `{uid, matchedPatterns:[…], ts}` — no user text at all. The security value is in
   knowing *that* a UID tripped a pattern, not in reading what they wrote. This preserves Guardian
   entirely and removes the exposure. **This is the recommended fix.**
2. If a text sample is genuinely needed for tuning, store a **salted hash** of the prompt plus the
   matched pattern names, and drop the plaintext.
3. Minimum viable: cut the TTL to 1 hour, strip the text from the Guardian email (send UID +
   pattern names only), and disclose the practice explicitly in the privacy policy and AI
   disclosure.

**Until fixed:** the privacy policy must disclose that prompt excerpts are retained up to 48 hours
for abuse detection and may be reviewed by the operator. That is a survivable disclosure, but it is
a worse product story than simply not doing it.

</details>

---

## ✅ G-02 — RESOLVED 2026-08-06 — Firestore backup retention confirmed

**Confirmed via Firebase console** (Firestore Database → Disaster Recovery — the tab was renamed
from "Backups" at some point after this gap was written):

| Layer | Status | Retention |
|---|---|---|
| Point-in-time recovery (PITR) | Enabled | 7 days |
| Scheduled backups — daily | Enabled | **98 days** |
| Scheduled backups — weekly | Not configured | — |

**The governing number is 98 days**, not 7 — the retention promise has to reflect the longer of the
two layers, since a deleted record could still be recoverable from a daily backup up to 98 days out
even after PITR's 7-day window has passed.

**`privacy-policy.md` updated** in both places that referenced `[BACKUP_RETENTION_WINDOW]` (the
retention table and the account-deletion caveats), now reading "up to 98 days." This is a real
number, not the smaller PITR figure that would have made a stronger-sounding but false promise.

<details>
<summary>Original finding (retained for the record)</summary>

**What's missing.** Nothing in either repo reveals whether Point-in-Time Recovery or scheduled
backups are enabled on Firebase project `productivity-dashboard-f8488`. PITR retains 7 days;
scheduled backups can retain far longer.

**Why it matters.** Every US state privacy law and GDPR Art. 13(2)(a) require a retention period or
the criteria for one. "We delete your data when you ask" is false if a backup holds it for another
7 days to 14 weeks, and a deletion-request response that ignores backups is the single most common
enforcement finding against small apps.

</details>

---

## ✅ G-03 — RESOLVED 2026-08-11 — Global Privacy Control now read and acknowledged

**What the code does now.** `GPC_DETECTED` (`legacy.js`, near the top-level vars) reads
`navigator.globalPrivacyControl` once at script load. `openCustomize()` calls
`_renderGpcBanner()`, which shows a banner in Settings → About & Legal
(`#gpcBanner`, `src/app-body.html`) when the signal is present: "We detected a Global Privacy
Control signal. Centerpost does not sell or share your personal data for advertising, so there is
nothing to opt out of — this is already how your account works." `privacy-policy.md` / `privacy.html`
§4 now state plainly that GPC is recognised.

**Original finding.** Nothing read the signal — `grep` for `globalPrivacyControl` / `Sec-GPC`
returned zero hits. California (CCPA/CPRA regs § 7025), Colorado, and Connecticut require a
universal opt-out mechanism to be honoured on the web; Colorado's is mandatory. Mitigating factor:
GPC is an opt-out of *sale* and *sharing for targeted advertising*, which Centerpost does neither
of — the substantive obligation was already met, what was missing was the acknowledgement.

---

## ✅ G-04 — RESOLVED 2026-08-11 — SendGrid tracking explicitly disabled in code

**What the code does now.** All three SendGrid senders (`guardian-worker.js`, `sentinel-worker.js`,
`pulse-worker.js`) now include an explicit `tracking_settings` object on every `mail/send` payload
with click, open, subscription, and Google Analytics tracking all off. Explicit-off in code, not
reliant on the SendGrid account console default (which was click tracking **on**). Deployed via
`wrangler deploy` for all three Workers.

**Original finding.** None of the three senders included a `tracking_settings` object
(`guardian-worker.js:921`, `sentinel-worker.js:318`, `pulse-worker.js:162`), so the account-level
default applied. Open/click tracking on the Pulse daily briefing would have meant an invisible pixel
and rewritten links reporting user engagement back to a third party — behavioural data a privacy
policy claiming "we don't track you" cannot survive.

Recommend also verifying at SendGrid → Settings → Tracking that the account-level default is off,
as defense in depth.

---

## ✅ G-05 — RESOLVED 2026-08-11 — other-device local data now purges itself

**What the code does now.** `_purgeDeletedAccountData()` (`legacy.js`) runs in the signed-out
branch of `onAuthStateChanged` — which is exactly where a second device lands when its account is
deleted elsewhere, because the delete revokes the refresh token. It scans localStorage for
`uid`-suffixed keys, and for each distinct uid asks the new `POST /account/exists` endpoint
(`jarvis-worker.js`, backed by `authUserExists` in `shared/google-admin.js`) whether that account
still exists. Only an explicit `{exists:false}` triggers `_wipeLocalAccountData(uid)`.

**Fails closed in every direction**, which matters because a false "gone" would destroy a live
user's cache: `authUserExists` throws rather than returning false on any Google/transport error,
the endpoint turns that into a 503, and the client purges nothing on a non-OK response, a thrown
fetch, or a malformed body. A normal sign-out purges nothing either — the account still exists and
the server says so. All four failure modes plus the happy path were verified in-browser, and the
happy path re-verified end-to-end against the deployed Worker (a live uid kept its data, a
nonexistent uid was purged, the `local` scratch scope untouched).

**Also fixed in the same pass — a same-device gap this surfaced.** `_wipeLocalAccountData` had
silently drifted out of date: `cpCheckins_<uid>`, `cpMoodLog_<uid>`, and `cpAxisProfile_<uid>` were
never being removed, so check-ins, mood log, and the Axis profile survived deletion *on the
deleting device itself*. Both wipe paths now iterate one shared `UID_SCOPED_LS_PREFIXES` list, so
the list can't drift per-path again — the drift is what caused this.

**Why it mattered.** Wellness data persisted on a device after the user believed they erased
everything. Same class as the two cross-account leaks already fixed (`a3f6c42`, `2b1e21d`).

**Endpoint security note.** `/account/exists` is necessarily unauthenticated (the caller's account
may be gone, so it cannot present a token). It is origin-gated, IP rate-limited on the same bucket
as Touch ID login, answers exactly one bit about a uid the caller already holds, and Firebase uids
are 28 random characters — not an enumeration surface in practice.

---

## ✅ G-06 — RESOLVED 2026-08-11 — Centerpost no longer collects children's data at all

**Closed at the root rather than mitigated.** The original finding was that `kids.html` collected
child first names, routines, and completion history under the parent's UID — including a default
**"Take meds"** item — with no age gate, no consent record, and no notice. Every recommended fix
was a *disclosure* fix, which would have left the collection in place.

Instead the collection was removed. In two steps, same day:

1. **Separated from the product.** Not in the iOS bundle (`centerpost-sync.sh` strips it and its 5
   assets every sync, hard-stopping if that fails), no link from the web app. Standalone unlisted
   page at `centerpost.app/kids`, the `teacher.html` model.
2. **Cloud sync deleted.** ~316 lines of Firebase sync, the three Firebase SDK script tags, and
   `config.js` removed from the page. It writes nothing to `users/{uid}/data/kids`, holds no auth,
   and makes no data request. Cross-device is manual backup-file export/import.

**Personal data actively purged, not just no longer written:**
- `state.sync` held the **parent's email address** in localStorage. It is deleted on load, removed
  from `SACRED_KEYS` so migrations don't preserve it, and stripped from any restored backup file so
  an old export can't resurrect it.
- `_kidsParentUid` / `_kidsParentEmail` (parent's Firebase uid and email) are purged by
  `_purgeLegacySync()` on every load.

**Verified in-browser** against a seeded pre-change state: both legacy keys purged, the sync block
gone from memory *and* disk, all kid data preserved (points, lifetime stars, streak, tasks), zero
network requests to Firebase/gstatic/googleapis, no sign-in UI left in parent settings, and the
export→import round trip confirmed to drop a legacy `sync` block while keeping the data.

**Update 2026-08-16 — "Take meds" item removed.** It was never a compliance concern after the
2026-08-11 change (it lived only in the parent's own browser, never reached Centerpost), but it was
still the one thing in `kids.html` that could prompt a reviewer to ask about health data. Removed
from both default routines (`DEFAULT_ROUTINES.morning`/`evening`) rather than left as a
belt-and-suspenders disclosure risk.

**One thing deliberately left alone:** legacy `users/{uid}/data/kids` documents written by the old
sync still exist for accounts that used it. Nothing writes to them now, `kids` stays in
`USER_DATA_DOCS` so they are still erased on account deletion, and the privacy policy carries an
explicit historical note. That is the only children's data remaining anywhere in the system.

**Where the original four recommendations landed.**
1. ✅ Privacy policy has a "Family features (COPPA)" section — now rewritten to state that we
   receive nothing, with a historical note for pre-2026-08-11 accounts.
2. ✅ `users/{uid}/data/kids` is covered by account deletion (`USER_DATA_DOCS` includes `kids`).
   Kept deliberately, to clean up legacy documents.
3. ✅ Moot — renaming "Take meds" was only ever needed because the item reached us. It doesn't.
4. ✅ Superseded — the question was "is `kids.html` reachable from the iOS app"; the answer is now
   that it isn't *in* the iOS app.

**Audit note on how this was found.** R13.5 hid every native entry point and looked complete from
the app's behaviour, but the full 189 KB page and its 5 assets were still in the shipped binary.
The gap only surfaced by inspecting the **bundle** rather than the UI. Worth repeating that check
on anything else where "we removed it" means "we stopped linking to it".

---

## 🟠 G-07 — No privacy policy or terms exist anywhere in the product

**What the code does.** `grep` for `privacy`, `terms of service`, `/legal` across `index.html`,
`public/app.html`, and `src/components/*.jsx` returns **zero hits**. There is no link, no route, no
page, and no consent record anywhere in the codebase.

**Why it matters.** App Store Connect requires a functional privacy policy URL. MHMDA requires a
**homepage link** to the consumer health data policy specifically. CPRA requires a conspicuous
link. There is currently no consent record to prove any user accepted anything — so the arbitration
clause and limitation of liability in the forthcoming ToS would be unenforceable browsewrap.

**Recommended fix.** Beyond publishing the documents:
- Routes at `/privacy`, `/terms`, `/health-privacy` (MHMDA requires this one be **separately and
  conspicuously linked from the homepage**, not nested inside the main policy)
- Footer links on the landing page
- Settings → About links inside the app
- Clickwrap acceptance at signup writing `{acceptedAt, tosVersion, privacyVersion}` to
  `users/{uid}` — this is what makes the terms enforceable

---

## 🟠 G-08 — Sentry can incidentally receive user content in exception messages

**What the code does.** `src/main.jsx:41` is configured well — `userInfo: false`,
`httpBodies: []`, `genAI` inputs/outputs off, localhost silenced. But exception **messages and
stack traces** still transmit, and a thrown error can embed user content (e.g. a task title
interpolated into an error string).

**Why it matters.** Low likelihood, non-zero. Worth disclosing rather than engineering away.

**Recommended fix.** Extend the existing `beforeSend` to scrub long free-text-looking substrings,
or accept the residual risk and list Sentry as a subprocessor in the privacy policy — which the
documents will do regardless.

---

## 🟡 G-09 — CSP is still Report-Only; HSTS max-age is 1 day

**What the code does.** `public/_headers` ships `Content-Security-Policy-Report-Only` and
`Strict-Transport-Security: max-age=86400`.

**Why it matters.** The privacy policy's security section must not overstate. It can honestly
describe transport encryption, HSTS, owner-scoped Firestore rules, rate limiting, and security
headers — but it should not imply an enforced CSP while it is Report-Only.

**Recommended fix.** Continue the documented HSTS ramp and the CSP enforcement plan already written
into `_headers`. No policy change needed — just don't overclaim. Already accounted for in the
inventory's "may not claim" list.

---

## ✅ G-10 — RESOLVED 2026-08-11 — weather.gov/Overpass were dead code, not an undocumented flow

**What the investigation found.** CSP `connect-src` still allowed `api.weather.gov` and
`overpass-api.de`, and the privacy policy claimed those two parties saw the user's IP. But the
weather/location feature that used to call them was removed from `legacy.js` entirely in commit
`9b158e9` ("Remove weather/restaurant spinner (unreachable)") — grep-verified zero remaining
references anywhere in the web repo, the workers repo, or the iOS project. Before removal, that
dead code actually sent precise `navigator.geolocation` coordinates to both, not just IP — so this
would have been a bigger gap than originally scoped if it were still live.

**What changed.** Both domains removed from `public/_headers`' CSP `connect-src` (nothing calls
them — unnecessary attack surface). `privacy-policy.md` / `privacy.html` §4 and
`data-inventory.md` §1.11 corrected to drop the now-inaccurate weather.gov/Overpass disclosure.
YouTube (`frame-src`) is unaffected and remains documented as a genuine third-party flow.

---

## ✅ G-11 — CLOSED 2026-08-06 — false positive, no Google Sign-In exists

**Original finding was wrong.** It inferred "Google Sign-In is offered" from `GOOGLE_CLIENT_ID`
being configured in `public/config.js`, without tracing what that identifier actually
authenticates. It doesn't authenticate anything. Corrected after Joe asked what the fix would
actually involve and the call site got traced properly.

**What `GOOGLE_CLIENT_ID` actually does.** It feeds `google.accounts.oauth2.initTokenClient()`
(`legacy.js:14158`) — the Google Identity Services **token client**, used only to request Calendar
API scopes for the Google Calendar sync feature (§3 of `data-inventory.md`). It never calls
`firebase.auth()` and never authenticates a Centerpost account.

**Centerpost's actual sign-in methods:** email/password (Firebase Auth), plus a WebAuthn (Touch
ID/Face ID) passkey unlock layered on the same account. No third-party social login exists on web
or native — grep-confirmed against the iOS project too: no `GoogleSignIn` SDK, no `GIDSignIn`, no
`GoogleAuthProvider`, nothing in any Podfile or Package.swift.

**Guideline 4.8 does not apply.** It governs services used to authenticate the user's account —
"Sign in with Google," "Sign in with Facebook." A Calendar-sync OAuth scope grant is a feature
integration, the same category as connecting to Spotify or Dropbox, not an identity provider for
the app. **No Sign in with Apple work is needed for this guideline.**

**What the correction surfaced instead — see G-14.** Tracing the actual call site found that
Google Calendar sync itself, a real bidirectional data flow, was never listed anywhere in
`data-inventory.md` or disclosed in the privacy policy. That's the genuine gap this correction
turned up.

---

## 🟡 G-12 — Tombstones grow without bound

**What the code does.** `state._tombstones` is grow-only. `CLAUDE.md` documents a planned Pulse
Worker that hard-deletes tombstones older than 90 days; it is **not built**.

**Why it matters.** Minor for privacy (a tombstone is an id + timestamp, not content), but it means
a record of *when you deleted things* persists indefinitely, and the retention schedule should say
so rather than imply otherwise.

---

## ⚪ G-13 — Processor agreements unverified

None of these can be confirmed from the repos. Joe should confirm and record each:

| Provider | What to confirm |
|---|---|
| Google Cloud / Firebase | Cloud Data Processing Addendum accepted (Google Cloud console → Privacy & Security) |
| Cloudflare | DPA accepted (dash → Legal) |
| Anthropic | Commercial ToS in force; **re-read the current training-use and retention language and cite it with a date** |
| Twilio SendGrid | DPA accepted; tracking settings (see G-04) |
| Sentry | DPA accepted; event retention window on the current plan |

**Note on BAAs:** Centerpost is not a HIPAA covered entity or business associate. It is a
direct-to-consumer wellness app. **No BAA is needed with any of these providers, and asking for one
would be a category error.** The applicable regime is the FTC Act, the FTC Health Breach
Notification Rule, MHMDA, and the state comprehensive privacy laws — not HIPAA. The documents
should say this explicitly, because it is a common and expensive misconception.

---

## ✅ G-14 — RESOLVED 2026-08-06 — Google Calendar sync now disclosed in the privacy policy

**Found while correcting G-11.** Tracing what `GOOGLE_CLIENT_ID` actually does surfaced a genuine
gap the original audit missed: Google Calendar sync was not mentioned anywhere in
`data-inventory.md` or `privacy-policy.md`, despite being a real, bidirectional, broad-scope data
flow.

**What the code does.** `gcalPushAll()` (`legacy.js:14404`) creates a dedicated "Centerpost"
calendar in the user's Google account (`_gcalEnsureCalendar`, `legacy.js:14315`, via `POST
/calendars`) and pushes task/subtask/reminder/timeline-block titles and times into it as events.
`gcalPullEvents()` (`legacy.js:14520`) reads the user's **primary** calendar
(`GET /calendars/primary/events`) — their real appointments, titles, times, and locations — so the
app can show conflicts. Both require the full `https://www.googleapis.com/auth/calendar` scope.

**Scope-narrowing was investigated and explicitly declined.** The obvious fix — swap to
`auth/calendar.events` — does not work: that scope cannot create a new calendar, which push
depends on. A combination (`calendar.calendars` + `calendar.events`) might work but could not be
verified without live on-device OAuth testing, which carries real risk of a silent breakage (403s)
discovered only after shipping. Joe chose to keep the current scope and disclose it honestly rather
than risk breaking calendar sync on an unverified scope change. **Revisit if Google ships a purpose
-built scope for "app-created calendar plus read access to the primary calendar"** — as of this
writing, `calendar.app.created` covers only calendars the app itself created, not the primary-read
half of this feature.

**Resolution.** Added `privacy-policy.md` §3.9, which states plainly that the access requested is
broader than the feature strictly needs, explains why (dedicated-calendar creation needs
calendar-management permission; conflict detection needs primary-calendar read; no single Google
scope covers both without also covering more), and describes what actually happens with the data:
the token never leaves the browser, push writes only go to the dedicated calendar, pulled events
are displayed locally and never stored or sent to the AI. Also added a row to the §4 processor
table. `data-inventory.md` §3 got the matching row during the G-11 correction.

---

## ✅ Audited and clean — no gap

Recording these so they don't get re-litigated:

- **Therapeutic marketing language:** grep across `public/*.html`, `public/legacy.js`, and
  `src/components/*.jsx` for *therapy, therapist, treatment, clinical, diagnose, heal, cure,
  prescribe, patient* found **no violations in user-facing wellness copy**. The only hits are gym
  content about first-responder patient carries (`legacy.js:10184`, `:10206`, `:10547`), an
  "Occupational Therapy" role option in the unrelated `teacher.html:671`, and one code comment
  mentioning DBT (`ToolKitPanel.jsx:77`). The product's positioning is already correct — the
  documents need to preserve it, not repair it.
- **In-app account deletion:** exists, fails closed, idempotent, deletes Auth last
  (`jarvis-worker.js:987`). Satisfies Apple 5.1.1(v).
- **HealthKit:** write-only, `read: []` (`HealthKitBridge.swift:55`). Clean 5.1.3 story.
- **No push tokens, no IDFA, no ATT, no advertising SDKs, no analytics SDKs** beyond first-party
  KV counters and Sentry error reporting.
- **Journal encryption:** AES-GCM-256 under PBKDF2 with 310,000 iterations and a per-user random
  salt; PIN never stored (`public/journal-crypto.js:34`, `:54`). Genuinely strong, and the code's
  own comments are honest about the small keyspace of a numeric PIN.
- **Firestore rules:** `users/{uid}/data/*` owner-only; privileged fields (`admin`, `disabled`,
  `accountTier`) not self-modifiable (`firestore.rules`).
- **Wellness data is not fed to the LLM by the app.** No AI call site references `state.checkins`,
  `state.moodLog`, or the journal document.

---

## Deploy note — G-01 is committed but NOT live

The G-01 fix changes two Workers and one web file. **Until they are deployed, production still logs
prompt text**, and the privacy policy's claim in §3.5 ("we record which pattern matched, not what
you wrote") is not yet true of the running system.

**Do not publish the privacy policy before these three ship.**

Deploy, in this order, once Joe gives the OK:

```bash
cd /Users/jhmac/dev/centerpost-workers/jarvis && npx wrangler deploy
```

```bash
cd /Users/jhmac/dev/centerpost-workers/guardian && npx wrangler deploy
```

Then the web change (`public/ops.html`) goes live with the next push to main in
`~/dev/productivity-dashboard` — Cloudflare Pages auto-builds.

**Order matters:** deploy Jarvis first. If Guardian ships first it will simply find no
`patterns`-shaped entries and report zero injection anomalies for a sweep or two — harmless. If
Jarvis ships first, Guardian ignores the new entries until it catches up — also harmless. Either
order is safe; Jarvis-first minimises the window where prompt text is still being written.

**How to confirm it worked:** after both deploys, send a message to Axis containing the phrase
`ignore previous instructions`, then check the ops console security panel. The injection row should
show your UID and the pattern name **with no message text**. The next Guardian sweep email should
show the same three columns (UID / PATTERN(S) / TIME) and no excerpt column.

---

*This document was prepared with AI assistance and has not been reviewed by an attorney.
Centerpost LLC intends to obtain legal review before public release.*
