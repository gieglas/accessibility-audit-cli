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

  // console.log("DEBUG rootDir:", rootDir);
  if (mode === "latest") {
    const auditRuns = await loadLatestAuditRunsBySite({ rootDir });
    for (const auditRun of auditRuns) {
      // console.log("DEBUG auditRun:"
      //   , auditRun.scope?.siteId
      //   , auditRun.auditRun?.startedAt);
      // aggregate(auditRun.results.normalisedFindings);
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
    }
  };
}
