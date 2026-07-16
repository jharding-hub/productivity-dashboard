// ═══════════════════════════════════════════════════════════════════
// Centerpost — CSV formatting/download utilities (R18 extraction)
// Pure functions: take data in, produce a CSV string or trigger a blob
// download. The state-reading orchestrators (_exportCheckinsCSV etc.) stay
// in legacy.js since they need direct access to the live state object --
// only this formatting layer underneath is self-contained enough to move.
// _checkinDetail references HALT_ITEMS (a data array in legacy.js) only at
// CALL time, well after legacy.js has loaded, so load order is safe here
// same as the other extracted files.
// ═══════════════════════════════════════════════════════════════════

function _csvEsc(v){
  v=(v===null||v===undefined)?'':String(v);
  if(/[",\n]/.test(v))return '"'+v.replace(/"/g,'""')+'"';
  return v;
}
function _csvRows(rows){return rows.map(function(r){return r.map(_csvEsc).join(',');}).join('\r\n');}
function downloadCSV(fn,csv){
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var u=URL.createObjectURL(b);
  var a=document.createElement('a');
  a.href=u;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(u);
}
function _checkinDetail(c){
  if(c.type==='halt'){
    var labels=(c.items||[]).map(function(k){var it=HALT_ITEMS.find(function(i){return i.key===k;});return it?it.label:k;});
    return labels.join('; ');
  }
  if(c.type==='breath')return (c.techniqueName||'')+(c.cycles?' ('+c.cycles+' cycles)':'');
  if(c.type==='grounding')return c.techniqueName||'';
  if(c.type==='urge'){
    var parts=[c.urgeLabel||c.urgeType||''];
    if(c.note)parts.push('note: '+c.note);
    parts.push(c.delayMinutes+' min delay');
    parts.push(c.outcome==='passed'?'urge passed':'did it anyway');
    return parts.join('; ');
  }
  return '';
}
