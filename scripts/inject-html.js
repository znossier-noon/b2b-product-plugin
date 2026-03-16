#!/usr/bin/env node
// Injects ui.html into code.js as __html__. Run after build-ui.js and tsc.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const uiHtmlPath = path.join(ROOT, "ui.html");
const codeJsPath = path.join(ROOT, "code.js");

if (!fs.existsSync(uiHtmlPath)) {
  console.error("ERROR: ui.html not found. Run build-ui.js first.");
  process.exit(1);
}
if (!fs.existsSync(codeJsPath)) {
  console.error("ERROR: code.js not found. Run tsc first.");
  process.exit(1);
}

const uiHtml = fs.readFileSync(uiHtmlPath, "utf8");
const codeJs = fs.readFileSync(codeJsPath, "utf8");
const preamble = "var __html__ = " + JSON.stringify(uiHtml) + ";\n";
fs.writeFileSync(codeJsPath, preamble + codeJs);
console.log("Injected __html__ into code.js");
