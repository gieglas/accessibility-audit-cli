import test from "node:test";
import assert from "node:assert/strict";

import { toCsvWcagFlat } from "../../analysis/exports/toCsvWcagFlat.mjs";

test("exports WCAG tree to flat CSV format", () => {
  const input = {
    totalViolations: 13,
    tree: {
      Perceivable: {
        total: 8,
        guidelines: {
          "1.1": {
            total: 1,
            criteria: {
              "1.1.1": 1
            }
          },
          "1.4": {
            total: 7,
            criteria: {
              "1.4.1": 7
            }
          }
        }
      },
      Operable: {
        total: 1,
        guidelines: {
          "2.4": {
            total: 1,
            criteria: {
              "2.4.4": 1
            }
          }
        }
      },
      Robust: {
        total: 4,
        guidelines: {
          "4.1": {
            total: 4,
            criteria: {
              "4.1.2": 4
            }
          }
        }
      }
    }
  };

  const csv = toCsvWcagFlat(input);

  assert.equal(
    csv,
    [
      "principle,guidelineId,criterionId,occurrences",
      "Perceivable,1.1,1.1.1,1",
      "Perceivable,1.4,1.4.1,7",
      "Operable,2.4,2.4.4,1",
      "Robust,4.1,4.1.2,4",
      ""
    ].join("\n")
  );
});
