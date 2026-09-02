// The real-sky banner is arithmetic, so it can be checked against reality.
// These expectations are published sunrise/sunset times for 40.0°N on the 75°W
// meridian (the central meridian of US Eastern), not values this code produced.
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/day-progress.js', import.meta.url), 'utf8');
const sky = new Function(
  src + ';return{_skyElevation,_skyColor,skyGradientFor,_skyLatitude,SKY_TZ_LAT,SKY_RAMP};'
)();

const LAT = 40;
// Local minute at which the sun crosses -0.833° (refraction + solar radius),
// which is the standard definition of sunrise/sunset.
function crossing(date, rising) {
  let prev = sky._skyElevation(LAT, date, 0);
  for (let m = 1; m <= 1440; m++) {
    const cur = sky._skyElevation(LAT, date, m);
    if (rising ? prev < -0.833 && cur >= -0.833 : prev >= -0.833 && cur < -0.833) return m;
    prev = cur;
  }
  return null;
}
const hm = (h, m) => h * 60 + m;
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${what}: got ${Math.floor(actual / 60)}:${String(actual % 60).padStart(2, '0')}, expected within ${tol}min of ${Math.floor(expected / 60)}:${String(expected % 60).padStart(2, '0')}`);

test('summer solstice matches published sunrise/sunset', () => {
  const d = new Date(2026, 5, 21);
  near(crossing(d, true), hm(5, 32), 6, 'Jun 21 sunrise');
  near(crossing(d, false), hm(20, 33), 6, 'Jun 21 sunset');
});

test('winter solstice matches published sunrise/sunset', () => {
  const d = new Date(2026, 11, 21);
  near(crossing(d, true), hm(7, 19), 6, 'Dec 21 sunrise');
  near(crossing(d, false), hm(16, 38), 6, 'Dec 21 sunset');
});

test('the seasons actually change the bar', () => {
  const jun = crossing(new Date(2026, 5, 21), false) - crossing(new Date(2026, 5, 21), true);
  const dec = crossing(new Date(2026, 11, 21), false) - crossing(new Date(2026, 11, 21), true);
  assert.ok(jun - dec > 240, `expected >4h more daylight in June, got ${jun - dec}min`);
});

test('clocks going back shifts sunset by about an hour, with no special case', () => {
  // US DST ended 1 Nov 2026. Four days apart, one hour of clock change.
  const before = crossing(new Date(2026, 9, 30), false);
  const after = crossing(new Date(2026, 10, 3), false);
  assert.ok(Math.abs(before - after - 60) < 12,
    `expected a ~60min sunset shift across the DST boundary, got ${before - after}min`);
});

test('the ramp is ordered and covers night through zenith', () => {
  const stops = sky.SKY_RAMP.map((s) => s[0]);
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i] > stops[i - 1], 'ramp is not ascending');
  assert.equal(stops[0], -90);
  assert.equal(stops[stops.length - 1], 90);
});

test('night is dark and midday is bright', () => {
  const rgb = (s) => s.match(/\d+/g).map(Number);
  const night = rgb(sky._skyColor(-40));
  const noon = rgb(sky._skyColor(60));
  assert.ok(Math.max(...night) < 40, `night should be dark, got ${night}`);
  assert.ok(Math.max(...noon) > 120, `midday should be bright, got ${noon}`);
});

test('gradient is a well-formed CSS value with 61 stops', () => {
  const g = sky.skyGradientFor(LAT, new Date(2026, 11, 21));
  assert.match(g, /^linear-gradient\(to right,rgb\(/);
  assert.equal(g.split('rgb(').length - 1, 61);
  assert.ok(g.includes('0.00%') && g.includes('100.00%'));
});

test('every latitude in the timezone table is a real latitude', () => {
  const lats = Object.values(sky.SKY_TZ_LAT);
  assert.ok(lats.length > 60, 'timezone table is suspiciously small');
  for (const l of lats) assert.ok(l >= -60 && l <= 72, `latitude ${l} out of range`);
  assert.equal(sky.SKY_TZ_LAT['America/New_York'], 40.7);
});

test('an unknown timezone still yields a usable latitude', () => {
  assert.equal(typeof sky._skyLatitude(), 'number');
});
