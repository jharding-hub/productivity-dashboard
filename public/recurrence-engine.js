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
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // now: optional Date override, for testing -- same convention as
  // quick-add-parser.js's parseQuickAdd(text, now). legacy.js's real call
  // site never passes it, so production behavior (real clock) is unchanged.
  function _nextRecurrenceDate(dueStr, recurrence, now) {
    if (!dueStr || !recurrence || !recurrence.freq) return null;
    var d = new Date(dueStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    // Completed late (due date already in the past): count forward from today
    // instead of the stale due date, so the next occurrence isn't born overdue.
    var todayD = new Date(dayKey(now || new Date()) + 'T00:00:00');
    if (d.getTime() < todayD.getTime()) d = todayD;
    var n = recurrence.interval || 1;
    var origDay = d.getDate();
    if (recurrence.freq === 'weekly' && recurrence.days && recurrence.days.length) {
      var dow = d.getDay();
      var delta = null;
      for (var i = 0; i < recurrence.days.length; i++) {
        if (recurrence.days[i] > dow) { delta = recurrence.days[i] - dow; break; }
      }
      // Nothing left in the set this week -- wrap to the set's earliest day,
      // N weeks out (N=1 for the plain "every mon wed fri" case).
      if (delta == null) delta = (recurrence.days[0] + 7 * n) - dow;
      d.setDate(d.getDate() + delta);
    } else if (recurrence.freq === 'daily') {
      d.setDate(d.getDate() + n);
    } else if (recurrence.freq === 'weekly') {
      d.setDate(d.getDate() + 7 * n);
    } else if (recurrence.freq === 'monthly') {
      // setMonth overflows into the following month when the target month is
      // shorter (Jan 31 + 1mo -> Mar 3, not Feb 28) -- clamp to the target
      // month's actual last day instead.
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(origDay, lastDay));
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
