# Centerpost Privacy Policy

**Version:** 1.0
**Effective date:** [EFFECTIVE_DATE]
**Last updated:** [EFFECTIVE_DATE]
**Contact:** [CONTACT_EMAIL]

> **If you use Centerpost's wellness features, please also read our separate
> [Consumer Health Data Privacy Policy](consumer-health-data-privacy-policy.md).** Washington and
> Nevada law require that document to stand on its own, and it goes into more detail about urge
> logs, check-ins, mood entries, and journal data.

---

## The short version

- **We do not sell your data. We never have and we do not intend to.**
- **We do not run advertising** and there are no advertising or tracking tools in Centerpost.
- **We do not track you across other apps or websites.**
- Your tasks, notes, journal, and wellness entries exist to run Centerpost for you. That's it.
- Your **journal is encrypted** before it leaves your device, using a key derived from your PIN. We
  cannot read it.
- Your **wellness features are off until you turn them on**, and you can turn them off again.
- You can **delete your account and its data from inside the app**, at any time, without asking us.
- The AI assistant (Axis) is **software, not a person and not a professional**.
- Centerpost is a **wellness tool, not medical care**. See the
  [Medical & Crisis Disclaimer](medical-crisis-disclaimer.md).

The rest of this document is the detail behind those statements.

---

## 1. Who we are

Centerpost is operated by **Centerpost LLC**, a limited liability company organized in Indiana,
United States. Centerpost LLC is the "controller" of the personal data described here (the
"business," in California's terminology).

**Contact:** [CONTACT_EMAIL]
**Postal address:** [BUSINESS_ADDRESS]

"Centerpost" or "the Service" means the web app at centerpost.app, the Centerpost iOS app, its
Apple Watch companion, its home-screen widget, and its share extension.

## 2. Who may use Centerpost

**Centerpost is for people aged 16 and over.** We do not knowingly collect personal information
from anyone under 16. If you believe a child under 16 has given us personal information, contact
[CONTACT_EMAIL] and we will delete it.

We chose 16 rather than 13 deliberately: it clears the highest age of digital consent set by any
EU member state under GDPR Article 8, so we don't have to guess which national rule applies to you,
and it keeps health-related features away from minors entirely.

**Family features (COPPA).** Centerpost includes an optional chore-and-routine tracker for
children. It is operated **by the parent or guardian**, from the parent's own account. A child does
not create an account, does not log in, and does not interact with us directly. Any information
about a child in that feature is provided by the adult account holder, is stored under that adult's
account, and is deleted when that adult deletes their account. Consistent with the Children's
Online Privacy Protection Act, we do not knowingly collect personal information directly from
children under 13, and we do not use information in this feature for advertising, profiling, or any
purpose other than displaying it back to the family that entered it.

## 3. What we collect, why, and on what legal basis

We collect only what the product needs to work. Everything below is grouped by purpose.

### 3.1 Account information

| What | Why | Legal basis (GDPR) |
|---|---|---|
| Email address | To create your account, sign you in, and send you service messages | Performance of a contract |
| Password | Handled entirely by Google Firebase Authentication. **We never see or store your password.** | Performance of a contract |
| Google account identifier (if you use Google sign-in) | To sign you in | Performance of a contract |
| A unique account ID | To attach your data to your account | Performance of a contract |
| Account creation date, last sign-in date | Account management and abuse prevention | Legitimate interest |
| Invite code used at signup, if any | To administer invitations | Legitimate interest |

### 3.2 Your content ("Dashboard Data")

Tasks, projects and subtasks, notes, reminders, timeline blocks, brain-dump entries, routines,
workout selections, points and streak counters, and your settings.

**Why:** to provide the Service — this *is* the Service.
**Legal basis:** performance of a contract.

### 3.3 Wellness features ("Wellness Data") — opt-in

These features are **off by default**. Nothing in this section is collected unless you switch
wellness features on. You can switch them off at any time in Settings.

| What | What it contains |
|---|---|
| Urge logs | Which category you chose (impulse buy, phone/social media, snack, skip a task, or other), an optional free-text note, how long a pause you set, and whether the urge passed |
| HALT+ / Sensory check-ins | Which of hunger, anger, loneliness, tiredness, and sensory needs you marked as present |
| Breathwork and grounding sessions | Which technique you completed and how many cycles |
| Mood log | Your energy level and mental state for a given day, plus the suggestion Centerpost showed you in response |
| Journal | Your written entries — **encrypted**, see §7 |

**Why:** so these tools have memory instead of resetting each time, and so you can see your own
patterns over time.
**Legal basis:** your **explicit consent** (GDPR Art. 9(2)(a)). We treat all of this as sensitive
data. Withdrawing consent is described in §9.

### 3.4 The AI assistant (Axis)

When you use Axis, the text you type or dictate is sent to our server, which forwards it to
Anthropic's Claude API and returns the answer. Two other features also use it: organising a brain
dump sends your brain-dump entries, and turning a note into tasks sends that note's title and the
first 800 characters of its body, plus your project names so the assistant can file things
correctly.

**What is not sent:** Centerpost does **not** attach your journal, mood log, check-ins, or urge
logs to any AI request. Those never form part of a prompt.

**But please understand:** Axis is a free-text box. If *you* type something health-related into it,
that text is sent to Anthropic like any other message. Only you control what you put in it.

**Why:** to provide the feature you asked for.
**Legal basis:** performance of a contract; explicit consent where the content you supply is
health-related.

See §6 and the [AI Transparency Statement](ai-disclosure.md).

### 3.5 Security and abuse prevention

| What | Why | Retention |
|---|---|---|
| Count of requests per account per day | Detect abuse and runaway usage | 48 hours |
| Count of failed sign-in attempts per IP address | Detect credential-stuffing attacks | 48 hours |
| Count of rate-limit hits per account | Detect abuse | 48 hours |
| **If** a message you send to Axis matches a known prompt-injection pattern: your account ID, which pattern matched, and the time | Protect the Service from manipulation | 48 hours |
| Aggregate feature-usage counts (not linked to your account) | Understand which features are used | 35 days |

**On that fourth row, specifically:** we record **which pattern matched, not what you wrote**. The
text of your messages is not stored by us for this purpose. If a match occurs, an operator may see
that your account ID tripped a named pattern at a given time — nothing more.

**Legal basis:** legitimate interest in keeping the Service secure and available.

### 3.6 Technical and error data

Like every website, our hosting provider (Cloudflare) processes your IP address and basic request
information to deliver pages to you and to block attacks.

When something crashes, we send an error report to Sentry so we can fix it. We have configured
Sentry so that it does **not** receive request bodies, user profile information, or any AI input or
output. It receives the error message and the technical stack trace. It is possible for an error
message to incidentally contain a fragment of your content — for example, if a task title appears
inside an error string. We minimise this but cannot promise it never happens.

**Legal basis:** legitimate interest in a working, secure service.

### 3.7 Email

If we send you a daily briefing, it goes through Twilio SendGrid and contains your task and
schedule information. Operational alerts about the Service go only to us, not to you.

### 3.8 On your device

Centerpost stores a copy of your data in your browser or app storage so it works offline and loads
quickly. This is on your device, under your control. Clearing your browser storage or deleting the
app removes it.

**Note:** if you sign in on more than one device, deleting your account removes your data from our
servers, but a local copy may remain on each other device until you open Centerpost on it again.
See §10.

### 3.9 Google Calendar sync — optional

If you connect Google Calendar (Settings → Calendar), Centerpost can push your tasks, subtasks,
reminders, and timeline blocks into your Google Calendar as events, and pull your existing Google
Calendar events into Centerpost's timeline so you can see conflicts against your real schedule.

**This feature is off until you connect it, and you can disconnect it at any time.**

**What we ask Google for.** Connecting requires granting Centerpost **full read and write access to
your Google Calendar** (Google's `calendar` permission scope) — not a narrower "just this app's
events" permission. We ask for this because the feature does two things that each need broad
access: it creates a dedicated "Centerpost" calendar in your Google account to hold what it syncs
(which needs permission to create a calendar, not just edit events), and it reads your **primary**
calendar's real events — titles, times, and locations — so it can show you conflicts.

**We are telling you plainly that this is broader access than the feature strictly needs**, because
Google does not currently offer a permission scope narrow enough to cover both of those things at
once without also covering more. We are evaluating whether to split this into two more limited
permissions in a future update.

**What actually happens with it:**
- Your Google access token is held only in your browser session — **it is never sent to our
  servers, never stored in our database, and never persisted anywhere by us.** Disconnecting, or
  simply closing the tab, ends it.
- Events Centerpost creates go into the **dedicated "Centerpost" calendar** it creates for you, not
  your personal calendar. Your existing calendars are never written to.
- Events pulled from your primary calendar are displayed to you, in your own timeline, and are not
  sent to our servers, not sent to the AI assistant, and not stored in Firestore.
- You can revoke this access at any time from your own **Google Account → Security → Third-party
  access**, independent of anything in Centerpost.

### 3.10 Apple Health

If you use breathwork on Apple Watch and grant permission, Centerpost writes **Mindful Minutes** to
Apple Health. This is **write-only**: Centerpost requests no read access and **cannot read any of
your Apple Health data**. What we write stays in your Apple Health store on your device. It is not
sent to us, and it is never shared with anyone, including the AI provider.

### 3.11 Notifications

Centerpost uses **local notifications only** — scheduled by the app on your own device. We do not
operate a push server and **we do not collect a push notification token**.

### 3.12 What we do not collect

- No advertising identifiers (no IDFA), no advertising SDKs, no ad networks
- No cross-app or cross-site tracking
- No precise location for advertising or profiling
- No biometric identifiers. Face ID unlocks your journal **on your device**; the result is a
  yes/no answer from iOS. We never receive your face data.
- No purchase history beyond what Apple tells us about subscription status

## 4. Where your data goes: processors and third parties

These companies process data on our behalf, under contract, for the purposes above.

| Provider | Role | What they get | Privacy terms |
|---|---|---|---|
| **Google / Firebase** | Authentication and database | Your email, account ID, and all data you save | https://firebase.google.com/support/privacy |
| **Google Calendar** (only if you connect it) | Optional feature, under your own Google account — see §3.9 | Task/reminder titles and times you push; your primary calendar's events, read but not stored by us | https://policies.google.com/privacy |
| **Cloudflare** | Hosting, application servers, caching | IP address, request data, security counters | https://www.cloudflare.com/privacypolicy/ |
| **Anthropic** | AI model behind Axis | Only what §3.4 describes | https://www.anthropic.com/legal/privacy |
| **Twilio SendGrid** | Transactional email | Your email address and message contents | https://www.twilio.com/legal/privacy |
| **Sentry** | Error reporting | Error messages and stack traces | https://sentry.io/privacy/ |
| **Apple** | App distribution, subscriptions | Subscription and transaction data, under Apple's own terms | https://www.apple.com/legal/privacy/ |

**Other connections.** Some Centerpost features load content directly from third parties in your
browser, which means those parties see your IP address: the US National Weather Service
(weather.gov) and OpenStreetMap's Overpass API for location-related features, and YouTube where a
video is embedded. YouTube is operated by Google under its own privacy policy and may set cookies.

**We do not sell personal data, and we do not share it for cross-context behavioural advertising**,
as those terms are defined under California, Colorado, Connecticut, Virginia, and other state
privacy laws. We have not done so in the past 12 months. We do not sell or share the data of minors
under 16 — we do not knowingly have any.

## 5. AI processing — plain statement

- Axis is powered by Anthropic's Claude models, accessed through our own server.
- **Answers are generated by AI.** They can be wrong, incomplete, or confidently mistaken.
- Axis is **not a person, not a clinician, not a therapist, and not a licensed professional of any
  kind.** It does not provide medical advice.
- Anthropic's commercial API terms provide that content submitted through the API is not used to
  train their models. This reflects those terms **as of [AI_TERMS_VERIFIED_DATE]**; Anthropic's
  terms are theirs to change, and the current version governs.
- **Human review:** we do not read your AI conversations. The only human-visible signal is
  described in §3.5 — that an account tripped a named security pattern, without the message text.
- We do not use your AI interactions to build a profile of you, and we do not sell or share any
  data derived from them.

Full detail: [AI Transparency Statement](ai-disclosure.md).

## 6. How long we keep things

| Data | Retention |
|---|---|
| Account information | Until you delete your account |
| Dashboard Data and Wellness Data | Until you delete it, or delete your account |
| Journal | Until you delete it, or delete your account |
| Check-in history | The most recent 500 entries; older entries are dropped automatically |
| Security counters (requests, failed logins, rate limits, injection-pattern matches) | 48 hours |
| Aggregate feature-usage counts | 35 days |
| Aggregate AI cost totals (no user content) | 90 days |
| Error reports | Per Sentry's retention for our plan — [SENTRY_RETENTION] |
| Email delivery records | Per SendGrid's retention — [SENDGRID_RETENTION] |
| **Database backups** | **up to 98 days** — see the note below |
| Record that an item was deleted (a "tombstone": an identifier and a date, no content) | Retained so deletions sync correctly across your devices |

> **Backups.** When you delete data, it is removed from our live database immediately. A copy may
> persist in encrypted backups for **up to 98 days** before those backups age out. We maintain two
> layers of backup: a 7-day point-in-time recovery window used only to undo accidental data loss,
> and daily scheduled backups retained for 98 days for disaster recovery. We do not restore backups
> to recover deleted user data, and backup copies are not used for any other purpose.

## 7. Security

We describe what we actually do, and we are careful not to overstate it.

**What we do:**
- All traffic uses HTTPS, with HTTP Strict Transport Security enabled.
- Database rules restrict your data to your own account. Other users cannot read it.
- Our AI server verifies your identity token before every request, and applies per-account rate
  limits and spending caps.
- Security headers (frame denial, content-type protection, referrer policy, and a Content Security
  Policy) are deployed on the site.
- Passwords are handled by Google Firebase Authentication; we never see them.
- Automated monitoring alerts us to unusual authentication or usage patterns.

**Your journal, specifically.** Journal entries are encrypted **on your device** before being sent
to us, using AES-GCM-256 with a key derived from your PIN via PBKDF2 (310,000 iterations, with a
random per-user salt). **Your PIN is never stored or transmitted, and we cannot decrypt your
journal.** On iOS you may choose to have your device's Keychain hold that key behind Face ID.

Please be realistic about what a PIN can do: a short numeric PIN has a limited number of possible
values. The key derivation is deliberately slow to make guessing expensive, but a longer PIN is
meaningfully stronger than a short one.

**What we do not claim.** Your journal PIN is an access control and an encryption key — it is not
"end-to-end encryption" in the messaging sense, and we don't describe it that way. No system is
perfectly secure. We take reasonable and appropriate measures to protect your information, but we
cannot guarantee absolute security.

**If there is a breach.** Centerpost is not a HIPAA-covered entity, so HIPAA's breach rules do not
apply. The **FTC Health Breach Notification Rule** does apply to apps like ours that handle
consumer health data. If unsecured health information is disclosed without your authorisation, we
will notify affected users and the Federal Trade Commission as that rule requires, and will notify
media where the rule requires it. We will also comply with applicable state breach-notification
laws.

## 8. Your rights

Wherever you live, you may:

- **Access** the personal data we hold about you
- **Correct** it if it is wrong
- **Delete** it
- **Export** it in a portable, machine-readable format
- **Withdraw consent** to wellness features, or to any processing based on consent
- **Object to** or **restrict** certain processing
- **Appeal** a decision we make about one of these requests
- **Not be discriminated against** for exercising any of these rights. Centerpost works the same
  either way.

We do not use your data for automated decision-making that produces legal or similarly significant
effects, and we do not profile you.

### How to exercise them

**Fastest, no request needed:**
- **Delete everything:** Settings → Delete Account, inside the app. This deletes your account and
  data directly. You don't need to contact us or wait for us.
- **Export:** Settings → Export, which includes a decrypted copy of your journal.
- **Withdraw wellness consent:** Settings → turn wellness features off.

**Otherwise:** email [CONTACT_EMAIL]. We will respond within 45 days, and may extend once by a
further 45 days where permitted, telling you why. We verify requests by confirming control of the
account email address. We do not require you to create an account to make a request.

**Authorised agents** may make requests on your behalf with written permission; we may ask you to
confirm it directly.

**Appeals.** If we deny your request, reply to our decision and write "Appeal." A different review
will follow and we will respond in writing with our reasoning within the period your state's law
requires. If we deny your appeal, you may contact your state Attorney General.

**Global Privacy Control.** Centerpost recognises the Global Privacy Control browser signal.
Because we do not sell personal data and do not share it for targeted advertising, there is nothing
for the signal to opt you out of — your account already works that way. We honour it as a valid
opt-out request regardless.

**In the EEA, UK, or Switzerland**, you also have the right to lodge a complaint with your local
supervisory authority.

## 9. When you delete your account

Deleting your account removes, from our systems:

- Your profile and account record
- Your dashboard, check-ins, mood log, journal, completed-task archive, reminders archive, and
  family-feature data
- Your sign-in credentials
- Your subscription tier record and rate-limit counters

**Two honest caveats:**

1. **Other devices.** A local copy of your data may remain in the storage of other devices you
   signed in on, until you open Centerpost on them again. To clear it immediately, sign out or
   clear that browser's site data / delete the app on each device.
2. **Backups and short-lived logs.** Encrypted backups may retain a copy for **up to 98 days**.
   Security counters expire within 48 hours. Aggregate usage counts, which are not linked to your
   account, expire within 35 days.

Deleting your account does not cancel an Apple subscription. Cancel that in
**Settings → your name → Subscriptions** on your iPhone; see the
[Terms of Service](terms-of-service.md).

## 10. International users

Centerpost is operated from the United States, and your data is stored and processed on servers in
the United States. If you use Centerpost from the EEA, the UK, Switzerland, or elsewhere, you are
transferring your information to the United States, which may not provide the same level of legal
protection as your home country.

Where required, we rely on the European Commission's **Standard Contractual Clauses** with our
processors, and on your explicit consent for the transfer of health-related data under GDPR Article
49(1)(a).

## 11. Changes to this policy

If we make a material change, we will notify you in the app and by email before it takes effect,
and update the version and date at the top. Changes that would broaden how we use data you have
already given us will ask for your consent rather than assume it. Past versions are available on
request.

## 12. Contact

**Email:** [CONTACT_EMAIL]
**Centerpost LLC**, [BUSINESS_ADDRESS]

Related documents:
- [Consumer Health Data Privacy Policy](consumer-health-data-privacy-policy.md)
- [Terms of Service](terms-of-service.md)
- [AI Transparency Statement](ai-disclosure.md)
- [Medical & Crisis Disclaimer](medical-crisis-disclaimer.md)

---

*This document was prepared with AI assistance and has not been reviewed by an attorney.
Centerpost LLC intends to obtain legal review before public release.*
