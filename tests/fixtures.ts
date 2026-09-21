import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { CvPage } from "./pages/cv.page";
import { HomePage } from "./pages/home.page";
import { PageNotFound } from "./pages/not-found.page";
import { QaDashboard } from "./pages/qa-dashboard.page";

// WCAG 2.0 → 2.2, levels A and AA for accessibility
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Fixtures = {
  // Uncaught exceptions
  pageErrors: string[];
  // An axe-core scan with the WCAG tags from above
  makeAxeBuilder: () => AxeBuilder;
  homePage: HomePage; //index.html
  cvPage: CvPage; //cv.html
  notFoundPage: PageNotFound; //404
  dashboard: QaDashboard; //qa-suite.html
};

export const test = base.extend<Fixtures>({
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

  homePage: async ({ page, isMobile }, use) => {
    await use(new HomePage(page, isMobile));
  },

  cvPage: async ({ page }, use) => {
    await use(new CvPage(page));
  },

  notFoundPage: async ({ page }, use) => {
    await use(new PageNotFound(page));
  },

  dashboard: async ({ page }, use) => {
    await use(new QaDashboard(page));
  },
});

export { expect };
