// Threat-model fix R9 — the vision-call cost guard, tested at the unit level.
import { describe, it, expect, beforeEach } from "vitest";
import {
  acquireVisionSlot,
  resetRateLimits,
  inFlightVisionCalls,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_PER_WINDOW,
  MAX_CONCURRENT_VISION_CALLS,
} from "../src/rate-limit.js";

beforeEach(() => {
  resetRateLimits();
});

describe("per-IP fixed window", () => {
  it("allows up to the cap, then denies with reason 'rate'", () => {
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
      const slot = acquireVisionSlot("1.2.3.4", now);
      expect(slot.allowed).toBe(true);
      slot.release(); // release immediately so the concurrency cap isn't what's under test
    }

    const denied = acquireVisionSlot("1.2.3.4", now);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe("rate");
  });

  it("meters each IP independently — one noisy client cannot lock out another", () => {
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
      acquireVisionSlot("1.2.3.4", now).release();
    }
    expect(acquireVisionSlot("1.2.3.4", now).allowed).toBe(false);

    const other = acquireVisionSlot("5.6.7.8", now);
    expect(other.allowed).toBe(true);
  });

  it("lets the budget recover once the window rolls over", () => {
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
      acquireVisionSlot("1.2.3.4", now).release();
    }
    expect(acquireVisionSlot("1.2.3.4", now).allowed).toBe(false);

    const later = now + RATE_LIMIT_WINDOW_MS;
    expect(acquireVisionSlot("1.2.3.4", later).allowed).toBe(true);
  });
});

describe("global in-flight concurrency cap", () => {
  it("denies with reason 'concurrency' once the cap is saturated", () => {
    const held = [];
    for (let i = 0; i < MAX_CONCURRENT_VISION_CALLS; i++) {
      // Distinct IPs so the per-IP window is never the thing that denies.
      const slot = acquireVisionSlot(`10.0.0.${i}`);
      expect(slot.allowed).toBe(true);
      held.push(slot);
    }
    expect(inFlightVisionCalls()).toBe(MAX_CONCURRENT_VISION_CALLS);

    const denied = acquireVisionSlot("10.0.0.99");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe("concurrency");

    held[0].release();
    expect(acquireVisionSlot("10.0.0.98").allowed).toBe(true);
  });

  it("release() is idempotent — a double release cannot inflate the budget", () => {
    const slot = acquireVisionSlot("1.2.3.4");
    slot.release();
    slot.release();
    slot.release();
    expect(inFlightVisionCalls()).toBe(0); // not negative
  });
});
