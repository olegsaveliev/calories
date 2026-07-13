// ESLint flat config (ESLint 9). Node preset — lint src/ and tests/.
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node globals used by app/test code
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Lint app source + tests only. `.factory/` holds pipeline docs and design-handoff
    // artifacts (e.g. a designer's browser JS), which are not part of the running app and
    // must not be held to the Node source lint rules.
    ignores: ["node_modules/", "coverage/", "src/index.html", ".factory/"],
  },
];
