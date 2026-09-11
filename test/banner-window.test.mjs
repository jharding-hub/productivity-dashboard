// The productive window the day bar frames. Until 2026-09-11 this was a
// hardcoded 5am–8pm repeated in six places; these helpers are the one place
// it lives now, and the first test pins the default to the exact markers the
// hardcoded lists produced so existing users see nothing move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/day-progress.js', import.meta.url), 'utf8');
const w = new Function(
  src + ';return{bannerWindowFrom,bannerWindow,bannerOffset,bannerPhase,bannerSpanPct,bannerHourLabel,bannerHourMarkers,BANNER_MIN_LEN_MIN};'
)();
const hm = (h, m = 0) => h * 60 + m;

test('the default window is 5am–8pm and does not cross midnight', () => {
  const win = w.bannerWindow();          // no `state` in this scope → default
  assert.deepEqual(win, { startMin: 300, endMin: 1200, lenMin: 900 });
});

test('the default window reproduces the fourteen hardcoded markers exactly', () => {
  // These are the literal values that used to live in DayTimelineBanner.jsx
  // and ProjectDashboard.jsx. Same percentages (to 2dp), same labels, same
  // three "key" hours the mobile layout keeps.
  const expected = [
    ['6.67','6a'],['13.33','7a'],['20.00','8a'],['26.67','9a'],['33.33','10a'],['40.00','11a'],
    ['46.67','12p'],['53.33','1p'],['60.00','2p'],['66.67','3p'],['73.33','4p'],['80.00','5p'],
    ['86.67','6p'],['93.33','7p'],
  ];
  const got = w.bannerHourMarkers(w.bannerWindowFrom(300, 1200));
  assert.deepEqual(got.map(m => [m.pct.toFixed(2), m.label]), expected);
  assert.deepEqual(got.filter(m => m.key).map(m => m.label), ['8a', '12p', '4p']);
});

test('a window that crosses midnight is one contiguous range past 1440', () => {
  assert.deepEqual(w.bannerWindowFrom(hm(21), hm(7)), { startMin: 1260, endMin: 1860, lenMin: 600 });
});

test('start equal to end means the whole day', () => {
  assert.equal(w.bannerWindowFrom(hm(6), hm(6)).lenMin, 1440);
});

test('a window shorter than the floor is widened to it, never inverted', () => {
  const win = w.bannerWindowFrom(hm(9), hm(10));
  assert.equal(win.lenMin, w.BANNER_MIN_LEN_MIN);
  assert.ok(win.endMin > win.startMin);
});

test('offset into the window wraps correctly across midnight', () => {
  const night = w.bannerWindowFrom(hm(21), hm(7));
  assert.equal(w.bannerOffset(night, hm(21)), 0);
  assert.equal(w.bannerOffset(night, hm(23, 30)), 150);
  assert.equal(w.bannerOffset(night, hm(2)), 300);        // 2am is 5h in
  assert.equal(w.bannerOffset(night, hm(6, 59)), 599);
  assert.equal(w.bannerOffset(night, hm(7)), 600);        // exactly closed
  assert.ok(w.bannerOffset(night, hm(12)) >= night.lenMin, 'noon is outside a night window');
});

test('phase for the default window matches the old before-5am / after-8pm split', () => {
  const day = w.bannerWindowFrom(300, 1200);
  assert.equal(w.bannerPhase(day, hm(2)), 'before');
  assert.equal(w.bannerPhase(day, hm(4, 59)), 'before');
  assert.equal(w.bannerPhase(day, hm(5)), 'during');
  assert.equal(w.bannerPhase(day, hm(12)), 'during');
  assert.equal(w.bannerPhase(day, hm(19, 59)), 'during');
  assert.equal(w.bannerPhase(day, hm(20)), 'after');
  assert.equal(w.bannerPhase(day, hm(23, 59)), 'after');
  assert.equal(w.bannerPhase(day, 0), 'before');          // midnight flips to tomorrow's empty bar
});

test('phase for a night window splits the daytime rest at its midpoint', () => {
  const night = w.bannerWindowFrom(hm(21), hm(7));         // rest is 7am→9pm, 14h, midpoint 2pm
  assert.equal(w.bannerPhase(night, hm(23)), 'during');
  assert.equal(w.bannerPhase(night, hm(3)), 'during');
  assert.equal(w.bannerPhase(night, hm(7)), 'after');       // just finished: full bar
  assert.equal(w.bannerPhase(night, hm(13, 59)), 'after');
  assert.equal(w.bannerPhase(night, hm(14)), 'before');     // afternoon: tonight's empty bar
  assert.equal(w.bannerPhase(night, hm(20, 59)), 'before');
});

test('spans clip to the default window like the old hardcoded maths', () => {
  const day = w.bannerWindowFrom(300, 1200);
  // 4am–6am: only the 5–6 hour shows, at the left edge, 1/15 wide
  assert.deepEqual(w.bannerSpanPct(day, hm(4), hm(6)), { leftPct: 0, widthPct: 100 / 15 });
  // 12pm–1pm: 7 hours in
  const noon = w.bannerSpanPct(day, hm(12), hm(13));
  assert.ok(Math.abs(noon.leftPct - 46.6667) < 0.01 && Math.abs(noon.widthPct - 6.6667) < 0.01);
  // entirely outside
  assert.equal(w.bannerSpanPct(day, hm(21), hm(22)), null);
  assert.equal(w.bannerSpanPct(day, hm(1), hm(4)), null);
});

test('spans land inside a night window whichever side of midnight they start', () => {
  const night = w.bannerWindowFrom(hm(21), hm(7));
  const late = w.bannerSpanPct(night, hm(23), hm(23) + 90);   // 11pm–12:30am, straddles midnight
  assert.ok(Math.abs(late.leftPct - 20) < 0.01 && Math.abs(late.widthPct - 15) < 0.01);
  const small = w.bannerSpanPct(night, hm(2), hm(3));         // 2am–3am, next calendar day
  assert.ok(Math.abs(small.leftPct - 50) < 0.01 && Math.abs(small.widthPct - 10) < 0.01);
  const early = w.bannerSpanPct(night, hm(20), hm(22));       // starts before the window
  assert.ok(Math.abs(early.leftPct - 0) < 0.01 && Math.abs(early.widthPct - 10) < 0.01);
  assert.equal(w.bannerSpanPct(night, hm(12), hm(14)), null); // noon is not in a night window
});

test('hour labels use the 12-hour a/p form the bar always used', () => {
  assert.equal(w.bannerHourLabel(0), '12a');
  assert.equal(w.bannerHourLabel(5), '5a');
  assert.equal(w.bannerHourLabel(12), '12p');
  assert.equal(w.bannerHourLabel(20), '8p');
  assert.equal(w.bannerHourLabel(23), '11p');
  assert.equal(w.bannerHourLabel(31), '7a');   // past-midnight endMin/60 wraps
});

test('markers for a night window run through midnight and keep three key hours', () => {
  const got = w.bannerHourMarkers(w.bannerWindowFrom(hm(21), hm(7)));
  assert.deepEqual(got.map(m => m.label), ['10p','11p','12a','1a','2a','3a','4a','5a','6a']);
  assert.equal(got.filter(m => m.key).length, 3);
  for (const m of got) assert.ok(m.pct > 0 && m.pct < 100, `${m.label} at ${m.pct}% is not strictly inside`);
});

test('a window starting on the half hour puts its first marker at the next whole hour', () => {
  const got = w.bannerHourMarkers(w.bannerWindowFrom(hm(8, 30), hm(17)));
  assert.equal(got[0].label, '9a');
  assert.ok(Math.abs(got[0].pct - (30 / 510) * 100) < 0.01);
});
