# Product images

JPEG, 400×400, white background. Paths must match the `image` field in `catalog/products.json` (e.g. `it-equipment/hp-probook-450-g10.jpg`).

To refresh images: `node scripts/download-images.js` (skips existing) or `node scripts/download-images.js --force`. The plugin loads them from GitHub raw.
