import { test, expect } from "./fixtures";
import { PROFILE, ROLES, SKILLS } from "./data/site";

/**
 * Records one full visit - trace and video - on every run, even when it passes.
 * The dashboard shows this recording so visitors can watch a real Playwright run.
 */
test.use({
  trace: "on",
  video: { mode: "on", size: { width: 1280, height: 720 } },
  // Human pace, so the recording is watchable.
  launchOptions: { slowMo: 120 },
});

test.describe("showcase", { tag: "@showcase" }, () => {
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "recorded once, on desktop Chrome");

  test("a recruiter's first minute on the site", async ({ homePage, cvPage, dashboard }, testInfo) => {
    testInfo.annotations.push({ type: "qa:showcase", description: testInfo.title });

    await test.step("lands on the home page", async () => {
      await homePage.goto();
      await expect(homePage.heading).toContainText(PROFILE.headline);
    });

    await test.step("reads the current role, then the earlier ones", async () => {
      await homePage.nav.goTo("experience");
      await expect(homePage.timeline.currentRoles).toContainText(ROLES[0]);
      await homePage.timeline.showEarlierRoles();
      await expect(homePage.timeline.earlierRoles.first()).toBeVisible();
    });

    await test.step("checks the Playwright skill level", async () => {
      await homePage.nav.goTo("skills");
      const playwright = homePage.skills.bar("Playwright");
      await playwright.scrollIntoViewIfNeeded();
      await expect(homePage.skills.percentage(playwright)).toHaveText(`${SKILLS.Playwright}%`);
    });

    await test.step("opens the live QA dashboard from Projects", async () => {
      await homePage.suiteRunnerLink.click();
      await expect(dashboard.heading).toHaveText("QA Suite Runner");
      await expect(dashboard.section("summary")).toBeVisible();
    });

    await test.step("opens the CV", async () => {
      await homePage.goto();
      await homePage.nav.cvLink.click();
      await expect(cvPage.heading).toHaveText(PROFILE.name);
      await expect(cvPage.downloadLink).toHaveAttribute("href", /\.pdf$/);
    });

    await test.step("finds the way to get in touch", async () => {
      await homePage.goto("#contact");
      await expect(homePage.contactLink).toHaveAttribute("href", PROFILE.linkedIn);
    });
  });
});
