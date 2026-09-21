import { test, expect } from "./fixtures";
import { SITE_PAGES } from "./data/site";
import type { HomePage } from "./pages/home.page";
import type { QaDashboard } from "./pages/qa-dashboard.page";

type PagePath = (typeof SITE_PAGES)[number]["path"];
type Pages = { homePage: HomePage; dashboard: QaDashboard };

// Brings a page to what a visitor would see before axe scans it
const PREPARE: Partial<Record<PagePath, (pages: Pages) => Promise<void>>> = {
  // Expand earlier roles - hidden content is not scanned otherwise
  "/": ({ homePage }) => homePage.timeline.showEarlierRoles(),
  "/qa-suite.html": ({ dashboard }) => dashboard.rendered(),
};

test.describe("accessibility", { tag: "@a11y" }, () => {
  for (const target of SITE_PAGES) {
    test(`the ${target.name} page has no WCAG 2.2 A/AA violations`, async ({ page, homePage, dashboard, makeAxeBuilder }, testInfo) => {
      test.slow(); //90 rules, over 30s on Firefox under parallel load
      await page.goto(target.path);
      await PREPARE[target.path]?.({ homePage, dashboard });

      const results = await makeAxeBuilder().analyze();

      await testInfo.attach("axe-violations.json", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
      // test annotations picked up by qa-dashboard-reporter.ts for the dashboard.
      testInfo.annotations.push({
        type: "qa:a11y",
        description: JSON.stringify({
          page: target.path,
          violations: results.violations.length,
          passes: results.passes.length,
          incomplete: results.incomplete.length,
          rules: results.violations.map((v) => v.id),
        }),
      });

      expect(
        results.violations.map((v) => `${v.id} [${v.impact}] ×${v.nodes.length}: ${v.help} → ${v.nodes[0]?.target.join(" ")}`),
      ).toEqual([]);
    });
  }

  test("the home page outline reads as a document to assistive readers", async ({ page, homePage }) => {
    await homePage.goto();
    await expect(page.getByRole("main")).toMatchAriaSnapshot(`
      - main:
        - heading "Senior QA Automation Engineer & SDET" [level=1]
        - region "Testing as a craft, not a checkbox":
          - heading "Testing as a craft, not a checkbox" [level=2]
        - region "Where I've worked":
          - heading "Where I've worked" [level=2]
          - heading /School Management Platform/ [level=3]
          - heading /Electricity Auction Platform/ [level=3]
        - region "Tools & technologies":
          - heading "Tools & technologies" [level=2]
        - region "What I've built":
          - heading "What I've built" [level=2]
          - heading /Shift Board/ [level=3]
          - heading /QA Suite Runner/ [level=3]
        - region "Let's talk testing":
          - heading "Let's talk testing" [level=2]
    `);
  });

  // Desktop only
  test("the navigation exposes every section and the CV action", { tag: "@desktop" }, async ({ page, homePage }) => {
    await homePage.goto();
    await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
      - navigation:
        - link "Stefan Mandovski"
        - list:
          - listitem:
            - link "About"
          - listitem:
            - link "Experience"
          - listitem:
            - link "Skills"
          - listitem:
            - link "Projects"
          - listitem:
            - link "Contact"
          - listitem:
            - link "View / Download CV"
    `);
  });

  test("every control shows a visible focus indicator", async ({ page, homePage, browserName }) => {
    test.skip(browserName === "webkit", "WebKit only tabs to links when the OS allows it");
    await homePage.goto();

    // Tab through the page first so one failure lists all the controls that are missing an outline
    const focused: Array<{ name: string; outline: boolean } | null> = [];
    // Loop through the first 14 tabbable elements - a reasonable number to cover the main controls
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      focused.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          return {
            name: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`,
            outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
          };
        }),
      );
    }

    const controls = new Map(focused.filter((f) => f !== null).map((f) => [f.name, f.outline]));
    expect(controls.size, "controls reached by Tab").toBeGreaterThan(5);
    const withoutOutline = [...controls].filter(([, outline]) => !outline).map(([name]) => name);
    expect(withoutOutline, "controls with no visible focus outline").toEqual([]);
  });
});
