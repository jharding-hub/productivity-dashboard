# Centerpost — App Store Compliance Checklist

**Version:** 1.0
**Date:** 2026-08-06
**Audience:** Joe, filling in App Store Connect and preparing for review.

Every answer below is derived from the code audit in [data-inventory.md](data-inventory.md). Where
something is unverified, it says so — don't guess in App Store Connect, because a wrong nutrition
label is a Guideline 5.1.1 rejection and, once shipped, a misrepresentation.

---

## 1. Privacy nutrition label (App Store Connect → App Privacy)

### 1.1 Data types to declare

For each, App Store Connect asks: is it **linked to the user**, and is it **used for tracking**?
**For Centerpost, "Used for Tracking" is NO for every single item.**

| App Store category | Declare? | Linked to user? | Tracking? | Purpose to select | Basis |
|---|---|---|---|---|---|
| **Contact Info → Email Address** | ✅ Yes | Yes | No | App Functionality | Firebase Auth; `users/{uid}.email` |
| **Identifiers → User ID** | ✅ Yes | Yes | No | App Functionality | Firebase UID |
| **Health & Fitness → Health** | ✅ Yes | Yes | No | App Functionality | Urge logs, HALT+ check-ins, mood log, breathwork/grounding records |
| **User Content → Other User Content** | ✅ Yes | Yes | No | App Functionality | Tasks, notes, projects, reminders, journal |
| **Usage Data → Product Interaction** | ✅ Yes | **No** | No | Analytics | `ana:{date}` aggregate feature counts — not keyed to UID |
| **Diagnostics → Crash Data** | ✅ Yes | **No** | No | App Functionality | Sentry |
| **Diagnostics → Performance Data** | ✅ Yes | **No** | No | App Functionality | Sentry |
| **Identifiers → Device ID** | ❌ No | — | — | — | No IDFA/IDFV collected — grep-verified |
| **Location** | ❌ No | — | — | — | No location permission requested |
| **Contacts, Photos, Audio, Browsing History, Purchases, Financial Info, Sensitive Info** | ❌ No | — | — | — | Not collected |

### 1.2 Points people get wrong here

- **Health & Fitness must be declared.** Urge logs, mood entries, and HALT+ check-ins are health
  data even though Centerpost never touches Apple Health for reading. Omitting this is the most
  likely rejection on this app.
- **Mindful Minutes written to HealthKit is not "collection."** It stays on device, in the user's
  own Health store. Declare Health because of the *in-app* wellness logs, not because of HealthKit.
- **Usage Data is not linked.** `ana:{date}` stores `{type, id, name, ts}` with no UID
  (`jarvis-worker.js:829`). Declaring it linked would be inaccurate in the stricter direction, which
  still misrepresents the app.
- **"Used for Tracking" is No throughout.** Tracking means linking to third-party data for
  advertising or sharing with a data broker. Centerpost does neither.

### 1.3 Third-party SDK check

Apple holds you responsible for SDK behaviour. Present in the app:

| SDK | Collects | Tracking? |
|---|---|---|
| Firebase Auth + Firestore | Email, UID, user content | No |
| Sentry | Crash and performance data — configured with `userInfo:false`, `httpBodies:[]`, `genAI` off (`src/main.jsx:41`) | No |
| Capacitor | Nothing | No |

**No advertising, attribution, or analytics SDK is present.** Verified by grep across web and iOS.

---

## 2. App Tracking Transparency — no prompt needed

**Conclusion: Centerpost must NOT show an ATT prompt.**

ATT applies when an app collects data about the user and **links it with third-party data for
targeted advertising, or shares it with a data broker**. Centerpost:

- Has no advertising SDK, no ad network, no attribution SDK
- Does not access the IDFA (no `ATTrackingManager`, no `AdSupport` framework — grep-verified)
- Does not share data with data brokers
- Does not link user data with third-party data for advertising

Do **not** add `NSUserTrackingUsageDescription` to Info.plist. Including an ATT prompt when there is
nothing to track is itself a rejection reason, and it costs user trust for nothing.

**In App Store Connect:** answer **No** to "Used for Tracking" on every data type.

---

## 3. Guideline 5.1.3 — Health and health research

| Requirement | Status |
|---|---|
| Health data must not be used for advertising or marketing | ✅ No advertising exists anywhere in the app |
| HealthKit data must not be shared with third parties without permission | ✅ Centerpost **reads no HealthKit data**: `requestAuthorization(toShare: [type], read: [])` (`HealthKitBridge.swift:55`) |
| HealthKit data must not be written to iCloud | ✅ Nothing is written to iCloud |
| HealthKit data must not be used for data mining | ✅ N/A — none is read |
| Health data must not go to the AI provider | ✅ No AI call path reads `state.checkins`, `state.moodLog`, or the journal — verified across all call sites |
| Accurate usage-description strings | ✅ Both present and accurate (`Info.plist`) |
| Apps must not provide medical dosage or diagnosis | ✅ Centerpost does neither |

**The HealthKit story is genuinely clean and worth stating plainly in review notes.**

⚠️ **Watch item:** the children's routine tracker includes a default **"Take meds"** item
(`kids.html:2455`). It is a checkbox, not a dosage instruction or a medical recommendation, so it
does not implicate the dosage-calculation prohibition. But if a reviewer sees it, be ready to
explain it as a parent-managed chore checklist. Consider renaming it — see COMPLIANCE-GAPS.md G-06.

---

## 4. Guideline 5.1.1(v) — Account deletion ✅

**Requirement:** an app offering account creation must offer in-app account deletion.

**Status: satisfied, and well built.**

- Path: Settings → Delete Account, with a destructive confirmation requiring the user to type
  "Delete my account" (`legacy.js:620`)
- Calls `POST /account/delete` (`legacy.js:653`) → `handleAccountDelete`
  (`jarvis-worker.js:987`)
- Deletes all eight user data documents, the profile document, KV records, and the Firebase Auth
  record — Auth last, so the token stays valid throughout
- **Fails closed:** returns 503 and deletes nothing if misconfigured. Idempotent, safe to retry.

**Not merely a deactivation.** It is a real deletion.

**Two things to add before submission:**
1. The deletion confirmation should tell the user that an Apple subscription must be cancelled
   separately — Apple checks this.
2. The confirmation should mention that local data on other devices clears when they next open the
   app (COMPLIANCE-GAPS.md G-05).

---

## 5. Subscription requirements (if launching with paid tiers)

**In-app, on the purchase screen — all of these must be visible before purchase:**

- [ ] Subscription name and what it includes
- [ ] Length of the subscription period
- [ ] Price, and price per unit where applicable
- [ ] Statement that it **auto-renews** unless turned off 24 hours before period end
- [ ] Statement that the Apple ID is charged at confirmation
- [ ] Statement that renewal is charged within 24 hours of period end
- [ ] How to manage and cancel: **Settings → [name] → Subscriptions**
- [ ] Functional link to the **Privacy Policy**
- [ ] Functional link to the **Terms of Service** (EULA)
- [ ] Free-trial terms, if offered, including that an unused trial portion is forfeited on purchase

**In App Store Connect:**
- [ ] Privacy Policy URL set (required)
- [ ] EULA: either Apple's standard EULA, or a custom one — if custom, §14 of
      [terms-of-service.md](terms-of-service.md) contains the required Apple minimum terms
- [ ] Subscription display name and description
- [ ] Subscription group configured
- [ ] Pricing set for all territories

> **Note:** §8 of the Terms already covers Apple's required disclosure language. The in-app purchase
> screen must repeat it — a link to the Terms is not sufficient on its own.

---

## 6. Privacy policy URL requirements

| Where | Requirement | Status |
|---|---|---|
| App Store Connect → App Information | Publicly accessible privacy policy URL, no login | ❌ **Blocker — none exists yet** |
| In-app | Privacy policy reachable from within the app | ❌ **Blocker** |
| Subscription purchase screen | Privacy Policy + Terms links | ❌ **Blocker** if launching paid |
| Homepage | **Separate, conspicuous link to the Consumer Health Data Privacy Policy** | ❌ **Blocker — MHMDA requirement** |

**All four are blocked on the same work:** publishing the documents in `docs/legal/` at real routes.
See [onboarding-consent-flow.md](onboarding-consent-flow.md) "Non-screen requirements".

The URL must be live **before** submission. Apple checks it.

---

## 7. Other guidelines worth a look

| Guideline | Issue | Status |
|---|---|---|
| **4.8 — Login Services** | Google Sign-In is offered; Apple requires an equivalent privacy-preserving option | ⚠️ **Verify.** Either add Sign in with Apple, or confirm Google Sign-In isn't exposed in the native build. COMPLIANCE-GAPS.md G-11 |
| **1.4.1 — Physical harm** | Medical/wellness apps must not provide inaccurate health information, and must not be a crisis service without being one | ✅ Covered by [medical-crisis-disclaimer.md](medical-crisis-disclaimer.md). Ship the first-launch modal. |
| **5.1.1(i) — Data minimisation** | Only request data relevant to the app | ✅ Clean |
| **5.1.2 — Data use and sharing** | No sharing without consent; no data brokers | ✅ Clean |
| **2.5.1 — Public APIs only** | — | ✅ Standard Capacitor |
| **1.2 — User-generated content** | N/A — no social features, no content sharing between users | ✅ |
| **3.1.1 — In-app purchase** | Digital subscriptions must use IAP | ⚠️ If web billing is added later, keep it entirely out of the iOS app |
| **Kids Category** | Stricter rules if listed there | ⚠️ **Do not list Centerpost in the Kids Category.** Confirm whether `kids.html` is reachable from the native app; if it is, be ready to explain it as a parent-facing feature. |

---

## 8. Review notes — suggested text for App Store Connect

> Centerpost is a productivity and general-wellness app for adults (16+).
>
> **Health data:** the app includes optional self-management tools (urge-pause timers, HALT
> check-ins, breathing exercises, mood logging, an encrypted journal). These are **opt-in and off by
> default**. The data is stored only in the user's own account and is never used for advertising,
> never sold, and never sent to the AI provider.
>
> **HealthKit:** the Apple Watch app **writes** Mindful Minutes only. It requests **no read
> access** and cannot read any Health data.
>
> **AI:** an in-app assistant uses Anthropic's Claude API for organising tasks and notes. Users see
> a disclosure that it is an AI and not a professional, before first use and again after 7 days of
> inactivity. Journal, mood, and wellness data are never sent to it.
>
> **Not medical care:** the app is a general-wellness product, not a medical device. It does not
> diagnose or treat. A disclaimer with crisis resources (988, 911, findahelpline.com) appears on
> first launch and inside the wellness tools.
>
> **Account deletion:** Settings → Delete Account performs a full server-side deletion of the
> account and all associated data.
>
> **Tracking:** none. No advertising SDKs, no IDFA, no data brokers — hence no ATT prompt.

---

## 9. Pre-submission checklist

**Blockers — submission will fail without these:**
- [ ] Privacy policy live at a public URL, entered in App Store Connect
- [ ] Privacy policy reachable in-app
- [ ] Consumer Health Data Privacy Policy separately linked from the homepage (MHMDA)
- [ ] Nutrition label completed per §1 — **Health & Fitness declared**
- [ ] `ITSAppUsesNonExemptEncryption = false` ✅ already present (`Info.plist`)
- [ ] Build numbers matched across app, watch app, widget, complication, and share extension
- [ ] Signing & Capabilities re-checked on every target

**Should be done first:**
- [ ] Deploy the G-01 worker fix (see COMPLIANCE-GAPS.md) — prompt text no longer logged
- [ ] First-launch disclaimer modal shipped
- [ ] AI disclosure screen + 7-day re-disclosure shipped
- [ ] Terms acceptance recorded at signup
- [ ] Resolve Sign in with Apple (G-11)
- [ ] Answer the Firestore backup retention question (G-02) and fill
      `[BACKUP_RETENTION_WINDOW]`

**Reminder:** a web deploy does **not** update the native app. Anything above that touches the app
bundle needs a native ship — `centerpost-sync.command` → Xcode Archive → TestFlight.

---

*This document was prepared with AI assistance and has not been reviewed by an attorney.
Centerpost LLC intends to obtain legal review before public release.*
