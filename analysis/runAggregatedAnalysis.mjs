// analysis/runAggregatedAnalysis.mjs

import { loadAuditRuns } from "./loadAuditRuns.mjs";
import { loadLatestAuditRunsBySite } from "./loadLatestAuditRunsBySite.mjs";
import { violationsByPrinciple } from "./aggregations/violationsByPrinciple.mjs";
import { violationsByWcagTree } from "./aggregations/violationsByWcagTree.mjs";

/**
 * Run accessibility analysis over multiple audit runs.
 *
 * @param {Object} options
 * @param {string} options.rootDir Directory containing audit-run JSON files
 * @param {Object} options.standard Reference accessibility standard
 * @returns {Object} Analysis result
 */
export async function runAggregatedAnalysis({
  rootDir,
  standard,
  mode = "latest" // "latest" | "all"
}) {
  const aggregatedNormalisedFindings = {
    compliance: [],
    other: []
  };
  const siteMap = new Map();

  /**
 * Helper to accumulate per-site violation counts from an audit run.
 *
 * violations.compliance / violations.other represent TOTAL occurrences (sum of occurrenceCount).
 *
 * @param {Map<string, {siteId: string, violations: {compliance: number, other: number}}>} siteMap
 * @param {*} auditRun
 */
  function accumulateSiteviolations(siteMap, auditRun) {
    const siteId = auditRun?.scope?.siteId;
    if (!siteId) return;

    if (!siteMap.has(siteId)) {
      siteMap.set(siteId, {
        siteId,
        violations: { compliance: 0, other: 0 }
      });
    }

    const entry = siteMap.get(siteId);
    const findings = auditRun?.results?.normalisedFindings;

    const sumOccurrences = (arr) =>
      (arr ?? []).reduce((sum, f) => {
        const n = Number(f?.occurrenceCount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

    entry.violations.compliance += sumOccurrences(findings?.compliance);
    entry.violations.other += sumOccurrences(findings?.other);
  }


  // console.log("DEBUG rootDir:", rootDir);
  if (mode === "latest") {
    const auditRuns = await loadLatestAuditRunsBySite({ rootDir });
    for (const auditRun of auditRuns) {
      // console.log("DEBUG auditRun:"
      //   , auditRun.scope?.siteId
      //   , auditRun.auditRun?.startedAt);
      // aggregate(auditRun.results.normalisedFindings);
      accumulateSiteviolations(siteMap, auditRun);

      aggregatedNormalisedFindings.compliance.push(
        ...(auditRun.results.normalisedFindings.compliance || [])
      );
      aggregatedNormalisedFindings.other.push(
        ...(auditRun.results.normalisedFindings.other || [])
      );
    }
  } else {
    // Stream audit runs one by one (scales well)
    for await (const auditRun of loadAuditRuns({ rootDir })) {
      const findings = auditRun?.results?.normalisedFindings;
      // console.log("DEBUG findings:", findings);
      if (!findings) continue;

      accumulateSiteviolations(siteMap, auditRun);

      if (Array.isArray(findings.compliance)) {
        aggregatedNormalisedFindings.compliance.push(...findings.compliance);
      }

      if (Array.isArray(findings.other)) {
        aggregatedNormalisedFindings.other.push(...findings.other);
      }
    }
  }

  // console.log(
  //   "DEBUG aggregated compliance:",
  //   aggregatedNormalisedFindings
  // );
  const sites = Array.from(siteMap.values());

  // console.log(
  //   "DEBUG sites:",
  //   sites
  // );

  return {
    generatedAt: new Date().toISOString(),

    aggregations:
    {
      // violationsByPrinciple: violationsByPrinciple(
      //   aggregatedNormalisedFindings,
      //   standard
      // ),

      violationsByWcagTree: violationsByWcagTree(
        aggregatedNormalisedFindings,
        standard
      )
    },

    sites
  };
}
