import fs from "node:fs/promises";
import path from "node:path";

/**
 * Persist a completed audit run to disk.
 *
 * One audit run represents one site audited at a specific time.
 *
 * Folder structure:
 * audits/{standardId}/{siteId}/run-YYYYMMDD.json
 *
 * @param {Object} auditRunData Fully assembled audit-run object
 * @param {Object} options
 * @param {string} options.baseDir Base directory for audit storage
 * @returns {string} Absolute path of the saved file
 */
export async function saveAuditRun(
  auditRunData,
  { baseDir = "audits" } = {}
) {
  // Basic validation (defensive, not exhaustive)
  if (!auditRunData?.auditRun?.startedAt) {
    throw new Error("auditRun.startedAt is required");
  }

  if (!auditRunData?.scope?.siteId) {
    throw new Error("scope.siteId is required");
  }

  if (!auditRunData?.standard?.standardId) {
    throw new Error("standard.standardId is required");
  }

  const { startedAt } = auditRunData.auditRun;
  const { siteId } = auditRunData.scope;
  const { standardId } = auditRunData.standard;

  // Derive YYYYMMDD from startedAt (UTC)
  const date = new Date(startedAt);
  const yyyymmdd =
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");

  // Build directory path
  const dirPath = path.join(baseDir, standardId, siteId);

  // Ensure directory exists
  await fs.mkdir(dirPath, { recursive: true });

  // File name
  const fileName = `run-${yyyymmdd}.json`;
  const filePath = path.join(dirPath, fileName);

  // Write JSON (pretty-printed for inspection)
  const json = JSON.stringify(auditRunData, null, 2);
  await fs.writeFile(filePath, json, "utf-8");

  return path.resolve(filePath);
}
