// Emits the JS resolver's answer for every (anchor, instant) in the matrix,
// using the REAL public/date-utils.js -- not a copy.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DU = require(new URL('../../public/date-utils.js', import.meta.url).pathname);

const ANCHORS = [0, 60, 240, 720, -240, -720];
// Instants chosen to hit every hard case: ordinary days, both US DST
// transitions, a southern-hemisphere DST transition, and year/month rollover.
const STARTS = [
  Date.UTC(2026, 7, 20, 0, 0),   // ordinary
  Date.UTC(2026, 2,  8, 0, 0),   // US spring forward
  Date.UTC(2026, 10, 1, 0, 0),   // US fall back
  Date.UTC(2026, 9,  4, 0, 0),   // AU spring forward
  Date.UTC(2026, 11, 31, 0, 0),  // year rollover
  Date.UTC(2026, 1, 28, 0, 0),   // month rollover / short month
];
const rows = [];
for (const a of ANCHORS) {
  DU.setDayAnchorMinutes(a);
  for (const s of STARTS) {
    // every 17 min for 48h = 170 samples per start, prime step so it lands on
    // odd minute offsets rather than only on hour boundaries
    for (let m = 0; m < 60 * 48; m += 17) {
      const ms = s + m * 60000;
      rows.push([a, ms, DU._anchoredDayKey(new Date(ms))]);
    }
  }
}
process.stdout.write(JSON.stringify(rows));
