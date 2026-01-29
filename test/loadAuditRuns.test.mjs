import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAuditRuns } from "../analysis/loadAuditRuns.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("loads valid audit runs and skips invalid files", async () => {
  const fixturesDir = path.join(__dirname, "fixtures", "audits");

  const runs = [];

  for await (const auditRun of loadAuditRuns({ rootDir: fixturesDir })) {
    runs.push(auditRun);
  }

  // Only valid audit runs should be yielded
  assert.equal(runs.length, 2);

  const ids = runs.map(r => r.auditRun.auditRunId).sort();

  assert.deepEqual(ids, ["run-1", "run-2"]);
});
