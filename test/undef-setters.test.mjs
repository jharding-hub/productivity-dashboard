// Catches a React component calling a state setter that no longer exists.
// Run: npm run test:undef
//
// WHY THIS EXISTS: removing task priority (b262def, 2026-07-20) deleted the
// newTaskPri state but left one `setNewTaskPri('med')` call in
// ProjectDashboard.jsx's addTask. Vite/esbuild do not flag an undefined
// identifier -- it only throws when the code runs -- so every "Add task" on the
// project page threw a ReferenceError for two months: the task was pushed into
// memory, but save() and the panel re-renders after the throw never ran (lost
// if the app closed first). Silent: Sentry showed handled:false, no UI error.
//
// Pure text scan, no dependencies: every bare `setXxx(` call in src/ must be
// bound in the same file (useState pair, declaration, or destructure).
// Member calls (`window.setPinSubmit()`, `el.setAttribute()`) are skipped --
// they resolve on an object, not in scope.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

// Bare globals that happen to match set[A-Z]...
const GLOBAL_SETTERS = new Set(['setTimeout', 'setInterval', 'setImmediate']);

export function undefinedSetters(source) {
  const called = new Set();
  for (const m of source.matchAll(/(^|[^.\w$])(set[A-Z][\w$]*)\s*\(/g)) called.add(m[2]);
  const bound = new Set();
  for (const m of source.matchAll(/\[\s*[\w$]+\s*,\s*(set[A-Z][\w$]*)\s*\]/g)) bound.add(m[1]);      // const [x, setX] = useState
  for (const m of source.matchAll(/(?:function|const|let|var)\s+(set[A-Z][\w$]*)/g)) bound.add(m[1]); // declarations
  for (const m of source.matchAll(/[{,(]\s*(set[A-Z][\w$]*)\s*(?=[,})=:])/g)) bound.add(m[1]);       // props / params / destructure
  return [...called].filter(n => !bound.has(n) && !GLOBAL_SETTERS.has(n)).sort();
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(jsx?|tsx?)$/.test(name) ? [p] : [];
  });
}

test('the checker flags the exact bug it exists for (self-test)', () => {
  const bad = `const [newTaskName, setNewTaskName] = useState('');
    const addTask = () => { setNewTaskName(''); setNewTaskPri('med'); };`;
  assert.deepEqual(undefinedSetters(bad), ['setNewTaskPri']);
  const ok = `const [a, setA] = useState(0);
    function Row({ setOpen }) { setOpen(false); }
    window.setPinSubmit(); el.setAttribute('x', 1); setTimeout(() => setA(1), 0);`;
  assert.deepEqual(undefinedSetters(ok), []);
});

test('no React component calls an undefined state setter', () => {
  const problems = sourceFiles(SRC)
    .map(f => ({ file: relative(ROOT, f), missing: undefinedSetters(readFileSync(f, 'utf8')) }))
    .filter(r => r.missing.length);
  assert.deepEqual(problems, [], 'undefined setter calls:\n' +
    problems.map(r => `  ${r.file}: ${r.missing.join(', ')}`).join('\n'));
});
