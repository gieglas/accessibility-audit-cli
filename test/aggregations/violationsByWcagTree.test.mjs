import test from "node:test";
import assert from "node:assert/strict";

import { violationsByWcagTree } from "../../analysis/aggregations/violationsByWcagTree.mjs";

test("aggregates WCAG violations into principle → guideline → criterion tree", () => {
    const normalisedFindings = {
        compliance: [
            { wcagCriterionId: "1.1.1", occurrenceCount: 2 },
            { wcagCriterionId: "1.4.3", occurrenceCount: 1 },
            { wcagCriterionId: "1.4.3", occurrenceCount: 2 },
            { wcagCriterionId: "4.1.2", occurrenceCount: 3 }
        ],
        other: [
            { ruleId: "landmark-unique", occurrenceCount: 5 }
        ]
    };

    const standard = {
        criteria: {
            "1.1.1": { principle: "Perceivable" },
            "1.4.3": { principle: "Perceivable" },
            "4.1.2": { principle: "Robust" }
        }
    };

    const result = violationsByWcagTree(normalisedFindings, standard);

    assert.deepEqual(result, {
        totalViolations: 8,
        tree: {
            Perceivable: {
                total: 5,
                guidelines: {
                    "1.1": {
                        total: 2,
                        criteria: {
                            "1.1.1": 2
                        }
                    },
                    "1.4": {
                        total: 3,
                        criteria: {
                            "1.4.3": 3
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

});
