// Tests for public/quick-add-parser.js -- the natural-language date/time/
// recurrence parser behind every task/reminder/subtask quick-add
// field. Pure function, no browser, no Firestore. Run: npm run test:parser
//
// TZ pinned before any Date/Intl use so date math is deterministic anywhere.
process.env.TZ = 'America/New_York';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { parseQuickAdd } = require('../public/quick-add-parser.js');

// Fixed reference instant for every date-dependent case: Friday, 2026-07-17.
const NOW = new Date('2026-07-17T12:00:00');

// ── Priority (removed) ──────────────────────────────────────────────────────
test('priority: no longer parsed -- "!high" etc. is left as literal text, and the field is always null', () => {
  assert.equal(parseQuickAdd('call bob !high', NOW).name, 'call bob !high');
  assert.equal(parseQuickAdd('call bob !high', NOW).priority, null);
  assert.equal(parseQuickAdd('call bob', NOW).priority, null);
});

// ── Recurrence ────────────────────────────────────────────────────────────
test('recurrence: every day/week/month, case-insensitive; no match is null', () => {
  assert.deepEqual(parseQuickAdd('trash every day', NOW).recurrence, { freq: 'daily', interval: 1 });
  assert.deepEqual(parseQuickAdd('standup every week', NOW).recurrence, { freq: 'weekly', interval: 1 });
  assert.deepEqual(parseQuickAdd('rent EVERY MONTH', NOW).recurrence, { freq: 'monthly', interval: 1 });
  assert.equal(parseQuickAdd('trash', NOW).recurrence, null);
});
test('recurrence: every N days/weeks/months carries the interval', () => {
  assert.deepEqual(parseQuickAdd('water plants every 3 days', NOW).recurrence, { freq: 'daily', interval: 3 });
  assert.deepEqual(parseQuickAdd('standup every 2 weeks', NOW).recurrence, { freq: 'weekly', interval: 2 });
  assert.deepEqual(parseQuickAdd('review budget every 6 months', NOW).recurrence, { freq: 'monthly', interval: 6 });
});
test('recurrence: every <weekday> is weekly, and pins the due date to the next occurrence', () => {
  // NOW is Friday 2026-07-17 -- next Monday is 2026-07-20.
  const r = parseQuickAdd('trash every monday', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1 });
  assert.equal(r.due, '2026-07-20');
});
test('recurrence: every <weekday> never overrides an explicit date in the same text', () => {
  const r = parseQuickAdd('trash every monday 2026-09-01', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1 });
  assert.equal(r.due, '2026-09-01');
});

// ── Recurrence: day-sets + until (A-16, panel survey Stage 7) ──────────────
test('recurrence: multi-weekday day-set is a weekly rule with a sorted days array', () => {
  // NOW is Friday 2026-07-17 -- MWF from a Friday lands on next Monday.
  const r = parseQuickAdd('class every mon wed fri', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1, days: [1, 3, 5] });
  assert.equal(r.due, '2026-07-20');
  assert.equal(r.name, 'class');
});
test('recurrence: day-set accepts full weekday names, commas, and "and"', () => {
  const r = parseQuickAdd('gym every Monday, Wednesday and Friday', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1, days: [1, 3, 5] });
});
test('recurrence: day-set dedupes and sorts regardless of typed order', () => {
  const r = parseQuickAdd('shift every fri mon wed mon', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1, days: [1, 3, 5] });
});
test('recurrence: a SINGLE weekday still takes the pre-A-16 shape, no days array', () => {
  const r = parseQuickAdd('trash every monday', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1 });
  assert.equal(r.recurrence.days, undefined);
});
test('recurrence: day-set never overrides an explicit date in the same text', () => {
  const r = parseQuickAdd('class every mon wed fri 2026-09-01', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1, days: [1, 3, 5] });
  assert.equal(r.due, '2026-09-01');
});
test('recurrence: "until" attaches an end date to a day-set rule, in three formats', () => {
  assert.equal(parseQuickAdd('class every mon wed fri until Dec 12', NOW).recurrence.until, '2026-12-12');
  assert.equal(parseQuickAdd('class every mon wed fri until 2026-12-12', NOW).recurrence.until, '2026-12-12');
  assert.equal(parseQuickAdd('class every mon wed fri until 12/12', NOW).recurrence.until, '2026-12-12');
});
test('recurrence: "until <month> <day>" with no year rolls to next year if already past', () => {
  // NOW is 2026-07-17 -- "until Jan 5" has already passed this year.
  const r = parseQuickAdd('class every mon wed fri until Jan 5', NOW);
  assert.equal(r.recurrence.until, '2027-01-05');
});
test('recurrence: "until" is a no-op with no preceding recurrence -- ordinary text is untouched', () => {
  const r = parseQuickAdd('wait until confirmed', NOW);
  assert.equal(r.recurrence, null);
  assert.equal(r.name, 'wait until confirmed');
});
test('recurrence: "until" also attaches to the pre-A-16 single-weekday and every-N forms', () => {
  assert.equal(parseQuickAdd('trash every monday until Dec 12', NOW).recurrence.until, '2026-12-12');
  assert.equal(parseQuickAdd('water plants every 3 days until Dec 12', NOW).recurrence.until, '2026-12-12');
});
test('recurrence: day-set composes with type prefix and project tag', () => {
  const r = parseQuickAdd('task: chem lab every mon wed fri until Dec 12 #school', NOW);
  assert.equal(r.forcedType, 'task');
  assert.equal(r.projectTag, 'school');
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 1, days: [1, 3, 5], until: '2026-12-12' });
  assert.equal(r.name, 'chem lab');
});

// ── Time ──────────────────────────────────────────────────────────────────
test('time: 12h with am/pm, 24h with colon, "at N" prefix', () => {
  assert.equal(parseQuickAdd('call at 3pm', NOW).time, '15:00');
  assert.equal(parseQuickAdd('call at 3:30pm', NOW).time, '15:30');
  assert.equal(parseQuickAdd('call at 15:00', NOW).time, '15:00');
  assert.equal(parseQuickAdd('call at 9am', NOW).time, '09:00');
  assert.equal(parseQuickAdd('call at 9', NOW).time, '09:00'); // "at " prefix alone is a valid marker
});
test('time: a bare number with no am/pm, colon, or "at" is too ambiguous to accept', () => {
  assert.equal(parseQuickAdd('buy 3 apples', NOW).time, null);
});

// ── Date ──────────────────────────────────────────────────────────────────
test('date: today, tomorrow, in N days', () => {
  assert.equal(parseQuickAdd('pay rent today', NOW).due, '2026-07-17');
  assert.equal(parseQuickAdd('pay rent tomorrow', NOW).due, '2026-07-18');
  assert.equal(parseQuickAdd('pay rent in 3 days', NOW).due, '2026-07-20');
});
test('date: bare weekday is the NEXT occurrence, never literally today', () => {
  // NOW is itself a Friday -- "friday" must mean next week's, not today.
  assert.equal(parseQuickAdd('gym friday', NOW).due, '2026-07-24');
  // A weekday later this week resolves within the week.
  assert.equal(parseQuickAdd('gym wednesday', NOW).due, '2026-07-22');
});
test('date: "next <weekday>" always means next week\'s, not this week\'s', () => {
  assert.equal(parseQuickAdd('gym next wednesday', NOW).due, '2026-07-22');
  assert.equal(parseQuickAdd('gym next friday', NOW).due, '2026-07-24');
});
test('date: explicit YYYY-MM-DD, M/D (current year), and M/D/YYYY (2- or 4-digit year)', () => {
  assert.equal(parseQuickAdd('renew passport 2026-08-01', NOW).due, '2026-08-01');
  assert.equal(parseQuickAdd('dentist 8/5', NOW).due, '2026-08-05');
  assert.equal(parseQuickAdd('trip 12/25/2026', NOW).due, '2026-12-25');
  assert.equal(parseQuickAdd('trip 12/25/26', NOW).due, '2026-12-25');
});
test('date: no signal is null', () => {
  assert.equal(parseQuickAdd('buy groceries', NOW).due, null);
});

// ── Combined: the exact example used throughout the product review ────────
test('combined: date + time + recurrence together; a leftover "!high" is inert, plain text', () => {
  const r = parseQuickAdd('pay rent friday 3pm !high every month', NOW);
  assert.deepEqual(r, {
    name: 'pay rent !high',
    due: '2026-07-24',
    time: '15:00',
    priority: null,
    recurrence: { freq: 'monthly', interval: 1 },
    forcedType: null, projectTag: null,
  });
});

// ── No signal at all ────────────────────────────────────────────────────
test('no signal at all: name passes through unchanged, every field null', () => {
  assert.deepEqual(parseQuickAdd('buy groceries', NOW), {
    name: 'buy groceries', due: null, time: null, priority: null, recurrence: null,
    forcedType: null, projectTag: null,
  });
});
test('empty input', () => {
  assert.deepEqual(parseQuickAdd('', NOW), {
    name: '', due: null, time: null, priority: null, recurrence: null,
    forcedType: null, projectTag: null,
  });
});

// ── Bare trailing daily/weekly/monthly ────────────────────────────────────
// "workout 6am daily" is the phrasing reached for first; the "every ..." forms
// above did not cover it, so the keyword was left sitting in the task name.
test('bare recurrence: trailing daily/weekly/monthly is recognised', () => {
  assert.deepEqual(parseQuickAdd('workout 6am daily', NOW), {
    name: 'workout', due: null, time: '06:00', priority: null,
    recurrence: { freq: 'daily', interval: 1 },
    forcedType: null, projectTag: null,
  });
  assert.equal(parseQuickAdd('review inbox weekly', NOW).recurrence.freq, 'weekly');
  assert.equal(parseQuickAdd('pay rent monthly', NOW).recurrence.freq, 'monthly');
});
test('bare recurrence: works after the time is stripped, not just at end of raw input', () => {
  const r = parseQuickAdd('workout daily at 6am', NOW);
  assert.equal(r.time, '06:00');
  assert.deepEqual(r.recurrence, { freq: 'daily', interval: 1 });
  assert.equal(r.name, 'workout');
});
test('bare recurrence: NON-trailing keyword is a task name, left untouched', () => {
  // These are ordinary names -- turning them into recurring tasks and cutting
  // the word out of the title would be worse than not matching at all.
  for (const s of ['Daily report', 'daily standup with crew', 'read monthly magazine']) {
    const r = parseQuickAdd(s, NOW);
    assert.equal(r.recurrence, null, s);
    assert.equal(r.name, s, s);
  }
});
test('bare recurrence: keyword alone is not a recurrence', () => {
  assert.equal(parseQuickAdd('daily', NOW).recurrence, null);
  assert.equal(parseQuickAdd('daily', NOW).name, 'daily');
});
test('bare recurrence: never overrides an explicit "every N" form', () => {
  const r = parseQuickAdd('water plants every 2 weeks', NOW);
  assert.deepEqual(r.recurrence, { freq: 'weekly', interval: 2 });
});

// ── Opt-in explicit type prefix (panel survey 2026-08-18, I-9) ────────────
test('type prefix: "task:" / "thought:" forces the type and is stripped', () => {
  assert.equal(parseQuickAdd('task: buy milk', NOW).forcedType, 'task');
  assert.equal(parseQuickAdd('task: buy milk', NOW).name, 'buy milk');
  assert.equal(parseQuickAdd('thought: what if', NOW).forcedType, 'thought');
  assert.equal(parseQuickAdd('thought: what if', NOW).name, 'what if');
});
test('type prefix: case-insensitive, optional space before the colon', () => {
  assert.equal(parseQuickAdd('TASK: call bob', NOW).forcedType, 'task');
  assert.equal(parseQuickAdd('Thought : idea', NOW).forcedType, 'thought');
});
test('type prefix: must be a LEADING token -- a mid-sentence colon is left alone', () => {
  const r = parseQuickAdd('discuss my task: buy milk', NOW);
  assert.equal(r.forcedType, null);
  assert.equal(r.name, 'discuss my task: buy milk');
});
test('type prefix: absent when not typed', () => {
  assert.equal(parseQuickAdd('buy milk', NOW).forcedType, null);
});
test('type prefix: composes with date/time/recurrence extraction', () => {
  const r = parseQuickAdd('task: call bob tomorrow at 3pm', NOW);
  assert.equal(r.forcedType, 'task');
  assert.equal(r.name, 'call bob');
  assert.equal(r.time, '15:00');
  assert.equal(r.due, '2026-07-18');
});

// ── Opt-in project tag (panel survey 2026-08-18, I-9) ──────────────────────
// Deliberately returns the RAW tag text, not a resolved project id -- this
// module stays pure (no state.projects access); the caller resolves it.
test('project tag: "#name" is extracted and stripped, lowercased', () => {
  assert.equal(parseQuickAdd('renew lease #Apartment', NOW).projectTag, 'apartment');
  assert.equal(parseQuickAdd('renew lease #Apartment', NOW).name, 'renew lease');
});
test('project tag: absent when not typed', () => {
  assert.equal(parseQuickAdd('renew lease', NOW).projectTag, null);
});
test('project tag: takes the LAST tag if more than one appears', () => {
  const r = parseQuickAdd('renew lease #home #apartment', NOW);
  assert.equal(r.projectTag, 'apartment');
  assert.equal(r.name, 'renew lease #home');
});
test('project tag: composes with type prefix and date extraction', () => {
  const r = parseQuickAdd('task: renew lease #apartment tomorrow', NOW);
  assert.equal(r.forcedType, 'task');
  assert.equal(r.projectTag, 'apartment');
  assert.equal(r.due, '2026-07-18');
  assert.equal(r.name, 'renew lease');
});
