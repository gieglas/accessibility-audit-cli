import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import axe from "axe-core";

import { axeToRawFindings ,normaliseFindings} from "accessibility-audit-core";

import { normaliseFindings } from "../core/normalisation/normaliseFindings.mjs";
import { saveAuditRun } from "./persistence/saveAuditRun.mjs";


import fs from "node:fs";

// Load reference standard
const standard = JSON.parse(
  fs.readFileSync(
    new URL("../core/standards/en301549-v3.2.1.json", import.meta.url)
  )
);

// ----
// Minimal execution context
// ----
const auditRunId = `run-${Date.now()}`;

const startedAt = new Date().toISOString();


const context = {
  auditRunId,
  siteId: "demo-site",
  pageId: "home"
};

const url = "https://www.gov.cy/?s=performance";
// const url = "https://design-system.w3.org/layouts/";

// ----
// Step 1: Launch browser and open page
// ----
const browser = await puppeteer.launch({ headless: "new" , 
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]});
const page = await browser.newPage();

await page.goto(url, { waitUntil: "networkidle2" });

// ----
// Step 2: Inject axe-core into the page
// ----
const axePath = fileURLToPath(import.meta.resolve("axe-core"));

await page.addScriptTag({
  path: axePath
});
// ----
// Step 3: Run axe in the page context
// ----
const axeResults = await page.evaluate(async () => {
  return await axe.run();
});

// ----
// Step 4: Convert axe results → RawFindings
// ----
const rawFindings = axeToRawFindings(axeResults, {
  ...context,
  pageUrl: url
});

// ----
// Step 5: Normalise
// ----
const normalisedFindings = normaliseFindings(rawFindings, standard);

const finishedAt = new Date().toISOString();
const durationMs =
  new Date(finishedAt).getTime() - new Date(startedAt).getTime();

// ----
// Step 6: Assemble audit-run data
// ----
const auditRunData = {
  schemaVersion: "1.0",

  auditRun: {
    auditRunId,
    startedAt,
    finishedAt,
    durationMs
  },

  environment: {
    tool: "axe-core",
    nodeVersion: process.version
  },

  standard: {
    standardId: standard.standardId,
    wcagVersion: standard.wcagVersion
  },

  scope: {
    siteId: context.siteId,
    pages: [
      {
        pageId: context.pageId,
        url
      }
    ]
  },

  results: {
    rawFindings,
    normalisedFindings
  }
};

// ----
// Step 7: Persist audit run
// ----
const savedPath = await saveAuditRun(auditRunData);

console.log(`✔ Audit run saved to ${savedPath}`);


// ----
// Output (temporary)
// ----
// console.log(`Axe-core audit completed for ${url}`);
// console.log(JSON.stringify(axeResults, null, 2));
console.log("Raw findings:", rawFindings.length);
console.log(JSON.stringify(rawFindings, null, 2));
console.log("Normalised findings:", normalisedFindings.length);

console.log(JSON.stringify(normalisedFindings, null, 2));

// ----
// Cleanup
// ----
await browser.close();
