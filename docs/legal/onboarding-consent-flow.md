# Centerpost — First-Use Consent Flow (Product Spec)

**Version:** 1.0
**Date:** 2026-08-06
**Audience:** engineering. This is a build spec, not a legal document.
**Purpose:** make what the app actually does match what the legal documents promise. Today there is
**no consent flow at all** — see COMPLIANCE-GAPS.md G-07 — so all of this is new work.

---

## Why each screen exists

| Screen | Driven by |
|---|---|
| 1. Age gate | GDPR Art. 8; our stated 16+ minimum |
| 2. Terms + Privacy acceptance | Contract enforceability — without a recorded click, the ToS is browsewrap and the arbitration and liability clauses are unenforceable |
| 3. Wellness opt-in | Washington MHMDA; the ~19 states requiring opt-in consent for sensitive data; GDPR Art. 9 |
| 4. AI disclosure | Utah HB 452; EU AI Act Art. 50 |
| 5. Crisis acknowledgement | FTC Act §5 (deceptive-omission risk); App Store 1.4.1 |

Screens 1–3 run at signup. Screens 4 and 5 are **lazy** — they fire the first time the user
actually reaches the relevant feature. Do not front-load them; a five-screen wall at signup is
exactly the kind of friction this user base abandons.

---

## Where consent records live

Write to the existing profile document, `users/{uid}` — the same doc created at
`legacy.js:290` / `:821` / `:887`. It is already owner-read/write under `firestore.rules`.

```js
consent: {
  ageConfirmed:      { value: true, at: '<ISO>', minimum: 16 },
  terms:             { version: '1.0', at: '<ISO>' },
  privacy:           { version: '1.0', at: '<ISO>' },
  wellnessFeatures:  { value: false, at: '<ISO>', version: '1.0' },
  aiDisclosure:      { version: '1.0', at: '<ISO>', lastShownAt: '<ISO>' },
  crisisAck:         { version: '1.0', at: '<ISO>' }
}
```

**Rules for this object:**

1. **Never overwrite a withdrawal with a grant.** Toggling wellness off then on writes a new `at`;
   it does not delete the history. Keep an append-only `consent.history[]` of
   `{field, value, version, at}` if audit depth is wanted — cheap, and it is the thing a regulator
   asks for.
2. **Version-stamp everything.** When a document version changes, the stored version no longer
   matches and re-consent is triggered. This is the only mechanism that makes "we notified users of
   changes" provable.
3. **Write before proceeding**, not after. If the write fails, don't advance the screen.
4. `firestore.rules` currently blocks users from self-modifying `admin`, `disabled`, and
   `accountTier` — `consent` is not in that list, so users can write it. That is correct.
5. **Add `consent` to nothing that gets sent to the AI.** It is not part of `state`.

**Deletion:** `consent` lives on `users/{uid}`, which `handleAccountDelete` already deletes
(`jarvis-worker.js:1004`). No change needed. ✅

---

## Screen 1 — Age gate

**When:** immediately on tapping "Create account", before the email/password form.
**Blocking:** yes.

> ### How old are you?
>
> Centerpost is built for people **16 and over**. Some features handle personal wellbeing
> information, so we keep the minimum age high.
>
> [ I'm 16 or older ] [ I'm under 16 ]

**"I'm 16 or older"** → write `consent.ageConfirmed`, continue.

**"I'm under 16"** → dead-end screen. Do **not** let them back up and re-answer in the same session
(a re-try loop makes the gate meaningless, and a "neutral age gate" that teaches the right answer is
worse than none):

> ### Not yet
>
> Sorry — Centerpost is for people 16 and over.
>
> If you're looking for help getting organised, a paper planner and a trusted adult are genuinely a
> good start. Come back and see us in a few years.

Set a local flag so a page refresh doesn't reset it. This is a speed bump, not a security control,
and we shouldn't pretend otherwise — but it is the speed bump the law asks for.

---

## Screen 2 — Terms and Privacy (clickwrap)

**When:** on the signup form, above the "Create account" button.
**Blocking:** yes. **Unchecked by default. No pre-ticked box — a pre-ticked box is not consent.**

> ☐ I agree to the **[Terms of Service]** and the **[Privacy Policy]**.
>
> Both open in a panel you can scroll and close. The short version: your data is yours, we don't
> sell it, and you can delete everything from Settings whenever you want.
>
> The Terms include an arbitration clause you can opt out of within 30 days. It's in §11.

**Implementation notes:**
- The "Create account" button stays **disabled** until checked.
- Links open an in-app scrollable panel, **not** an external browser — a user who leaves the app
  mid-signup does not come back.
- Calling out the arbitration opt-out here, unprompted, materially strengthens enforceability.
  Keep that line.
- On submit, write `consent.terms` and `consent.privacy` **in the same operation** that creates the
  profile doc at `legacy.js:821`.

**Existing users** (accounts created before this ships) must see a one-time acceptance modal on
next launch. They cannot be silently bound to terms they never saw.

---

## Screen 3 — Wellness features opt-in

**When:** right after account creation, as the last onboarding step.
**Blocking:** no — "Not now" is a first-class answer and the app must be fully usable without it.
**Default: OFF.**

> ### Wellness tools — your call
>
> Centerpost has optional tools for the harder parts of the day: urge pauses, HALT check-ins,
> breathing exercises, mood tracking, and a private journal.
>
> **If you turn these on, Centerpost will store what you enter** — which urges you logged and
> whether they passed, how you rated your energy and mood, which breathing exercises you finished,
> and your journal entries. That's kept so the tools have memory instead of resetting every time,
> and so you can see your own patterns.
>
> **This is health information, and we treat it that way:**
> - It's stored under your account and nobody else can read it
> - **Your journal is encrypted with a key made from your PIN — we can't read it, ever**
> - It's **never** sent to the AI assistant
> - It's **never** sold, shared, or used for advertising. Not now, not later.
>
> You can turn this off any time in Settings, and delete everything you've logged.
>
> [ Turn on wellness tools ] [ Not now ]
>
> *More detail: [Consumer Health Data Privacy Policy]*

**Behaviour:**
- **"Not now"** → `consent.wellnessFeatures.value = false`. Wellness UI is hidden from navigation.
  If the user later taps a wellness entry point, show this screen again — inline, not as a nag.
- **"Turn on"** → `value = true`. Features appear.
- **Turning it off later** in Settings must offer, in the same flow: *"Also delete everything I've
  logged?"* — with a clear statement that turning off stops new collection but does not by itself
  erase past entries. Withdrawal of consent that leaves the data sitting there is the gap regulators
  look for.

**Do not** bundle this into the Terms checkbox. MHMDA and GDPR Art. 9 both require it to be
separate and specific.

---

## Screen 4 — AI disclosure

**When:** the first time the user opens Axis or triggers any AI feature (organise brain dump,
note → tasks). **Not at signup.**
**Blocking:** yes, for the AI feature only.
**Re-shown:** whenever `now - consent.aiDisclosure.lastShownAt >= 7 days`.

> ### Axis is an AI
>
> **You're talking to software, not a person.** Axis runs on Claude, an AI model made by Anthropic.
>
> **It is not a therapist, doctor, or professional of any kind**, and it can't help in an
> emergency.
>
> **It can be wrong** — confidently and fluently wrong. Check anything that matters.
>
> **What we send:** what you type, plus your project names so it can file things correctly.
> **What we never send:** your journal, mood log, check-ins, or urge logs. Those never reach it.
>
> **We don't read your conversations, we don't sell anything from them, and they aren't used to
> train AI models.**
>
> [ Got it ]
>
> *More detail: [AI Transparency Statement]*

**The 7-day re-disclosure is a hard Utah HB 452 requirement.** Implementation:

```js
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
function needsAiDisclosure(consent) {
  const a = consent?.aiDisclosure;
  if (!a || a.version !== AI_DISCLOSURE_VERSION) return true;
  const last = Date.parse(a.lastShownAt || a.at || 0);
  return !last || (Date.now() - last) >= SEVEN_DAYS;
}
```

Update `lastShownAt` on dismissal. Gate this on the **AI feature entry point**, so it fires for
brain-dump organise and note→tasks too, not only the chat panel.

**Also required, and easy to miss:**

1. **Persistent indicator.** The assistant panel header already shows "Axis"
   (`AxisAssistant.jsx:10`). Add a small `AI` badge beside it, always visible.
2. **Direct-question honesty.** If the user's message matches `/are you (a )?(human|real|person|
   bot|ai|robot)/i`, `/are you (a )?(therapist|doctor|counsell?or|psychologist)/i`, or similar,
   **answer client-side before calling the API**:
   > I'm an AI — a computer program, not a person. I'm not a therapist, doctor, or licensed
   > professional, and I can't help in an emergency. If you need to talk to someone, call or text
   > **988** (US) or find your local line at **findahelpline.com**.

   Answering client-side is deliberate: it must be guaranteed, not left to a model that could
   phrase it differently on a bad day.
3. **Crisis-phrase safety net.** If a message matches self-harm or crisis language, surface the
   crisis panel from [medical-crisis-disclaimer.md](medical-crisis-disclaimer.md) §(f) **above** the
   AI response. Do not suppress the response, and do not attempt to counsel. Show the resources.
   Log nothing about the match — no counters, no flags, no KV write. This is a display behaviour,
   not telemetry.

---

## Screen 5 — Crisis and wellness acknowledgement

**When:** first use of the Urge Log, TIPP, or any distress-oriented tool. Once per account.
**Blocking:** yes, once.

Use the copy in [medical-crisis-disclaimer.md](medical-crisis-disclaimer.md) §(a) for the modal,
then §(c) or §(d) as an inline note above the specific tool on first use.

Write `consent.crisisAck`. Thereafter show only the persistent footer line (§(b)) within those
features — a modal on every open trains people to dismiss it unread, which defeats the purpose.

---

## Non-screen requirements

These aren't screens, but they're part of the same body of work and the documents assume they
exist.

| # | Requirement | Why |
|---|---|---|
| 1 | Routes `/privacy`, `/terms`, `/health-privacy`, `/ai`, `/disclaimer` serving the published documents | App Store Connect requires a working privacy URL; the documents cross-link each other |
| 2 | **A direct homepage link to the Consumer Health Data Privacy Policy**, distinct from the main privacy link | **Hard MHMDA requirement** — it must be its own conspicuous homepage link, not nested |
| 3 | Settings → About: links to all five documents, with the version the user accepted shown beside each | Transparency; makes re-consent legible |
| 4 | Global Privacy Control detection (COMPLIANCE-GAPS.md G-03) | Colorado requires it |
| 5 | Landing-page footer links | CPRA conspicuous-link requirement |
| 6 | Re-consent modal when a stored version ≠ current version | Makes change-notification provable |

---

## Suggested build order

1. **Consent object + write path + Screen 2 (clickwrap).** Highest legal value per hour — this is
   what makes the ToS enforceable at all.
2. **Screen 1 (age gate).** Trivial once the consent object exists.
3. **Routes + homepage links** (#1, #2, #5 above). Blocks App Store submission otherwise.
4. **Screen 4 (AI disclosure) + the 7-day logic + client-side honesty answers.** The Utah-shaped
   work.
5. **Screen 3 (wellness opt-in)** and the withdrawal-with-deletion flow.
6. **Screen 5 (crisis ack)** and the crisis-phrase safety net.
7. **GPC**, re-consent modal, existing-user acceptance modal.

Steps 1–3 are the App Store blockers. 4–7 are the regulatory ones.

---

*This document was prepared with AI assistance and has not been reviewed by an attorney.
Centerpost LLC intends to obtain legal review before public release.*
