import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["node_modules/", "playwright-report/", "test-results/", "blob-report/", "all-blob-reports/", "_site/", "assets/"],
  },

  // Node scripts: the local server and the CV PDF build.
  {
    files: ["**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly", Buffer: "readonly" },
    },
  },

  // Everything TypeScript: config, reporters, tests, type-aware rules.
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },

  // The suite itself.
  {
    files: ["tests/**/*.ts"],
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      // Skips must be conditional and carry a reason why they are skipped
      "playwright/no-skipped-test": ["error", { allowConditional: true }],
      // page.locator('[role=button]') → getByRole('button'), and friends.
      "playwright/prefer-native-locators": "error",
      "playwright/prefer-to-be": "error",
      "playwright/prefer-to-contain": "error",
      "playwright/prefer-comparison-matcher": "error",
      "playwright/prefer-equality-matcher": "error",
      "playwright/no-useless-not": "error",
      "playwright/prefer-web-first-assertions": "error",
      "playwright/no-wait-for-timeout": "error",
      "playwright/no-force-option": "error",
      "playwright/no-page-pause": "error",
      "playwright/require-top-level-describe": "error",
      "playwright/require-to-throw-message": "error",
    },
  },

  // Specs describe behaviour. Selectors live in tests/pages and
  // tests/components.
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "playwright/no-raw-locators": "error",
    },
  },
);
