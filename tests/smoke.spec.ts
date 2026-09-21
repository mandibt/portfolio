import { test, expect } from "./fixtures";
import { PROFILE, ROLES, SECTIONS, SHIFT_BOARD, SITE_PAGES, SKILLS, type SectionId } from "./data/site";
import { stylesheetHref, stylesheetLoadedFromRoot } from "./pages/document";

test.describe("home page", { tag: "@smoke" }, () => {
  test("loads with the right title and hero content", async ({ page, homePage }) => {
    await homePage.goto();
    await expect(page).toHaveTitle(new RegExp(PROFILE.name));
    await expect(homePage.heading).toContainText(PROFILE.headline);
  });

  test("each nav link scrolls to its section", async ({ homePage }) => {
    await homePage.goto();
    for (const id of Object.keys(SECTIONS) as SectionId[]) {
      await homePage.nav.goTo(id);
      await expect(homePage.section(id)).toBeInViewport();
    }
  });

  test("experience lists every role, newest first", async ({ homePage }) => {
    await homePage.goto();
    await homePage.timeline.showEarlierRoles();
    await expect(homePage.timeline.visibleRoles).toHaveText(ROLES.map((role) => new RegExp(role)));
  });

  test("only the newest role is marked Current", async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.timeline.currentRoles).toHaveCount(1);
    await expect(homePage.timeline.currentRoles).toContainText(ROLES[0]);
  });

  test("Shift Board lists its AI providers", async ({ homePage }) => {
    await homePage.goto();
    const card = homePage.projectCard(SHIFT_BOARD.name);
    await expect(card).toHaveCount(1);
    for (const provider of SHIFT_BOARD.providers) {
      await expect(card).toContainText(provider);
    }
  });

  test("contact section links to LinkedIn in a new tab", async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.contactLink).toHaveAttribute("href", PROFILE.linkedIn);
    await expect(homePage.contactLink).toHaveAttribute("target", "_blank");
    await expect(homePage.contactLink).toHaveAttribute("rel", /noopener/);
  });

  test("the hero and nav both link to the CV", async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.nav.cvLink).toHaveAttribute("href", "cv.html");
    await expect(homePage.heroCvLink).toHaveAttribute("href", "cv.html");
  });

  test("footer LinkedIn link matches the contact link", async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.footerLinkedIn).toHaveAttribute("href", PROFILE.linkedIn);
  });

  test("the footer shows the current year", async ({ page, homePage }) => {
    // Year is calculated at runtime and not hardcoded
    await page.clock.setFixedTime(new Date("2031-03-01T09:00:00Z"));
    await homePage.goto();
    await expect(homePage.footer).toContainText(`© 2031 ${PROFILE.name}`);
  });
});

test.describe("interactions", { tag: "@smoke" }, () => {
  test("earlier roles are hidden until expanded", async ({ homePage }) => {
    await homePage.goto();
    const { timeline } = homePage;
    // The two newest roles are always shown
    const earlierRoleCount = ROLES.length - 2;
    await expect(timeline.earlierRoles).toHaveCount(earlierRoleCount);
    await expect(timeline.earlierRoles.filter({ visible: true })).toHaveCount(0);

    await timeline.showEarlierRoles();
    await expect(timeline.earlierRoles.filter({ visible: true })).toHaveCount(earlierRoleCount);
    await expect(timeline.earlierRolesToggle).toContainText("Hide earlier roles");
  });

  test("each skill bar fills to its percentage", async ({ homePage }) => {
    await homePage.goto();
    const { skills } = homePage;
    await expect(skills.bars).toHaveCount(Object.keys(SKILLS).length);
    await expect(skills.percentage(skills.bar("Playwright"))).toHaveText(`${SKILLS.Playwright}%`);

    for (const bar of await skills.bars.all()) {
      await skills.centre(bar);
      const declared = await skills.declaredPercent(bar);
      await expect.poll(() => skills.fillPercent(bar)).toBeGreaterThanOrEqual(declared - 2);
    }
  });

  test("reduced motion turns the skill bar animation off", async ({ page, homePage }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await homePage.goto();
    expect(await homePage.skills.runningAnimations()).toBe(0);
  });

  test("the floating button hides at Projects", async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.floatingCta).toBeVisible();

    await homePage.section("projects").scrollIntoViewIfNeeded();
    // Hidden from keyboard tabs
    await expect(homePage.floatingCta).toBeHidden();
  });

  test("reloading opens the page at the top", async ({ page, homePage }) => {
    await homePage.goto();
    await homePage.section("contact").scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    await page.reload();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("keyboard users can skip straight to the content", async ({ page, homePage, browserName }) => {
    test.skip(browserName === "webkit", "Safari skips links on Tab by default");
    await homePage.goto();
    await page.keyboard.press("Tab");
    await expect(homePage.skipLink).toBeFocused();
    await expect(homePage.skipLink).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    await expect(page.getByRole("main")).toBeInViewport();
  });
});

test.describe("URLs", { tag: "@smoke" }, () => {
  test("the old #work link goes to Projects", async ({ page, homePage }) => {
    await homePage.goto("#work");
    await expect(page).toHaveURL(/#projects$/);
  });

  test("an unknown #section goes to the 404 page", async ({ page, homePage, notFoundPage }) => {
    await homePage.goto("#totally-not-a-section");
    await expect(page).toHaveURL(/404\.html$/);
    await expect(notFoundPage.code).toHaveText("404");
  });

  test("an unknown page returns 404", async ({ request }) => {
    const response = await request.get("/no-such-page");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("wandered off the test plan");
  });

  test("the 404 page keeps its styling on nested paths", async ({ page, homePage, notFoundPage }) => {
    const response = await notFoundPage.goto("/some/deeply/nested/missing/page");
    expect(response?.status()).toBe(404);
    expect(await stylesheetLoadedFromRoot(page), "stylesheet loads on nested paths").toBe(true);

    await notFoundPage.backLink.click();
    await expect(homePage.heading).toContainText(PROFILE.headline);
  });
});

test.describe("cv page", { tag: "@smoke" }, () => {
  test("the PDF download works", async ({ page, cvPage }) => {
    await cvPage.goto();
    await expect(page).toHaveTitle(`CV - ${PROFILE.name}`);
    await expect(cvPage.heading).toHaveText(PROFILE.name);

    await expect(cvPage.downloadLink).toHaveAttribute("href", PROFILE.cvPdf);
    await expect(cvPage.downloadLink).toHaveAttribute("download");

    const response = await page.request.get(`/${PROFILE.cvPdf}`);
    await expect(response).toBeOK();
    expect(response.headers()["content-type"]).toContain("pdf");
  });

  test("lists every role, Shift Board and the certifications", async ({ page, cvPage }) => {
    await cvPage.goto();
    // The four roles, then the Shift Board entry under Personal Projects.
    await expect(cvPage.entryTitles).toHaveText([...ROLES.map((role) => new RegExp(role)), /Shift Board/]);
    await expect(page.getByText("Anthropic Academy")).toBeVisible();
  });

  test("back link returns to the portfolio", async ({ page, cvPage }) => {
    await cvPage.goto();
    await cvPage.backLink.click();
    await expect(page).toHaveURL(/index\.html$|\/$/);
  });
});

test.describe("404 page", { tag: "@smoke" }, () => {
  test("shows 404 and a link home", async ({ notFoundPage }) => {
    await notFoundPage.goto();
    await expect(notFoundPage.code).toHaveText("404");
    await expect(notFoundPage.backLink).toHaveAttribute("href", "index.html");
  });
});

test.describe("every page", { tag: "@smoke" }, () => {
  test("renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      const thirdParty = /fonts\.(googleapis|gstatic)\.com/.test(message.location().url);
      if (message.type() === "error" && !thirdParty) errors.push(`${page.url()}: ${message.text()}`);
    });
    for (const { path } of SITE_PAGES) {
      await page.goto(path);
    }
    expect(errors).toEqual([]);
  });

  test("asks for the same stylesheet version", async ({ page }) => {
    const hrefs: string[] = [];
    for (const { path } of SITE_PAGES) {
      await page.goto(path);
      hrefs.push((await stylesheetHref(page)) ?? "");
    }
    expect(hrefs[0]).toMatch(/\?v=\d+$/);
    expect(new Set(hrefs).size, `stylesheet links: ${hrefs.join(", ")}`).toBe(1);
  });
});

// Runs only on the mobile project: desktop projects filter out @mobile (playwright.config.ts).
test.describe("mobile viewport", { tag: ["@smoke", "@mobile"] }, () => {
  test("the nav opens from the menu button", async ({ homePage }) => {
    await homePage.goto();
    const { nav } = homePage;
    await expect(nav.toggle).toHaveAttribute("aria-expanded", "false");
    await expect(nav.link("about")).toBeHidden();

    await nav.openMenu();
    await expect(nav.toggle).toHaveAttribute("aria-expanded", "true");
    await expect(nav.link("about")).toBeVisible();
  });

  test("the page doesn't scroll sideways on a phone", async ({ page, homePage }) => {
    await homePage.goto();
    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
