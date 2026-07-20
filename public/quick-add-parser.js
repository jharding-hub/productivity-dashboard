// ═══════════════════════════════════════════════════════════════════════
// quick-add-parser.js — R8: natural-language date/time/priority/recurrence
// parsing for the task/reminder/subtask quick-add inputs.
// ═══════════════════════════════════════════════════════════════════════
//
// A single pure function, window.parseQuickAdd(text, now), extracts
// structured fields from a line of typed text and returns both the
// structured result and the leftover "clean" name with matched tokens
// removed. Deliberately RRULE-lite: daily/weekly/monthly only, interval 1.
// No project-tagging (#project) -- every add-form already has its own
// project picker, and fuzzy name-matching from free text is a real
// ambiguity risk not worth taking on in v1.
//
// Pure and side-effect-free so it's easy to hand-verify in the console and,
// if a test runner is ever added to this repo, to unit test directly.
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }

  var WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var PRIORITY_MAP = { high: 'high', med: 'med', medium: 'med', low: 'low' };

  // -- Priority: "!high" / "!med" / "!low" (case-insensitive) -------------
  function extractPriority(text) {
    var m = text.match(/(^|\s)!(\w+)\b/i);
    if (!m) return { priority: null, text: text };
    var val = PRIORITY_MAP[m[2].toLowerCase()];
    if (!val) return { priority: null, text: text };
    return { priority: val, text: (text.slice(0, m.index) + text.slice(m.index + m[0].length)) };
  }

  // -- Recurrence: "every day|week|month", "every N days|weeks|months", or
  // "every <weekday>" (weekly, anchored to that weekday -- weekly recurrence
  // already repeats on whatever weekday the due date lands on, so this just
  // needs to pin the due date to the right day; see dayOfWeek below).
  function extractRecurrence(text) {
    var m = text.match(/\bevery\s+(\d+)\s+(day|week|month)s?\b/i);
    if (m) {
      var freqN = { day: 'daily', week: 'weekly', month: 'monthly' }[m[2].toLowerCase()];
      return { recurrence: { freq: freqN, interval: parseInt(m[1], 10) }, dayOfWeek: null, text: strip(text, m) };
    }
    m = text.match(/\bevery\s+(day|week|month)\b/i);
    if (m) {
      var freq = { day: 'daily', week: 'weekly', month: 'monthly' }[m[1].toLowerCase()];
      return { recurrence: { freq: freq, interval: 1 }, dayOfWeek: null, text: strip(text, m) };
    }
    m = text.match(/\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (m) {
      return { recurrence: { freq: 'weekly', interval: 1 }, dayOfWeek: WEEKDAYS.indexOf(m[1].toLowerCase()), text: strip(text, m) };
    }
    return { recurrence: null, dayOfWeek: null, text: text };
  }

  // -- Time: "3pm", "3:30pm", "15:00", "at 9am" -> 'HH:MM' (24h) ----------
  function extractTime(text) {
    var re = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    var m = text.match(re);
    if (!m) return { time: null, text: text };
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0, ap = m[3] ? m[3].toLowerCase() : null;
    if (h > 23 || min > 59) return { time: null, text: text };
    // Bare hour with no am/pm/colon and no clear time context (e.g. just "3")
    // is too ambiguous with a plain number in the task name -- require either
    // an am/pm marker, a ":mm", or an explicit "at " prefix to accept it.
    var hasMarker = !!ap || m[0].indexOf(':') >= 0 || /^at\s/i.test(m[0]);
    if (!hasMarker) return { time: null, text: text };
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23) return { time: null, text: text };
    return { time: pad(h) + ':' + pad(min), text: (text.slice(0, m.index) + text.slice(m.index + m[0].length)) };
  }

  // -- Date: today/tomorrow/next <weekday>/<weekday>/in N days/explicit ---
  function extractDate(text, now) {
    var lower = text.toLowerCase();

    var m = lower.match(/\btoday\b/);
    if (m) return { due: dayKey(now), text: strip(text, m) };

    m = lower.match(/\btomorrow\b/);
    if (m) return { due: dayKey(addDays(now, 1)), text: strip(text, m) };

    m = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (m) return { due: dayKey(addDays(now, parseInt(m[1], 10))), text: strip(text, m) };

    m = lower.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (m) {
      var targetNext = WEEKDAYS.indexOf(m[1]);
      var deltaNext = ((targetNext - now.getDay() + 7) % 7) || 7; // "next X" always means next week's X, not today
      return { due: dayKey(addDays(now, deltaNext)), text: strip(text, m) };
    }

    m = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (m) {
      var target = WEEKDAYS.indexOf(m[1]);
      var delta = (target - now.getDay() + 7) % 7; // the NEXT occurrence, today counts if it's today
      if (delta === 0) delta = 7; // bare weekday name means the upcoming one, not literally today
      return { due: dayKey(addDays(now, delta)), text: strip(text, m) };
    }

    // Explicit YYYY-MM-DD
    m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m) return { due: m[0], text: strip(text, m) };

    // Explicit M/D or M/D/YYYY (assumes current year if omitted)
    m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
      var yr = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : ('' + now.getFullYear());
      var mo = pad(parseInt(m[1], 10)), da = pad(parseInt(m[2], 10));
      return { due: yr + '-' + mo + '-' + da, text: strip(text, m) };
    }

    return { due: null, text: text };
  }
  function strip(text, m) { return text.slice(0, m.index) + text.slice(m.index + m[0].length); }

  function cleanName(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  // -- Public entry point ---------------------------------------------------
  // now: optional Date override, for testing. Order matters: priority and
  // recurrence markers are unambiguous tokens, pull them first so date/time
  // extraction isn't confused by leftover punctuation.
  var parseQuickAdd = function (rawText, now) {
    now = now || new Date();
    var text = rawText || '';

    var pr = extractPriority(text); text = pr.text;
    var rec = extractRecurrence(text); text = rec.text;
    var tm = extractTime(text); text = tm.text;
    var dt = extractDate(text, now); text = dt.text;

    // "every <weekday>" with no other date signal: pin the due date to the
    // next occurrence of that weekday so the weekly recurrence actually
    // lands on it (an explicit date elsewhere in the text always wins).
    var due = dt.due;
    if (!due && rec.dayOfWeek != null) {
      var delta = ((rec.dayOfWeek - now.getDay() + 7) % 7) || 7;
      due = dayKey(addDays(now, delta));
    }

    return {
      name: cleanName(text),
      due: due,
      time: tm.time,
      priority: pr.priority,
      recurrence: rec.recurrence,
    };
  };

  // R4: dual export, same shape as sync-merge.js -- window for the browser
  // (unchanged behavior), module.exports for `node --test` (test/quick-add-parser.test.mjs).
  if (typeof window !== 'undefined') window.parseQuickAdd = parseQuickAdd;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseQuickAdd };
})();
