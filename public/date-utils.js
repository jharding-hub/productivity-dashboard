// ═══════════════════════════════════════════════════════════════════
// Centerpost — date/time formatting helpers (R18 extraction)
// Pure functions, zero dependency on app state or the DOM. Loaded before
// legacy.js (same as config.js/journal-crypto.js/quick-add-parser.js) so
// these are already global by the time anything calls them.
// ═══════════════════════════════════════════════════════════════════

function todayStr(){var d=new Date();var pad=function(n){return n<10?'0'+n:''+n;};return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function fmtTime(t){const[h,m]=t.split(':');const hr=parseInt(h);return(hr>12?hr-12:hr||12)+':'+m+(hr>=12?' PM':' AM');}
function _hmToMin(hm){var a=(hm||'').split(':');return (parseInt(a[0],10)||0)*60+(parseInt(a[1],10)||0);}
function _dayKey(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _monthKey(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}

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
function _dueCountdownLabel(dueStr,now){
  if(!dueStr)return null;
  now=now||new Date();
  // _dayKey(now), not a raw comparison: this is the ONE place the countdown
  // decides which day "today" is, so it inherits whatever _dayKey means.
  if(dueStr!==_dayKey(now))return null;
  var end=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999);
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

// Test-only export (no-op in the browser, where `module` is undefined).
if(typeof module!=='undefined' && module.exports){
  module.exports = { todayStr, fmtDate, fmtTime, _hmToMin, _dayKey, _monthKey, _dateGroupInfo, _dueCountdownLabel };
}
