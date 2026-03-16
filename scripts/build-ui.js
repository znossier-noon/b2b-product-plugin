#!/usr/bin/env node
// Injects catalog/products.json into ui-source.html → ui.html
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const srcHtml = path.join(ROOT, "ui-source.html");
const catalogJson = path.join(ROOT, "catalog", "products.json");
const outHtml = path.join(ROOT, "ui.html");

const template = fs.readFileSync(srcHtml, "utf8");
const catalog = JSON.parse(fs.readFileSync(catalogJson, "utf8"));

const compactLines = catalog.map((p) => JSON.stringify(p));
const catalogJs = "[\n" + compactLines.join(",\n") + "\n]";

const output = template.replace("/* __CATALOG_DATA__ */[]", catalogJs);

if (output === template) {
  console.error("ERROR: placeholder /* __CATALOG_DATA__ */[] not found in ui-source.html");
  process.exit(1);
}

fs.writeFileSync(outHtml, output);
console.log(
  `ui.html built — ${catalog.length} products embedded (${(Buffer.byteLength(output) / 1024).toFixed(1)} KB)`
);
