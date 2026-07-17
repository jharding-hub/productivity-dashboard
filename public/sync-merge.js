// ═══════════════════════════════════════════════════════════════════
// Centerpost — tombstone-aware sync reconciliation
// Pure functions, zero dependency on app state, the DOM, or Firestore.
// Loaded before legacy.js (same as date-utils.js/quick-add-parser.js) so
// these are already global by the time load()/onSnapshot call them.
//
// WHY THIS EXISTS
//   The whole dashboard is one JSON blob in a single Firestore doc, and
//   every save() overwrites the whole field. The old reconciliation kept
//   "whichever side had MORE array items" — which structurally cannot
//   represent a deletion: a delete/complete SHORTENS the array, and a
//   shorter array always lost to a stale client still holding the longer
//   pre-delete copy. That resurrected dismissed reminders and un-completed
//   tasks across devices.
//
//   The fix: deletion and completion are recorded as durable, synced FACTS
//   in a grow-only tombstone map (state._tombstones = { id: deletedAtISO }),
//   never as the mere absence of an item. Reconciliation unions the two
//   sides' item arrays by id (so concurrent adds on different devices both
//   survive) and then drops any id present in the unioned tombstone map.
//   A tombstone is clock-independent — presence means gone — so a stale
//   client can never win it back regardless of its device clock.
// ═══════════════════════════════════════════════════════════════════

// Newest known modification time of an item, for last-write-wins on
// concurrent EDITS (not deletions — those go through the tombstone map).
// Missing timestamps read as 0 (oldest), so a stamped edit beats an unstamped
// legacy copy.
function _syncItemTime(it){
  if(!it) return 0;
  var t=0, keys=['updatedAt','archivedAt','created'];
  for(var i=0;i<keys.length;i++){
    var v=it[keys[i]];
    if(v){ var ms=Date.parse(v); if(ms>t) t=ms; }
  }
  return t;
}

// Merge two arrays of {id,...} by id. UNION: an id present on either side
// survives (concurrent adds don't clobber each other). On a shared id, the
// copy with the newer modification time wins; exact ties keep the cloud copy
// (deterministic). Order: cloud order first, then local-only ids appended.
function mergeById(localArr, cloudArr){
  localArr = Array.isArray(localArr) ? localArr : [];
  cloudArr = Array.isArray(cloudArr) ? cloudArr : [];
  var byId = Object.create(null), order = [];
  function add(it){
    if(!it || it.id==null) return;
    var id = it.id;
    if(!(id in byId)){ byId[id]=it; order.push(id); return; }
    // Later, strictly-newer edit wins; ties keep whatever is already there
    // (cloud, since cloud is added first).
    if(_syncItemTime(it) > _syncItemTime(byId[id])) byId[id]=it;
  }
  cloudArr.forEach(add);
  localArr.forEach(add);
  return order.map(function(id){ return byId[id]; });
}

// Union two tombstone maps { id: deletedAtISO }. Grow-only; on a shared id the
// EARLIEST recorded time is kept (accurate for a future age-based purge).
function mergeTombstones(a, b){
  var out = Object.create(null);
  var k;
  a = a || {}; b = b || {};
  for(k in a){ if(Object.prototype.hasOwnProperty.call(a,k)) out[k]=a[k]; }
  for(k in b){
    if(!Object.prototype.hasOwnProperty.call(b,k)) continue;
    if(!(k in out) || String(b[k]) < String(out[k])) out[k]=b[k];
  }
  return out;
}

function _dropTombstoned(arr, tomb){
  arr = Array.isArray(arr) ? arr : [];
  return arr.filter(function(it){ return !(it && tomb[it.id]); });
}

// Merge project arrays by id, and for each project that exists on BOTH sides,
// deep-merge its subtasks by id so a subtask added on one device and one
// completed on another both reconcile correctly. Tombstoned subtasks are
// dropped from every project.
function mergeProjects(localArr, cloudArr, tomb){
  var localById = Object.create(null), cloudById = Object.create(null);
  (Array.isArray(localArr)?localArr:[]).forEach(function(p){ if(p&&p.id!=null) localById[p.id]=p; });
  (Array.isArray(cloudArr)?cloudArr:[]).forEach(function(p){ if(p&&p.id!=null) cloudById[p.id]=p; });
  return mergeById(localArr, cloudArr).map(function(p){
    var lp = localById[p.id], cp = cloudById[p.id];
    var subs = (lp && cp) ? mergeById(lp.subtasks, cp.subtasks) : (p.subtasks || []);
    return Object.assign({}, p, { subtasks: _dropTombstoned(subs, tomb) });
  });
}

// Array fields whose deletions/completions are tracked by the tombstone map.
var SYNC_ACTIVE_ARRAYS = ['reminders','tasks','notes','thoughts'];
// Append-mostly archive arrays: union by id so an entry added on one device
// isn't dropped by a stale write, but NOT tombstone-filtered (a completed
// task's id lives in _tombstones yet its archive record must remain visible).
var SYNC_UNION_ARRAYS = ['completedTasks','completedProjects','completedWorkouts'];

// Reconcile a local state snapshot against a cloud snapshot. Returns ONLY the
// fields it owns (the synced arrays + the merged tombstone map) for the caller
// to Object.assign onto state. Pure — never mutates its inputs.
function reconcileSync(local, cloud){
  local = local || {}; cloud = cloud || {};
  var tomb = mergeTombstones(local._tombstones, cloud._tombstones);
  var out = { _tombstones: tomb };
  SYNC_ACTIVE_ARRAYS.forEach(function(k){
    out[k] = _dropTombstoned(mergeById(local[k], cloud[k]), tomb);
  });
  out.projects = mergeProjects(local.projects, cloud.projects, tomb);
  SYNC_UNION_ARRAYS.forEach(function(k){
    if(Array.isArray(local[k]) || Array.isArray(cloud[k])){
      out[k] = mergeById(local[k], cloud[k]);
    }
  });
  return out;
}

// Test-only export. `module` is undefined in the browser, so this is a no-op
// there; under Node's CommonJS loader it exposes the pure functions for
// test/sync-merge.test.mjs.
if(typeof module!=='undefined' && module.exports){
  module.exports = { _syncItemTime, mergeById, mergeTombstones, _dropTombstoned, mergeProjects, reconcileSync, SYNC_ACTIVE_ARRAYS, SYNC_UNION_ARRAYS };
}
