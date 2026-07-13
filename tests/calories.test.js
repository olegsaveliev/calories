import { describe, it, expect } from "vitest";
import { formatCalories } from "../src/calories.js";

// Starter test — proves the Node toolchain (Vitest) runs green.
// Each delivered feature adds its own tests under tests/.
describe("formatCalories", () => {
  it("rounds and formats a calorie estimate", () => {
    expect(formatCalories(539.6)).toBe("≈ 540 kcal");
  });

  it("rejects negative input", () => {
    expect(() => formatCalories(-1)).toThrow();
  });

  it("rejects non-numbers", () => {
    expect(() => formatCalories("lots")).toThrow();
  });
});
