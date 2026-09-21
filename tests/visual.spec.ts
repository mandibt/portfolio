import { test, expect } from "./fixtures";
import { qaHistory, qaReport, qaTest } from "./data/qa-report";
import { PERF_BUDGET } from "./data/site";
import { fontsReady } from "./pages/document";

// Baseline screenshots come from Linux, since CI runs on Linux.
test.use({ timezoneId: "UTC", locale: "en-GB" });

test.describe("visual", { tag: "@visual" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-14T09:00:00Z"));
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the home page looks as designed", async ({ page, homePage }) => {
    await homePage.goto();
    await fontsReady(page);
    await expect(page).toHaveScreenshot("home.png", { fullPage: true });
  });

  test("the CV looks as designed on screen and on paper", async ({ page, cvPage }) => {
    await cvPage.goto();
    await fontsReady(page);
    await expect(page).toHaveScreenshot("cv-screen.png", { fullPage: true });

    await page.emulateMedia({ media: "print" });
    await expect(page).toHaveScreenshot("cv-print.png", { fullPage: true });
  });

  test("the not-found page looks as designed", async ({ page, notFoundPage }) => {
    await notFoundPage.goto();
    await fontsReady(page);
    await expect(page).toHaveScreenshot("not-found.png");
  });

  test("the dashboard looks as designed with failures, flakes and skips", async ({ page, dashboard }) => {
    await dashboard.serve({
      report: qaReport({
        tests: [
          qaTest(),
          qaTest({ title: "the nav reaches every section", project: "mobile-chromium" }),
          qaTest({ title: "the CV downloads", status: "failed", error: "expect(locator).toHaveAttribute(expected) failed" }),
          qaTest({ title: "reload opens at the top", status: "flaky", retries: 1 }),
          qaTest({ title: "keyboard users can skip to the content", status: "skipped", project: "desktop-webkit" }),
        ],
        accessibility: [
          { page: "/", project: "desktop-chromium", violations: 0, passes: 41, incomplete: 1, rules: [] },
          { page: "/cv.html", project: "desktop-chromium", violations: 2, passes: 38, incomplete: 0, rules: ["color-contrast", "link-name"] },
        ],
        performance: [{ page: "/", project: "desktop-chromium", lcpMs: 3100, fcpMs: 900, cls: 0.02, transferKb: 48, budget: PERF_BUDGET }],
      }),
      history: qaHistory([92, 96, 100, 98]),
    });
    await dashboard.open();
    await dashboard.rendered();
    await fontsReady(page);
    await expect(page).toHaveScreenshot("dashboard.png", { fullPage: true });
  });
});
