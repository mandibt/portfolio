import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { QaDashboard } from "./support/qa-dashboard";

/** WCAG 2.0 → 2.2, levels A and AA: what the accessibility gate enforces. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Fixtures = {
  /** Uncaught exceptions the page threw during the test. */
  pageErrors: string[];
  /** A fresh axe-core scan scoped to the WCAG tags above. */
  makeAxeBuilder: () => AxeBuilder;
  /** qa-suite.html with its report files served by the test, not the disk. */
  dashboard: QaDashboard;
};

export const test = base.extend<Fixtures>({
  // Auto fixture: every test in the suite fails if the page throws, so "no JS
  // errors" is enforced on every journey rather than asserted by one test.
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "uncaught exceptions thrown by the page").toEqual([]);
    },
    { auto: true },
  ],

  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags(WCAG_TAGS));
  },

  dashboard: async ({ page }, use) => {
    await use(new QaDashboard(page));
  },
});

export { expect };
