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

const { mergeById, mergeTombstones, reconcileSync, _dropTombstoned } = require('../public/sync-merge.js');
const { fmtDate } = require('../public/date-utils.js');

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
