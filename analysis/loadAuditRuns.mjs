import fs from "node:fs/promises";
import path from "node:path";

/**
 * Recursively walk a directory and yield file paths.
 *
 * @param {string} dir
 */
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

/**
 * Load audit-run JSON files lazily.
 *
 * IMPORTANT:
 * - Does NOT load everything into memory
 * - Yields one audit-run at a time
 * - Silently skips invalid files
 *
 * @param {Object} options
 * @param {string} options.rootDir Directory containing audit-run files
 */
export async function* loadAuditRuns({ rootDir }) {
  if (!rootDir) {
    throw new Error("loadAuditRuns requires a rootDir");
  }

  const resolvedRoot = path.resolve(rootDir);

  for await (const filePath of walk(resolvedRoot)) {
    // console.log("DEBUG loading audit file:", filePath);
    // Only consider JSON files
    if (!filePath.endsWith(".json")) continue;

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const auditRun = JSON.parse(raw);

      // Very light validation (defensive, not strict)
      if (
        auditRun?.schemaVersion &&
        auditRun?.auditRun &&
        auditRun?.results
      ) {
        yield auditRun;
      }
    } catch (err) {
      // Never crash analysis because of one bad file
      console.warn(`⚠ Skipping invalid audit file: ${filePath}`);
    }
  }
}
