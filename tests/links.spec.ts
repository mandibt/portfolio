import { test, expect } from "./fixtures";
import { SITE_PAGES } from "./data/site";
import { siteReferences } from "./pages/document";

// Page links must point to an element that exists - a renamed file or removed section
// id will fail the test, not a click.
test.describe("links", { tag: "@smoke" }, () => {
  for (const target of SITE_PAGES) {
    test(`the ${target.name} page only links to things that exist`, async ({ page, request }) => {
      await page.goto(target.path);
      const { files, anchors } = await siteReferences(page);
      expect(files.length, "same-site references found on the page").toBeGreaterThan(0);

      for (const file of files) {
        await expect.soft(await request.get(file), file).toBeOK();
      }
      for (const { file, ids } of anchors) {
        const html = await (await request.get(file)).text();
        for (const id of ids) {
          expect.soft(html, `${file} has no element with id="${id}"`).toContain(`id="${id}"`);
        }
      }
    });
  }
});
