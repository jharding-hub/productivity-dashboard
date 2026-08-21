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

const { mergeById, mergeTombstones, reconcileSync, _dropTombstoned, reconcileLifetimeCounter } = require('../public/sync-merge.js');
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
