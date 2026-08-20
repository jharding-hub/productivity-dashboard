// Tests for public/recurrence-engine.js -- the recurrence ADVANCEMENT engine
// (as opposed to quick-add-parser.test.mjs, which tests extracting a
// recurrence rule out of typed text). Pure function, no browser. Extracted
// from legacy.js and extended with day-sets + until-date during panel-survey
// Stage 7 (A-16), 2026-08-19. Run: npm run test:recurrence
//
// TZ pinned before any Date use, and NOW is passed explicitly to every call
// (recurrence-engine.js's third, optional param -- same convention as
// quick-add-parser.js's parseQuickAdd(text, now)). Without it, every case
// whose due date happens to be in the past relative to the real wall clock
// on whatever day this suite runs would silently take the "completed late"
// branch instead of the one under test -- exactly the trap the first draft
// of this file fell into.
process.env.TZ = 'America/New_York';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { _nextRecurrenceDate } = require('../public/recurrence-engine.js');

// Fixed reference instant, a Wednesday, matching quick-add-parser.test.mjs's
// pattern of pinning one NOW per file.
const NOW = new Date('2026-08-19T12:00:00');

// ── Regression: the pre-A-16 shapes are unaffected by the extraction ───────
// Due dates here are on/after NOW so none of them trip the "completed late"
// clamp below -- that branch gets its own dedicated test instead.
test('daily/weekly/monthly with interval N advance unchanged', () => {
  assert.equal(_nextRecurrenceDate('2026-08-19', { freq: 'daily', interval: 1 }, NOW), '2026-08-20');
  assert.equal(_nextRecurrenceDate('2026-08-19', { freq: 'daily', interval: 3 }, NOW), '2026-08-22');
  assert.equal(_nextRecurrenceDate('2026-08-19', { freq: 'weekly', interval: 1 }, NOW), '2026-08-26');
  assert.equal(_nextRecurrenceDate('2026-08-19', { freq: 'weekly', interval: 2 }, NOW), '2026-09-02');
  // A future due date, so the month-end clamp math (Jan 31 + 1mo -> Feb 28,
  // not Mar 3) is exercised on its own terms, not via the late-clamp branch.
  assert.equal(_nextRecurrenceDate('2027-01-31', { freq: 'monthly', interval: 1 }, NOW), '2027-02-28');
});
test('missing/malformed input returns null, same as before', () => {
  assert.equal(_nextRecurrenceDate('', { freq: 'daily', interval: 1 }, NOW), null);
  assert.equal(_nextRecurrenceDate('2026-08-19', null, NOW), null);
  assert.equal(_nextRecurrenceDate('2026-08-19', { interval: 1 }, NOW), null);
  assert.equal(_nextRecurrenceDate('not-a-date', { freq: 'daily', interval: 1 }, NOW), null);
});
test('a due date already in the past counts forward from NOW, not the stale date', () => {
  // 2026-01-01 is long before NOW (2026-08-19) -- must not advance from January.
  const next = _nextRecurrenceDate('2026-01-01', { freq: 'daily', interval: 1 }, NOW);
  assert.equal(next, '2026-08-20');
});

// ── A-16: multi-weekday day-sets ────────────────────────────────────────────
// These due dates are all well after NOW, so they exercise the day-set
// advancement logic on its own -- the late-clamp interaction has its own
// dedicated test below.
test('day-set: advances to the next day in the set, same week', () => {
  // 2027-03-01 is a Monday; Mon/Wed/Fri -> next is Wednesday the 3rd.
  const r = { freq: 'weekly', interval: 1, days: [1, 3, 5] };
  assert.equal(_nextRecurrenceDate('2027-03-01', r, NOW), '2027-03-03');
  assert.equal(_nextRecurrenceDate('2027-03-03', r, NOW), '2027-03-05'); // Wed -> Fri
});
test('day-set: wraps to next week’s earliest day once the week is exhausted', () => {
  // 2027-03-05 is a Friday, the last day in the Mon/Wed/Fri set this week.
  const r = { freq: 'weekly', interval: 1, days: [1, 3, 5] };
  assert.equal(_nextRecurrenceDate('2027-03-05', r, NOW), '2027-03-08'); // -> next Monday
});
test('day-set: a single-day set behaves like plain weekly recurrence', () => {
  const r = { freq: 'weekly', interval: 1, days: [3] };
  assert.equal(_nextRecurrenceDate('2027-03-03', r, NOW), '2027-03-10'); // Wed -> next Wed
});
test('day-set: a completed-late due date counts forward from NOW, then lands on a set day', () => {
  const r = { freq: 'weekly', interval: 1, days: [1, 3, 5] };
  // NOW (2026-08-19) is itself a Wednesday, IN the set -- clamped d starts
  // there, so the next occurrence is the next set day after it: Friday.
  assert.equal(_nextRecurrenceDate('2020-01-01', r, NOW), '2026-08-21');
});

// ── A-16: until-date ends the series ────────────────────────────────────────
test('until: returns null once the next occurrence would fall after it', () => {
  const r = { freq: 'daily', interval: 1, until: '2026-08-20' };
  assert.equal(_nextRecurrenceDate('2026-08-19', r, NOW), '2026-08-20'); // still within range
  assert.equal(_nextRecurrenceDate('2026-08-20', r, NOW), null); // 08-21 > until
});
test('until: combines with a day-set to cut off a class schedule mid-week', () => {
  const r = { freq: 'weekly', interval: 1, days: [1, 3, 5], until: '2026-08-21' };
  assert.equal(_nextRecurrenceDate('2026-08-19', r, NOW), '2026-08-21'); // last class, on the until date itself
  assert.equal(_nextRecurrenceDate('2026-08-21', r, NOW), null); // series is over
});
test('until: an until date far in the future never cuts anything off', () => {
  const r = { freq: 'monthly', interval: 1, until: '2030-01-01' };
  assert.equal(_nextRecurrenceDate('2026-08-19', r, NOW), '2026-09-19');
});
