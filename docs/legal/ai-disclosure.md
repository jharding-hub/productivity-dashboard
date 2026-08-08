# Centerpost AI Transparency Statement

**Version:** 1.0
**Effective date:** August 7, 2026
**Contact:** medicjth@gmail.com

This statement is written to the standard of **Utah HB 452** (the Artificial Intelligence Policy
Act's mental-health-chatbot provisions), which is the strictest AI disclosure regime in the United
States and offers a safe harbour for suppliers who meet it. We apply it to all users, everywhere.
It also satisfies **EU AI Act Article 50** transparency obligations.

---

## The short version

- **Axis is a computer program. It is not a human being.**
- It is **not a therapist, counsellor, doctor, or licensed professional of any kind.**
- **It can be wrong.** Check anything that matters.
- **We do not sell or share anything from your AI conversations.**
- We do not read your conversations, and they are not used to train AI models.
- **It cannot help in an emergency.** If you are in crisis: **call or text 988** (US) or **911**.

---

## 1. You are interacting with an AI

**Axis is artificial intelligence — a software system, not a person.** No human is reading your
messages or replying to them.

Axis is built on **Claude**, a large language model made by **Anthropic**. Your messages go from
your device to a server we operate, which passes them to Anthropic's API and returns the response.

**Axis is not, and cannot act as:**

- A therapist, counsellor, psychologist, or psychiatrist
- A doctor, nurse, or any healthcare provider
- A crisis counsellor or emergency responder
- A lawyer, accountant, or financial adviser
- A licensed professional of any kind

Talking to Axis creates **no professional relationship** of any kind. It cannot diagnose, treat, or
provide clinical care. See the [Medical & Crisis Disclaimer](medical-crisis-disclaimer.md).

## 2. When we tell you this in the app

Utah HB 452 requires disclosure at specific moments. Centerpost implements all of them:

| When | What happens |
|---|---|
| **Before your first AI interaction, ever** | A full-screen disclosure you must acknowledge before Axis will respond |
| **After 7 or more days without using an AI feature** | The disclosure is shown again when you return |
| **Whenever you ask** — e.g. "are you a real person?", "are you human?", "are you an AI?", "are you a therapist?" | Axis answers directly and truthfully that it is an AI, before anything else |
| **Persistently, while in use** | An "AI" indicator is visible in the assistant panel at all times |
| **At the start of every new conversation thread** | A short reminder line above the message area |

The exact wording and the storage of acknowledgements are specified in
[onboarding-consent-flow.md](onboarding-consent-flow.md).

## 3. What Axis can and cannot do

**It is designed to help you:**
- Sort a brain dump into tasks, notes, reminders, and projects
- Turn a long note into individual action items
- Answer questions about organising your work
- Draft and rephrase text you are writing

**It cannot:**
- Diagnose any condition, physical or mental
- Provide therapy, counselling, or treatment
- Prescribe or advise on medication
- Assess risk of self-harm, or respond appropriately to a crisis
- Access your journal, mood log, check-ins, or urge logs — **the app never sends these to it**
- Take actions outside Centerpost — it cannot email anyone, browse the web, or contact anybody
- Remember previous conversations. **Each request stands alone**; there is no persistent memory of
  your chat history.
- Know anything that happened after its training data ends
- Reliably do arithmetic, cite sources, or state facts about the world without error

## 4. Accuracy — please read this one

**AI language models generate plausible text. Plausible is not the same as true.**

Axis will sometimes be confidently, fluently wrong. It can invent facts, dates, citations, and
details that do not exist. It will rarely tell you it is unsure.

**Therefore:**
- Verify anything with real consequences — deadlines, medical questions, legal or financial matters,
  anything safety-related.
- Do not use Axis as your only source for a decision that matters.
- If a response seems off, it probably is. Trust that instinct.

**Never use Axis for emergencies or anything time-critical.** It has no awareness of urgency, no
ability to summon help, and no one is monitoring what it says.

## 5. Your data and AI

### What we send

| Feature | What is sent |
|---|---|
| Axis chat | The message you typed or dictated |
| Organise brain dump | Your brain-dump entries, plus your project names |
| Note → action items | The note's title, the first 800 characters of its body, and your project names |

### What we never send

**Centerpost does not attach your journal, mood log, HALT+ check-ins, or urge logs to any AI
request.** This is verified in our source code — no AI request path reads those stores.

**However:** Axis is a free-text box. If **you** type something health-related into it, that text
is transmitted like any other message. You control what goes in.

### What happens to it

- **Training:** Anthropic's commercial API terms provide that content submitted through the API is
  **not used to train their models.** This reflects those terms as of **August 7, 2026**;
  Anthropic's terms are theirs to change, and their current version governs.
- **Human review:** **We do not read your AI conversations.** There is no operator tool that
  displays them.
- **Retention by us:** we do not store your AI conversation content on our servers. Your chat
  history exists in your own app storage.
- **Abuse detection:** if a message matches a known prompt-injection pattern, we record **which
  pattern matched**, your account ID, and the time — **never the text you wrote** — for up to 48
  hours. An operator may see that an account tripped a named pattern. They cannot see what you
  said.
- **Sale or sharing:** **we do not sell, share, or transfer any individually identifiable
  information derived from your AI interactions**, to anyone, for any purpose. We do not use it for
  advertising, profiling, or marketing, and we never will.

### Costs and limits

We record aggregate, non-identifying totals of AI usage cost so we can keep the service running
within budget. These totals contain no user content.

Free accounts have a daily AI request limit. All accounts have a rate limit.

## 6. Legal notices

**EU AI Act, Article 50.** In accordance with Article 50(1) of Regulation (EU) 2024/1689, you are
hereby informed that you are interacting with an artificial intelligence system. Any text generated
by Axis is artificially generated content.

**Utah HB 452.** Centerpost provides the disclosures required of a supplier of a mental health
chatbot: that Axis is not human; that it does not sell or share individually identifiable data from
AI interactions; and that it does not advertise to users within the AI interaction. Centerpost does
not use AI interactions to market or advertise anything.

**Colorado SB 24-205.** To the extent Centerpost's AI features fall within scope, we disclose that
you are interacting with an AI system, and we do not use AI to make consequential decisions about
you.

**California AB 3030 / transparency laws.** AI-generated content in Centerpost is identified as
such. Centerpost does not use AI to generate clinical communications.

## 7. Reporting a problem

If Axis says something harmful, wrong, or inappropriate — especially anything that sounds like
medical or mental-health advice — please tell us at **medicjth@gmail.com**. Include what you asked and
what it answered. Reports like these are how we find the failure modes that matter.

## 8. Changes

Material changes to how AI features work, what is sent, or how data is handled will be notified in
the app, and the disclosure screen will be shown again.

---

Related: [Privacy Policy](privacy-policy.md) ·
[Consumer Health Data Privacy Policy](consumer-health-data-privacy-policy.md) ·
[Terms of Service](terms-of-service.md) ·
[Medical & Crisis Disclaimer](medical-crisis-disclaimer.md)

---

*This document was prepared with AI assistance and has not been reviewed by an attorney.
Centerpost LLC intends to obtain legal review before public release.*
