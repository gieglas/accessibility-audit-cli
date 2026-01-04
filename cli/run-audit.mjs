#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import puppeteer from "puppeteer";
import axe from "axe-core";

import { axeToRawFindings ,normaliseFindings, loadStandard } from "@consevangelou/accessibility-audit-core";
import { saveAuditRun } from "./persistence/saveAuditRun.mjs";

/**
 * Entry point for audit execution.
 *
 * Usage:
 *   node cli/run-audit.mjs audit-config.json
 */
async function runAudit() {
    // ----
    // Step 0: Read CLI arguments
    // ----
    const args = process.argv.slice(2);

    const configPath = args.find(arg => !arg.startsWith("--"));
    const isDebug = args.includes("--debug");

    // debug dir
    const debugDir = path.resolve("debug");

    if (isDebug) {
        console.log("⚠ Running in DEBUG mode");
        await fs.mkdir(debugDir, { recursive: true });
    }


    if (!configPath) {
        console.error("Usage: node cli/run-audit.mjs <audit-config.json>");
        process.exit(1);
    }

    // ----
    // Step 1: Load audit input JSON
    // ----
    const resolvedConfigPath = path.resolve(configPath);
    const configRaw = await fs.readFile(resolvedConfigPath, "utf-8");
    const config = JSON.parse(configRaw);

    // Basic validation (v1)
    if (!config.standard) {
        throw new Error("Audit config must include 'standard'");
    }

    if (!Array.isArray(config.sites) || config.sites.length === 0) {
        throw new Error("Audit config must include non-empty 'sites' array");
    }

    // ----
    // Step 2: Load reference standard JSON
    // ----
    
    const standard = await loadStandard(config.standard);

    // ----
    // Step 3: Launch browser once (reuse across sites)
    // ----
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {
        // ----
        // Step 4: Iterate over sites (one audit-run per site)
        // ----
        for (const site of config.sites) {
            const { siteId, pages } = site;

            if (!siteId || !Array.isArray(pages) || pages.length === 0) {
                console.warn(`Skipping invalid site entry: ${siteId}`);
                continue;
            }

            console.log(`\n▶ Auditing site: ${siteId}`);

            const auditRunId = `run-${Date.now()}`;
            const startedAt = new Date().toISOString();

            const rawFindings = [];

            // ----
            // Step 5: Audit each page
            // ----
            for (const pageConfig of pages) {
                const { pageId, url } = pageConfig;

                if (!pageId || !url) {
                    console.warn(`Skipping invalid page in site ${siteId}`);
                    continue;
                }

                console.log(`  → Auditing page: ${pageId}`);

                const page = await browser.newPage();

                try {
                    await page.goto(url, { waitUntil: "networkidle2" });


                    // Give client-side rendering time to finish (Puppeteer-version safe)
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // ---
                    //debug
                    // ----
                    if (isDebug) {
                        // Screenshot of rendered page
                        await page.screenshot({
                            path: path.join(debugDir, `debug-${siteId}-${pageId}.png`),
                            fullPage: true
                        });

                        // Dump rendered HTML
                        const html = await page.content();
                        await fs.writeFile(
                            path.join(debugDir, `debug-${siteId}-${pageId}.html`),
                            html
                        );
                    }

                    // Inject axe-core
                    // await page.addScriptTag({ path: require.resolve("axe-core") });
                    const axePath = fileURLToPath(import.meta.resolve("axe-core"));

                    await page.addScriptTag({
                        path: axePath
                    });

                    // Run axe
                    const axeResults = await page.evaluate(async () => {
                        return await axe.run();
                    });

                    // Convert to RawFindings
                    const pageRawFindings = axeToRawFindings(axeResults, {
                        auditRunId,
                        siteId,
                        pageId,
                        pageUrl: url
                    });

                    rawFindings.push(...pageRawFindings);
                } catch (err) {
                    console.error(`    ✖ Failed to audit page ${pageId}: ${err.message}`);
                } finally {
                    await page.close();
                }
            }

            // ----
            // Step 6: Normalise findings (per site)
            // ----
            const normalisedFindings = normaliseFindings(rawFindings, standard);

            const finishedAt = new Date().toISOString();
            const durationMs =
                new Date(finishedAt).getTime() - new Date(startedAt).getTime();

            // ----
            // Step 7: Assemble audit-run object
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
                    siteId,
                    pages
                },

                results: {
                    rawFindings,
                    normalisedFindings
                }
            };

            // ----
            // Step 8: Persist audit-run
            // ----
            const savedPath = await saveAuditRun(auditRunData);
            console.log(`✔ Saved audit run: ${savedPath}`);
        }
    } finally {
        // ----
        // Step 9: Cleanup
        // ----
        await browser.close();
    }
}

// Run
runAudit().catch(err => {
    console.error("Audit execution failed:", err);
    process.exit(1);
});
