// The real-sky banner is arithmetic, so it can be checked against reality.
// These expectations are published sunrise/sunset times for 40.0°N on the 75°W
// meridian (the central meridian of US Eastern), not values this code produced.
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/day-progress.js', import.meta.url), 'utf8');
const sky = new Function(
  src + ';return{_skyElevation,_skyColor,skyGradientFor,_skyEnabled,_skyLocation,SKY_THEMES,SKY_TZ_LOC,SKY_REGION_LAT,SKY_RAMP};'
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

test('every entry in the timezone table is a real coordinate', () => {
  const entries = Object.entries(sky.SKY_TZ_LOC);
  assert.ok(entries.length > 60, 'timezone table is suspiciously small');
  for (const [tz, loc] of entries) {
    assert.ok(Array.isArray(loc) && loc.length === 2, `${tz} is not a [lat, lon] pair`);
    const [lat, lon] = loc;
    assert.ok(lat >= -60 && lat <= 72, `${tz} latitude ${lat} out of range`);
    assert.ok(lon >= -180 && lon <= 180, `${tz} longitude ${lon} out of range`);
    // A longitude more than 30 degrees from its own name's hemisphere is almost
    // always a sign flip, which is the easy mistake in a table like this.
    if (tz.startsWith('America/')) assert.ok(lon < 20, `${tz} longitude ${lon} looks sign-flipped`);
  }
  assert.deepEqual(sky.SKY_TZ_LOC['America/New_York'], [40.7, -74.0]);
});

test('an unknown timezone still yields a usable location', () => {
  const loc = sky._skyLocation();
  assert.equal(typeof loc.lat, 'number');
  assert.ok(loc.lon === null || typeof loc.lon === 'number');
});

// The sky is on by default; ?sky=0 is the only way to get the old fixed
// gradient back. It is deliberately unreachable inside the native app, which
// loads from capacitor://localhost with no query string -- so the no-location
// fallback has to be ON, not off, or the phone would silently never show it.
test('the sky is on by default and ?sky=0 is the only opt-out', () => {
  const cases = [
    ['', true, 'no query string'],
    ['?sky=0', false, 'explicit opt-out'],
    ['?sky=1', true, 'explicit opt-in still works'],
    ['?pager=0', true, 'an unrelated param'],
    ['?sky=false', true, 'only the exact string 0 disables it'],
  ];
  for (const [search, expected, why] of cases) {
    globalThis.location = { search };
    assert.equal(sky._skyEnabled(), expected, `${why}: location.search=${JSON.stringify(search)}`);
  }
  delete globalThis.location;
});

test('with no location at all the sky is on (the native case)', () => {
  delete globalThis.location;
  assert.equal(sky._skyEnabled(), true, 'native has no query string and must still get the sky');
});

// This has now caused the same visible bug twice: a theme starts painting the
// real sky, its ticks and numbers are still the near-black default, and they
// vanish into the night-blue at both ends of the bar. Any theme on SKY_THEMES
// must have its own marker and label rules in app.css.
test('every theme that gets the sky also has visible ticks and labels', () => {
  const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  for (const theme of sky.SKY_THEMES) {
    const sel = theme === null ? 'body:not([data-theme])' : `body[data-theme="${theme}"]`;
    const name = theme === null ? 'default dark' : theme;
    for (const part of ['.day-progress-marker', '.day-progress-edge-label']) {
      const hit = css.includes(`${sel} ${part},`) || css.includes(`${sel} ${part}{`);
      assert.ok(hit, `${name} paints the sky but has no "${sel} ${part}" rule — it would fall back to the near-black default and vanish into the night-blue ends`);
    }
  }
});

test('galaxy is on the sky list', () => {
  assert.ok(sky.SKY_THEMES.includes('galaxy'), 'galaxy should get the real sky');
  assert.ok(!sky.SKY_THEMES.includes('starry'), 'starry paints its own bar and must not be overridden');
  assert.ok(!sky.SKY_THEMES.includes('storm-dark'), 'storm-dark paints its own bar');
});

// The bug this table exists to prevent. Indianapolis is at -86.15 in a zone
// centred on -75: eleven degrees, which is 45 minutes of solar time. Deriving
// longitude from the UTC offset verified perfectly against New York (almost
// exactly on the meridian) and was three quarters of an hour out here.
// Offsets for Indianapolis and New York are identical, so running this file
// under TZ=America/New_York and passing the Indiana longitude is equivalent.
test('Indianapolis matches published times, not its central meridian', () => {
  const LAT = 39.8, LON = -86.2;
  const d = new Date(2026, 8, 2);
  const cross = (rising, lon) => {
    let prev = sky._skyElevation(LAT, d, 0, lon);
    for (let m = 1; m <= 1440; m++) {
      const cur = sky._skyElevation(LAT, d, m, lon);
      if (rising ? prev < -0.833 && cur >= -0.833 : prev >= -0.833 && cur < -0.833) return m;
      prev = cur;
    }
    return null;
  };
  near(cross(true, LON), hm(7, 11), 6, 'Indianapolis sunrise 2 Sep 2026');
  near(cross(false, LON), hm(20, 19), 6, 'Indianapolis sunset 2 Sep 2026');

  // And prove the longitude is actually doing the work: without it the same
  // date lands roughly three quarters of an hour early.
  const drift = cross(false, LON) - cross(false, undefined);
  assert.ok(drift > 35 && drift < 55,
    `omitting longitude should shift sunset ~45min earlier, got ${drift}min`);
});

test('Indiana zones resolve to Indiana, not the region fallback', () => {
  for (const tz of ['America/Indianapolis', 'America/Indiana/Indianapolis']) {
    const [lat, lon] = sky.SKY_TZ_LOC[tz];
    assert.ok(Math.abs(lat - 39.8) < 0.5, `${tz} latitude is ${lat}`);
    assert.ok(Math.abs(lon + 86.2) < 0.5, `${tz} longitude is ${lon}`);
  }
});

// Only a zone missing from the table may fall back to the central meridian.
test('a listed zone always carries a real longitude', () => {
  for (const [tz, [, lon]] of Object.entries(sky.SKY_TZ_LOC)) {
    assert.ok(lon !== null && lon !== undefined, `${tz} has no longitude`);
  }
});
