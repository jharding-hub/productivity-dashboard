#!/usr/bin/env node
// One-off build tool: renders the 5 public-facing docs in docs/legal/*.md into
// static HTML pages in public/, matching the existing static-page pattern
// (kids.html, howto.html, architecture.html) -- hand-committed, not part of
// the Vite/React build, no client-side router. Cloudflare Pages serves clean
// URLs (/privacy -> privacy.html) automatically; no repo config needed for that.
//
// Run once locally, review the diff, commit the generated HTML. Not wired
// into `npm run build` -- these documents change rarely and deliberately,
// on a human decision, not on every deploy.
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const REPO = '/Users/jhmac/dev/productivity-dashboard';
const LEGAL_DIR = path.join(REPO, 'docs/legal');
const OUT_DIR = path.join(REPO, 'public');

// slug -> {source md file, page title, route}
const DOCS = [
  { md: 'privacy-policy.md', slug: 'privacy', title: 'Privacy Policy' },
  { md: 'consumer-health-data-privacy-policy.md', slug: 'health-privacy', title: 'Consumer Health Data Privacy Policy' },
  { md: 'terms-of-service.md', slug: 'terms', title: 'Terms of Service' },
  { md: 'ai-disclosure.md', slug: 'ai', title: 'AI Transparency Statement' },
  { md: 'medical-crisis-disclaimer.md', slug: 'disclaimer', title: 'Medical & Crisis Disclaimer' },
];

// Rewrite internal cross-links (privacy-policy.md -> /privacy) before parsing,
// so marked never sees a dangling .md link in the output.
const MD_TO_ROUTE = Object.fromEntries(DOCS.map(d => [d.md, '/' + d.slug]));
function rewriteLinks(src) {
  let out = src;
  for (const [md, route] of Object.entries(MD_TO_ROUTE)) {
    out = out.split('(' + md + ')').join('(' + route + ')');
  }
  // Any .md link surviving the pass above points at an internal-only doc
  // (data-inventory, COMPLIANCE-GAPS, onboarding-consent-flow, etc.) that is
  // never published. Defuse it to plain text rather than ship a 404 on a
  // public legal page: [label](file.md) -> label.
  out = out.replace(/\[([^\]]+)\]\([^)]+\.md\)/g, '$1');
  return out;
}

// heading -> URL-safe anchor id, so long docs get jumpable in-page anchors.
function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function render(mdPath) {
  const src = rewriteLinks(fs.readFileSync(mdPath, 'utf8'));
  const renderer = new marked.Renderer();
  const seen = new Map();
  renderer.heading = function({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    let id = slugify(text.replace(/<[^>]+>/g, ''));
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    if (n > 1) id += '-' + n;
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  return marked.parse(src, { renderer, gfm: true, breaks: false });
}

const NAV_LINKS = DOCS.map(d => `<a href="/${d.slug}">${d.title}</a>`).join('\n        ');

const TEMPLATE = (title, bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Centerpost</title>
<meta name="description" content="Centerpost ${title}">
<meta name="robots" content="index, follow">
<style>
:root{
  --bg:#fafbfc;--surface:#ffffff;--surface-raised:#f5f7fa;
  --text:#1a2332;--text-dim:#4a5568;--text-faint:#8895a8;
  --border:#e2e8f0;--accent:#2563eb;--accent-dim:#1e4fc4;
  --red:#dc2626;--green:#16a34a;--warn-bg:#fff7ed;--warn-border:#fdba74;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0c0f14;--surface:#111520;--surface-raised:#161c2a;
    --text:#c8d8ee;--text-dim:#8fa6c2;--text-faint:#5a7290;
    --border:#1e2840;--accent:#7ab8e8;--accent-dim:#4a88c8;
    --red:#f08080;--green:#7bd0a8;--warn-bg:#241a10;--warn-border:#8a5a20;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  line-height:1.6;font-size:16px;}
.topbar{border-bottom:1px solid var(--border);background:var(--surface);
  position:sticky;top:0;z-index:10;}
.topbar-inner{max-width:800px;margin:0 auto;padding:14px 20px;
  display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.topbar-brand{font-weight:700;font-size:15px;color:var(--text);text-decoration:none;
  display:flex;align-items:center;gap:6px;}
.topbar-brand .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;}
.topbar-nav{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;}
.topbar-nav a{color:var(--text-dim);text-decoration:none;}
.topbar-nav a:hover{color:var(--accent);text-decoration:underline;}
.topbar-nav a.current{color:var(--accent);font-weight:600;}
.page{max-width:760px;margin:0 auto;padding:2.5rem 1.25rem 5rem;}
.page h1{font-size:26px;font-weight:700;margin:0 0 4px;line-height:1.25;}
.page h2{font-size:19px;font-weight:700;margin:2.2em 0 0.6em;padding-top:0.4em;
  border-top:1px solid var(--border);}
.page h2:first-of-type{border-top:none;padding-top:0;margin-top:1.4em;}
.page h3{font-size:15.5px;font-weight:700;margin:1.6em 0 0.5em;}
.page p{margin:0.8em 0;color:var(--text);}
.page ul,.page ol{margin:0.8em 0;padding-left:1.4em;}
.page li{margin:0.3em 0;}
.page a{color:var(--accent);}
.page strong{color:var(--text);}
.page table{width:100%;border-collapse:collapse;margin:1.2em 0;font-size:13.5px;
  display:block;overflow-x:auto;}
.page th,.page td{text-align:left;padding:8px 10px;border:1px solid var(--border);
  vertical-align:top;}
.page th{background:var(--surface-raised);font-weight:700;white-space:nowrap;}
.page blockquote{margin:1.2em 0;padding:0.8em 1.1em;background:var(--surface-raised);
  border-left:3px solid var(--accent);border-radius:0 6px 6px 0;color:var(--text-dim);}
.page blockquote p{margin:0.4em 0;}
.page code{background:var(--surface-raised);padding:0.15em 0.4em;border-radius:4px;
  font-size:0.9em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.page hr{border:none;border-top:1px solid var(--border);margin:2em 0;}
.page details{margin:1em 0;padding:0.8em 1em;background:var(--surface-raised);
  border-radius:6px;border:1px solid var(--border);}
.page summary{cursor:pointer;font-weight:600;color:var(--text-dim);}
.meta{color:var(--text-faint);font-size:13px;margin:0 0 1.6em;}
.disclaimer-banner{background:var(--warn-bg);border:1px solid var(--warn-border);
  border-radius:8px;padding:12px 16px;font-size:13px;color:var(--text-dim);margin-bottom:1.6em;}
.footer-nav{max-width:760px;margin:2rem auto 0;padding:1.5rem 1.25rem 3rem;
  border-top:1px solid var(--border);font-size:13px;color:var(--text-faint);}
.footer-nav a{color:var(--text-dim);text-decoration:none;margin-right:14px;}
.footer-nav a:hover{color:var(--accent);text-decoration:underline;}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-inner">
    <a class="topbar-brand" href="/"><span class="dot"></span>Centerpost</a>
    <nav class="topbar-nav">
      ${NAV_LINKS.replace(`>${title}<`, ` class="current">${title}<`)}
    </nav>
  </div>
</div>
<div class="page">
<div class="disclaimer-banner">This document was prepared with AI assistance and has not been reviewed by an attorney. Centerpost LLC intends to obtain legal review before public release.</div>
${bodyHtml}
</div>
<div class="footer-nav">
  <a href="/">&larr; Back to Centerpost</a>
  ${NAV_LINKS}
</div>
</body>
</html>
`;

for (const doc of DOCS) {
  const mdPath = path.join(LEGAL_DIR, doc.md);
  const bodyHtml = render(mdPath);
  const html = TEMPLATE(doc.title, bodyHtml);
  const outPath = path.join(OUT_DIR, `${doc.slug}.html`);
  fs.writeFileSync(outPath, html);
  console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}
