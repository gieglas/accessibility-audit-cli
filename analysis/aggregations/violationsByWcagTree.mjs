/**
 * Aggregate WCAG compliance violations into a hierarchical WCAG tree.
 *
 * Structure:
 * Principle → Guideline → Success Criterion
 *
 * IMPORTANT:
 * - Uses ONLY compliance findings
 * - Counts occurrences conservatively using occurrenceCount
 * - Relies entirely on the reference standard for principle mapping
 *
 * @param {Object} normalisedFindings
 * @param {Object} standard Reference accessibility standard
 * @returns {Object}
 */
export function violationsByWcagTree(normalisedFindings = {}, standard) {
  const compliance = Array.isArray(normalisedFindings.compliance)
    ? normalisedFindings.compliance
    : [];

  const result = {
    totalViolations: 0,
    tree: {}
  };

  for (const finding of compliance) {
    const { wcagCriterionId, occurrenceCount = 1 } = finding;
    if (!wcagCriterionId) continue;

    const criterion = standard?.criteria?.[wcagCriterionId];
    if (!criterion?.principle) continue;

    const principle = criterion.principle;

    // WCAG guideline = first two parts (e.g. 1.4 from 1.4.3)
    const guideline = wcagCriterionId
      .split(".")
      .slice(0, 2)
      .join(".");

    // ---- Initialise hierarchy safely ----

    if (!result.tree[principle]) {
      result.tree[principle] = {
        total: 0,
        guidelines: {}
      };
    }

    if (!result.tree[principle].guidelines[guideline]) {
      result.tree[principle].guidelines[guideline] = {
        total: 0,
        criteria: {}
      };
    }

    if (
      result.tree[principle].guidelines[guideline].criteria[wcagCriterionId] ===
      undefined
    ) {
      result.tree[principle].guidelines[guideline].criteria[wcagCriterionId] = 0;
    }

    // ---- Increment counts ----

    result.tree[principle].total += occurrenceCount;
    result.tree[principle].guidelines[guideline].total += occurrenceCount;
    result.tree[principle].guidelines[guideline].criteria[wcagCriterionId] +=
      occurrenceCount;

    result.totalViolations += occurrenceCount;
  }

  return result;
}
