import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Loaded before every test file. Pins a sentinel ANTHROPIC_API_KEY and blocks any real
    // request to api.anthropic.com, so the suite never uses a real key or triggers a real
    // vision call. Real API checks are run manually, out of band. See tests/setup.guard.js.
    setupFiles: ["./tests/setup.guard.js"],
  },
});
