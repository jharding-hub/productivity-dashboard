// Builds docs/legacy-map.md: a table of contents for public/legacy.js.
// Plain Node, no dependencies. Run with: npm run map
//
// Sections: a comment line made of box-drawing or = characters, followed by a
// comment line holding the title (the closing rule line is skipped).
// Functions: found on a comment/string-stripped copy of the source, then the
// closing brace is matched. Heuristic, not a parser: nested functions are
// listed too, and unusual syntax may be missed.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'public/legacy.js');
const OUT = resolve(root, 'docs/legacy-map.md');
const TOP_N = 40;

const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

// ---------- sections ----------
const RULE = /^\s*\/\/\s*[─━═=]{8,}\s*$/;
const COMMENT = /^\s*\/\/(.*)$/;
const sections = [];
for (let i = 0; i < lines.length; i++) {
  if (!RULE.test(lines[i])) continue;
  const next = lines[i + 1];
  if (next === undefined || RULE.test(next)) continue;
  const m = COMMENT.exec(next);
  if (!m || !m[1].trim()) continue;
  sections.push({ title: m[1].trim(), line: i + 1 });
  // skip to the closing rule (within the comment block) so it is not re-read
  let j = i + 1;
  while (j < lines.length && COMMENT.test(lines[j]) && !RULE.test(lines[j])) j++;
  if (j < lines.length && RULE.test(lines[j])) i = j;
}

// ---------- mask strings / comments / regex literals ----------
function mask(text) {
  const out = text.split('');
  const n = text.length;
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  const stack = []; // template-literal ${ } brace depths
  let i = 0;
  let prev = ''; // previous significant code char
  let depth = 0;
  const regexOk = () => prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev);
  function template() {
    // positioned just after an opening backtick or a closing } of ${}
    const s = i;
    while (i < n) {
      const c = text[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { blank(s, ++i); prev = '`'; return; }
      if (c === '$' && text[i + 1] === '{') {
        blank(s, i + 2); i += 2; stack.push(depth); depth = 0; prev = '{'; return;
      }
      i++;
    }
    blank(s, n);
  }
  while (i < n) {
    const c = text[i], d = text[i + 1];
    if (c === '/' && d === '/') { const s = i; while (i < n && text[i] !== '\n') i++; blank(s, i); continue; }
    if (c === '/' && d === '*') { const s = i; i = text.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; blank(s, i); continue; }
    if (c === '"' || c === "'") {
      const s = i++;
      while (i < n && text[i] !== c && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
      blank(s, ++i); prev = c; continue;
    }
    if (c === '`') { i++; template(); continue; }
    if (c === '/' && regexOk()) {
      const s = i++; let cls = false;
      while (i < n && text[i] !== '\n') {
        const ch = text[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '[') cls = true; else if (ch === ']') cls = false;
        else if (ch === '/' && !cls) break;
        i++;
      }
      if (text[i] === '/') { i++; while (/[a-z]/i.test(text[i] || '')) i++; blank(s, i); prev = '/'; continue; }
      i = s + 1; prev = '/'; continue; // not a regex after all
    }
    if (c === '{') depth++;
    if (c === '}') {
      if (depth === 0 && stack.length) { depth = stack.pop(); i++; template(); continue; }
      depth--;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

const code = mask(src);

// line lookup
const lineStarts = [0];
for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);
function lineOf(pos) {
  let lo = 0, hi = lineStarts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

function matchClose(open, oc, cc) {
  let d = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === oc) d++;
    else if (code[i] === cc && --d === 0) return i;
  }
  return -1;
}

// ---------- functions ----------
const patterns = [
  // function foo(  /  async function foo(
  { re: /(?<![\w$.])(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g, kind: 'paren' },
  // foo = function(   /   window.foo = async function(
  { re: /(?<![\w$])([A-Za-z_$][\w$.]*)\s*=\s*(?:async\s+)?function\s*\*?\s*[\w$]*\s*\(/g, kind: 'paren' },
  // const foo = (a, b) =>   /   const foo = async (a) =>
  { re: /(?<![\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g, kind: 'arrow-paren' },
  // const foo = a =>
  { re: /(?<![\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/g, kind: 'arrow-bare' },
];

const found = new Map(); // start line + name -> entry
for (const { re, kind } of patterns) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(code))) {
    const name = m[1];
    let bodyOpen = -1;
    if (kind === 'paren' || kind === 'arrow-paren') {
      const open = m.index + m[0].length - 1;
      const close = matchClose(open, '(', ')');
      if (close < 0) continue;
      let p = close + 1;
      while (/\s/.test(code[p] || '')) p++;
      if (kind === 'arrow-paren') {
        if (code.slice(p, p + 2) !== '=>') continue;
        p += 2;
        while (/\s/.test(code[p] || '')) p++;
      }
      if (code[p] === '{') bodyOpen = p;
    } else {
      let p = m.index + m[0].length;
      while (/\s/.test(code[p] || '')) p++;
      if (code[p] === '{') bodyOpen = p;
    }
    if (bodyOpen < 0) continue;
    const end = matchClose(bodyOpen, '{', '}');
    if (end < 0) continue;
    const start = lineOf(m.index + (m[0].search(/\S/) > 0 ? m[0].search(/\S/) : 0));
    const endLine = lineOf(end);
    const key = start + ':' + name;
    if (!found.has(key)) found.set(key, { name, start, end: endLine, len: endLine - start + 1 });
  }
}

const longest = [...found.values()].sort((a, b) => b.len - a.len || a.start - b.start).slice(0, TOP_N);

// ---------- write ----------
const esc = (s) => s.replace(/\|/g, '\\|');
const md = [];
md.push('# legacy.js map');
md.push('');
md.push('Generated by `npm run map` (scripts/legacy-map.mjs). Do not edit by hand.');
md.push(`Source: public/legacy.js, ${lines.length} lines. Line numbers are 1-based.`);
md.push('');
md.push(`## Sections (${sections.length})`);
md.push('');
md.push('| Line | Section |');
md.push('| ---: | --- |');
for (const s of sections) md.push(`| ${s.line} | ${esc(s.title)} |`);
md.push('');
md.push(`## ${TOP_N} longest functions`);
md.push('');
md.push('| # | Function | Starts | Ends | Lines |');
md.push('| ---: | --- | ---: | ---: | ---: |');
longest.forEach((f, i) => md.push(`| ${i + 1} | \`${f.name}\` | ${f.start} | ${f.end} | ${f.len} |`));
md.push('');
md.push('Nested functions are included. Detection is a heuristic, not a full parser.');
md.push('');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md.join('\n'));
console.log(`legacy-map: ${sections.length} sections, ${found.size} functions -> docs/legacy-map.md`);
