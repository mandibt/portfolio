import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./fixtures";
import { PROFILE } from "./data/site";

const ROOT = join(__dirname, "..");
const PDF_OPTIONS = JSON.parse(readFileSync(join(ROOT, "scripts", "cv-pdf.json"), "utf8"));
const COMMITTED_PDF = join(ROOT, PROFILE.cvPdf);
const MAX_PAGES = 4;

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

test.describe("CV print & PDF", { tag: "@print" }, () => {
  test("print styles drop the screen chrome and keep entries whole", async ({ page, cvPage }) => {
    await cvPage.goto();
    await expect(cvPage.backLink).toBeVisible();
    await expect(cvPage.downloadLink).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(cvPage.backLink).toBeHidden();
    await expect(cvPage.downloadLink).toBeHidden();
    await expect(cvPage.skipLink).toBeHidden();
    await expect(cvPage.body).toHaveCSS("background-color", "rgb(255, 255, 255)");
    // Check that no entries are split across pages and no page-split occurs.
    const splittable = await cvPage.entries.evaluateAll(
      (entries) => entries.filter((el) => getComputedStyle(el).breakInside !== "avoid").length,
    );
    expect(splittable).toBe(0);
  });

  test.describe("rendered PDF", () => {
    // page.pdf() is Chrome only.
    test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Chromium desktop only");

    test.beforeEach(async ({ cvPage }) => {
      await cvPage.goto();
      await cvPage.fontsReady();
    });

    test(`the CV prints to at most ${MAX_PAGES} A4 pages`, async ({ page }) => {
      const pdf = await page.pdf(PDF_OPTIONS);
      await test.info().attach("cv-fresh-render.pdf", { body: pdf, contentType: "application/pdf" });
      expect(pageCount(pdf)).toBeLessThanOrEqual(MAX_PAGES);
    });

    test("compare the committed PDF against cv.html", async ({ page, cvPage }) => {
      const fresh = await page.pdf(PDF_OPTIONS);
      const committed = readFileSync(COMMITTED_PDF);

      expect(pageCount(committed), "page count differs - run `npm run cv:pdf`").toBe(pageCount(fresh));
      // Links survive into the PDF as URI annotations
      for (const href of await cvPage.contactLinks.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
        expect(committed.toString("latin1"), `PDF is missing the link ${href}`).toContain(`/URI (${href})`);
      }
    });
  });
});
