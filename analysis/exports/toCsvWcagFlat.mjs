/**
 * Export WCAG violations into a flat CSV format:
 *
 * principle,guidelineId,criterionId,occurrences
 *
 * This format is intentionally "long-form" so it can be:
 * - Pivoted in Excel
 * - Grouped in BI tools
 * - Used directly for EU reporting (Section 4 style)
 *
 * @param {Object} violationsByWcagTree
 * @returns {string} CSV string
 */
export function toCsvWcagFlat(violationsByWcagTree) {
  if (!violationsByWcagTree?.tree) {
    return "principle,guidelineId,criterionId,occurrences";
  }

  const lines = [
    "principle,guidelineId,criterionId,occurrences"
  ];

  for (const [principle, principleData] of Object.entries(
    violationsByWcagTree.tree
  )) {
    const guidelines = principleData.guidelines || {};

    for (const [guidelineId, guidelineData] of Object.entries(guidelines)) {
      const criteria = guidelineData.criteria || {};

      for (const [criterionId, occurrences] of Object.entries(criteria)) {
        lines.push(
          `${principle},${guidelineId},${criterionId},${occurrences}`
        );
      }
    }
  }

  return lines.join("\n") + "\n";;
}
