#!/usr/bin/env node
// Fetches product images via DuckDuckGo, resizes to 400×400 with sharp, saves under catalog/images/. Use --force to re-download.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "catalog", "products.json");
const IMAGES_DIR = path.join(ROOT, "catalog", "images");

const FORCE = process.argv.includes("--force");
const CONCURRENCY = 2;
const DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSearchQuery(product) {
  const brand = product.brand || "";
  const title = product.title || "";
  const words = title
    .replace(/\d+GB|\d+TB|\d+mm|\d+gsm|\d+ppm|\d+VA|\d+W|\d+V|\d+Ah|\d+ml|\d+oz|\d+ct|\d+pk|\d+cm|Box\/\d+|\d+-Pack|\d+-Pair|\d+-Piece|\d+-Roll|\d+-Port/gi, "")
    .replace(/[()\/\[\]]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 6)
    .join(" ");
  return `${brand} ${words} product photo white background`.trim();
}

async function getVQD(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const html = await res.text();
  const m = html.match(/vqd=['"]([^'"]+)['"]/);
  if (m) return m[1];
  const m2 = html.match(/vqd=([\d-]+)/);
  if (m2) return m2[1];
  return null;
}

async function searchImages(query) {
  const vqd = await getVQD(query);
  if (!vqd) return [];

  const url =
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}` +
    `&vqd=${vqd}&f=size:Medium,type:photo&p=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
      Referer: "https://duckduckgo.com/",
    },
  });

  if (!res.ok) return [];
  try {
    const data = await res.json();
    return (data.results || []).map((r) => r.image).filter(Boolean);
  } catch {
    return [];
  }
}

async function downloadAndProcess(imageUrl, outPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return false;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false;

    await sharp(buf)
      .resize(400, 400, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toFile(outPath);

    return true;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

async function processProduct(product, index, total) {
  const outPath = path.join(IMAGES_DIR, product.image);
  const label = `[${index + 1}/${total}]`;

  if (!FORCE && fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
    console.log(`${label} SKIP (exists) ${product.image}`);
    return true;
  }

  // Ensure directory
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const query = buildSearchQuery(product);
  console.log(`${label} Searching: ${query.substring(0, 60)}…`);

  let urls = [];
  try {
    urls = await searchImages(query);
  } catch (e) {
    console.log(`${label} Search failed: ${e.message}`);
  }

  if (urls.length === 0) {
    // Simpler fallback query
    const fallback = `${product.brand} ${product.subcategory || ""} product`.trim();
    console.log(`${label} Retrying with: ${fallback}`);
    try {
      urls = await searchImages(fallback);
    } catch {
      // give up
    }
  }

  // Try up to 5 image URLs
  for (let i = 0; i < Math.min(urls.length, 5); i++) {
    const ok = await downloadAndProcess(urls[i], outPath);
    if (ok) {
      const size = (fs.statSync(outPath).size / 1024).toFixed(0);
      console.log(`${label} OK (${size} KB) ${product.image}`);
      return true;
    }
  }

  console.log(`${label} FAILED ${product.image}`);
  return false;
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  console.log(`\nDownloading images for ${catalog.length} products…\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < catalog.length; i += CONCURRENCY) {
    const batch = catalog.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((p, j) => processProduct(p, i + j, catalog.length))
    );
    for (const r of results) {
      if (r) success++;
      else failed++;
    }
    if (i + CONCURRENCY < catalog.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${success} downloaded, ${failed} failed out of ${catalog.length}\n`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
