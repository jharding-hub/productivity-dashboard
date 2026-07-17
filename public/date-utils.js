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

// Test-only export (no-op in the browser, where `module` is undefined).
if(typeof module!=='undefined' && module.exports){
  module.exports = { todayStr, fmtDate, fmtTime, _hmToMin, _dayKey, _monthKey };
}
