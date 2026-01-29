#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { runAggregatedAnalysis } from "../analysis/runAggregatedAnalysis.mjs";
import { loadStandard } from "@consevangelou/accessibility-audit-core";
import { toCsvWcagFlat } from "../analysis/exports/toCsvWcagFlat.mjs";



function formatDateYYYYMMDD(date = new Date()) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Parse CLI arguments (very small + explicit on purpose)
 */
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const key = arg.replace(/^--/, "");
            const value = argv[i + 1] && !argv[i + 1].startsWith("--")
                ? argv[++i]
                : true;
            args[key] = value;
        }
    }
    return args;
}

async function run() {
    const args = parseArgs(process.argv.slice(2));

    if (!args.config) {
        console.error("Usage: node cli/run-aggregated-analysis.mjs --config <analysis-config.json>");
        process.exit(1);
    }

    // ----
    // Step 1: Load config file
    // ----
    const configPath = path.resolve(args.config);
    const configRaw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configRaw);

    // ----
    // Step 2: Apply CLI overrides (CLI > config)
    // ----
    const auditsPath = path.resolve(
        args.audits ?? config.auditsPath
    );

    const standardId = args.standard ?? config.standard;
    const mode = args.mode ?? config.mode ?? "latest";

    const outputConfig = {
        directory: path.resolve(
            args.out ?? config.output?.directory ?? "./analysis-output"
        ),
        filenamePrefix:
            config.output?.filenamePrefix ?? "accessibility-analysis",
        formats: config.output?.formats ?? ["json"]
    };

    // ----
    // Step 3: Load standard (from core package)
    // ----
    const standard = await loadStandard(standardId);

    // ----
    // Step 4: Run analysis
    // ----
    const analysisResult = await runAggregatedAnalysis({
        rootDir: auditsPath,
        standard,
        mode
    });

    // ----
    // Step 5: Persist outputs
    // ----
    const generatedAt = new Date();
    const dateSuffix = formatDateYYYYMMDD(generatedAt);

    await fs.mkdir(outputConfig.directory, { recursive: true });

    // Assemble final persisted payload
    const persistedResult = {
        generatedAt: generatedAt.toISOString(),

        standard: {
            standardId: standard.standardId,
            wcagVersion: standard.wcagVersion
        },

        mode,

        source: {
            auditsPath
        },

        aggregations: analysisResult.aggregations
    };

    if (outputConfig.formats.includes("json")) {
        const outPath = path.join(
            outputConfig.directory,
            `${outputConfig.filenamePrefix}-${dateSuffix}.json`
        );

        await fs.writeFile(
            outPath,
            JSON.stringify(persistedResult, null, 2),
            "utf-8"
        );

        console.log(`✔ JSON written to ${outPath}`);
    }

    if (outputConfig.formats.includes("csv")) {
        const csv = toCsvWcagFlat(
            analysisResult.aggregations.violationsByWcagTree
        );

        const outPath = path.join(
            outputConfig.directory,
            `${outputConfig.filenamePrefix}-${dateSuffix}.csv`
        );

        await fs.writeFile(outPath, csv, "utf-8");
        console.log(`✔ CSV written to ${outPath}`);
    }



    // ----
    // Step 6: Minimal stdout summary
    // ----
    const tree = analysisResult.aggregations?.violationsByWcagTree;

    if (tree) {
        console.log("\nSummary:");
        console.log(`Total violations: ${tree.totalViolations}`);

        for (const [principle, data] of Object.entries(tree.tree)) {
            console.log(`  ${principle}: ${data.total}`);
        }
    }
}

// Run
run().catch(err => {
    console.error("Analysis failed:", err);
    process.exit(1);
});
