// Completed tasks stay on the day banner, greyed (2026-09-23).
// Pure helpers from public/day-progress.js. Run: npm run test:banner-done
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/day-progress.js', import.meta.url), 'utf8');
const w = new Function(src + ';return{bannerDoneEntry,bannerDoneAdd,bannerDoneVisible};')();

const WED = '2026-09-23', FRI = '2026-09-25';
// What _tlCollectBlocks returns for Wednesday: one auto-placed task, one task
// dragged onto the bar (a linked manual block), one hand-typed block.
const wedBlocks = [
  { id: 'task_t1', itemId: 't1', name: 'Timed task', startMin: 600, durMin: 60, projectId: 'p1' },
  { id: 'blk9', linkedId: 't2', name: 'Dragged task', startMin: 780, durMin: 30, projectId: '' },
  { id: 'blk5', linkedId: '', name: 'Lunch', startMin: 720, durMin: 60 },
];

test('a task on today\'s banner records its exact slot when completed', () => {
  const e = w.bannerDoneEntry(wedBlocks, 't1', WED, 'X');
  assert.deepEqual(e, { id: 't1', day: WED, name: 'Timed task', startMin: 600, durMin: 60, projectId: 'p1', updatedAt: 'X' });
});

test('a task dragged onto the bar (linked block) is found by linkedId', () => {
  assert.equal(w.bannerDoneEntry(wedBlocks, 't2', WED).startMin, 780);
});

test('completed AHEAD of its day: not on today\'s banner, so nothing is recorded', () => {
  // t3 is due Friday -- it has no block in Wednesday's list.
  assert.equal(w.bannerDoneEntry(wedBlocks, 't3', WED), null);
  const list = w.bannerDoneAdd([], null, WED);
  assert.deepEqual(list, []);
  // ...and on Friday there is nothing to draw for it.
  assert.deepEqual(w.bannerDoneVisible(list, FRI, {}), []);
});

test('an empty linkedId on a hand-typed block never matches', () => {
  assert.equal(w.bannerDoneEntry(wedBlocks, '', WED), null);
});

test('entries only show on the day they were completed', () => {
  const list = [{ id: 't1', day: WED, startMin: 600, durMin: 60 }];
  assert.equal(w.bannerDoneVisible(list, WED, {}).length, 1);
  assert.equal(w.bannerDoneVisible(list, '2026-09-24', {}).length, 0);
});

test('adding prunes other days and replaces a same-id entry', () => {
  const list = [
    { id: 'old', day: '2026-09-22', startMin: 300, durMin: 30 },
    { id: 't1', day: WED, startMin: 500, durMin: 30 },
  ];
  const out = w.bannerDoneAdd(list, { id: 't1', day: WED, startMin: 600, durMin: 60 }, WED);
  assert.deepEqual(out.map(e => [e.id, e.startMin]), [['t1', 600]]);
});

test('an item live on the bar again (restored) is not drawn grey twice', () => {
  const list = [{ id: 't1', day: WED, startMin: 600, durMin: 60 }];
  assert.deepEqual(w.bannerDoneVisible(list, WED, { t1: 1 }), []);
});
