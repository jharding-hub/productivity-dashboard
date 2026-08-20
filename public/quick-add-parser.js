// ═══════════════════════════════════════════════════════════════════════
// quick-add-parser.js — R8: natural-language date/time/recurrence
// parsing for the task/reminder/subtask quick-add inputs.
// ═══════════════════════════════════════════════════════════════════════
//
// A single pure function, window.parseQuickAdd(text, now), extracts
// structured fields from a line of typed text and returns both the
// structured result and the leftover "clean" name with matched tokens
// removed. Deliberately RRULE-lite: daily/weekly/monthly only, interval 1.
//
// Panel survey 2026-08-18 (I-9) added two OPT-IN tokens on top of the
// original heuristic-only design: a leading "task:"/"thought:" prefix
// (forcedType) and a trailing "#project" tag (projectTag). Both are no-ops
// unless typed -- the heuristic remains the only default. This module still
// does NOT attempt fuzzy project-name matching itself (stays pure, no
// state.projects access); it returns the raw tag text and the caller
// resolves it against real projects.
//
// Panel survey Stage 7 (A-16) extended recurrence itself: a weekly rule can
// now carry a multi-weekday day-SET ("every mon wed fri", recurrence.days)
// and an optional end date ("until Dec 12", recurrence.until) instead of
// only the single-weekday/interval-N shape from R8. Both are additive to the
// recurrence object's existing {freq, interval} shape, so any code that
// already reads .freq/.interval is unaffected.
//
// Pure and side-effect-free so it's easy to hand-verify in the console and,
// if a test runner is ever added to this repo, to unit test directly.
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }

  var WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var WEEKDAY_ABBR = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  var WEEKDAY_TOKEN = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)';

  // -- Recurrence: multi-weekday day-sets, "every mon wed fri" (A-16) -------
  // The Student's actual reality ("MWF 10am") and the one shape the original
  // engine could not express: it had a single anchored weekday or an N-day/
  // week/month interval, but no day-SET. Requires at least TWO weekday tokens
  // -- a single one ("every monday") is left to the existing extractRecurrence
  // below, unchanged, so nothing that already worked changes shape. Must run
  // BEFORE extractRecurrence for the same reason: "every monday" is a prefix
  // of "every monday wednesday" and would otherwise match first and eat only
  // the first day.
  function extractDaySetRecurrence(text) {
    var re = new RegExp('\\bevery\\s+(' + WEEKDAY_TOKEN + '(?:\\s*,?\\s*(?:and\\s+)?' + WEEKDAY_TOKEN + ')+)\\b', 'i');
    var m = text.match(re);
    if (!m) return { recurrence: null, text: text };
    var tokens = m[1].toLowerCase().match(new RegExp(WEEKDAY_TOKEN, 'g'));
    var seen = {};
    tokens.forEach(function (t) { seen[WEEKDAY_ABBR[t.slice(0, 3)]] = true; });
    var days = Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
    return { recurrence: { freq: 'weekly', interval: 1, days: days }, text: strip(text, m) };
  }

  // -- Recurrence end date: "until Dec 12" / "until 2026-12-12" / "until
  // 12/12" (A-16). Only meaningful attached to a recurrence, so the caller
  // only invokes this once a recurrence (day-set or the forms below) has
  // already matched -- keeps a bare "wait until confirmed" task name untouched.
  var MONTH_ABBR = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function extractUntilDate(text, now) {
    var m = text.match(/\buntil\s+(\d{4})-(\d{2})-(\d{2})\b/i);
    if (m) return { until: m[0].replace(/^until\s+/i, ''), text: strip(text, m) };
    m = text.match(/\buntil\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/i);
    if (m) {
      var yr = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : ('' + now.getFullYear());
      return { until: yr + '-' + pad(parseInt(m[1], 10)) + '-' + pad(parseInt(m[2], 10)), text: strip(text, m) };
    }
    m = text.match(/\buntil\s+([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i);
    if (m) {
      var monIdx = MONTH_ABBR[m[1].toLowerCase().slice(0, 3)];
      if (monIdx != null) {
        var day = parseInt(m[2], 10);
        var year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
        var d = new Date(year, monIdx, day);
        // No year typed and the date already passed this year -- assume next.
        if (!m[3] && d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
          d = new Date(year + 1, monIdx, day);
        }
        return { until: dayKey(d), text: strip(text, m) };
      }
    }
    return { until: null, text: text };
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

  // -- Bare "daily"/"weekly"/"monthly", TRAILING ONLY ----------------------
  // "workout 6am daily" is the phrasing people reach for first, but a bare
  // keyword anywhere in the string is too greedy: "Daily report", "daily
  // standup" and "read monthly magazine" are ordinary task NAMES and must not
  // be silently turned into recurring tasks with the word cut out of them.
  // Requiring the keyword to be the last token (and to have something before
  // it) keeps the natural phrasing working while leaving those names alone.
  //
  // Run AFTER time/date extraction, unlike the "every ..." forms above, so
  // that "workout daily at 6am" also works -- once "at 6am" is stripped the
  // keyword is trailing.
  function extractBareRecurrence(text) {
    var m = text.match(/\S\s+(daily|weekly|monthly)\s*$/i);
    if (!m) return { recurrence: null, text: text };
    var freq = m[1].toLowerCase();
    // Keep the matched leading character -- the regex only consumed it to
    // prove the keyword isn't the entire input.
    var cut = text.slice(0, m.index + 1) + text.slice(m.index + m[0].length);
    return { recurrence: { freq: freq, interval: 1 }, text: cut };
  }

  // -- Opt-in explicit type prefix: "task: buy milk" / "thought: idea" -----
  // Panel survey 2026-08-18 (I-9): the High-Functioning persona called the
  // task-vs-thought heuristic "a black box I audit later" -- this lets that
  // seat skip the guess entirely. Must be a LEADING token (anchored at the
  // start) so it reads as a deliberate declaration, not a word that happens
  // to appear in the text ("task: buy milk" vs "discuss my task: buy milk").
  // Opt-in only: the heuristic is unchanged for anyone who doesn't type it.
  function extractTypePrefix(text) {
    var m = text.match(/^\s*(task|thought)\s*:\s*/i);
    if (!m) return { forcedType: null, text: text };
    return { forcedType: m[1].toLowerCase(), text: text.slice(m[0].length) };
  }

  // -- Opt-in project tag: "#project-name" ----------------------------------
  // Panel survey 2026-08-18 (I-9). The original file header on this module
  // explicitly deferred #project tagging as "a real ambiguity risk not worth
  // taking on in v1" -- still true for fuzzy free-text matching, so this
  // module stays pure and does NOT attempt to resolve the tag against real
  // project names. It only extracts the raw token; the caller (legacy.js,
  // which holds state.projects) resolves it to an id or leaves it unmatched.
  // Takes the LAST #tag in the text (a task name is unlikely to contain a
  // literal hash otherwise, but "last" avoids swallowing an incidental one
  // mid-sentence ahead of the real tag).
  function extractProjectTag(text) {
    var matches = text.match(/#(\S+)/g);
    if (!matches || !matches.length) return { projectTag: null, text: text };
    var last = matches[matches.length - 1];
    var idx = text.lastIndexOf(last);
    return {
      projectTag: last.slice(1).toLowerCase(),
      text: text.slice(0, idx) + text.slice(idx + last.length),
    };
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
  // now: optional Date override, for testing. Order matters: recurrence
  // markers are unambiguous tokens, pull them first so date/time
  // extraction isn't confused by leftover punctuation.
  var parseQuickAdd = function (rawText, now) {
    now = now || new Date();
    var text = rawText || '';

    var tp = extractTypePrefix(text); text = tp.text;
    var pt = extractProjectTag(text); text = pt.text;

    // Day-set ("every mon wed fri") takes priority over the single-weekday/
    // day/week/month form below -- see extractDaySetRecurrence's comment for
    // why it must run first.
    var daySet = extractDaySetRecurrence(text);
    var rec = daySet.recurrence ? daySet : extractRecurrence(text);
    text = rec.text;

    // "until ..." only ever modifies a recurrence that was just found.
    var until = null;
    if (rec.recurrence) {
      var ut = extractUntilDate(text, now);
      text = ut.text;
      until = ut.until;
    }

    var tm = extractTime(text); text = tm.text;
    var dt = extractDate(text, now); text = dt.text;

    // Bare trailing daily/weekly/monthly, only if no "every ..." form already
    // matched (an explicit "every 2 weeks" must never be overridden).
    var recurrence = rec.recurrence;
    if (!recurrence) {
      var bare = extractBareRecurrence(text);
      if (bare.recurrence) { recurrence = bare.recurrence; text = bare.text; }
    }
    if (recurrence && until) recurrence.until = until;

    // "every <weekday>" with no other date signal: pin the due date to the
    // next occurrence of that weekday so the weekly recurrence actually
    // lands on it (an explicit date elsewhere in the text always wins).
    var due = dt.due;
    if (!due && rec.dayOfWeek != null) {
      var delta = ((rec.dayOfWeek - now.getDay() + 7) % 7) || 7;
      due = dayKey(addDays(now, delta));
    }
    // Day-set: pin to the nearest day IN THE SET after today (same "not
    // literally today" convention as the single-weekday case above).
    if (!due && recurrence && recurrence.days && recurrence.days.length) {
      var dow = now.getDay(), setDelta = null;
      for (var i = 0; i < recurrence.days.length; i++) {
        if (recurrence.days[i] > dow) { setDelta = recurrence.days[i] - dow; break; }
      }
      if (setDelta == null) setDelta = (recurrence.days[0] + 7) - dow;
      due = dayKey(addDays(now, setDelta));
    }

    return {
      name: cleanName(text),
      due: due,
      time: tm.time,
      priority: null,
      recurrence: recurrence,
      forcedType: tp.forcedType,
      projectTag: pt.projectTag,
    };
  };

  // R4: dual export, same shape as sync-merge.js -- window for the browser
  // (unchanged behavior), module.exports for `node --test` (test/quick-add-parser.test.mjs).
  if (typeof window !== 'undefined') window.parseQuickAdd = parseQuickAdd;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseQuickAdd };
})();
