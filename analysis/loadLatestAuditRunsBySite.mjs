import { loadAuditRuns } from "./loadAuditRuns.mjs";

/**
 * Load the latest audit-run per site.
 *
 * Uses the same traversal and validation logic as loadAuditRuns,
 * but returns ONLY the most recent audit-run for each site.
 *
 * @param {Object} options
 * @param {string} options.rootDir
 * @returns {Array<Object>} Array of audit-run objects
 */
export async function loadLatestAuditRunsBySite({ rootDir }) {
  const latestBySite = new Map();

  for await (const auditRun of loadAuditRuns({ rootDir })) {
    const siteId =
      auditRun?.scope?.siteId ||
      auditRun?.auditRun?.siteId;

    const startedAt = auditRun?.auditRun?.startedAt;

    if (!siteId || !startedAt) continue;

    const ts = new Date(startedAt).getTime();
    if (Number.isNaN(ts)) continue;

    const existing = latestBySite.get(siteId);
    if (!existing) {
      latestBySite.set(siteId, auditRun);
      continue;
    }

    const existingTs = new Date(
      existing.auditRun.startedAt
    ).getTime();

    if (ts > existingTs) {
      latestBySite.set(siteId, auditRun);
    }
  }

  return Array.from(latestBySite.values());
}
