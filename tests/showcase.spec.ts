import { test, expect } from "./fixtures";

/**
 * One journey recorded on every run — trace and video even when it passes —
 * so the dashboard can offer a real Playwright Trace Viewer session to anyone
 * visiting the site, not only when something breaks.
 *
 * These options force a dedicated worker, which Playwright only allows at the
 * top level of a file — hence a file of its own.
 */
test.use({
  trace: "on",
  video: { mode: "on", size: { width: 1280, height: 720 } },
  // Human pace, so the recording is watchable.
  launchOptions: { slowMo: 120 },
});

test.describe("showcase", { tag: "@showcase" }, () => {
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "one recorded journey is enough");

  test("a recruiter's first minute on the site", async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: "qa:showcase", description: "A recruiter's first minute on the site" });

    await test.step("lands on the home page", async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Senior QA Automation Engineer");
    });

    await test.step("reads the current role, then the earlier ones", async () => {
      await page.getByRole("link", { name: "Experience", exact: true }).click();
      await expect(page.locator(".tl-item.current .job-title")).toContainText("School Management Platform");
      await page.getByText("Show earlier roles").click();
      await expect(page.locator("#tlMore .job-title").first()).toBeVisible();
    });

    await test.step("checks the Playwright skill level", async () => {
      await page.getByRole("link", { name: "Skills", exact: true }).click();
      const playwright = page.locator(".skill-bar", { hasText: "Playwright" });
      await playwright.scrollIntoViewIfNeeded();
      await expect(playwright.locator(".skill-bar-pct")).toHaveText("95%");
    });

    await test.step("opens the live QA dashboard from Projects", async () => {
      await page.getByRole("link", { name: /Open the suite runner/ }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("QA Suite Runner");
      await expect(page.locator('[data-section="summary"]')).toBeVisible();
    });

    await test.step("opens the CV", async () => {
      await page.goto("/");
      await page.locator("a.nav-cv").click();
      await expect(page.locator(".cv-header h1")).toHaveText("Stefan Mandovski");
      await expect(page.locator("a[download]")).toHaveAttribute("href", /\.pdf$/);
    });

    await test.step("finds the way to get in touch", async () => {
      await page.goto("/#contact");
      await expect(page.locator("#contact a.btn-primary")).toHaveAttribute("href", /linkedin\.com\/in\/mandovski/);
    });
  });
});
