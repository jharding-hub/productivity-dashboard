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

## 🔴 G-03 — No Global Privacy Control handling

**What the code does.** Nothing. `grep` for `globalPrivacyControl` / `Sec-GPC` across
`public/` and `src/` returns zero hits.

**Why it matters.** California (CCPA/CPRA regs § 7025), Colorado, and Connecticut require a
universal opt-out mechanism to be honoured on the web. GPC is the recognised signal. Colorado's
is mandatory, not optional.

**Mitigating factor — and it's a strong one.** GPC is an opt-out of *sale* and *sharing for
targeted advertising*. Centerpost does neither. So the substantive obligation is already met; what's
missing is the **acknowledgement**. Several state AGs expect the signal to at least be recognised.

**Recommended fix (small).** Read `navigator.globalPrivacyControl` on load; if `true`, record it on
the client and surface it in the privacy UI as "We detected a Global Privacy Control signal.
Centerpost does not sell or share your personal data for advertising, so there is nothing to opt
out of — this is already how your account works." Then the privacy policy can state truthfully that
the signal is recognised and honoured.

---

## 🟠 G-04 — SendGrid open/click tracking status is unknown and not disabled in code

**What the code does.** None of the three SendGrid senders
(`guardian-worker.js:921`, `sentinel-worker.js:318`, `pulse-worker.js:162`) include a
`tracking_settings` object. The account-level default therefore applies — and SendGrid's default is
**click tracking on**.

**Why it matters.** Open/click tracking on the Pulse daily briefing means an invisible pixel and
rewritten links reporting user engagement back to a third party. In a wellness app, "user opened
their daily briefing at 06:12" is behavioural data that a privacy policy claiming "we don't track
you" cannot survive.

**Recommended fix.** Add to every `mail/send` payload:

```json
"tracking_settings": {
  "click_tracking": { "enable": false, "enable_text": false },
  "open_tracking":  { "enable": false },
  "subscription_tracking": { "enable": false },
  "ganalytics": { "enable": false }
}
```

Explicit-off in code beats relying on a console setting nobody will remember. Also verify at
SendGrid → Settings → Tracking.

---

## 🟠 G-05 — Account deletion does not clear localStorage on the user's other devices

**What the code does.** `handleAccountDelete` cleans Firestore, KV, and Auth server-side. The
client wipes its own local caches. Any *other* device where the user signed in still holds
`cpCheckins_<uid>`, `cpMoodLog_<uid>`, `cpJournal_<uid>`, `prodDash_<uid>` etc. in localStorage,
indefinitely.

**Why it matters.** Wellness data persists on a device after the user believes they erased
everything. This is also the same class of bug as the two cross-account leaks already fixed
(`a3f6c42`, `2b1e21d`), so the pattern has bitten this codebase before.

**Recommended fix.** On app boot, if a signed-out `uid`-suffixed key exists and a lightweight
server check says that UID no longer exists, purge those keys. Simpler alternative: the deletion
confirmation copy explicitly tells the user to open Centerpost once on each of their other devices
to finish clearing local data — and the privacy policy says the same. Cheap and honest.

---

## 🟠 G-06 — Children's data is collected with no COPPA-facing treatment

**What the code does.** `public/kids.html` collects child first names, routines, and completion
history under the parent's UID (`kids.html:4759`), including a default **"Take meds"** item
(`:2455`, `:2464`). There is no age gate, no parental-consent record, and no notice describing it.

**Why it matters.** COPPA applies to personal information collected from children under 13. The
architecture here is the favourable one — the parent creates the account, the parent is the user,
the child never logs in — which is a defensible "parent-provided information" posture rather than
collection *from* a child. But that argument only works if it's documented, and right now nothing
documents it.

Separately, a medication item about a named child is a sensitive-data element under several state
laws.

**Recommended fix.**
1. Privacy policy gets an explicit "Family features" section: the parent is the account holder, the
   parent supplies the child's information, the child does not have an account or log in, the data
   is stored under the parent's account and deleted with it.
2. Confirm and state that `users/{uid}/data/kids` **is** covered by account deletion — it is
   (`USER_DATA_DOCS` includes `kids`, `jarvis-worker.js:985`). Good.
3. Consider renaming the default "Take meds" item to something non-medical, or make it opt-in. It
   is the only element pulling child data into the health-data category.
4. App Store: if `kids.html` is reachable from the iOS app, Apple may push the listing toward the
   Kids Category, which carries much stricter rules. Confirm whether it is reachable from native.

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

## 🟡 G-10 — Third-party endpoints called directly from the browser are undocumented

**What the code does.** CSP `connect-src` allows `api.weather.gov` and `overpass-api.de`; `frame-src`
allows YouTube. These are direct browser-to-third-party calls, so at minimum the user's IP is
disclosed to each.

**Why it matters.** Subprocessor lists must be complete. YouTube embeds additionally set cookies
and feed Google's own purposes — that is a genuine third-party disclosure, not a processor
relationship.

**Recommended fix.** Determine what is actually sent to weather.gov and Overpass (IP only, or
coordinates?). If coordinates, that is precise geolocation and needs its own consent treatment.
Then list all three in the privacy policy. Consider `youtube-nocookie.com` for embeds.

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

## 🟠 G-14 — Google Calendar sync is a real, undisclosed third-party data flow

**Found while correcting G-11.** Tracing what `GOOGLE_CLIENT_ID` actually does (see G-11) surfaced
a genuine gap that the original audit missed entirely: the Google Calendar sync feature is not
mentioned anywhere in `data-inventory.md` or `privacy-policy.md`, and it's a real, bidirectional,
sensitive-scope data flow.

**What the code does.** `gcalPushAll()` (`legacy.js:14404`) sends task, subtask, reminder, and
timeline-block titles and times to the user's Google Calendar as events, via `_gcalPushItem`
(`legacy.js:14385`). `gcalPullEvents()` (`legacy.js:14520`) reads events back in. Both require the
full `https://www.googleapis.com/auth/calendar` scope — **read/write access to the user's entire
Google Calendar**, not a narrower events-only or read-only scope — plus their Google account email.

**Why it matters.** This is Dashboard Data — potentially including task titles that reference
wellness content, since nothing stops a user from naming a task "Therapy appointment" or "Refill
prescription" — leaving Centerpost's systems entirely and landing in a third party's calendar,
under a very broad permission grant. The current privacy policy's third-party table has no row for
it. A user who reads the privacy policy today would have no way to know this feature exists or
what scope it requests before they click "Connect Google Calendar."

**Recommended fix — two parts:**

1. **Add a section to `privacy-policy.md`** describing the feature: that it's optional, off by
   default, requires the user's own Google sign-in and consent to the OAuth scope, that Centerpost
   never sees the calendar data pass through our servers (`_gcalAccessToken` lives in the browser,
   never sent to Jarvis or stored in Firestore), and that revoking access is done through the user's
   own Google Account permissions page, not through Centerpost.
2. **Consider narrowing the scope.** `auth/calendar` grants full read/write to the entire calendar.
   If the feature only needs to create/read Centerpost-created events, a narrower scope
   (`auth/calendar.events`) reduces both the privacy exposure and the OAuth consent screen's
   scariness for users. This is a product decision, not just a documentation one — flagging it here
   because the fix touches both.

**Not yet done.** This gap was found during this session but the privacy policy has not been
updated to include it — that edit needs sign-off before publication, since the policy is already
committed and Joe should decide the scope-narrowing question first rather than have it decided for
him.

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
