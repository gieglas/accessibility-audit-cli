#!/usr/bin/env node
/**
 * accessibility-audit
 *
 * Thin CLI router.
 *
 * Responsibilities:
 * - Parse top-level command groups
 * - Dispatch execution to existing scripts
 *
 * Non-responsibilities:
 * - Business logic
 * - Validation
 * - File IO
 * - Analysis rules
 */

import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

/**
 * Resolve paths relative to this package
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Remaining CLI arguments (after the binary name)
 */
const args = process.argv.slice(2);

/**
 * Utility: run another script in-process
 * (keeps stack traces, avoids shell indirection)
 */
// async function run(scriptPath, forwardedArgs = []) {
//   const modulePath = path.resolve(__dirname, scriptPath);
//   process.argv = [process.argv[0], modulePath, ...forwardedArgs];
//   await import(modulePath);
// }
async function run(scriptPath, forwardedArgs = []) {
  const modulePath = path.resolve(__dirname, scriptPath);
  const moduleUrl = pathToFileURL(modulePath).href;

  process.argv = [process.argv[0], modulePath, ...forwardedArgs];
  await import(moduleUrl);
}

/**
 * Print top-level usage help
 */
function printHelp() {
  console.log(`
Accessibility Audit CLI

Usage:
  accessibility-audit audit <audit-config.json> [--debug] [--log]

  accessibility-audit analysis init-excel
  accessibility-audit analysis run
  accessibility-audit analysis copy-latest-csv

Notes:
- This tool produces audit and analysis artefacts.
- It does NOT make compliance claims.
`);
}

/**
 * Router entry point
 */
async function main() {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const [command, ...rest] = args;


  // ---- AUDIT COMMANDS ----
  if (command === "audit") {
    return run("./run-audit.mjs", rest);
  }

  // ---- ANALYSIS COMMANDS ----
  if (command === "analysis") {
    const [subcommand, ...analysisArgs] = rest;

    if (subcommand === "init-excel") {
      return run("./init-excel-analysis.mjs", analysisArgs);
    }

    if (subcommand === "run") {
      return run("./run-aggregated-analysis.mjs", analysisArgs);
    }

    if (subcommand === "copy-latest-csv") {
      return run("./copy-latest-csv-for-excel.mjs", analysisArgs);
    }

    console.error(`✖ Unknown analysis command: ${subcommand}`);
    process.exit(1);
  }

  // ---- FALLBACK ----
  console.error(`✖ Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch(err => {
  console.error("✖ Fatal error:", err);
  process.exit(1);
});
