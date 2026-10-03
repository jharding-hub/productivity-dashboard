// ═══════════════════════════════════════════════════════════════════
// Centerpost — recurrence advancement engine (R8, extracted from legacy.js
// during panel-survey Stage 7, 2026-08-19 -- A-16).
// Pure function, zero dependency on the DOM or Firestore: given a due date
// and a recurrence rule, returns the NEXT due date or null. Loaded before
// legacy.js (same as sync-merge.js/quick-add-parser.js/date-utils.js) so
// _nextRecurrenceDate is already global by the time legacy.js calls it.
//
// recurrence shape: { freq: 'daily'|'weekly'|'monthly', interval: N,
//                      days: [0-6, ...] (optional, weekly only),
//                      until: 'YYYY-MM-DD' (optional) }
//
// `days` (A-16): a weekly recurrence with a day-SET -- "every mon wed fri" --
// instead of the single weekday the due date happens to land on. Advances to
// the next day in the set after the current due date's weekday, wrapping to
// the following week (× interval) when none remain this week.
//
// `until` (A-16): once the computed next date would fall after this date,
// the recurrence is over -- returns null exactly like a missing/malformed
// rule, so _materializeRecurrence's existing "no next date -> don't push
// anything" path ends the series with no separate code path needed.
//
// `nth` + `weekday` (2026-10-03, monthly only): "the 1st Monday of every
// month" instead of "the same DATE every month". nth is 1-4, or -1 for the
// LAST one; weekday is 0-6. A monthly rule without them keeps the old
// same-date meaning, so every existing monthly task is unchanged. Before
// this, a meeting set up on the first Monday of August (the 3rd) came back
// on Thu Sep 3, then Sat Oct 3 -- the app had no way to say "1st Monday".
//
// Late completion (2026-10-03): weekly and monthly rules step forward along
// the task's OWN schedule until they pass today, instead of restarting from
// the day it was checked off. Restarting from today was right for daily
// (an overdue daily task shouldn't respawn overdue) but silently moved the
// others: "Every Saturday" ticked on a Sunday became every Sunday, and the
// 1st Monday ticked two days late became the 9th of every month. Daily and
// weekly day-sets keep the restart-from-today rule -- for both, "the next
// one after today" already IS the schedule.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // A monthly rule pinned to "the Nth weekday" (see header), validated --
  // anything malformed falls back to the plain same-date meaning rather than
  // inventing a schedule nobody chose.
  function isNthWeekdayRule(r) {
    return r.freq === 'monthly' && (r.nth === -1 || (r.nth >= 1 && r.nth <= 4)) &&
      r.weekday >= 0 && r.weekday <= 6 && r.weekday === Math.floor(r.weekday);
  }
  // The Nth weekday of a month as a local-midnight Date. nth 1-4 counts from
  // the 1st (the 4th one always exists, by day 28); -1 is the last one.
  // month may be out of 0-11 -- the Date constructor rolls the year over.
  function nthWeekdayOfMonth(year, month, nth, weekday) {
    if (nth === -1) {
      var last = new Date(year, month + 1, 0);
      last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7));
      return last;
    }
    var first = new Date(year, month, 1);
    first.setDate(1 + ((weekday - first.getDay() + 7) % 7) + 7 * (nth - 1));
    return first;
  }
  // The same day-of-month, clamped to the month's real last day -- Jan 31
  // + 1 month is Feb 28, never Mar 3 (setMonth's overflow).
  function sameDateInMonth(year, month, day) {
    var lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  }

  // now: optional Date override, for testing -- same convention as
  // quick-add-parser.js's parseQuickAdd(text, now). legacy.js's real call
  // site never passes it, so production behavior (real clock) is unchanged.
  function _nextRecurrenceDate(dueStr, recurrence, now) {
    if (!dueStr || !recurrence || !recurrence.freq) return null;
    var due = new Date(dueStr + 'T00:00:00');
    if (isNaN(due.getTime())) return null;
    var todayD = new Date(dayKey(now || new Date()) + 'T00:00:00');
    var n = recurrence.interval || 1;
    // The next occurrence must be after the due date AND after today, so a
    // late completion is never born overdue (or due again today).
    var floor = due.getTime() < todayD.getTime() ? todayD : due;
    var d, guard;
    if (recurrence.freq === 'daily' ||
        (recurrence.freq === 'weekly' && recurrence.days && recurrence.days.length)) {
      // Completed late: count forward from today instead of the stale due date.
      d = new Date(floor.getTime());
      if (recurrence.freq === 'daily') {
        d.setDate(d.getDate() + n);
      } else {
        var dow = d.getDay();
        var delta = null;
        for (var i = 0; i < recurrence.days.length; i++) {
          if (recurrence.days[i] > dow) { delta = recurrence.days[i] - dow; break; }
        }
        // Nothing left in the set this week -- wrap to the set's earliest day,
        // N weeks out (N=1 for the plain "every mon wed fri" case).
        if (delta == null) delta = (recurrence.days[0] + 7 * n) - dow;
        d.setDate(d.getDate() + delta);
      }
    } else if (recurrence.freq === 'weekly') {
      // Step whole weeks from the due date, so the weekday never changes.
      d = new Date(due.getTime());
      guard = 0;
      do { d.setDate(d.getDate() + 7 * n); } while (d.getTime() <= floor.getTime() && ++guard < 10000);
    } else if (recurrence.freq === 'monthly') {
      // Step whole months from the due date's month (k * interval), working
      // each candidate out from that base month -- never from the previous
      // candidate, so when a very late completion steps through several
      // months, a Feb 28 clamp on the way doesn't drag March to the 28th.
      // k starts at 0: an Nth-weekday task due before this month's Nth
      // weekday (e.g. due the 3rd, 1st Monday is the 5th) is still owed it.
      var nth = isNthWeekdayRule(recurrence);
      var y = due.getFullYear(), m = due.getMonth(), origDay = due.getDate();
      for (var k = 0; k < 2400; k++) {
        d = nth ? nthWeekdayOfMonth(y, m + k * n, recurrence.nth, recurrence.weekday)
                : sameDateInMonth(y, m + k * n, origDay);
        if (d.getTime() > floor.getTime()) break;
      }
    } else {
      return null;
    }
    var next = dayKey(d);
    if (recurrence.until && next > recurrence.until) return null;
    return next;
  }

  if (typeof window !== 'undefined') window._nextRecurrenceDate = _nextRecurrenceDate;
  if (typeof module !== 'undefined' && module.exports) module.exports = { _nextRecurrenceDate: _nextRecurrenceDate };
})();
