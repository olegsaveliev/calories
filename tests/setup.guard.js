// Global test guard — loaded before every test file (see vitest.config.js `setupFiles`).
//
// Policy (owner's instruction): tests MUST NOT use a real ANTHROPIC_API_KEY or trigger a real
// Anthropic API call. Real vision calls are exercised manually, out of band. Two safety nets:
//   1. Pin the key to a sentinel for the whole test process, so a real key exported in the shell
//      (or in CI) is never read by code under test.
//   2. Make the default `fetch` throw on any request to api.anthropic.com. A suite that legitimately
//      exercises the vision path stubs `fetch` itself (vi.stubGlobal) and never reaches this guard;
//      a suite that FORGETS to mock fails loudly here instead of silently billing a real request.
// Non-Anthropic requests (e.g. a test's own HTTP call to the local ephemeral server) pass through
// to the real fetch untouched.

// 1. Never let the real key into the test process.
process.env.ANTHROPIC_API_KEY = "test-key-not-real";

// 2. Block real Anthropic egress by default. Capture the true fetch before anyone replaces it.
const realFetch = globalThis.fetch;
globalThis.fetch = function guardedFetch(url, init) {
  const href = typeof url === "string" ? url : String(url);
  if (href.includes("api.anthropic.com")) {
    throw new Error(
      "Test guard: a real request to api.anthropic.com was attempted. Tests must mock the vision " +
        "call (vi.stubGlobal('fetch', ...)) — real API calls are run manually, not in the suite.",
    );
  }
  return realFetch(url, init);
};
