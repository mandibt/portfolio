import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./fixtures";

const ROOT = join(__dirname, "..");
const PDF_OPTIONS = JSON.parse(readFileSync(join(ROOT, "scripts", "cv-pdf.json"), "utf8"));
const COMMITTED_PDF = join(ROOT, "assets", "cv", "Stefan-Mandovski-CV.pdf");
const MAX_PAGES = 4;

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

test.describe("CV print & PDF", { tag: "@print" }, () => {
  test("print styles drop the screen chrome and keep entries whole", async ({ page }) => {
    await page.goto("/cv.html");
    await page.emulateMedia({ media: "print" });

    await expect(page.locator(".cv-toolbar")).toBeHidden();
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeHidden();
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    // A role split across two sheets of paper is the classic printed-CV bug.
    const splittable = await page
      .locator(".cv-entry")
      .evaluateAll((entries) => entries.filter((el) => getComputedStyle(el).breakInside !== "avoid").length);
    expect(splittable).toBe(0);
  });

  test.describe("rendered PDF", () => {
    // page.pdf() exists only in Chromium; one desktop render is the real one.
    test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Chromium desktop only");

    test(`the CV prints to at most ${MAX_PAGES} A4 pages`, async ({ page }) => {
      await page.goto("/cv.html", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf(PDF_OPTIONS);
      await test.info().attach("cv-fresh-render.pdf", { body: pdf, contentType: "application/pdf" });
      expect(pageCount(pdf)).toBeLessThanOrEqual(MAX_PAGES);
    });

    test("the committed PDF is not stale against cv.html", async ({ page }) => {
      await page.goto("/cv.html", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const fresh = await page.pdf(PDF_OPTIONS);
      const committed = readFileSync(COMMITTED_PDF);

      expect(pageCount(committed), "page count differs — run `npm run cv:pdf`").toBe(pageCount(fresh));
      // Links survive into the PDF as URI annotations; a stale export loses new ones.
      for (const href of await page.locator(".cv-contact a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
        expect(committed.toString("latin1"), `PDF is missing the link ${href}`).toContain(`/URI (${href})`);
      }
    });
  });
});
