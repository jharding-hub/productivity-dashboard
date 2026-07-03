# Start Vite dev server with HMR
dev:
	npx vite

# Production build into dist/ (vite build -> minify legacy.js -> stamp SW version)
build:
	npm run build

# Build and deploy to GitHub Pages (gh-pages branch)
deploy:
	npm run deploy

# Remove build artifacts
clean:
	rm -rf dist node_modules/.cache
