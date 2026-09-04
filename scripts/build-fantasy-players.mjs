#!/usr/bin/env node
// Builds public/fantasy-players.js (window.FF_PLAYERS) for the draft-day page
// at /fantasy from three sources in scripts/fantasy-sources/:
//   fantasypros-2026-all.csv  — the spine: rank, tier, pos, bye, upside/bust
//   espn-ppr-top300.txt       — ESPN PPR top 300 (rank, pos rank, auction $)
//   sbnation-ppr-tiers.txt    — SB Nation positional tiers (layout-mode text)
// Run: node scripts/build-fantasy-players.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'fantasy-sources', f), 'utf8');

// ── name normalisation ──────────────────────────────────────────────
const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;
export function norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[’'`.]/g, '')
    .replace(SUFFIX, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const slug = (s) => norm(s).replace(/ /g, '-');

// ── 1. FantasyPros CSV (spine) ──────────────────────────────────────
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
const stars = (s) => { const m = /^(\d) out of 5/.exec(s || ''); return m ? +m[1] : null; };

const players = [];
const byNorm = new Map();
const dstByTeam = new Map();
for (const line of src('fantasypros-2026-all.csv').split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const c = parseCsvLine(line);
  if (!c[0] || !c[2]) continue; // blank tier-separator rows
  const posMatch = /^([A-Z]+)(\d+)$/.exec(c[4]);
  const p = {
    id: slug(c[2]),
    name: c[2],
    team: c[3] === 'FA' ? null : c[3],
    pos: posMatch ? posMatch[1] : c[4],
    posRank: posMatch ? +posMatch[2] : null,
    bye: /^\d+$/.test(c[5]) ? +c[5] : null,
    fpRank: +c[0],
    fpTier: +c[1],
    upside: stars(c[6]),
    bust: stars(c[7]),
    sos: stars(c[8]),
    ecrVsAdp: /^[+-]?\d+$/.test(c[9]) ? +c[9] : null,
    espnRank: null, espnPosRank: null, auction: null,
    sbTier: null,
  };
  players.push(p);
  if (!byNorm.has(norm(p.name))) byNorm.set(norm(p.name), p); // first (higher-ranked) wins on duplicate names
  if (p.pos === 'DST') dstByTeam.set(p.team, p);
}

// ── 2. ESPN top 300 ─────────────────────────────────────────────────
// Reading order in the PDF is row-major across 4 columns of 80/80/80/60.
const espnText = src('espn-ppr-top300.txt').replace(/\n/g, ' ');
const re = /(\d{1,3})\.\s+\(([A-Z/]+?)(\d+)\)\s+([^,]+?),\s+([A-Z]{2,3})\s+\$(\d+)/g;
let k = 0; let m; const espnMisses = [];
while ((m = re.exec(espnText)) && k < 300) {
  let rank;
  if (k < 240) rank = Math.floor(k / 4) + 1 + 80 * (k % 4);
  else { const j = k - 240; rank = 61 + Math.floor(j / 3) + 80 * (j % 3); }
  if (!m[1].endsWith(String(rank))) throw new Error(`ESPN rank mismatch at item ${k}: got ${m[1]}, expected ${rank}`);
  const [, , pos, posRank, rawName, team, dollars] = m;
  let p = null;
  if (pos === 'DST') p = dstByTeam.get(team);
  else p = byNorm.get(norm(rawName));
  if (!p) {
    // fall back: same last name + team
    const last = norm(rawName).split(' ').pop();
    p = players.find(x => x.team === team && norm(x.name).split(' ').pop() === last) || null;
  }
  if (p) { p.espnRank = rank; p.espnPosRank = +posRank; p.auction = +dollars; }
  else espnMisses.push(`${rank} ${rawName} ${team}`);
  k++;
}
if (k !== 300) throw new Error(`ESPN parsed ${k} rows, expected 300`);

// ── 3. SB Nation positional tiers (layout text, columns by x position) ─
const POS_HEADERS = { QUARTERBACKS: 'QB', 'RUNNING BACKS': 'RB', 'WIDE RECEIVERS': 'WR', 'TIGHT ENDS': 'TE', DEFENSES: 'DST', KICKERS: 'K' };
const sbMisses = [];
const seenSb = new Set();
for (const page of src('sbnation-ppr-tiers.txt').split(/=== PAGE \d+ ===\n/).filter(Boolean)) {
  // tokens: [{text, x}] where x = centre column of the token span
  const rows = page.split('\n').map(line => {
    const toks = []; const r = /\S+(?: \S+)*/g; let t;
    while ((t = r.exec(line))) toks.push({ text: t[0], x: t.index + t[0].length / 2 });
    return toks;
  });
  // cluster x centres into columns (gap > 8 chars starts a new column)
  const xs = rows.flat().map(t => t.x).sort((a, b) => a - b);
  const cols = []; // [{lo, hi}]
  for (const x of xs) {
    const c = cols[cols.length - 1];
    if (c && x - c.hi <= 8) c.hi = x; else cols.push({ lo: x, hi: x });
  }
  const colOf = (x) => cols.findIndex(c => x >= c.lo - 4 && x <= c.hi + 4);
  // decide each column's position: header if present, else majority of matched names
  const colPos = cols.map(() => null);
  const votes = cols.map(() => ({}));
  for (const toks of rows) for (const t of toks) {
    const ci = colOf(t.x); if (ci < 0) continue;
    if (POS_HEADERS[t.text]) colPos[ci] = POS_HEADERS[t.text];
    const p = byNorm.get(norm(t.text));
    if (p) votes[ci][p.pos] = (votes[ci][p.pos] || 0) + 1;
  }
  cols.forEach((_, i) => {
    if (colPos[i]) return;
    const v = Object.entries(votes[i]).sort((a, b) => b[1] - a[1])[0];
    colPos[i] = v ? v[0] : null;
  });
  // walk rows top-to-bottom carrying a per-column current tier
  const tier = cols.map(() => null);
  for (const toks of rows) for (const t of toks) {
    const ci = colOf(t.x); if (ci < 0 || !colPos[ci]) continue;
    const tm = /^Tier (\d+)$/.exec(t.text);
    if (tm) { tier[ci] = +tm[1]; continue; }
    if (t.text === 'Stream D/ST') { tier[ci] = 1; continue; }
    if (POS_HEADERS[t.text] || /^(PPR|1-Sep|[A-Z])$/.test(t.text)) continue;
    const p = byNorm.get(norm(t.text));
    if (!p) { sbMisses.push(`${colPos[ci]}: ${t.text}`); continue; }
    if (seenSb.has(p.id)) continue; // sheet repeats overflow names on page 3
    seenSb.add(p.id);
    if (p.pos !== colPos[ci]) { sbMisses.push(`POS MISMATCH ${t.text} (${p.pos} vs col ${colPos[ci]})`); continue; }
    p.sbTier = tier[ci];
  }
}

// ── 4. write ─────────────────────────────────────────────────────────
const meta = {
  built: new Date().toISOString().slice(0, 10),
  sources: {
    fantasypros: 'FantasyPros 2026 Draft ALL rankings (ECR, PPR), CSV export',
    espn: 'ESPN 2026 Draft Kit PPR Top 300 cheat sheet, updated 2026-09-02',
    sbnation: 'SB Nation 2026 PPR positional tiers, 2026-09-01',
  },
  counts: { players: players.length, espnMatched: players.filter(p => p.espnRank).length, sbMatched: players.filter(p => p.sbTier).length },
};
const out = `// GENERATED by scripts/build-fantasy-players.mjs — do not edit by hand.\n` +
  `window.FF_META = ${JSON.stringify(meta)};\n` +
  `window.FF_PLAYERS = ${JSON.stringify(players)};\n`;
writeFileSync(join(here, '..', 'public', 'fantasy-players.js'), out);
console.log(JSON.stringify(meta.counts));
if (espnMisses.length) console.log('ESPN unmatched:', espnMisses);
if (sbMisses.length) console.log('SB Nation unmatched:', sbMisses);
