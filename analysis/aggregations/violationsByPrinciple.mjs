/**
 * Aggregate WCAG compliance violations by POUR principle.
 *
 * IMPORTANT:
 * - Uses ONLY compliance findings (non-WCAG findings are ignored)
 * - Counts occurrences conservatively using occurrenceCount
 * - Relies entirely on the reference standard for principle mapping
 *
 * @param {Object} normalisedFindings
 * @param {Object} standard Reference accessibility standard
 * @returns {Object}
 */
export function violationsByPrinciple(normalisedFindings = {}, standard) {
    const compliance = Array.isArray(normalisedFindings.compliance)
        ? normalisedFindings.compliance
        : [];

    const result = {
        totalViolations: 0,
        byPrinciple: {
            Perceivable: 0,
            Operable: 0,
            Understandable: 0,
            Robust: 0
        }
    };

    for (const finding of compliance) {
        const { wcagCriterionId, occurrenceCount = 1 } = finding;

        if (!wcagCriterionId) continue;

        const criterion =
            standard?.criteria?.[wcagCriterionId];

        if (!criterion || !criterion.principle) continue;

        const principle = criterion.principle;

        if (!(principle in result.byPrinciple)) continue;

        result.byPrinciple[principle] += occurrenceCount;
        result.totalViolations += occurrenceCount;
    }

    return result;
}
