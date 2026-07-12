# Start Vite dev server with HMR
dev:
	npx vite

# Production build into dist/ (vite build -> minify legacy.js -> stamp SW version)
build:
	npm run build

# RETIRED — production now deploys via `git push origin main` (Cloudflare Pages
# git integration auto-builds and publishes). This old gh-pages push is kept
# only until the gh-pages branch is retired (it still serves the www->apex
# redirect). Do NOT use it to deploy.
deploy:
	npm run deploy

# Remove build artifacts
clean:
	rm -rf dist node_modules/.cache
