import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { loadLatestAuditRunsBySite } from "../../analysis/loadLatestAuditRunsBySite.mjs";

test("returns latest audit run per site", async () => {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "audit-test-")
  );

  const siteDir = path.join(rootDir, "site-govcy");
  await fs.mkdir(siteDir, { recursive: true });

  await fs.writeFile(
    path.join(siteDir, "run-20251229.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      auditRun: { startedAt: "2025-12-29T10:00:00Z" },
      scope: { siteId: "govcy" },
      results: { normalisedFindings: { compliance: [], other: [] } }
    })
  );

  await fs.writeFile(
    path.join(siteDir, "run-20251230.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      auditRun: { startedAt: "2025-12-30T10:00:00Z" },
      scope: { siteId: "govcy" },
      results: { normalisedFindings: { compliance: [], other: [] } }
    })
  );

  const result = await loadLatestAuditRunsBySite({ rootDir });

  assert.equal(result.length, 1);
  assert.equal(
    result[0].auditRun.startedAt,
    "2025-12-30T10:00:00Z"
  );
});
