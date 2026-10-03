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

// ── 2026-10-03: monthly on the Nth weekday ("1st Monday") ──────────────────
// The bug: a meeting set up on the first Monday of August 2026 (the 3rd) came
// back on Thu Sep 3, then Sat Oct 3 -- "monthly" only knew "same date".
// nth 1-4 or -1 (last), weekday 0-6. Due dates here are after NOW.
test('nth weekday: 1st Monday advances to the 1st Monday of each next month', () => {
  const r = { freq: 'monthly', interval: 1, nth: 1, weekday: 1 };
  assert.equal(_nextRecurrenceDate('2026-10-05', r, NOW), '2026-11-02');
  assert.equal(_nextRecurrenceDate('2026-11-02', r, NOW), '2026-12-07');
});
test('nth weekday: 2nd Tuesday rolls over the year end', () => {
  const r = { freq: 'monthly', interval: 1, nth: 2, weekday: 2 };
  assert.equal(_nextRecurrenceDate('2026-12-08', r, NOW), '2027-01-12');
});
test('nth weekday: the 4th one always exists, even in February', () => {
  const r = { freq: 'monthly', interval: 1, nth: 4, weekday: 6 };
  assert.equal(_nextRecurrenceDate('2027-01-23', r, NOW), '2027-02-27');
});
test('nth weekday: nth -1 is the LAST one, 4th or 5th', () => {
  const r = { freq: 'monthly', interval: 1, nth: -1, weekday: 5 };
  assert.equal(_nextRecurrenceDate('2026-10-30', r, NOW), '2026-11-27');
  assert.equal(_nextRecurrenceDate('2026-11-27', r, NOW), '2026-12-25');
  assert.equal(_nextRecurrenceDate('2026-12-25', r, NOW), '2027-01-29'); // a 5th Friday
});
test('nth weekday: interval 3 is every quarter, on the pattern', () => {
  const r = { freq: 'monthly', interval: 3, nth: 1, weekday: 1 };
  assert.equal(_nextRecurrenceDate('2026-10-05', r, NOW), '2027-01-04');
});
test('nth weekday: a due date BEFORE this month\'s Nth weekday is still owed it', () => {
  // Due Sat Oct 3 (the bugged date), rule now says 1st Monday -> Mon Oct 5.
  const r = { freq: 'monthly', interval: 1, nth: 1, weekday: 1 };
  assert.equal(_nextRecurrenceDate('2026-10-03', r, new Date('2026-10-03T12:00:00')), '2026-10-05');
});
test('nth weekday: a malformed rule falls back to the plain same-date meaning', () => {
  assert.equal(_nextRecurrenceDate('2026-10-05', { freq: 'monthly', interval: 1, nth: 5, weekday: 1 }, NOW), '2026-11-05');
  assert.equal(_nextRecurrenceDate('2026-10-05', { freq: 'monthly', interval: 1, nth: 1, weekday: 9 }, NOW), '2026-11-05');
});
test('nth weekday: until ends the series like every other rule', () => {
  const r = { freq: 'monthly', interval: 1, nth: 1, weekday: 1, until: '2026-11-15' };
  assert.equal(_nextRecurrenceDate('2026-10-05', r, NOW), '2026-11-02');
  assert.equal(_nextRecurrenceDate('2026-11-02', r, NOW), null);
});
test('plain monthly still means the same DATE (the old behavior, unchanged)', () => {
  const r = { freq: 'monthly', interval: 1 };
  assert.equal(_nextRecurrenceDate('2026-08-03', r, new Date('2026-08-03T12:00:00')), '2026-09-03');
});

// ── 2026-10-03: a late completion keeps the task's own schedule ────────────
// Before: weekly/monthly restarted from the day it was ticked off, so
// "Every Saturday" done on Sunday became every Sunday.
test('late weekly: stays on its weekday, first one after today', () => {
  const r = { freq: 'weekly', interval: 1 };
  assert.equal(_nextRecurrenceDate('2026-09-26', r, new Date('2026-09-27T12:00:00')), '2026-10-03'); // Sat stays Sat
  assert.equal(_nextRecurrenceDate('2026-01-03', r, NOW), '2026-08-22'); // months late, still a Saturday
});
test('late weekly: done late ON a scheduled day goes to the next one, never due again today', () => {
  const r = { freq: 'weekly', interval: 1 };
  assert.equal(_nextRecurrenceDate('2026-08-08', r, new Date('2026-08-15T12:00:00')), '2026-08-22');
});
test('late weekly: every 2 weeks keeps its fortnight grid', () => {
  const r = { freq: 'weekly', interval: 2 };
  // Grid from Sat Aug 1: Aug 15, Aug 29. NOW is Wed Aug 19 -> Aug 29, not Sep 2.
  assert.equal(_nextRecurrenceDate('2026-08-01', r, NOW), '2026-08-29');
});
test('late monthly: same-date rule stays on its date', () => {
  const r = { freq: 'monthly', interval: 1 };
  assert.equal(_nextRecurrenceDate('2026-09-03', r, new Date('2026-09-05T12:00:00')), '2026-10-03');
});
test('late monthly: a clamp on the way does not drag later months', () => {
  const r = { freq: 'monthly', interval: 1 };
  // Due Jan 31, done Mar 5: Feb 28 has passed -> Mar 31, not Mar 28.
  assert.equal(_nextRecurrenceDate('2027-01-31', r, new Date('2027-03-05T12:00:00')), '2027-03-31');
});
test('late nth weekday: 1st Monday done two days late stays the 1st Monday', () => {
  const r = { freq: 'monthly', interval: 1, nth: 1, weekday: 1 };
  assert.equal(_nextRecurrenceDate('2026-09-07', r, new Date('2026-09-09T12:00:00')), '2026-10-05');
  // Done so late the next month's one is still ahead -> that one, not a skip.
  assert.equal(_nextRecurrenceDate('2026-10-05', r, new Date('2026-11-01T12:00:00')), '2026-11-02');
});
test('late daily: still restarts from today (unchanged)', () => {
  assert.equal(_nextRecurrenceDate('2026-08-10', { freq: 'daily', interval: 3 }, NOW), '2026-08-22');
});
