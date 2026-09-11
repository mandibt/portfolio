import { test, expect } from "./fixtures";

const isMobile = (projectName: string) => projectName.startsWith("mobile");

test.describe("home page", { tag: "@smoke" }, () => {
  test("loads with the right title and hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Stefan Mandovski/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Senior QA Automation Engineer");
  });

  test("renders without console errors on any page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      // Google Fonts is a third party; a hiccup fetching it is not a defect here.
      const thirdParty = /fonts\.(googleapis|gstatic)\.com/.test(message.location().url);
      if (message.type() === "error" && !thirdParty) errors.push(`${page.url()}: ${message.text()}`);
    });
    for (const path of ["/", "/cv.html", "/qa-suite.html", "/404.html"]) {
      await page.goto(path);
      await page.waitForLoadState("load");
    }
    expect(errors).toEqual([]);
  });

  test("nav links resolve to real sections on the page", async ({ page }, testInfo) => {
    await page.goto("/");
    for (const id of ["about", "experience", "skills", "projects", "contact"]) {
      if (isMobile(testInfo.project.name)) await page.locator("#navToggle").click();
      await page.locator(`.nav-links a[href="#${id}"]`).click();
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test("experience section lists all four roles in order", async ({ page }) => {
    await page.goto("/");
    const titles = page.locator("#experience .job-title");
    await expect(titles).toHaveCount(4);
    await expect(titles.nth(0)).toContainText("School Management Platform");
    await expect(titles.nth(1)).toContainText("Electricity Auction Platform");
    await expect(titles.nth(2)).toContainText("US Pet Retailer");
    await expect(titles.nth(3)).toContainText("NS NL");
  });

  test("current role carries the Current badge and the rest don't", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".tl-item").first()).toHaveClass(/current/);
    await expect(page.locator(".badge-current")).toHaveCount(1);
  });

  test("projects section features Shift Board with its AI-provider tags", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#projects .project-card", { hasText: "Shift Board" });
    await expect(card).toHaveCount(1);
    for (const provider of ["Claude Code", "OpenAI", "Z.ai", "Kimi"]) {
      await expect(card).toContainText(provider);
    }
  });

  test("contact section links to LinkedIn in a new tab", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("#contact a.btn-primary");
    await expect(link).toHaveAttribute("href", "https://www.linkedin.com/in/mandovski/");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("hero and nav both offer a way to reach the CV", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("a.nav-cv")).toHaveAttribute("href", "cv.html");
    await expect(page.locator(".hero-ctas a", { hasText: "Download CV" })).toHaveAttribute("href", "cv.html");
  });

  test("footer LinkedIn link matches the contact link", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer a")).toHaveAttribute("href", "https://www.linkedin.com/in/mandovski/");
  });

  test("the footer year comes from the visitor's clock", async ({ page }) => {
    // page.clock pins Date for the page, so the test proves the year is
    // computed at runtime rather than typed into the HTML.
    await page.clock.setFixedTime(new Date("2031-03-01T09:00:00Z"));
    await page.goto("/");
    await expect(page.locator("#year")).toHaveText("2031");
  });
});

test.describe("interactive features", { tag: "@smoke" }, () => {
  test("earlier roles stay collapsed until asked for", async ({ page }) => {
    await page.goto("/");
    const older = page.locator("#tlMore .tl-item");
    await expect(older).toHaveCount(2);
    for (let i = 0; i < 2; i++) await expect(older.nth(i)).not.toBeVisible();

    await page.locator("#tlMore summary").click();
    for (let i = 0; i < 2; i++) await expect(older.nth(i)).toBeVisible();
    await expect(page.locator("#tlMore summary")).toContainText("Hide earlier roles");
  });

  test("skill bars fill to the value each one declares", async ({ page }) => {
    await page.goto("/");
    const bars = page.locator(".skill-bar");
    await expect(bars).toHaveCount(6);
    await expect(bars.first().locator(".skill-bar-pct")).toHaveText("95%");

    for (const bar of await bars.all()) {
      // Centre the bar: in browsers with scroll-driven animations the fill
      // completes once the bar is well inside the viewport.
      await bar.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const declared = parseFloat((await bar.locator(".skill-bar-pct").textContent()) ?? "");
      await expect
        .poll(() =>
          bar.evaluate((el) => {
            const fill = el.querySelector<HTMLElement>(".skill-bar-fill")!;
            const track = el.querySelector<HTMLElement>(".skill-bar-track")!;
            return Math.round((fill.getBoundingClientRect().width / track.getBoundingClientRect().width) * 100);
          }),
        )
        .toBeGreaterThanOrEqual(declared - 2);
    }
  });

  test("reduced motion turns the skill bar animation off", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const running = await page
      .locator(".skill-bar-fill")
      .evaluateAll((fills) => fills.reduce((n, el) => n + el.getAnimations().length, 0));
    expect(running).toBe(0);
  });

  test("a floating CTA is visible while browsing and steps aside at Projects", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("#floatingCta");
    await expect(cta).toHaveCSS("opacity", "1");

    await page.locator("#projects").scrollIntoViewIfNeeded();
    await expect(cta).toHaveClass(/is-hidden/);
  });

  test("a reload opens the page at the top, not where the last visit ended", async ({ page }) => {
    await page.goto("/");
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    await page.reload();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("keyboard users can skip straight to the content", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit only tabs to links when the OS setting allows it");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    await expect(page.getByRole("main")).toBeInViewport();
  });
});

test.describe("addresses", { tag: "@smoke" }, () => {
  test("a retired anchor still reaches the section it now lives in", async ({ page }) => {
    await page.goto("/#work");
    await expect(page).toHaveURL(/#projects$/);
  });

  test("an unknown section in the address lands on the not found page", async ({ page }) => {
    await page.goto("/#totally-not-a-section");
    await expect(page).toHaveURL(/404\.html$/);
    await expect(page.locator(".code")).toHaveText("404");
  });

  test("an unknown path answers with a real 404 status", async ({ request }) => {
    const response = await request.get("/no-such-page");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("wandered off the test plan");
  });

  test("a deep unknown path still renders the styled not found page", async ({ page }) => {
    const response = await page.goto("/some/deeply/nested/missing/page");
    expect(response?.status()).toBe(404);
    // Styled means the stylesheet resolved from the site root, not from
    // /some/deeply/nested/ — the accent colour only exists in styles.css.
    await expect(page.locator(".code")).toHaveCSS("color", "rgb(44, 79, 66)");
    await page.getByRole("link", { name: "Back to the portfolio" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Senior QA Automation Engineer");
  });
});

test.describe("cv page", { tag: "@smoke" }, () => {
  test("renders the résumé with a working PDF download link", async ({ page }) => {
    await page.goto("/cv.html");
    await expect(page).toHaveTitle(/CV — Stefan Mandovski/);
    await expect(page.locator(".cv-header h1")).toContainText("Stefan Mandovski");

    const pdfLink = page.locator("a[download]");
    await expect(pdfLink).toHaveAttribute("href", "assets/cv/Stefan-Mandovski-CV.pdf");

    const response = await page.request.get("/assets/cv/Stefan-Mandovski-CV.pdf");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("pdf");
  });

  test("lists all four experience entries and the certifications block", async ({ page }) => {
    await page.goto("/cv.html");
    await expect(page.locator(".cv-entry .job-title")).toHaveCount(5); // 4 roles + Shift Board project entry
    await expect(page.getByText("Anthropic Academy")).toBeVisible();
  });

  test("back link returns to the portfolio", async ({ page }) => {
    await page.goto("/cv.html");
    await page.locator(".cv-toolbar a.back").click();
    await expect(page).toHaveURL(/index\.html$|\/$/);
  });
});

test.describe("404 page", { tag: "@smoke" }, () => {
  test("shows a friendly not-found message with a way back", async ({ page }) => {
    await page.goto("/404.html");
    await expect(page.locator(".code")).toHaveText("404");
    await expect(page.locator("a.btn-primary")).toHaveAttribute("href", "index.html");
  });
});

test.describe("asset versions", { tag: "@smoke" }, () => {
  test("every page asks for the same stylesheet version", async ({ page }) => {
    const hrefs: string[] = [];
    for (const path of ["/index.html", "/cv.html", "/qa-suite.html", "/404.html"]) {
      await page.goto(path);
      hrefs.push((await page.locator('link[rel="stylesheet"][href*="styles.css"]').getAttribute("href")) ?? "");
    }
    expect(hrefs[0]).toMatch(/\?v=\d+$/);
    expect(new Set(hrefs).size, `stylesheet links: ${hrefs.join(", ")}`).toBe(1);
  });
});

test.describe("mobile viewport", { tag: "@smoke" }, () => {
  // Only meaningful on the mobile-chromium project (see playwright.config.ts).
  test.beforeEach(({}, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "mobile viewport only");
  });

  test("nav collapses behind a toggle and opens on tap", async ({ page }) => {
    await page.goto("/");
    const links = page.locator("#navLinks");
    await expect(links).not.toHaveClass(/open/);
    await page.locator("#navToggle").click();
    await expect(links).toHaveClass(/open/);
  });

  test("hero content is visible without horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
