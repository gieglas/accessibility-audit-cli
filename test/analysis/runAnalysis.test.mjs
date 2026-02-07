import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { runAggregatedAnalysis } from "../../analysis/runAggregatedAnalysis.mjs";
import { loadStandard } from "@consevangelou/accessibility-audit-core";

const standard = await loadStandard("EN301549-v3.2.1");

test("runAggregatedAnalysis aggregates WCAG violations across multiple audit runs", async () => {
  // --- Setup temporary directory
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-analysis-"));

  // --- Fake audit run #1
  await fs.writeFile(
    path.join(tmpDir, "run-1.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      auditRun: { auditRunId: "run-1", startedAt: "2024-01-01T12:00:00Z" },
      scope: { siteId: "site-a" },
      results: {
        normalisedFindings: {
          compliance: [
            { wcagCriterionId: "1.1.1", occurrenceCount: 2 }
          ],
          other: []
        }
      }
    })
  );

  // --- Fake audit run #2
  await fs.writeFile(
    path.join(tmpDir, "run-2.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      auditRun: { auditRunId: "run-2", startedAt: "2024-01-02T12:00:00Z" },
      scope: { siteId: "site-b" },
      results: {
        normalisedFindings: {
          compliance: [
            { wcagCriterionId: "4.1.2", occurrenceCount: 3 }
          ],
          other: []
        }
      }
    })
  );

  // --- Run analysis
  const result = await runAggregatedAnalysis({
    rootDir: tmpDir,
    standard
  });

  // --- Assertions
  assert.deepEqual(result.aggregations.violationsByWcagTree, {
    totalViolations: 5,
    tree: {
      Perceivable: {
        total: 2,
        guidelines: {
          "1.1": {
            total: 2,
            criteria: {
              "1.1.1": 2
            }
          }
        }
      },
      Robust: {
        total: 3,
        guidelines: {
          "4.1": {
            total: 3,
            criteria: {
              "4.1.2": 3
            }
          }
        }
      }
    }
  });

  assert.deepEqual(result.sites, [
    {
      siteId: "site-a",
      violations: { compliance: 2, other: 0 }
    },
    {
      siteId: "site-b",
      violations: { compliance: 3, other: 0 }
    }
  ]);

});

test("runAggregatedAnalysis returns empty sites array when no audit runs are found", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-analysis-empty-"));

  const result = await runAggregatedAnalysis({
    rootDir: tmpDir,
    standard
  });

  assert.deepEqual(result.sites, []);
});
