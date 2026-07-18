// DOM-behavior tests for the inline-edit layer (public/inline-edit.js).
// This is the first UI-layer regression harness for the Centerpost front end --
// every case below maps to a real shipped bug or a load-bearing behavior that
// previously had no coverage. Run: npm run test:inline
//
// The module is a plain browser script with a CommonJS export guard (same
// pattern as sync-merge.js). We give it a jsdom document/window, then exercise
// the real functions through actual DOM events.

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// jsdom document/window must exist before the module's functions run (they read
// document at call time). Set them as globals, then load the module.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const IE = require('../public/inline-edit.js');

// A real MouseEvent/FocusEvent from jsdom so listeners fire as in a browser.
function click(el){ el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }
function blur(el){ el.dispatchEvent(new dom.window.FocusEvent('blur')); }

function freshContainer(id){
  const c = document.createElement('div');
  c.id = id;
  document.body.appendChild(c);
  return c;
}

test.beforeEach(() => {
  document.body.innerHTML = '';
  IE._resetInlineEditState();
});

// ── Picker survival — guards commit 8862b73 ──────────────────────────────────
// A date picker opened in a panel must set the edit-active flag so a concurrent
// panel re-render defers instead of destroying the open <input>. The bug was
// that _isEditingInPanel only protected contenteditable text, so a sync echo
// closed the picker "on its own."
test('date picker opens, marks the panel as editing, and commits on blur', () => {
  const c = freshContainer('taskListItems');
  const cell = document.createElement('span');
  cell.id = 'tldue_x';
  cell.textContent = 'Jan 1, 2026';
  c.appendChild(cell);

  let saved = null, calls = 0;
  IE.makeDateClickable(cell, '2026-01-01', (v) => { saved = v; calls++; });

  // Not editing yet.
  assert.equal(IE._isEditingInPanel('taskListItems'), false);

  click(cell);
  const inp = cell.querySelector('input.date-edit-input');
  assert.ok(inp, 'an input appears on click');
  assert.equal(inp.type, 'date');
  assert.equal(inp.value, '2026-01-01', 'input seeded with the current value');

  // The guard must hold WHILE the picker is open (flag-based, independent of focus).
  assert.equal(IE._isEditingInPanel('taskListItems'), true, 'panel is protected while picker open');
  assert.ok(IE._getDateEditActive() === cell, 'the open picker cell is tracked');

  inp.value = '2026-02-02';
  blur(inp);

  assert.equal(calls, 1, 'onSave fired exactly once on commit');
  assert.equal(saved, '2026-02-02', 'committed the picked value');
  assert.equal(IE._isEditingInPanel('taskListItems'), false, 'guard clears at commit');
  assert.equal(IE._getDateEditActive(), null, 'flag cleared at commit');
});

test('a second blur does not double-commit', () => {
  const c = freshContainer('reminderList');
  const cell = document.createElement('span');
  c.appendChild(cell);
  let calls = 0;
  IE.makeDateClickable(cell, '', () => { calls++; });
  click(cell);
  const inp = cell.querySelector('input.date-edit-input');
  blur(inp); blur(inp);
  assert.equal(calls, 1, 'commit is idempotent');
});

// ── Time picker uses the same guard ──────────────────────────────────────────
test('time picker sets the guard and commits', () => {
  const c = freshContainer('reminderList');
  const cell = document.createElement('span');
  c.appendChild(cell);
  let saved = null;
  IE.makeTimeClickable(cell, '09:00', (v) => { saved = v; });
  click(cell);
  const inp = cell.querySelector('input.date-edit-input');
  assert.equal(inp.type, 'time');
  assert.equal(IE._isEditingInPanel('reminderList'), true);
  inp.value = '14:30';
  blur(inp);
  assert.equal(saved, '14:30');
  assert.equal(IE._isEditingInPanel('reminderList'), false);
});

// ── Defer-then-flush — guards the render-clobber path ────────────────────────
// While an edit is open, a panel renderer sees the guard, defers itself, and
// returns without rebuilding. On commit the deferred render is flushed and now
// runs. This is the mechanism that keeps a sync echo from wiping the open
// picker. The renderer below mirrors the real callers (renderTaskList et al.),
// which each check _isEditingInPanel at their top and defer+return if editing.
test('a render attempted while editing defers, then runs once after commit', () => {
  const c = freshContainer('taskListItems');
  const cell = document.createElement('span');
  c.appendChild(cell);

  let rendered = 0;
  function renderPanel(){
    if(IE._isEditingInPanel('taskListItems')){ IE._deferPanelRender('taskListItems'); return; }
    rendered++;
  }
  IE._registerPanelRenderers({ taskListItems: renderPanel });

  IE.makeDateClickable(cell, '2026-01-01', () => {});
  click(cell);

  // A sync echo tries to re-render while the picker is open -> the renderer
  // guards itself and defers instead of rebuilding (which would kill the input).
  renderPanel();
  assert.equal(rendered, 0, 'render deferred while editing');

  // Commit -> makeDateClickable calls _flushPendingPanelRenders(), which
  // re-invokes the renderer; editing is over now, so it actually renders.
  blur(cell.querySelector('input.date-edit-input'));
  assert.equal(rendered, 1, 'the deferred render runs once, after commit');

  // A later flush with nothing pending is a no-op.
  IE._flushPendingPanelRenders();
  assert.equal(rendered, 1);
});

// ── Scoped id lookup — guards the a603548 principle ──────────────────────────
// The Today and Everything views render task rows with duplicate element ids.
// A bare document.getElementById wires the first match, leaving the other
// view's cell dead. The fix wires each view via a container-scoped lookup.
// This proves a container-scoped query targets the right cell where the global
// lookup would not have.
test('container-scoped lookup wires the correct duplicate-id cell', () => {
  const a = freshContainer('viewA');
  const b = freshContainer('viewB');
  const cellA = document.createElement('span'); cellA.id = 'dup'; a.appendChild(cellA);
  const cellB = document.createElement('span'); cellB.id = 'dup'; b.appendChild(cellB);

  // Sanity: the global lookup only ever sees the first one.
  assert.equal(document.getElementById('dup'), cellA);

  // Wire view B's cell the way _wireTaskRowEditable does: scoped to the container.
  const scopedB = b.querySelector('[id="dup"]');
  assert.equal(scopedB, cellB, 'scoped query finds B, not the first-in-DOM A');
  IE.makeDateClickable(scopedB, '2026-03-03', () => {});

  click(cellB);
  assert.ok(cellB.querySelector('input.date-edit-input'), 'clicking B opens its own picker');
  assert.equal(cellA.querySelector('input.date-edit-input'), null, 'A is untouched (not miswired)');
});

// ── makeEditable text round-trip ─────────────────────────────────────────────
test('makeEditable saves trimmed text on blur and is contenteditable after refresh', () => {
  const c = freshContainer('projectList');
  const cell = document.createElement('span');
  c.appendChild(cell);

  let saved = null;
  IE.makeEditable(cell, (v) => { saved = v; });
  IE.refreshEditables();
  assert.equal(cell.getAttribute('contenteditable'), 'true');
  assert.ok(cell.classList.contains('editable'));

  cell.textContent = '  New name  ';
  blur(cell);
  assert.equal(saved, 'New name', 'text is trimmed on save');
});
