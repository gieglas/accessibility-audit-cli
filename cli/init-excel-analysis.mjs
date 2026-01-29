#!/usr/bin/env node

/**
 * Initialise the Excel analysis workspace.
 *
 * This script copies Excel analysis templates shipped with the CLI
 * (read-only, inside the npm package) into a user-controlled workspace
 * (relative to the current working directory).
 *
 * Design principles:
 * - Never write inside node_modules
 * - Never overwrite user files
 * - Fail loudly on unsafe conditions
 * - No-op when executed inside the CLI package itself
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

/**
 * Resolve absolute paths for:
 * - the package root (where this script lives)
 * - the caller's working directory
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the CLI package root */
const packageRoot = path.resolve(__dirname, "..");

/** Absolute path to where the command was executed */
const cwd = process.cwd();

/**
 * Source directory containing Excel templates inside the package.
 * This directory is treated as read-only.
 */
const sourceDir = path.join(
  packageRoot,
  "excel_analysis",
  "aggregated_analysis"
);

/**
 * Destination directory inside the user's workspace.
 * This directory is writable and owned by the user.
 */
const destinationDir = path.join(
  cwd,
  "excel_analysis",
  "aggregated_analysis"
);

/**
 * List of template files to copy.
 * These are considered reference assets and should never be modified in-place.
 */
const filesToCopy = [
  "aggregated-analysis-template.xlsm",
  "aggregated-analysis.csv"
];

/**
 * Determine whether the script is being executed from within
 * the CLI package repository itself.
 *
 * If so, the script should perform no action.
 *
 * @returns {boolean} true if cwd === packageRoot
 */
function isRunningInsidePackageRepo() {
  return path.resolve(cwd) === path.resolve(packageRoot);
}

/**
 * Verify that all expected source files exist inside the package.
 *
 * This guards against:
 * - broken npm publishes
 * - incomplete installations
 * - accidental file moves during development
 *
 * @throws {Error} if any source file is missing
 */
async function ensureSourceFilesExist() {
  for (const file of filesToCopy) {
    const sourcePath = path.join(sourceDir, file);
    try {
      await fs.access(sourcePath);
    } catch {
      throw new Error(`✖ Missing source file in package: ${sourcePath}`);
    }
  }
}

/**
 * Verify that copying is safe and non-destructive.
 *
 * If any destination file already exists, the operation is aborted.
 * Excel templates are assumed to be manually edited by users and
 * must never be overwritten implicitly.
 *
 * @throws {Error} if any destination file already exists
 */
async function ensureDestinationIsEmpty() {
  for (const file of filesToCopy) {
    const destinationPath = path.join(destinationDir, file);
    try {
      await fs.access(destinationPath);
      throw new Error(
        `✖ Destination file already exists: ${destinationPath}\n. Refusing to overwrite existing analysis files.`
      );
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
}

/**
 * Copy Excel template files from the package into the user's workspace.
 *
 * The destination directory is created if it does not exist.
 *
 * @returns {Promise<void>}
 */
async function copyTemplateFiles() {
  await fs.mkdir(destinationDir, { recursive: true });

  for (const file of filesToCopy) {
    const src = path.join(sourceDir, file);
    const dest = path.join(destinationDir, file);
    await fs.copyFile(src, dest);
    console.log(`→ Copied: ${dest}`);
  }
}

/**
 * Main execution entry point.
 *
 * Handles:
 * - package-repo guard
 * - validation
 * - copying
 * - user-facing messages
 */
async function main() {
  // Guard: do nothing when executed inside the CLI package itself
  if (isRunningInsidePackageRepo()) {
    console.log(
      "Info: Excel analysis initialisation skipped.\n" +
      "⚠ This command is intended to be run from a consumer project, not from within the accessibility-audit-cli repository."
    );
    return;
  }

  try {
    await ensureSourceFilesExist();
    await ensureDestinationIsEmpty();
    await copyTemplateFiles();

    console.log("\n✔ Excel analysis workspace initialised successfully.");
  } catch (err) {
    console.error(`\n✖ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
