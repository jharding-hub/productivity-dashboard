// ═══════════════════════════════════════════════════════════════════
// Centerpost — inline-edit layer
// Extracted from legacy.js (R18 slice) so its DOM behavior is unit-testable
// (test/inline-edit.test.mjs). Loaded as a plain <script> before legacy.js,
// same as sync-merge.js/date-utils.js, so every symbol below is a global the
// legacy call sites resolve unchanged. Under Node's CommonJS loader the guard
// at the bottom exports these for tests; in the browser it's a no-op.
//
// WHY THIS IS ITS OWN FILE
//   Two shipped bugs lived here and were caught only in real use (no DOM-level
//   tests existed): (1) inline edits wired via a bare document.getElementById
//   grabbed the wrong cell when the Today and Everything views rendered rows
//   with duplicate ids; (2) an open date/time picker was destroyed by a panel
//   re-render because the edit guard only protected contenteditable text, not
//   the transient <input>. Both fixes live in this layer, so this layer is
//   exactly what needs a regression harness.
// ═══════════════════════════════════════════════════════════════════

// INLINE EDITING
//
// Guards list-panel re-renders (projects/reminders/tasklist/thoughts) against
// wiping an open inline edit. The Firestore realtime listener rebuilds every
// panel's innerHTML on each snapshot (including the echo of our own saves);
// without this, a snapshot landing mid-edit destroys the focused .editable
// element and drops whatever the user was mid-typing. makeEditable() is the one
// shared entry point every panel's inline text edits go through.
var _panelRenderPending={};
// Map of containerId -> a function that re-renders that panel. Populated by the
// app (legacy.js) via _registerPanelRenderers() so this module stays free of
// any hard dependency on legacy's render functions -- which also lets tests
// inject spies and exercise the defer/flush mechanism in isolation.
var _PANEL_RENDER_FNS={};
function _registerPanelRenderers(map){ _PANEL_RENDER_FNS=map||{}; }

// While a date/time picker is open, this holds its cell element. A picker is a
// transient <input> injected into a list row; any panel re-render (esp. the
// Firestore onSnapshot echo) rebuilds that row's innerHTML and destroys the
// input mid-interaction -- the picker "closes on its own" before the user can
// pick. Guarding on document.activeElement (as the contenteditable path does)
// is unreliable for a native date wheel, which can blur the input while its
// overlay is up; an explicit flag, cleared exactly at commit, is robust.
var _dateEditActive=null;
function _isEditingInPanel(containerId){
  var c=document.getElementById(containerId);
  if(_dateEditActive&&c&&c.contains(_dateEditActive))return true;
  var ae=document.activeElement;
  if(!ae||!ae.classList||!ae.classList.contains('editable'))return false;
  return !!(c&&c.contains(ae));
}
function _deferPanelRender(containerId){_panelRenderPending[containerId]=true;}
function _flushPendingPanelRenders(){
  Object.keys(_PANEL_RENDER_FNS).forEach(function(id){
    if(_panelRenderPending[id]){_panelRenderPending[id]=false;_PANEL_RENDER_FNS[id]();}
  });
}
function makeEditable(el,onSave){
  el.classList.add('editable');
  el.addEventListener('blur',function(){onSave(el.textContent.trim());_flushPendingPanelRenders();});
  el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();el.blur();}if(e.key==='Escape')el.blur();});
}
function refreshEditables(){
  // Editables are ALWAYS editable now. The "lock" only affects panel drag-drop, not content edits.
  document.querySelectorAll('.editable').forEach(function(el){
    el.setAttribute('contenteditable','true');
  });
}
function makeDateClickable(el,currentVal,onSave){
  el.addEventListener('click',function(e){
    e.stopPropagation();
    if(el.querySelector('input.date-edit-input')) return;
    var inp=document.createElement('input');
    inp.type='date';inp.className='date-edit-input';
    inp.value=currentVal||'';
    el.innerHTML='';el.appendChild(inp);
    _dateEditActive=el; // suspend panel re-renders until commit (see _isEditingInPanel)
    inp.focus();
    var committed=false;
    function commit(){ if(committed) return; committed=true; _dateEditActive=null; onSave(inp.value); _flushPendingPanelRenders(); }
    inp.addEventListener('blur',commit);
    inp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); inp.blur(); } });
  });
}
function makeTimeClickable(el,currentVal,onSave){
  el.addEventListener('click',function(e){
    e.stopPropagation();
    if(el.querySelector('input.date-edit-input')) return;
    var inp=document.createElement('input');
    inp.type='time';inp.className='date-edit-input';inp.style.width='100px';
    inp.value=currentVal||'';
    el.innerHTML='';el.appendChild(inp);
    _dateEditActive=el; // suspend panel re-renders until commit (see _isEditingInPanel)
    inp.focus();
    var committed=false;
    function commit(){ if(committed) return; committed=true; _dateEditActive=null; onSave(inp.value); _flushPendingPanelRenders(); }
    inp.addEventListener('blur',commit);
    inp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); inp.blur(); } });
  });
}

// Test-only export. `module` is undefined in the browser (no-op there); under
// Node's CommonJS loader this exposes the layer for test/inline-edit.test.mjs.
// _getDateEditActive/_resetInlineEditState exist only to observe/reset the
// module-scoped state between test cases.
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    makeEditable, makeDateClickable, makeTimeClickable, refreshEditables,
    _isEditingInPanel, _deferPanelRender, _flushPendingPanelRenders, _registerPanelRenderers,
    _getDateEditActive: function(){ return _dateEditActive; },
    _resetInlineEditState: function(){ _dateEditActive=null; _panelRenderPending={}; _PANEL_RENDER_FNS={}; }
  };
}
