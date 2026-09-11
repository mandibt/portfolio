import { test, expect } from "./fixtures";

const PAGES = [
  { path: "/", name: "home" },
  { path: "/cv.html", name: "CV" },
  { path: "/qa-suite.html", name: "QA suite runner" },
  { path: "/404.html", name: "not found" },
];

test.describe("accessibility", { tag: "@a11y" }, () => {
  for (const target of PAGES) {
    test(`the ${target.name} page has no WCAG 2.2 A/AA violations`, async ({ page, makeAxeBuilder }, testInfo) => {
      // A full axe scan runs ~90 rules over the whole DOM; in Firefox under
      // parallel load that can pass 30s. Triple the timeout rather than skip.
      test.slow();
      await page.goto(target.path);
      if (target.path === "/") {
        // Scan the collapsed earlier roles too — hidden content is skipped by axe.
        await page.locator("#tlMore summary").click();
      }
      if (target.path === "/qa-suite.html") {
        // The dashboard renders from fetched JSON; scan what a visitor sees.
        await expect(page.locator(".qa-section").first()).toBeVisible();
      }

      const results = await makeAxeBuilder().analyze();

      await testInfo.attach("axe-violations.json", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
      // Picked up by reporters/qa-dashboard-reporter.ts for the dashboard.
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

  test("the home page outline reads as a document to assistive technology", async ({ page }) => {
    await page.goto("/");
    // An ARIA snapshot asserts what a screen reader is given — landmark,
    // heading levels and their order — independently of markup or styling.
    await expect(page.getByRole("main")).toMatchAriaSnapshot(`
      - main:
        - heading "Senior QA Automation Engineer & SDET" [level=1]
        - heading "Testing as a craft, not a checkbox" [level=2]
        - heading "Where I've worked" [level=2]
        - heading "Tools & technologies" [level=2]
        - heading "What I've built" [level=2]
        - heading "Let's talk testing" [level=2]
    `);
  });

  test("the navigation exposes every section and the CV action", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("mobile"), "the mobile nav is collapsed behind a toggle");
    await page.goto("/");
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

  test("every control shows a visible focus indicator", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit only tabs to links when the OS setting allows it");
    await page.goto("/");
    const seen = new Set<string>();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          name: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`,
          outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
        };
      });
      if (!focus || seen.has(focus.name)) continue;
      seen.add(focus.name);
      expect(focus.outline, `${focus.name} has no visible focus outline`).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});
