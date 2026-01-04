import test, { describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { saveAuditRun } from "../../cli/persistence/saveAuditRun.mjs";

const TEST_DIR = path.join("test", "tmp");

describe("saveAuditRun.mjs", () => {
  afterEach(async () => {
    // Clean up test directory after each test
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  test("persists an audit run using site-first structure", async () => {
    const auditRunData = {
      schemaVersion: "1.0",
      auditRun: {
        startedAt: "2025-03-01T10:00:00Z"
      },
      standard: {
        standardId: "EN301549_v3.2.1"
      },
      scope: {
        siteId: "site-govcy"
      },
      results: {
        rawFindings: [],
        normalisedFindings: []
      }
    };

    const savedPath = await saveAuditRun(auditRunData, {
      baseDir: TEST_DIR
    });

    // Expected path:
    // test/tmp/EN301549_v3.2.1/site-govcy/run-20250301.json
    const expectedPath = path.join(
      TEST_DIR,
      "EN301549_v3.2.1",
      "site-govcy",
      "run-20250301.json"
    );

    assert.equal(savedPath, path.resolve(expectedPath));

    // File exists
    const fileContents = await fs.readFile(savedPath, "utf-8");
    const parsed = JSON.parse(fileContents);

    // Minimal content verification
    assert.equal(parsed.schemaVersion, "1.0");
    assert.equal(parsed.scope.siteId, "site-govcy");
    assert.equal(parsed.standard.standardId, "EN301549_v3.2.1");
    assert.equal(parsed.auditRun.startedAt, "2025-03-01T10:00:00Z");
  });

  test("throws if required fields are missing", async () => {
    const invalidAuditRun = {
      scope: { siteId: "site-govcy" }
    };

    await assert.rejects(
      () =>
        saveAuditRun(invalidAuditRun, {
          baseDir: TEST_DIR
        }),
      /startedAt/
    );
  });
});
