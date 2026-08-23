// ═══════════════════════════════════════════════════════════════════
// Centerpost — date/time formatting helpers (R18 extraction)
// Pure functions, zero dependency on app state or the DOM. Loaded before
// legacy.js (same as config.js/journal-crypto.js/quick-add-parser.js) so
// these are already global by the time anything calls them.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// A-2 DAY ANCHOR (panel survey Stage 9, 2026-08-20)
//
// The instant a new calendar day begins, as minutes past local midnight.
//
// 0 IS THE DEFAULT AND IS EXACTLY THE HISTORICAL BEHAVIOUR -- the arithmetic
// below subtracts zero, so every resolver returns byte-identical results to
// the pre-anchor code. This is asserted in test/sync-merge.test.mjs rather
// than assumed. The anchor is opt-in per account and no existing account moves.
//
// Positive = the day starts LATER than midnight. Anchor 240 (4am) means 01:30
// still belongs to the previous day: the ADHD User's 1am false-overdue shame,
// and the Student's 11:59pm deadlines. Negative = the day starts the previous
// evening (anchor -240 = 20:00) for a night-shift worker.
//
// Implemented as ONE SUBTRACTION on the instant, not a branch on the hour:
// the anchored day of an instant is the LOCAL calendar day of (instant minus
// anchor). Shifting the instant leaves DST to the platform -- the shifted
// value is still a real instant, and its local Y/M/D is what a wall clock
// actually read at that moment. A branch-on-hour version would have to
// special-case the 23- and 25-hour days itself.
//
// This file stays PURE: it never reads app state or the DOM. legacy.js pushes
// state.dayAnchorMin in here via setDayAnchorMinutes() after load() and after
// every onSnapshot.
//
// ANYTHING THAT ASKS "WHAT DAY IS IT RIGHT NOW" MUST START FROM _anchoredNow().
// A bare new Date() feeding a day comparison will disagree with todayStr() for
// the length of the offset, every single day -- and the native widget has its
// own copy of this arithmetic in TodayWidget.swift that must move in lockstep.
// ═══════════════════════════════════════════════════════════════════
var _dayAnchorMin = 0;
function setDayAnchorMinutes(n){
  n = parseInt(n,10);
  if(!isFinite(n)) n = 0;
  // Bounded to +/-12h. Past that the "day" stops being a day, and the widget's
  // rollover-boundary arithmetic would start wrapping in confusing ways.
  if(n > 720) n = 720;
  if(n < -720) n = -720;
  _dayAnchorMin = n;
  return _dayAnchorMin;
}
function getDayAnchorMinutes(){ return _dayAnchorMin; }
// "Now", moved into anchored-day space. Returned as a Date because several
// callers need to do calendar arithmetic on it (a 7-day streak strip, a 90-day
// cutoff) before formatting.
function _anchoredNow(){
  return _dayAnchorMin ? new Date(Date.now() - _dayAnchorMin*60000) : new Date();
}
// THE canonical instant -> anchored-day mapping. Everything that answers "which
// day does this moment belong to" goes through here: todayStr(), the no-arg
// _dayKey(), the deadline countdown, and the widget-parity harness. It is also
// the exact function TodayWidget.swift's dayKey() must mirror -- one definition
// on each side of the bridge, not four copies of the same subtraction.
// `instant` defaults to now; passing one makes the mapping testable without
// mocking the clock.
function _anchoredDayKey(instant){
  var ms = instant ? instant.getTime() : Date.now();
  var d = new Date(ms - _dayAnchorMin*60000);
  var pad = function(n){return n<10?'0'+n:''+n;};
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
// The real instant at which the anchored day `dayStr` ends. At anchor 0 this
// is 23:59:59.999 local on that date, unchanged. Under an anchor the day is
// still 24h long, just displaced -- with a 4am anchor, 2026-08-20 ends at
// 03:59:59.999 on the 21st.
//
// Built from the date's components, never new Date(dayStr): the latter parses
// a bare YYYY-MM-DD as UTC and lands a day early west of Greenwich.
function _anchoredDayEndOf(dayStr){
  var p = (dayStr||'').split('-');
  var base = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10), 23, 59, 59, 999);
  if(isNaN(base.getTime())) return null;
  return new Date(base.getTime() + _dayAnchorMin*60000);
}
// Same thing for the anchored day that CONTAINS `now`. Delegates, so there is
// one implementation of "when does a day end", not two that can drift.
function _anchoredDayEnd(now){
  return _anchoredDayEndOf(_anchoredDayKey(now || new Date()));
}
// The instant at which wall-clock time `min` (minutes since midnight) falls
// INSIDE the anchored day `dayStr`. Same rule _anchoredDayEndOf encodes, for a
// general time rather than the day's last second: under a 4am anchor the day
// 2026-08-20 runs 04:00 on the 20th to 03:59 on the 21st, so 10a is the 20th
// at 10:00 but 1a is the TWENTY-FIRST at 01:00 -- the small hours belong to
// the day you were still awake in. At anchor 0 this is plain local time.
function _anchoredInstantOf(dayStr,min){
  var p=(dayStr||'').split('-');
  var base=new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10), 0, 0, 0, 0);
  if(isNaN(base.getTime()))return null;
  var t=base.getTime()+min*60000;
  if(min<_dayAnchorMin)t+=86400000;
  return new Date(t);
}

function todayStr(){return _anchoredDayKey();}
function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function fmtTime(t){const[h,m]=t.split(':');const hr=parseInt(h);return(hr>12?hr-12:hr||12)+':'+m+(hr>=12?' PM':' AM');}
// Compact wall-clock label ("9a", "12:30p") from minutes-since-midnight. The
// timeline has always rendered times this way; it lives here now so the due
// countdown can speak the SAME dialect as the timeline row above it rather
// than inventing a second one (legacy.js's _tlFmtTime delegates to this).
// Minutes are normalised into a real clock time first: a block ending 2h after
// 11:59pm is 1559 minutes, and the old arithmetic printed that as "13:59p" --
// not a time at all. Wrapping is the formatter's job; naming the day is the
// caller's (legacy.js's _tlFmtEnd appends "(+1)").
function _shortTime(min){
  min=((Math.floor(min)%1440)+1440)%1440;
  var h=Math.floor(min/60),m=min%60;
  var h12=h===0?12:h>12?h-12:h;
  return h12+(m===0?'':':'+(m<10?'0':'')+m)+(h<12?'a':'p');
}
function _hmToMin(hm){var a=(hm||'').split(':');return (parseInt(a[0],10)||0)*60+(parseInt(a[1],10)||0);}
// Called BOTH ways on purpose, and the two meanings are different:
//   _dayKey()      -> "what day is it now"      -> anchored
//   _dayKey(aDate) -> "format this Date's day"  -> pure, NEVER shifted
// Shifting the with-argument form too would be wrong: callers that iterate day
// buckets pass Dates already sitting at local midnight, and subtracting the
// anchor from those would slide every bucket into the previous day. Callers
// that pass a date derived from NOW (a 7-day streak strip, a 90-day cutoff)
// are the ones that must build that date from _anchoredNow() themselves --
// see the call sites in legacy.js.
function _dayKey(d){if(!d)return _anchoredDayKey();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _monthKey(d){d=d||_anchoredNow();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}

// A-13 (panel survey Stage 9, 2026-08-20): a CALM live countdown for a task
// whose deadline is inside the next 24 hours, shown in place of the static
// date. Deliberately not alarming -- no colour change, no icon, no count-UP of
// how late something is. The app already refuses streak-shame elsewhere and
// this is the same rule: an overdue item returns null here and keeps its
// existing no-shame handling (the static date plus Fresh Start), because
// "3h LATE" is exactly the pressure this app exists not to apply.
//
// A due DATE with no time means "by the end of that day", so the deadline
// counted down to is 23:59:59 local on the due day. That is also the Student's
// "11:59pm deadline" case from the survey, with no separate code path.
//
// Only ever fires for a task due TODAY, and that is not an arbitrary
// restriction: even at 23:00, tomorrow's end-of-day is still 25h away, so
// "due within 24 hours" and "due today" are the SAME SET. Anything dated
// tomorrow or later keeps its static date.
//
// `now` is an optional Date override for tests -- same convention as
// quick-add-parser's parseQuickAdd(text, now) and recurrence-engine's
// _nextRecurrenceDate(due, rec, now). Production call sites pass nothing.
function _dueCountdownLabel(dueStr,now,timeStr){
  if(!dueStr)return null;
  now=now||new Date();
  // _dayKey(now), not a raw comparison: this is the ONE place the countdown
  // decides which day "today" is, so it inherits whatever _dayKey means.
  // _dayKey with the SHIFTED instant, and _anchoredDayEnd for the deadline:
  // under an anchor the due day no longer ends at 23:59 local. With a 4am
  // anchor, 2026-08-20 runs 04:00 on the 20th to 03:59:59 on the 21st, so at
  // 01:00 on the 21st this correctly still reads "due in 2h" rather than
  // having silently gone overdue three hours earlier. At anchor 0 both calls
  // reduce to the original arithmetic exactly.
  if(dueStr!==_anchoredDayKey(now))return null;
  // A task that carries its OWN time counts down to THAT instant, not to the
  // end of the day (panel survey 2026-08-22, C3/I2-1). Counting a 9:00 task to
  // 23:59 produced "due in 14h" at 9:14am -- a number that was not merely
  // useless but false, and three personas said one wrong chip made them
  // distrust the correct ones. Only the dateless case means "by end of day".
  var end, deadlineMin=(timeStr&&timeStr.indexOf(':')>=0)?_hmToMin(timeStr):null;
  if(deadlineMin!=null){
    end=_anchoredInstantOf(dueStr,deadlineMin);
    if(!end)return null;
    var tmins=Math.floor((end.getTime()-now.getTime())/60000);
    // Past its time but still today: state the fact, calmly, and STOP. No
    // count-up of how late it is, no colour, no "overdue" -- the same rule
    // that makes a missed day return null below. "past 9a" is true and still
    // implies the day is not over; "3h LATE" is the pressure this app exists
    // not to apply.
    if(tmins<0)return 'past '+_shortTime(deadlineMin);
    if(tmins<1)return 'due now';
    if(tmins<60)return 'due in '+tmins+'m';
    return 'due in '+Math.floor(tmins/60)+'h';
  }
  end=_anchoredDayEndOf(dueStr);
  if(!end)return null;
  var mins=Math.floor((end.getTime()-now.getTime())/60000);
  if(mins<1)return 'due today';   // last minute of the day -- "due in 0m" reads as a countdown to a buzzer
  if(mins<60)return 'due in '+mins+'m';
  return 'due in '+Math.floor(mins/60)+'h';
}

// R7 stage 4: shared date-grouping bucket for Tasks/Reminders' full-list
// view (Overdue/Today/Tomorrow/This week/Later/No date). "This week" reuses
// the same +7-day boundary as the overdue triage bar's "snooze a week"
// (_tlPlusDays in legacy.js) so the app has one meaning of "a week", not two.
// todayS/tomorrowS/weekEndS are precomputed by the caller once per render,
// not per row.
function _dateGroupInfo(dateStr,todayS,tomorrowS,weekEndS){
  if(!dateStr)return {key:'none',label:'No date'};
  if(dateStr<todayS)return {key:'overdue',label:'Overdue'};
  if(dateStr===todayS)return {key:'today',label:'Today'};
  if(dateStr===tomorrowS)return {key:'tomorrow',label:'Tomorrow'};
  if(dateStr<=weekEndS)return {key:'week',label:'This week'};
  return {key:'later',label:'Later'};
}

// ═══════════════════════════════════════════════════════════════════
// CROSS-DEVICE FOCUS TIMER (2026-08-21)
//
// The focus timer used to live entirely as bare in-memory JS variables, so it
// could not cross devices at all. state.focusTimer syncs it through the same
// Firestore blob everything else rides.
//
// The ONE rule that makes this work, and the same one that fixed the watch
// bug: the synced record stores `endAt`, an ABSOLUTE instant -- never a
// countdown value. Every device derives its own remaining time from it, so
// the timer never has to write on its tick. Only start/pause/reset/preset/
// complete write, four or five times a session instead of twice a second.
//
// This decision function is pure and lives here so it can be unit-tested
// without a DOM (test/sync-merge.test.mjs). It answers one question: given
// what this device is currently showing and what just arrived from the cloud,
// should the local timer be replaced?
//
// `local` and `remote` are both state.focusTimer shapes (or null):
//   { sessionId, running, endAt, total, presetIdx, awardedSessionId }
function _shouldAdoptRemoteTimer(local, remote){
  if(!remote || typeof remote!=='object') return false;   // nothing to adopt
  if(!remote.sessionId) return false;                     // malformed
  if(!local || typeof local!=='object') return true;      // nothing local -- take it
  // A different session always wins: whichever device most recently pressed
  // start/reset defines the current run, and save()'s _updatedAt transaction
  // guard already stopped a stale write from becoming the cloud copy.
  if(remote.sessionId !== local.sessionId) return true;
  // Same session: adopt only if a FIELD THAT MATTERS actually differs.
  // Without this, every unrelated snapshot echo (a note edit, a task toggle)
  // would re-apply the timer and restart its interval for nothing.
  if(!!remote.running !== !!local.running) return true;
  if((remote.endAt||0) !== (local.endAt||0)) return true;
  if((remote.total||0) !== (local.total||0)) return true;
  // awardedSessionId changing means another device already granted the points
  // for this run -- worth adopting so this device doesn't grant them again.
  if((remote.awardedSessionId||'') !== (local.awardedSessionId||'')) return true;
  return false;
}

// Has this run already finished, as of `now`? Used to land a session that
// expired while every device was closed on a silent idle state -- no alarm, no
// points, no "Done!" for something that ended last Tuesday.
function _timerSessionExpired(t, now){
  if(!t || !t.running) return false;
  var end = t.endAt || 0;
  if(!end) return false;
  return end <= (now || Date.now());
}

// Test-only export (no-op in the browser, where `module` is undefined).
if(typeof module!=='undefined' && module.exports){
  module.exports = { todayStr, fmtDate, fmtTime, _shortTime, _hmToMin, _dayKey, _monthKey, _dateGroupInfo, _dueCountdownLabel,
                     setDayAnchorMinutes, getDayAnchorMinutes, _anchoredNow, _anchoredDayKey, _anchoredDayEnd, _anchoredDayEndOf,
                     _anchoredInstantOf, _shouldAdoptRemoteTimer, _timerSessionExpired };
}
