# B2B Product Populator

Figma plugin that fills product card designs with data from a built-in catalog of 210 B2B products (real brands, 6 categories). No API keys or external services.

## Features

- Populate from 210 products across IT Equipment, Office Supplies, Medical, Automotive, MRO, Packaging
- Search/filter by keyword; filter by category; DHM, SAR, EGP
- Detects product cards by layer names; fills title, price, image, rating, reviews, description, brand, discount
- Images loaded from repo (400×400) via GitHub raw

## Setup

```bash
npm install
npm run build
```

In Figma: **Plugins → Development → Import plugin from manifest** → choose `manifest.json`.

## Usage

1. Name card layers as in the table below (case-sensitive).
2. Select the card frame(s) (or a parent containing cards).
3. Run the plugin and click **Populate Products**.

### Layer names

| Layer | Content |
|-------|--------|
| `product-image` | Product photo (required) |
| `product-title` | Title (required) |
| `product-price` | Price with currency |
| `product-rating` | 4.0–5.0 |
| `product-reviews` | Review count |
| `product-description` | Short description |
| `product-brand` | Brand name |
| `product-discount` | Discount % |
| `original-price` | Strikethrough price |

## Catalog

- **Data:** `catalog/products.json`
- **Images:** `catalog/images/` by category (e.g. `it-equipment/`, `office-supplies/`). Filenames must match the `image` field in the catalog.

After editing `catalog/products.json`, run `npm run build` so the UI bundle is updated.

To (re)download images (DuckDuckGo + sharp):

```bash
node scripts/download-images.js           # skip existing
node scripts/download-images.js --force   # re-download all
```

## Project layout

```
├── manifest.json
├── src/code.ts          → compiled to code.js
├── ui-source.html       → built to ui.html (catalog embedded)
├── catalog/
│   ├── products.json
│   └── images/
└── scripts/
    ├── build-ui.js      → injects catalog into ui.html
    ├── inject-html.js   → injects ui.html into code.js
    └── download-images.js
```

**Commands:** `npm run build` (full); `npm run build:catalog` (ui.html only); `npm run build:ts` (TypeScript only); `npm run watch` (ts watch).

## Publishing as organization plugin

Private plugins are visible only to your Figma org (no Community review). Requires an Organization or Enterprise plan.

1. Run `npm run build` and test via Development → Import plugin.
2. **Plugins → Development → [plugin name] → Publish.** On “Add the final details”, set **Publish to** to your organization (not Community).
3. Only org members can install it. Updates: publish again from Development.

[Create private organization plugins](https://help.figma.com/hc/en-us/articles/4404228629655) · [Publish plugins](https://help.figma.com/hc/en-us/articles/360042293394)
