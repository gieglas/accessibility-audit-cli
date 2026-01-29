import test from "node:test";
import assert from "node:assert/strict";

import { violationsByPrinciple } from "../../analysis/aggregations/violationsByPrinciple.mjs";
import { loadStandard } from "@consevangelou/accessibility-audit-core";

/**
 * Shared test input
 */
const normalisedFindings = {
    compliance: [
        { wcagCriterionId: "1.1.1", occurrenceCount: 2 },
        { wcagCriterionId: "1.4.3", occurrenceCount: 1 },
        { wcagCriterionId: "4.1.2", occurrenceCount: 3 }
    ],
    other: [
        { ruleId: "landmark-unique", occurrenceCount: 5 }
    ]
};

const expectedResult = {
    totalViolations: 6,
    byPrinciple: {
        Perceivable: 3,
        Operable: 0,
        Understandable: 0,
        Robust: 3
    }
};

test("aggregates violations by POUR principle (mock standard)", () => {
    const mockStandard = {
        criteria: {
            "1.1.1": { principle: "Perceivable" },
            "1.4.3": { principle: "Perceivable" },
            "4.1.2": { principle: "Robust" }
        }
    };

    const result = violationsByPrinciple(normalisedFindings, mockStandard);

    assert.deepEqual(result, expectedResult);
});

test("aggregates violations by POUR principle (standard from core package)", async () => {
    const standard = await loadStandard("EN301549-v3.2.1");

    const result = violationsByPrinciple(normalisedFindings, standard);

    assert.deepEqual(result, {
        totalViolations: 6,
        byPrinciple: {
            Perceivable: 3,
            Operable: 0,
            Understandable: 0,
            Robust: 3
        }
    });
});

