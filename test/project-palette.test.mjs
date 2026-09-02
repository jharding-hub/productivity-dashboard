// The eight project colours exist in three places that cannot import from each
// other: public/legacy.js is a classic script injected at runtime, app.css is
// CSS, and ProjectDashboard.jsx is in the Vite bundle. This test is the thing
// that keeps them identical -- without it a palette change silently updates the
// timeline blocks but not the legend dots, which is exactly how the old set
// ended up half-replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function paletteFromLegacy() {
  const m = read('public/legacy.js').match(/var PROJECT_PALETTE=\[([^\]]+)\];/);
  assert.ok(m, 'PROJECT_PALETTE not found in public/legacy.js');
  return m[1].split(',').map((s) => s.trim().replace(/'/g, '').toLowerCase());
}

function paletteFromJsx() {
  const m = read('src/components/ProjectDashboard.jsx').match(/const BLOCK_PALETTE = \[([^\]]+)\];/);
  assert.ok(m, 'BLOCK_PALETTE not found in ProjectDashboard.jsx');
  return m[1].split(',').map((s) => s.trim().replace(/'/g, '').toLowerCase());
}

function paletteFromCss() {
  const css = read('src/app.css');
  return Array.from({ length: 8 }, (_, i) => {
    const m = css.match(new RegExp(`--proj-${i}-rgb:\\s*(\\d+),(\\d+),(\\d+)`));
    assert.ok(m, `--proj-${i}-rgb not found in src/app.css`);
    return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  });
}

test('legacy.js declares eight well-formed project colours', () => {
  const pal = paletteFromLegacy();
  assert.equal(pal.length, 8);
  for (const c of pal) assert.match(c, /^#[0-9a-f]{6}$/);
});

test('ProjectDashboard.jsx mirrors legacy.js exactly', () => {
  assert.deepEqual(paletteFromJsx(), paletteFromLegacy());
});

test('app.css --proj-N-rgb mirrors legacy.js exactly', () => {
  assert.deepEqual(paletteFromCss(), paletteFromLegacy());
});

test('every .tl-block colour rule is driven by its custom property', () => {
  const css = read('src/app.css');
  for (let i = 0; i < 8; i++) {
    assert.match(
      css,
      new RegExp(`\\.tl-block\\.tl-color-${i}\\{[^}]*var\\(--proj-${i}-rgb\\)[^}]*\\}`),
      `.tl-block.tl-color-${i} does not read --proj-${i}-rgb`
    );
  }
});

// The reason the palette was replaced. Non-text UI needs 3:1 (WCAG 1.4.11) and
// the colours have to survive both the lightest and the darkest shipped theme.
test('every colour clears 3:1 on the light and dark theme surfaces', () => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const c of paletteFromLegacy()) {
    for (const surface of ['#ffffff', '#10152a', '#0a1124']) {
      const r = ratio(c, surface);
      assert.ok(r >= 3, `${c} on ${surface} is only ${r.toFixed(2)}:1`);
    }
    assert.ok(ratio(c, '#ffffff') >= 3, `${c} fails 3:1 on the light themes`);
  }
});
