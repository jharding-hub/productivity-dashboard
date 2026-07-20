// Tests for public/quick-add-parser.js -- the natural-language date/time/
// priority/recurrence parser behind every task/reminder/subtask quick-add
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

// ── Priority ──────────────────────────────────────────────────────────────
test('priority: !high, !med, !medium, !low, case-insensitive', () => {
  assert.equal(parseQuickAdd('call bob !high', NOW).priority, 'high');
  assert.equal(parseQuickAdd('call bob !med', NOW).priority, 'med');
  assert.equal(parseQuickAdd('call bob !medium', NOW).priority, 'med');
  assert.equal(parseQuickAdd('call bob !low', NOW).priority, 'low');
  assert.equal(parseQuickAdd('call bob !HIGH', NOW).priority, 'high');
});
test('priority: no marker is null; an unrecognized word is null, not a crash', () => {
  assert.equal(parseQuickAdd('call bob', NOW).priority, null);
  assert.equal(parseQuickAdd('call bob !urgent', NOW).priority, null);
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
test('combined: date + time + priority + recurrence together, with a clean leftover name', () => {
  const r = parseQuickAdd('pay rent friday 3pm !high every month', NOW);
  assert.deepEqual(r, {
    name: 'pay rent',
    due: '2026-07-24',
    time: '15:00',
    priority: 'high',
    recurrence: { freq: 'monthly', interval: 1 },
  });
});

// ── No signal at all ────────────────────────────────────────────────────
test('no signal at all: name passes through unchanged, every field null', () => {
  assert.deepEqual(parseQuickAdd('buy groceries', NOW), {
    name: 'buy groceries', due: null, time: null, priority: null, recurrence: null,
  });
});
test('empty input', () => {
  assert.deepEqual(parseQuickAdd('', NOW), {
    name: '', due: null, time: null, priority: null, recurrence: null,
  });
});
