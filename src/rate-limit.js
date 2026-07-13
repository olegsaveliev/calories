// Calories — threat-model fix R9: cap the NUMBER of paid vision calls.
//
// `POST /upload` is unauthenticated and unthrottled, and since 002 every accepted request spends real
// money on a vision call. Nothing capped how many calls could be made — a stuck client loop, a held-down
// send button, or anyone who can reach the port could drain the API budget (OWASP LLM10, cost-DoS) and
// deny the feature to everyone else once the quota is gone.
//
// Two plain, in-process, dependency-free guards (ADR-001 — no redis, no rate-limiter package):
//   1. a FIXED-WINDOW per-IP cap  — bounds how fast any one caller can spend;
//   2. a GLOBAL IN-FLIGHT cap     — bounds how much can be spent (and how much memory is pinned) at once.
// Both are checked BEFORE the API call is made; exceeding either is a 429.
//
// In-process state is the right scope here: this is a single-process localhost service (ADR-001). It
// resets on restart and would not coordinate across replicas — which is fine, because the manifest's
// "resolve before any exposure beyond localhost" gate already stands.

/** Length of the per-IP fixed window, in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Max vision calls a single client IP may trigger within one window. */
export const RATE_LIMIT_MAX_PER_WINDOW = 10;

/** Max vision calls allowed to be in flight at the same time, across ALL clients. */
export const MAX_CONCURRENT_VISION_CALLS = 2;

/** @type {Map<string, { windowStart: number, count: number }>} per-IP fixed-window counters */
const windows = new Map();

/** @type {number} how many vision calls are in flight right now */
let inFlight = 0;

/**
 * @typedef {"rate" | "concurrency"} DenialReason
 * @typedef {{ allowed: true, release: () => void }} Granted
 * @typedef {{ allowed: false, reason: DenialReason }} Denied
 */

/**
 * Try to reserve the right to make ONE vision call.
 *
 * Call this BEFORE spending anything. On success you own an in-flight slot and MUST call the returned
 * `release()` (in a `finally`) once the call settles, or the concurrency cap will leak.
 *
 * @param {string} clientId - the caller's identity for rate-limiting purposes (the remote IP)
 * @param {number} [now] - injectable clock, for tests
 * @returns {Granted | Denied}
 */
export function acquireVisionSlot(clientId, now = Date.now()) {
  const key = clientId || "unknown";

  // 1. Per-IP fixed window.
  const entry = windows.get(key);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    windows.set(key, { windowStart: now, count: 1 });
  } else if (entry.count >= RATE_LIMIT_MAX_PER_WINDOW) {
    return { allowed: false, reason: "rate" };
  } else {
    entry.count += 1;
  }

  // 2. Global in-flight concurrency. (Checked second so a burst from one IP is attributed to that
  //    IP's window rather than silently absorbed by the concurrency cap.)
  if (inFlight >= MAX_CONCURRENT_VISION_CALLS) {
    return { allowed: false, reason: "concurrency" };
  }

  inFlight += 1;
  let released = false;
  return {
    allowed: true,
    release() {
      if (released) return; // idempotent — a double-release must not corrupt the counter
      released = true;
      inFlight -= 1;
    },
  };
}

/**
 * Current number of in-flight vision calls (exported for tests/observability).
 * @returns {number}
 */
export function inFlightVisionCalls() {
  return inFlight;
}

/**
 * Drop all rate-limit state. Tests only — lets each test start from a clean budget.
 * @returns {void}
 */
export function resetRateLimits() {
  windows.clear();
  inFlight = 0;
}
