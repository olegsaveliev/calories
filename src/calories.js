// Starter module for the Calories app.
// Its only job right now is to prove the toolchain (ESLint + Vitest) is green.
// Feature 001 (/factory-run 001) replaces/extends this with the real upload + estimate logic.

/**
 * Format a calorie estimate for display.
 * @param {number} kcal - estimated calories (non-negative number)
 * @returns {string} e.g. "≈ 540 kcal"
 */
export function formatCalories(kcal) {
  if (typeof kcal !== "number" || Number.isNaN(kcal) || kcal < 0) {
    throw new Error("kcal must be a non-negative number");
  }
  return `≈ ${Math.round(kcal)} kcal`;
}
