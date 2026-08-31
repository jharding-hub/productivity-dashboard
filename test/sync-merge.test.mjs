// Tombstone-merge + date-handling tests for the reminder/task resurrection fix.
// Pure logic — no browser, no Firestore emulator. Run: npm run test:sync
//
// TZ is pinned to a UTC-5 zone BEFORE any Date/Intl use so the timezone test
// is deterministic on any machine.
process.env.TZ = 'America/New_York';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { mergeById, mergeTombstones, reconcileSync, _dropTombstoned, reconcileLifetimeCounter,
        mergeDeviceHeartbeats, DEVICE_HEARTBEAT_MAX, mergeProjects } = require('../public/sync-merge.js');
const DU = require('../public/date-utils.js');
const { fmtDate, _dueCountdownLabel, setDayAnchorMinutes, getDayAnchorMinutes,
        _anchoredNow, _anchoredDayKey, _anchoredDayEnd, todayStr, _dayKey, _monthKey,
        _shouldAdoptRemoteTimer, _timerSessionExpired } = DU;

// The OLD reconciliation, copied verbatim in spirit from load() lines 725-731,
// so each test can show the bug it fixed: "keep whichever array is longer".
function legacyKeepLonger(localState, cloudState){
  const merged = Object.assign({}, localState, cloudState);
  ['reminders','tasks','notes','thoughts'].forEach(function(key){
    const localArr = localState[key], cloudArr = cloudState[key];
    if(Array.isArray(localArr) && (!Array.isArray(cloudArr) || localArr.length > cloudArr.length)){
      merged[key] = localArr;
    }
  });
  return merged;
}

const rem = (id, extra={}) => Object.assign({ id, text: id, date:'', time:'' }, extra);

// ── 1. Two clients; A deletes X; stale B writes an unrelated change ──────────
test('deleted reminder stays deleted when a stale client writes', () => {
  // Both clients start holding the same three reminders.
  const start = [rem('X'), rem('Y'), rem('Z')];

  // Client A dismisses X → removed from the array AND recorded as a tombstone.
  const A = { reminders: start.filter(r => r.id !== 'X'),
              _tombstones: { X: '2026-07-17T12:00:00.000Z' } };
  const cloudAfterA = A; // A saved to the cloud.

  // Sanity: the OLD heuristic resurrects X (this is the shipped bug).
  const staleB = { reminders: start.slice() }; // B never saw the delete
  const legacyMerged = legacyKeepLonger(staleB, cloudAfterA); // local(3) > cloud(2)
  assert.ok(legacyMerged.reminders.some(r => r.id === 'X'),
    'old heuristic should (wrongly) resurrect X — proves the bug');

  // NEW: B reconciles against the cloud. X must not come back.
  const reconciled = reconcileSync(staleB, cloudAfterA);
  assert.deepEqual(reconciled.reminders.map(r => r.id), ['Y','Z']);
  assert.ok(reconciled._tombstones.X, 'tombstone for X carries forward');

  // B now makes an unrelated edit (edits Y) and saves the reconciled state.
  const bAfter = Object.assign({}, staleB, reconciled);
  bAfter.reminders = bAfter.reminders.map(r => r.id==='Y' ? rem('Y',{text:'edited'}) : r);

  // A reloads against B's write — still no X.
  const roundTrip = reconcileSync(A, bAfter);
  assert.ok(!roundTrip.reminders.some(r => r.id === 'X'), 'X does not resurrect on round-trip');
});

// ── 2. Same, for completion state (completedProjects — a still-in-blob union
//      array; completedTasks moved to its own doc in F3, covered separately) ──
test('completed archive record stays put when a stale client still holds it', () => {
  const subs = [{id:'t1',name:'a',done:false}, {id:'t2',name:'b',done:false}];

  // Client A completes t1: removed from active items, archived, tombstoned.
  const A = {
    tasks: subs.filter(t => t.id !== 't1'),
    completedProjects: [{ id:'t1', name:'a', archivedAt:'2026-07-17T12:00:00.000Z', source:'project' }],
    _tombstones: { t1: '2026-07-17T12:00:00.000Z' },
  };
  const staleB = { tasks: subs.slice(), completedProjects: [] };

  const reconciled = reconcileSync(staleB, A);
  assert.deepEqual(reconciled.tasks.map(t => t.id), ['t2'], 't1 does not return to the active list');
  assert.ok(reconciled.completedProjects.some(t => t.id === 't1'), 'archive record is preserved');
});

// ── Lifetime completion counter: seed, monotonicity, and poisoned-zero heal ──
// The green "✓ N" badge reads a lifetime counter, not the 100-capped archive
// array. reconcileLifetimeCounter reconciles it on every load.
test('lifetime counter seeds from the archive array for a pre-counter doc', () => {
  // Old own-doc has 100 archived items but no `lifetime` field yet (undefined).
  // The array length is the floor, so the badge starts at 100, not 0.
  assert.equal(reconcileLifetimeCounter(undefined, undefined, 100), 100);
});

test('lifetime counter self-heals a persisted 0 (the badge-stuck-at-100/0 bug)', () => {
  // THE REGRESSION: a save fired before the counter was seeded and wrote
  // `lifetime: 0` into the doc. The old `=== undefined` seed guard then never
  // re-fired (0 is defined), pinning the badge at 0 across every reload.
  // With the array (100 items) as a floor, the counter recovers to 100.
  assert.equal(reconcileLifetimeCounter(undefined, 0, 100), 100,
    'a poisoned lifetime:0 must not survive when 100 items are in the archive');
  assert.equal(reconcileLifetimeCounter(0, 0, 100), 100,
    'even with 0 already in memory, the array floor drags it back up');
});

test('lifetime counter is monotonic and preserves a real synced total', () => {
  // A genuine total higher than the (capped) array must win and never shrink.
  assert.equal(reconcileLifetimeCounter(0, 250, 100), 250, 'a real synced 250 beats the 100-item floor');
  assert.equal(reconcileLifetimeCounter(250, 100, 100), 250, 'an in-memory 250 is not rolled back by a lower doc/floor');
  // Clearing archive items (array shrinks) does NOT decrement the lifetime.
  assert.equal(reconcileLifetimeCounter(250, 250, 50), 250, 'removing archived items leaves the lifetime total intact');
});

test('lifetime counter never regresses below what a fresh completion just set', () => {
  // Complete-then-stale-snapshot: memory is 101, an older doc still says 100.
  assert.equal(reconcileLifetimeCounter(101, 100, 100), 101);
});

// ── 2b. Completed SUBTASK inside a project doesn't re-appear ─────────────────
test('completed subtask is not resurrected by a stale project copy', () => {
  const proj = { id:'p1', name:'Proj', subtasks:[
    {id:'s1',name:'one',done:false}, {id:'s2',name:'two',done:false} ]};

  const A = {
    projects: [ Object.assign({}, proj, { subtasks: proj.subtasks.filter(s=>s.id!=='s1') }) ],
    _tombstones: { s1: '2026-07-17T12:00:00.000Z' },
  };
  const staleB = { projects: [ JSON.parse(JSON.stringify(proj)) ] }; // still has s1

  const reconciled = reconcileSync(staleB, A);
  const subs = reconciled.projects[0].subtasks.map(s => s.id);
  assert.deepEqual(subs, ['s2'], 's1 stays completed even though B still holds it');
});

// ── 3. A clock-skewed stale write does not win over the delete ──────────────
test('a 5-min-fast stale client cannot out-timestamp a deletion', () => {
  // Deletion is clock-INDEPENDENT: presence in the tombstone map means gone,
  // no matter what the stale client's clock says.
  const A = { reminders: [rem('Y')], _tombstones: { X: '2026-07-17T12:00:00.000Z' } };

  // B's clock is 5 minutes fast; it re-writes the stale X with a "newer" stamp.
  const fast = new Date(Date.now() + 5*60*1000).toISOString();
  const staleB = { reminders: [ rem('X', {updatedAt: fast}), rem('Y') ] };

  const reconciled = reconcileSync(staleB, A);
  assert.ok(!reconciled.reminders.some(r => r.id === 'X'),
    'fast clock does not resurrect a tombstoned item');

  // And for genuine concurrent EDITS (no deletion), the newer updatedAt wins.
  const older = mergeById(
    [rem('E', {text:'old', updatedAt:'2026-07-17T10:00:00.000Z'})],
    [rem('E', {text:'new', updatedAt:'2026-07-17T11:00:00.000Z'})]);
  assert.equal(older.find(r=>r.id==='E').text, 'new');
});

// ── 4. Offline delete, then reconnect ───────────────────────────────────────
test('an offline deletion survives reconnect', () => {
  // While A is offline it deletes X. The cloud (from another device) still
  // holds all three. On reconnect the realtime snapshot delivers the cloud doc.
  const offlineA = { reminders: [rem('Y'), rem('Z')],
                     _tombstones: { X: '2026-07-17T12:00:00.000Z' } };
  const cloud = { reminders: [rem('X'), rem('Y'), rem('Z')] };

  const reconciled = reconcileSync(offlineA, cloud);
  assert.ok(!reconciled.reminders.some(r => r.id === 'X'), 'the offline delete is not undone');
});

// ── 5. A past-due, dismissed reminder does not render ───────────────────────
test('a dismissed past-due reminder is excluded after reconcile', () => {
  const past = rem('OLD', { date: '2026-05-28' });
  const cloud = { reminders: [past, rem('Y')] };
  const localDismissed = { reminders: [rem('Y')],
                           _tombstones: { OLD: '2026-07-17T12:00:00.000Z' } };

  const reconciled = reconcileSync(localDismissed, cloud);
  assert.ok(!reconciled.reminders.some(r => r.id === 'OLD'),
    'the May 28 reminder does not come back on Jul 17');
});

// ── 6. Timezone: local-midnight reminder renders on the intended local date ──
test('fmtDate renders the intended local date in a UTC-5 zone', () => {
  // A reminder due 2026-07-17 (local). The naive `new Date('2026-07-17')`
  // parses as UTC midnight, which in America/New_York is the evening of the
  // 16th — the classic off-by-one. date-utils.fmtDate anchors at LOCAL midnight
  // and must render the 17th.
  const naiveTrap = new Date('2026-07-17').toLocaleDateString('en-US',
    { month:'short', day:'numeric', year:'numeric' });
  assert.equal(naiveTrap, 'Jul 16, 2026', 'demonstrates the UTC-parse off-by-one');

  assert.equal(fmtDate('2026-07-17'), 'Jul 17, 2026', 'fmtDate has no off-by-one');
});

// ── Concurrent adds on two devices both survive (bonus, guards a regression) ─
test('concurrent adds on different devices are both kept', () => {
  const A = { reminders: [rem('base'), rem('addedOnA')] };
  const B = { reminders: [rem('base'), rem('addedOnB')] };
  const reconciled = reconcileSync(A, B);
  const ids = reconciled.reminders.map(r => r.id).sort();
  assert.deepEqual(ids, ['addedOnA','addedOnB','base'],
    'the old keep-longer heuristic would have dropped one of these');
});

// ── 7. A cleared history entry (removeCompleted) stays gone across a stale write ─
test('a removed completed-project history entry does not resurrect', () => {
  // Both devices hold two archive records. Device A clears t1 from history:
  // filtered out AND recorded in the SEPARATE _archiveTombstones map (not
  // _tombstones — see removeCompleted / _archiveTombstone in legacy.js).
  const both = [
    { id:'t1', name:'a', archivedAt:'2026-07-17T10:00:00.000Z', source:'project' },
    { id:'t2', name:'b', archivedAt:'2026-07-17T11:00:00.000Z', source:'project' },
  ];
  const A = {
    completedProjects: both.filter(t => t.id !== 't1'),
    _archiveTombstones: { t1: '2026-07-17T12:00:00.000Z' },
  };
  const staleB = { completedProjects: both.slice() }; // B never saw the removal

  const reconciled = reconcileSync(staleB, A);
  assert.deepEqual(reconciled.completedProjects.map(t => t.id), ['t2'],
    'the cleared archive record does not come back from a stale client');
  assert.ok(reconciled._archiveTombstones.t1, 'archive tombstone carries forward');
});

// ── 7b. Archiving a project must tombstone it, or a stale device duplicates it ──
// (Projects-panel investigation, 2026-08-30.) Before this fix, markProjectComplete
// filtered state.projects and pushed to completedProjects but never called
// _tombstone -- so mergeProjects' union brought the project straight back into
// the active list on any device that was offline/backgrounded for the archive,
// while the archive copy ALSO survived. The project rendered in both lists.
test('an archived project stays out of the active list when a stale client still holds it', () => {
  const proj = { id:'p1', name:'Ultrasound', due:'', subtasks:[] };
  const A = {
    projects: [],
    completedProjects: [{ id:'p1', name:'Ultrasound', archivedAt:'2026-08-30T12:00:00.000Z', subtasks:[] }],
    _tombstones: { p1: '2026-08-30T12:00:00.000Z' },
  };
  const staleB = { projects: [ JSON.parse(JSON.stringify(proj)) ], completedProjects: [] };

  const reconciled = reconcileSync(staleB, A);
  assert.deepEqual(reconciled.projects.map(p => p.id), [],
    'the archived project does not resurrect into the active list');
  assert.deepEqual(reconciled.completedProjects.map(p => p.id), ['p1'],
    'the archive record is the only surviving copy');
});

// ── 7c. Restoring an archived project must not resurrect under the tombstoned id ──
test('a restored project lives under a fresh id and its old archive record stays cleared', () => {
  // Same rule as the reminder-restore case: the archived id is permanently in
  // _tombstones (grow-only), so restoreProject mints a fresh id. Pin down that
  // a restore staying under the OLD id would be re-dropped by mergeProjects,
  // and that the archive record itself is cleared via _archiveTombstones so a
  // stale archive doc can't bring the old record back either.
  const tomb = { p1: '2026-08-30T12:00:00.000Z' };
  const staleRestoreUnderOldId = { projects: [{ id:'p1', name:'Ultrasound', subtasks:[] }] };
  const cloudNoProjects = { projects: [] };
  const wronglyRestored = reconcileSync(staleRestoreUnderOldId, cloudNoProjects);
  assert.deepEqual(mergeProjects(wronglyRestored.projects, [], tomb).map(p => p.id), [],
    'restoring under the tombstoned id would be dropped on the very next reconcile');

  const restoredUnderFreshId = { projects: [{ id:'p1-restored', name:'Ultrasound', subtasks:[] }] };
  const stillActive = mergeProjects(restoredUnderFreshId.projects, [], tomb);
  assert.deepEqual(stillActive.map(p => p.id), ['p1-restored'], 'a fresh id survives the tombstone filter');

  const archiveTomb = { p1: '2026-08-30T13:00:00.000Z' };
  const staleArchive = _dropTombstoned(mergeById([], [{ id:'p1', name:'Ultrasound' }]), archiveTomb);
  assert.equal(staleArchive.length, 0, 'old archive record does not resurrect after restore');
});

// ── 8. The live-item tombstone must NOT wipe a fresh archive record ─────────
test('a just-completed archive record survives even though its id is tombstoned', () => {
  // This is the whole reason _archiveTombstones is a separate map: completing
  // t1 puts its id in _tombstones (so the LIVE item stays gone) while the
  // archive record REUSES that same id. If the union arrays were filtered by
  // _tombstones, the archive record would vanish the instant it was created.
  const A = {
    tasks: [{ id:'t2', name:'b', done:false }],
    completedProjects: [{ id:'t1', name:'a', archivedAt:'2026-07-17T12:00:00.000Z', source:'project' }],
    _tombstones: { t1: '2026-07-17T12:00:00.000Z' }, // completion tombstone
    _archiveTombstones: {},                          // NOT removed from history
  };
  const staleB = { tasks: [{ id:'t1', name:'a', done:false }, { id:'t2', name:'b', done:false }], completedProjects: [] };

  const reconciled = reconcileSync(staleB, A);
  assert.ok(!reconciled.tasks.some(t => t.id === 't1'), 't1 stays out of the active list');
  assert.ok(reconciled.completedProjects.some(t => t.id === 't1'),
    'the archive record is NOT wiped by the live-item tombstone');
});

// ── 8b. F3: completedTasks moved to its own doc; its load reconcile uses the
//        same helpers (_dropTombstoned(mergeById(local, cloud), archiveTomb) —
//        see _loadCompletedTasksDoc). Verify it keeps the same two guarantees. ─
test('completedTasks own-doc load reconcile: removed stays removed, concurrent adds survive', () => {
  // removed-stays-removed: local cleared t1 (archiveTombstone set); the cloud
  // doc is stale and still holds t1. The load reconcile must drop it.
  const local = [{ id:'t2', name:'b' }];
  const cloudDoc = [{ id:'t1', name:'a' }, { id:'t2', name:'b' }];
  const archiveTomb = { t1: '2026-07-17T12:00:00.000Z' };
  const merged = _dropTombstoned(mergeById(local, cloudDoc), archiveTomb);
  assert.deepEqual(merged.map(t => t.id).sort(), ['t2'], 't1 stays removed on load');

  // concurrent adds: device A archived t3 locally, device B's cloud doc has t4;
  // union keeps both.
  const localA = [{ id:'t3', name:'c' }];
  const cloudB = [{ id:'t4', name:'d' }];
  const both = _dropTombstoned(mergeById(localA, cloudB), {});
  assert.deepEqual(both.map(t => t.id).sort(), ['t3', 't4'], 'both completions survive');
});

// ── mergeTombstones keeps the earliest time and is grow-only ────────────────
test('mergeTombstones unions and keeps the earliest time', () => {
  const m = mergeTombstones({ a:'2026-07-17T12:00:00.000Z', b:'2026-07-01T00:00:00.000Z' },
                            { a:'2026-07-18T12:00:00.000Z', c:'2026-07-02T00:00:00.000Z' });
  assert.equal(m.a, '2026-07-17T12:00:00.000Z', 'earliest deletion time wins');
  assert.deepEqual(Object.keys(m).sort(), ['a','b','c']);
});

// ── R7 (Ship-3) archive model: REMINDERS ARCHIVE ────────────────────────────
// Same own-doc recipe as completedTasks (see _loadRemindersArchiveDoc in
// legacy.js): archiving tombstones the live id + moves a record into the
// archive doc; the archive reconciles with mergeById + _archiveTombstones.
// These cases encode the contract that load/save plumbing must uphold.

test('archived reminder does not resurrect into active on a stale-client merge', () => {
  // Device A archived r1 (tombstoned + moved to the archive doc). A stale
  // device B write still holds r1 in its ACTIVE reminders array.
  const local = { reminders: [rem('r2')], _tombstones: { r1: '2026-07-31T08:00:00.000Z' } };
  const staleCloud = { reminders: [rem('r1'), rem('r2')], _tombstones: {} };
  const out = reconcileSync(local, staleCloud);
  assert.deepEqual(out.reminders.map(r => r.id), ['r2'], 'archived reminder stays out of active');
  // ...while the archive doc keeps its record even though that same id is in
  // the live-item tombstone map (records are filtered by _archiveTombstones
  // only -- the completedTasks pattern).
  const record = { id:'r1', text:'call dentist', archivedAt:'2026-07-31T08:00:00.000Z', reason:'done' };
  const archive = _dropTombstoned(mergeById([record], []), {});
  assert.equal(archive.length, 1, 'archive record survives its own live-item tombstone');
});

test('reminder archives from two devices union on load', () => {
  const localA = [{ id:'r1', text:'a', archivedAt:'2026-07-31T08:00:00.000Z', reason:'done' }];
  const cloudB = [{ id:'r2', text:'b', archivedAt:'2026-07-31T09:00:00.000Z', reason:'sweep' }];
  const merged = _dropTombstoned(mergeById(localA, cloudB), {});
  assert.deepEqual(merged.map(r => r.id).sort(), ['r1', 'r2'], 'both archives survive');
});

test('concurrent auto-sweeps of the same reminder converge to one record', () => {
  // Both devices swept r1 on the same rollover, seconds apart: same id, so the
  // union keeps ONE record, not a duplicate.
  const devA = [{ id:'r1', text:'x', archivedAt:'2026-08-08T00:01:00.000Z', reason:'sweep' }];
  const devB = [{ id:'r1', text:'x', archivedAt:'2026-08-08T00:02:00.000Z', reason:'sweep' }];
  const merged = mergeById(devA, devB);
  assert.equal(merged.length, 1, 'one archive record after concurrent sweeps');
  // Active side: both devices tombstoned r1; earliest time wins, id stays gone.
  const tomb = mergeTombstones({ r1:'2026-08-08T00:01:00.000Z' }, { r1:'2026-08-08T00:02:00.000Z' });
  assert.equal(tomb.r1, '2026-08-08T00:01:00.000Z', 'earliest sweep time kept');
  assert.deepEqual(_dropTombstoned([rem('r1')], tomb), [], 'r1 stays out of active');
});

test('a restored reminder lives under a fresh id and its old record stays cleared', () => {
  // Restore MUST mint a fresh id: the old id is permanently in _tombstones
  // (grow-only), so re-adding under it would be re-dropped by every future
  // reconcile. Under a fresh id the restored copy survives.
  const tomb = { r1: '2026-07-31T08:00:00.000Z' };
  const active = _dropTombstoned(mergeById([rem('r1-restored')], [rem('r1-restored')]), tomb);
  assert.deepEqual(active.map(r => r.id), ['r1-restored'], 'restored copy survives reconcile');
  // The archive record itself was archive-tombstoned on restore, so it cannot
  // come back from a stale archive doc either.
  const archiveTomb = { r1: '2026-07-31T10:00:00.000Z' };
  const staleArchive = _dropTombstoned(mergeById([], [{ id:'r1', text:'x' }]), archiveTomb);
  assert.equal(staleArchive.length, 0, 'old archive record does not resurrect');
});

// ── Archive sweep (panel survey Stage 6, A-9) ─────────────────────────────
// The sweep retires OLD data in two different arrays that are governed by two
// DIFFERENT tombstone maps. These cases pin that split down, because getting
// it backwards is silent: the items vanish locally and then merge straight
// back on the next load from any other device.

test('sweep: swept thoughts stay gone after a stale device merges its old copy back', () => {
  // Thoughts are live items (SYNC_ACTIVE_ARRAYS) -> the LIVE _tombstones map.
  const local = {
    thoughts: [{ id:'th2', text:'recent' }],
    _tombstones: { th1: '2026-08-19T12:00:00.000Z' },
  };
  // Stale device still holds the swept thought and knows nothing of the sweep.
  const cloud = {
    thoughts: [{ id:'th1', text:'ancient' }, { id:'th2', text:'recent' }],
    _tombstones: {},
  };
  const out = reconcileSync(local, cloud);
  assert.deepEqual(out.thoughts.map(t => t.id), ['th2'], 'swept thought does not resurrect');
});

test('sweep: swept completed-task records use the ARCHIVE map, not the live one', () => {
  // completedTasks records reuse the live item's id, which _tombstones already
  // holds from the original completion. If the sweep wrote to _tombstones, the
  // filter could not distinguish "this item was completed" from "this history
  // entry was cleared" -- so the split is load-bearing, not stylistic.
  const archiveTomb = mergeTombstones({ t1: '2026-08-19T12:00:00.000Z' }, {});
  const staleArchive = mergeById(
    [{ id:'t2', name:'recent', archivedAt:'2026-08-18T00:00:00.000Z' }],
    [{ id:'t1', name:'ancient', archivedAt:'2020-01-01T00:00:00.000Z' },
     { id:'t2', name:'recent',  archivedAt:'2026-08-18T00:00:00.000Z' }]
  );
  const kept = _dropTombstoned(staleArchive, archiveTomb);
  assert.deepEqual(kept.map(t => t.id), ['t2'], 'swept archive record does not resurrect');
});

test('sweep: clearing history does NOT drop the live item of the same id', () => {
  // The inverse guard: archive-tombstoning t1's HISTORY entry must leave a
  // live task that happens to carry id t1 alone, since the two maps are
  // consulted separately.
  const out = reconcileSync(
    { tasks: [{ id:'t1', name:'live task' }], _tombstones: {}, _archiveTombstones: { t1:'2026-08-19T12:00:00.000Z' } },
    { tasks: [{ id:'t1', name:'live task' }], _tombstones: {}, _archiveTombstones: {} }
  );
  assert.deepEqual(out.tasks.map(t => t.id), ['t1'], 'live task survives an archive-only tombstone');
});

test('sweep: lifetime counter is never reduced by trimming the archive array', () => {
  // The array has always been a capped recent SUBSET of all completions, so a
  // sweep shrinking it must not drag the lifetime total down with it.
  const afterSweep = reconcileLifetimeCounter(2200, 2200, 3);
  assert.equal(afterSweep, 2200, 'lifetime total survives a sweep down to 3 records');
});

// ── Large import round-trip (panel survey Stage 7, A-5) ───────────────────
// _importCommit (legacy.js) writes every imported task straight into
// state.tasks in one batch, exactly like any other locally-created task --
// there is no separate import code path in the sync layer. What matters here
// is that reconcileSync scales cleanly to a large single-device batch: every
// row survives a reconcile against an empty cloud (first sync after import),
// and then survives unchanged on the ROUND TRIP once that becomes the new
// cloud copy and a second device reconciles against it -- the Utilizer's
// explicit ask ("verify round-trip fidelity at 1,000+ rows").
function _makeImportBatch(n){
  const rows = [];
  for(let i=0;i<n;i++){
    rows.push({ id:'imp'+i, name:'Imported task '+i, due:'', time:'', priority:'med',
      timeEst:'', projectId:'', projectIds:[], done:false, recurrence:null });
  }
  return rows;
}

test('large import: 1,000 freshly-created tasks all survive reconciling against an empty cloud', () => {
  const batch = _makeImportBatch(1000);
  const local = { tasks: batch, _tombstones: {}, _archiveTombstones: {} };
  const cloud = { tasks: [], _tombstones: {}, _archiveTombstones: {} };

  const reconciled = reconcileSync(local, cloud);

  assert.equal(reconciled.tasks.length, 1000, 'no rows dropped');
  const ids = new Set(reconciled.tasks.map(t => t.id));
  assert.equal(ids.size, 1000, 'no id collisions introduced by the merge');
  assert.ok(batch.every(t => ids.has(t.id)), 'every imported row is present by id');
});

test('large import: round trip — the reconciled batch becomes the cloud copy and a second device reconciles against it losslessly', () => {
  const batch = _makeImportBatch(1000);
  const local = { tasks: batch, _tombstones: {}, _archiveTombstones: {} };
  const cloud = { tasks: [], _tombstones: {}, _archiveTombstones: {} };

  // First sync: the importing device pushes its batch up.
  const afterFirstSync = reconcileSync(local, cloud);

  // Second device had nothing locally, then pulls that as the new cloud copy.
  const secondDevice = { tasks: [], _tombstones: {}, _archiveTombstones: {} };
  const roundTrip = reconcileSync(secondDevice, Object.assign({}, cloud, afterFirstSync));

  assert.equal(roundTrip.tasks.length, 1000, 'round trip does not drop rows');
  // Field-for-field fidelity, not just count/id — a real "did the data
  // actually survive" check, not merely "did the array stay the same length".
  const byId = Object.create(null);
  roundTrip.tasks.forEach(t => { byId[t.id] = t; });
  batch.forEach(orig => {
    assert.deepEqual(byId[orig.id], orig, 'row '+orig.id+' is byte-for-byte unchanged after the round trip');
  });
});

test('large import: one completed task from the batch tombstones correctly and does not resurrect on a later sync from an untouched device', () => {
  const batch = _makeImportBatch(1000);
  const local = { tasks: batch, _tombstones: {}, _archiveTombstones: {} };
  const cloud = { tasks: [], _tombstones: {}, _archiveTombstones: {} };
  const afterImportSync = reconcileSync(local, cloud);

  // The importing device completes (removes + tombstones) row 500.
  const completedLocal = Object.assign({}, afterImportSync, {
    tasks: afterImportSync.tasks.filter(t => t.id !== 'imp500'),
    _tombstones: Object.assign({}, afterImportSync._tombstones, { imp500: '2026-08-19T12:00:00.000Z' }),
  });

  // A second device that only ever saw the ORIGINAL 1000-row import (never
  // the completion) reconciles against the completing device's cloud write.
  const staleSecondDevice = { tasks: batch, _tombstones: {}, _archiveTombstones: {} };
  const finalReconcile = reconcileSync(staleSecondDevice, completedLocal);

  assert.equal(finalReconcile.tasks.length, 999, 'the completed row does not resurrect');
  assert.ok(!finalReconcile.tasks.some(t => t.id === 'imp500'));
  assert.ok(finalReconcile._tombstones.imp500, 'tombstone for the completed import row carries forward');
});


// ── A-13 deadline countdown (panel survey Stage 9) ──────────────────────────
// TZ is pinned to America/New_York at the top of this file, so every `now`
// below is an unambiguous local instant.
const at = (y,mo,d,h,mi,se=0) => new Date(y,mo-1,d,h,mi,se);

test('countdown: no due date -> null', () => {
  assert.equal(_dueCountdownLabel('', at(2026,8,20,18,0)), null);
  assert.equal(_dueCountdownLabel(null, at(2026,8,20,18,0)), null);
});

test('countdown: overdue returns null, never a count-UP', () => {
  // The no-shame rule, asserted rather than assumed: an item dated yesterday
  // keeps its plain static date and its existing Fresh Start handling. If this
  // ever starts returning "3h late" the test fails.
  assert.equal(_dueCountdownLabel('2026-08-19', at(2026,8,20,18,0)), null);
  assert.equal(_dueCountdownLabel('2026-01-02', at(2026,8,20,18,0)), null);
});

test('countdown: tomorrow is always >24h out, so it stays a static date', () => {
  // Even at 23:00, tomorrow's end-of-day is 25h away -- this is why "within
  // 24 hours" and "due today" are the same set.
  assert.equal(_dueCountdownLabel('2026-08-21', at(2026,8,20,23,0)), null);
  assert.equal(_dueCountdownLabel('2026-08-21', at(2026,8,20,0,1)), null);
});

test('countdown: hours remaining in the due day', () => {
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,18,0)), 'due in 5h');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,0,0)),  'due in 23h');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,22,59)), 'due in 1h');
});

test('countdown: switches to minutes under the hour', () => {
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,23,30)), 'due in 29m');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,23,0)),  'due in 59m');
});

test('countdown: last minute reads "due today", not a zero countdown', () => {
  // "due in 0m" reads as a buzzer. The calm wording is the point of A-13.
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,23,59,30)), 'due today');
});


// ── I2-1 timed deadlines (panel survey 2026-08-22, candidate C3) ────────────
// The bug this locks down: a task carrying its own time counted down to the
// END OF DAY, so a 9:00 task read "due in 14h" at 9:14am. Wrong, not merely
// imprecise -- and three personas said one wrong chip made them distrust the
// correct ones.

test('countdown: a timed task counts to ITS time, not to end of day', () => {
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,7,0),  '09:00'), 'due in 2h');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,8,30), '09:00'), 'due in 30m');
  // The exact reported case: 9:14am on a 9:00 task. Formerly "due in 14h".
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,9,14), '09:00'), 'past 9a');
});

test('countdown: past its time stays calm and never counts UP', () => {
  // Same no-shame rule as the overdue case: state the fact and stop. If this
  // ever starts returning "3h late" or growing with time, the test fails.
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,12,0), '09:00'), 'past 9a');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,20,0), '09:00'), 'past 9a');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,20,0), '12:30'), 'past 12:30p');
});

test('countdown: the 11:59pm deadline case still works and is exact', () => {
  // The Student's world. Formerly indistinguishable from a dateless task.
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,18,0),  '23:59'), 'due in 5h');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,23,30), '23:59'), 'due in 29m');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,23,59), '23:59'), 'due now');
});

test('countdown: a dateless task still means "by end of day"', () => {
  // The original behaviour must be untouched when there is no time.
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,18,0)), 'due in 5h');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,18,0), ''), 'due in 5h');
  assert.equal(_dueCountdownLabel('2026-08-20', at(2026,8,20,18,0), null), 'due in 5h');
});

test('countdown: a timed task on another day is still a static date', () => {
  assert.equal(_dueCountdownLabel('2026-08-21', at(2026,8,20,23,0), '09:00'), null);
  assert.equal(_dueCountdownLabel('2026-08-19', at(2026,8,20,10,0), '09:00'), null);
});


// ── A-2 day anchor (panel survey Stage 9) ───────────────────────────────────
// The single most important property: THE DEFAULT MUST NOT MOVE. Everything
// else here is secondary to that.

// The pre-anchor implementations, copied verbatim, so "unchanged" is measured
// against the real old code rather than against the new code's own opinion.
const OLD_todayStr = (d) => {
  const pad = n => n < 10 ? '0' + n : '' + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

test('anchor: default is 0', () => {
  setDayAnchorMinutes(0);
  assert.equal(getDayAnchorMinutes(), 0);
});

test('anchor 0 is byte-identical to the pre-anchor resolver, all day long', () => {
  setDayAnchorMinutes(0);
  // Every minute of a full day would be slow; every 7 minutes across 24h is
  // 206 samples and still crosses every hour boundary including midnight.
  for (let m = 0; m < 1440; m += 7) {
    const now = new Date(2026, 7, 20, Math.floor(m / 60), m % 60, 30);
    assert.equal(_anchoredDayKey(now), OLD_todayStr(now), 'diverged at minute ' + m);
  }
});

test('anchor 0: _anchoredNow is a plain now', () => {
  setDayAnchorMinutes(0);
  const before = Date.now(), a = _anchoredNow().getTime(), after = Date.now();
  assert.ok(a >= before && a <= after, 'anchor 0 must not shift the clock');
});

test('anchor 0: day end is 23:59:59.999 local, as it always was', () => {
  setDayAnchorMinutes(0);
  const e = _anchoredDayEnd(new Date(2026, 7, 20, 13, 0));
  assert.equal(e.getHours(), 23);
  assert.equal(e.getMinutes(), 59);
  assert.equal(e.getDate(), 20);
});

test('anchor 240 (4am): 01:30 still belongs to the PREVIOUS day', () => {
  // The ADHD User's 1am false-overdue, and half the Shift Worker's breakpoints.
  setDayAnchorMinutes(240);
  assert.equal(_anchoredDayKey(new Date(2026, 7, 21, 1, 30)), '2026-08-20');
  assert.equal(_anchoredDayKey(new Date(2026, 7, 21, 3, 59)), '2026-08-20');
  assert.equal(_anchoredDayKey(new Date(2026, 7, 21, 4, 0)),  '2026-08-21');
  assert.equal(_anchoredDayKey(new Date(2026, 7, 21, 12, 0)), '2026-08-21');
  setDayAnchorMinutes(0);
});

test('anchor -240 (20:00 the night before): the evening is already tomorrow', () => {
  setDayAnchorMinutes(-240);
  assert.equal(_anchoredDayKey(new Date(2026, 7, 20, 19, 59)), '2026-08-20');
  assert.equal(_anchoredDayKey(new Date(2026, 7, 20, 20, 0)),  '2026-08-21');
  setDayAnchorMinutes(0);
});

test('anchor: _dayKey WITH a Date argument is never shifted', () => {
  // Day-bucket callers pass Dates already at local midnight. Shifting those
  // would slide every bucket into the previous day.
  setDayAnchorMinutes(240);
  const midnight = new Date(2026, 7, 20, 0, 0, 0);
  assert.equal(_dayKey(midnight), '2026-08-20');
  setDayAnchorMinutes(0);
});

test('anchor: input is coerced and clamped to +/-12h', () => {
  assert.equal(setDayAnchorMinutes('240'), 240);
  assert.equal(setDayAnchorMinutes(99999), 720);
  assert.equal(setDayAnchorMinutes(-99999), -720);
  assert.equal(setDayAnchorMinutes('garbage'), 0);
  assert.equal(setDayAnchorMinutes(undefined), 0);
  assert.equal(setDayAnchorMinutes(null), 0);
  setDayAnchorMinutes(0);
});

test('anchor: an anchored day is still exactly 24h long', () => {
  for (const a of [0, 120, 240, 720, -240, -720]) {
    setDayAnchorMinutes(a);
    const end = _anchoredDayEnd(new Date(2026, 7, 20, 12, 0));
    const prevEnd = _anchoredDayEnd(new Date(2026, 7, 19, 12, 0));
    assert.equal(end.getTime() - prevEnd.getTime(), 86400000, 'anchor ' + a);
  }
  setDayAnchorMinutes(0);
});

test('anchor: the countdown follows the anchored day end, not 23:59', () => {
  setDayAnchorMinutes(240);
  // 01:00 on the 21st is still the 20th, with 3h left before the 4am flip.
  assert.equal(_dueCountdownLabel('2026-08-20', new Date(2026, 7, 21, 1, 0)), 'due in 2h');
  // Under the OLD midnight rule this item went overdue an hour earlier.
  setDayAnchorMinutes(0);
  assert.equal(_dueCountdownLabel('2026-08-20', new Date(2026, 7, 21, 1, 0)), null);
});

test('anchor: a timed deadline in the small hours belongs to the day you were awake in', () => {
  // With a 4am anchor, the day 2026-08-20 runs 04:00 on the 20th to 03:59 on
  // the 21st, so a 1am deadline on "the 20th" is the 21st at 01:00 -- and at
  // midnight it is still an hour AWAY, not fifteen hours gone. This is the
  // interaction that would break if the timed path built its instant from raw
  // local midnight instead of the anchored day.
  setDayAnchorMinutes(240);
  assert.equal(_dueCountdownLabel('2026-08-20', new Date(2026, 7, 21, 0, 0), '01:00'), 'due in 1h');
  assert.equal(_dueCountdownLabel('2026-08-20', new Date(2026, 7, 21, 2, 0), '01:00'), 'past 1a');
  // A daytime deadline on the same anchored day is plain local time.
  assert.equal(_dueCountdownLabel('2026-08-20', new Date(2026, 7, 20, 8, 0), '10:00'), 'due in 2h');
  setDayAnchorMinutes(0);
});

test('anchor: DST spring-forward day still resolves one day per day', () => {
  // 2026-03-08 is the US spring-forward (2am -> 3am), a 23-hour local day.
  // Shifting the INSTANT means the platform handles this; a branch-on-hour
  // implementation would have to special-case it.
  setDayAnchorMinutes(240);
  const keys = new Set();
  for (let h = 0; h < 24; h++) keys.add(_anchoredDayKey(new Date(2026, 2, 8, h, 30)));
  assert.ok(keys.size <= 2, 'a single local day mapped to ' + keys.size + ' anchored days');
  assert.ok(keys.has('2026-03-07') && keys.has('2026-03-08'));
  setDayAnchorMinutes(0);
});

test('anchor: a stale device without the field cannot flip an anchored account', () => {
  // The anchor rides the dashboard blob as a plain scalar. reconcileSync owns
  // only the item arrays and tombstone maps -- it must NOT emit dayAnchorMin,
  // or it would start overriding the caller's Object.assign ordering.
  const local = { dayAnchorMin: 240, reminders: [rem('r1')], _tombstones: {} };
  const cloud = { reminders: [rem('r1')], _tombstones: {} };   // stale build, no field
  const out = reconcileSync(local, cloud);
  assert.ok(!('dayAnchorMin' in out), 'reconcileSync must not own the anchor scalar');
});


// ── Cross-device focus timer (2026-08-21) ──────────────────────────────────
const ft = (o = {}) => Object.assign({
  sessionId: 's1', running: false, endAt: 0, total: 1500, presetIdx: 0, awardedSessionId: ''
}, o);

test('timer sync: nothing to adopt', () => {
  assert.equal(_shouldAdoptRemoteTimer(ft(), null), false);
  assert.equal(_shouldAdoptRemoteTimer(ft(), undefined), false);
  assert.equal(_shouldAdoptRemoteTimer(ft(), 'garbage'), false);
  assert.equal(_shouldAdoptRemoteTimer(ft(), {}), false, 'a record with no sessionId is malformed');
});

test('timer sync: no local timer means take the remote one', () => {
  assert.equal(_shouldAdoptRemoteTimer(null, ft({ running: true, endAt: 123 })), true);
});

test('timer sync: an identical record is IGNORED', () => {
  // This is what stops every unrelated snapshot echo (a note edit, a task
  // toggle) from tearing down and rebuilding the timer interval.
  assert.equal(_shouldAdoptRemoteTimer(ft({ running: true, endAt: 999 }),
                                       ft({ running: true, endAt: 999 })), false);
  assert.equal(_shouldAdoptRemoteTimer(ft(), ft()), false);
});

test('timer sync: a different session always wins', () => {
  assert.equal(_shouldAdoptRemoteTimer(ft({ sessionId: 's1' }), ft({ sessionId: 's2' })), true);
});

test('timer sync: same session, a meaningful field changed', () => {
  const base = ft({ sessionId: 's1', running: true, endAt: 999 });
  assert.equal(_shouldAdoptRemoteTimer(base, ft({ sessionId: 's1', running: false, endAt: 999 })), true, 'paused elsewhere');
  assert.equal(_shouldAdoptRemoteTimer(base, ft({ sessionId: 's1', running: true, endAt: 1500 })), true, 'endAt moved');
  assert.equal(_shouldAdoptRemoteTimer(base, ft({ sessionId: 's1', running: true, endAt: 999, total: 2700 })), true, 'preset changed');
});

test('timer sync: adopting when another device already claimed the points', () => {
  // Otherwise this device would tick to zero and award them a second time.
  const local = ft({ sessionId: 's1', running: true, endAt: 999 });
  const remote = ft({ sessionId: 's1', running: true, endAt: 999, awardedSessionId: 's1' });
  assert.equal(_shouldAdoptRemoteTimer(local, remote), true);
});

test('timer sync: expired-session detection', () => {
  const now = 1_000_000;
  assert.equal(_timerSessionExpired(ft({ running: true, endAt: now + 5000 }), now), false, 'still running');
  assert.equal(_timerSessionExpired(ft({ running: true, endAt: now - 1 }), now), true, 'ended a moment ago');
  assert.equal(_timerSessionExpired(ft({ running: false, endAt: 0 }), now), false, 'paused is not expired');
  assert.equal(_timerSessionExpired(null, now), false);
  assert.equal(_timerSessionExpired(ft({ running: true, endAt: 0 }), now), false, 'running with no endAt is malformed, not expired');
});

test('timer sync: reconcileSync does not own focusTimer', () => {
  // It rides the plain blob spread (last-write-wins via save()'s _updatedAt
  // transaction guard), exactly like dayAnchorMin. If reconcileSync started
  // emitting it, it would override the caller's Object.assign ordering.
  const out = reconcileSync({ focusTimer: ft(), reminders: [], _tombstones: {} },
                            { reminders: [], _tombstones: {} });
  assert.ok(!('focusTimer' in out));
});


// ── I2-8 device heartbeats (panel survey 2026-08-22) ────────────────────────
// The blob is last-writer-wins; this map must not be, or heartbeats regress.

test('heartbeats: union by device, latest sighting wins', () => {
  const local = { mac:  { n: 'Mac · Chrome',  t: 2000 },
                  phone:{ n: 'iPhone app',    t:  500 } };
  const cloud = { mac:  { n: 'Mac · Chrome',  t: 1000 },   // stale copy of mac
                  ipad: { n: 'iPad · Safari', t: 3000 } };  // device local never met
  const out = mergeDeviceHeartbeats(local, cloud);
  assert.equal(out.mac.t, 2000);        // fresher local sighting survives the stale cloud one
  assert.equal(out.phone.t, 500);       // local-only device survives
  assert.equal(out.ipad.t, 3000);       // cloud-only device survives
});

test('heartbeats: a stale writer cannot erase a fresher sighting (the regression this exists for)', () => {
  // Device B saves the whole blob holding an OLD copy of A's heartbeat.
  // Under plain spread, A would appear last-seen an hour ago forever.
  const afterAWrote = { A: { n: 'Mac · Chrome', t: 10_000 }, B: { n: 'iPhone app', t: 9_000 } };
  const staleB      = { A: { n: 'Mac · Chrome', t:  1_000 }, B: { n: 'iPhone app', t: 9_500 } };
  const out = mergeDeviceHeartbeats(afterAWrote, staleB);
  assert.equal(out.A.t, 10_000);
  assert.equal(out.B.t, 9_500);
});

test('heartbeats: pruned to the newest DEVICE_HEARTBEAT_MAX', () => {
  const many = {};
  for (let i = 0; i < DEVICE_HEARTBEAT_MAX + 4; i++) many['d' + i] = { n: 'Dev ' + i, t: i };
  const out = mergeDeviceHeartbeats(many, {});
  const ids = Object.keys(out);
  assert.equal(ids.length, DEVICE_HEARTBEAT_MAX);
  // the OLDEST ones are the ones dropped
  assert.ok(!out.d0 && !out.d1 && !out.d2 && !out.d3);
  assert.ok(out['d' + (DEVICE_HEARTBEAT_MAX + 3)]);
});

test('heartbeats: reconcileSync owns _devices at both apply sites', () => {
  const out = reconcileSync(
    { _devices: { mac: { n: 'Mac', t: 2 } }, tasks: [], reminders: [], notes: [], thoughts: [] },
    { _devices: { mac: { n: 'Mac', t: 1 }, ipad: { n: 'iPad', t: 3 } } }
  );
  assert.equal(out._devices.mac.t, 2);
  assert.equal(out._devices.ipad.t, 3);
});

test('heartbeats: absent on both sides stays an empty map, never a crash', () => {
  const out = reconcileSync({ tasks: [] }, {});
  assert.deepEqual(Object.keys(out._devices), []);
});


// ── Stage 7: project-level deletion is a durable fact too ───────────────────
test('deleted project stays deleted when a stale client writes', () => {
  // Found during the undo work: deleteProject never tombstoned and
  // mergeProjects never dropped project-level tombstones, so a deleted
  // project came back -- subtasks and all -- from any stale device.
  const proj = { id:'p9', name:'Old project', subtasks:[{id:'s1',name:'a',done:false}] };
  const A = { projects: [], _tombstones: { p9: '2026-08-23T12:00:00.000Z' } };
  const staleB = { projects: [ JSON.parse(JSON.stringify(proj)) ] };
  const reconciled = reconcileSync(staleB, A);
  assert.deepEqual(reconciled.projects, [], 'p9 does not resurrect');
  // And the same round-trip as reminders: B saves, A reloads -- still gone.
  const bAfter = Object.assign({}, staleB, reconciled);
  const roundTrip = reconcileSync(A, bAfter);
  assert.deepEqual(roundTrip.projects, []);
});


// ── tlBlocks join SYNC_ACTIVE_ARRAYS (2026-08-25, build-113 on-device) ──────
// A block added to tomorrow appeared, then vanished: blocks were merged by
// NEITHER path, so the snapshot handler's plain cloud spread dropped any block
// the (older) cloud doc didn't carry. These pin the three behaviors the fix
// promises: a fresh local add survives a stale echo, a tombstoned delete stays
// deleted, and concurrent adds on two devices both survive.
const blk = (id, extra={}) => Object.assign({ id, name: id, date:'2026-08-26', time:'09:00' }, extra);

test('tlBlocks: a just-added block survives a stale cloud echo', () => {
  const local = { tlBlocks: [ blk('tlb_new') ], tasks: [], reminders: [], notes: [], thoughts: [] };
  const staleCloud = { tlBlocks: [] };            // echo of the doc from before the add
  const out = reconcileSync(local, staleCloud);
  assert.deepEqual(out.tlBlocks.map(b=>b.id), ['tlb_new'], 'the add is not dropped');
});

test('tlBlocks: a deleted block stays deleted when a stale client writes', () => {
  // Deleter removed it AND tombstoned it (every removal site goes through
  // _tlRemoveBlocks in legacy.js); the stale side still carries the block.
  const A = { tlBlocks: [], _tombstones: { tlb_gone: '2026-08-25T12:00:00.000Z' } };
  const staleB = { tlBlocks: [ blk('tlb_gone') ] };
  const out = reconcileSync(staleB, A);
  assert.deepEqual(out.tlBlocks, [], 'tombstoned block does not resurrect');
  // Round-trip: stale side saves the reconciled state, deleter reloads it.
  const bAfter = Object.assign({}, staleB, out);
  assert.deepEqual(reconcileSync(A, bAfter).tlBlocks, []);
});

test('tlBlocks: concurrent adds on two devices both survive', () => {
  const out = reconcileSync({ tlBlocks: [ blk('tlb_phone') ] },
                            { tlBlocks: [ blk('tlb_desktop') ] });
  assert.deepEqual(out.tlBlocks.map(b=>b.id).sort(), ['tlb_desktop','tlb_phone']);
});
