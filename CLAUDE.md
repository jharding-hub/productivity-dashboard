# Centerpost — project context for Claude Code

## What this is
Personal productivity + wellness PWA at centerpost.app. Solo-founder project.
Two repos:
- Front end (this repo): ~/dev/productivity-dashboard
- Private backend Workers:  ~/dev/centerpost-workers

## Architecture — read this before assuming anything
- Modular Vite/React build, BUT there are also standalone static HTML pages:
  kids.html, howto.html, teacher.html, ops.html. These are NOT part of the
  React app and CANNOT read import.meta.env.
- Shared config lives in a committed config.js holding PUBLIC keys only.
  Do NOT introduce .env / import.meta.env for shared config — the static
  pages can't access it. config.js is the correct pattern for this setup.
- public/config.js is the ONLY config.js — canonical for both `vite dev`
  (served from publicDir) and the production build (copied to dist/).
  A duplicate root-level config.js was removed 2026-07-01; don't recreate it.
  config.example.js at the root is just the template for new checkouts.
- Backend = four Cloudflare Workers (in the separate centerpost-workers repo):
  - centerpost-jarvis  — proxies the Claude API for the in-app assistant
    (Axis/Jarvis). Verifies Firebase ID tokens via Google JWKs.
    KV per-UID rate limit: 20 requests / 60s rolling window.
  - centerpost-guardian — daily behavioral-monitoring cron (10:15 UTC),
    email alerts via SendGrid. Endpoints: /security-sweep (sends email),
    /security-sweep-data (returns JSON, no email).
  - centerpost-sentinel — uptime monitoring, Twilio SMS alerts.
  - centerpost-pulse    — daily briefing emails via SendGrid.
- Auth + data: Firebase Auth + Firestore.
- public/architecture.html is a self-contained interactive map of the whole
  system (front end, hosting, Workers, data, security practices, deploy
  pipeline) — linked from the ops console header. When a change here adds,
  removes, or repurposes a structural component (a new Worker, a hosting
  move, a new external service, a changed data store, a new security
  control), update the matching card's what/why/info in that file's
  nodeData object in the same PR. Skip it for routine feature work that
  doesn't change the shape of the system.

## Build / test / deploy
- Dev server (Vite + HMR):  make dev     -> npx vite
- Production build:          make build   -> npm run build (vite build, then
  esbuild-minify dist/legacy.js, then scripts/stamp-sw.js stamps the SW
  version from the git short hash; outputs to dist/)
- Deploy to production:      git push origin main. Cloudflare Pages is
  git-integrated — every push to main auto-builds (npm run build: vite build,
  esbuild-minify legacy.js, then scripts/stamp-sw.js stamps the SW version
  from the git short hash, which resolves in CF's build env) and publishes.
  There is NO separate deploy command. Production host = Cloudflare Pages (cut
  over from GitHub Pages 2026-07), custom domain centerpost.app. public/_headers
  (security + caching headers) is served by CF Pages from the build output
  root (dist/) — GitHub Pages couldn't send custom headers, which is why the
  app moved.
- RETIRED, still present: `npm run deploy` / `make deploy` (the old gh-pages
  push), the gh-pages branch, and CNAME. Do NOT deploy with them — their
  "GitHub Pages" wording is stale. They survive only so gh-pages can still
  serve the www->apex 301 redirect, until a Cloudflare Redirect Rule replaces
  it (then the branch + CNAME + npm script get deleted).
- Clean build artifacts:     make clean   -> rm -rf dist node_modules/.cache
- vite.config.js `base` must stay correct or the deployed page renders blank
  (React never mounts). This has bitten me before.
- No automated test suite — verify changes by running make dev and checking
  the result in the browser.

## Service Worker
- The SW version is AUTO-GENERATED at build time from the git short hash.
  NEVER bump it by hand.
- Why it exists: cache invalidation for non-hashed files (the standalone HTML
  pages, manifest, icons). Vite-hashed JS/CSS busts its own cache.

## Security — prior API-key exposure, so be strict here
- NEVER commit secrets. Only PUBLIC keys belong in config.js.
  Worker secrets live in Cloudflare, never in the repo.
- Before any commit, scan for hardcoded keys, tokens, or credentials.
- Flag anything that would log user input, tokens, or PII.

## How I work
- Explain the plan in plain English BEFORE editing. I review, then you build.
- Small, verifiable steps — one change at a time, and tell me how to confirm it.
- Prefer patterns already in the codebase over pulling in new libraries.

## Repo etiquette
- GitHub: jharding-hub
- Branch: commit to main (solo project, no PR flow).
- Commit messages: single line, capitalized imperative verb, specific about
  what changed. Name the file/component when relevant. No prefixes, no
  trailing period.
  Examples: "Add security scanning workflow", "Enhance galaxy theme styles
  in kids.html", "Update Service Worker version to v15".
