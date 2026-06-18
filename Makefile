# Start Vite dev server with HMR
dev:
	npx vite

# Production build into dist/
build:
	npx vite build

# Build and deploy to GitHub Pages (gh-pages branch)
deploy:
	npx vite build && npx gh-pages -d dist -b gh-pages --dotfiles

# Remove build artifacts
clean:
	rm -rf dist node_modules/.cache
