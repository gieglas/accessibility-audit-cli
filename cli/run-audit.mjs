#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import util from "node:util";

import puppeteer from "puppeteer";
import axe from "axe-core";
import { axeToRawFindings ,normaliseFindings, loadStandard } from "@consevangelou/accessibility-audit-core";
import { saveAuditRun } from "./persistence/saveAuditRun.mjs";

/**
 * Format a Date object into YYYYMMDDHHMMSS
 * @param {*} date Date object (default: now) 
 * @returns {string} Formatted timestamp
 */
function formatTimestampForLog(date = new Date()) {
    const pad = value => value.toString().padStart(2, "0");
    return (
        date.getFullYear().toString() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
}

/**
 * Create a logger that writes to console and optionally to a log file. 
 * @param {*} enableLog Whether to enable file logging
 * @returns {Object} Logger with log, warn, error methods and close() 
 */
async function createLogger(enableLog) {
    const noop = async () => {};

    // If logging is disabled, return no-op close and console-bound methods
    if (!enableLog) {
        return {
            filePath: null,
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            close: noop
        };
    }

    // Ensure log directory exists
    const logDir = path.resolve("log");
    await fs.mkdir(logDir, { recursive: true });

    // Create log file stream
    const logFilePath = path.join(
        logDir,
        `audit-run-${formatTimestampForLog()}.txt`
    );
    const stream = createWriteStream(logFilePath, {
        flags: "a",
        encoding: "utf8"
    });

    // Create console-bound methods
    const original = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };

    // Write log lines to file
    stream.on("error", err => {
        original.error("Failed to write to log file:", err);
    });

    // ISO timestamp + level keeps log files machine-parsable while readable.
    const formatLogLine = (level, args) =>
        `${new Date().toISOString()} ${level.toUpperCase()} ${util.format(...args)}`;

    // Mirror console methods
    const mirror = (level, args) => {
        original[level](...args);
        stream.write(`${formatLogLine(level, args)}\n`);
    };

    // Return logger object
    return {
        filePath: logFilePath,
        log: (...args) => mirror("log", args),
        warn: (...args) => mirror("warn", args),
        error: (...args) => mirror("error", args),
        close: () =>
            new Promise(resolve => {
                stream.end(resolve);
            })
    };
}

/**
 * Entry point for audit execution.
 *
 * Usage:
 *   node cli/run-audit.mjs audit-config.json
 */
async function runAudit({ args, logger }) {
    // ----
    // Step 0: Read CLI arguments
    // ----
    const configPath = args.find(arg => !arg.startsWith("--"));
    const isDebug = args.includes("--debug");

    // debug dir
    const debugDir = path.resolve("debug");

    if (isDebug) {
        logger.log("⚠ Running in DEBUG mode");
        await fs.mkdir(debugDir, { recursive: true });
    }


    if (!configPath) {
        logger.error("Usage: node cli/run-audit.mjs <audit-config.json>");
        const error = new Error("Audit config path is required");
        error.isUsageError = true;
        throw error;
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
                logger.warn(`Skipping invalid site entry: ${siteId}`);
                continue;
            }

            logger.log(`\n▶ Auditing site: ${siteId}`);

            const auditRunId = `run-${Date.now()}`;
            const startedAt = new Date().toISOString();

            const rawFindings = [];

            // ----
            // Step 5: Audit each page
            // ----
            for (const pageConfig of pages) {
                const { pageId, url } = pageConfig;

                if (!pageId || !url) {
                    logger.warn(`Skipping invalid page in site ${siteId}`);
                    continue;
                }

                logger.log(`  → Auditing page: ${pageId}`);

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

                    if (pageRawFindings.length === 0) {
                        logger.log(`    ✔ No issues found on page ${pageId}`);
                    } else {
                        logger.log(`    ⚠ Found ${pageRawFindings.length} issues on page ${pageId}`);
                    }
                    rawFindings.push(...pageRawFindings);
                } catch (err) {
                    logger.error(`    ✖ Failed to audit page ${pageId}: ${err.message}`);
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
            logger.log(`✔ Saved audit run: ${savedPath}`);
        }
    } finally {
        // ----
        // Step 9: Cleanup
        // ----
        await browser.close();
    }
}

async function main() {
    const args = process.argv.slice(2);
    // Check for --log flag to enable file logging
    const enableLog = args.includes("--log");
    const logger = await createLogger(enableLog);

    if (logger.filePath) {
        logger.log(`Logging enabled. Writing to ${logger.filePath}`);
    }

    let exitCode = 0;

    try {
        await runAudit({ args, logger });
    } catch (err) {
        exitCode = 1;

        if (!err?.isUsageError) {
            logger.error("Audit execution failed:", err);
        }
    } finally {
        await logger.close();

        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    }
}

main();
