import type { Page } from "@playwright/test";


// The shared stylesheet href
export function stylesheetHref(page: Page): Promise<string | null> {
  return page.locator('link[rel="stylesheet"][href*="styles.css"]').getAttribute("href");
}

/**
 * Whether styles.css was loaded from the root and applied. A wrong
 * path gets the 404 page back as HTML, which the browser refuses to
 * use as CSS so the sheet would be missing.
 */
export function stylesheetLoadedFromRoot(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.styleSheets].some(
      (sheet) => !!sheet.href && new URL(sheet.href).pathname === "/assets/css/styles.css" && sheet.cssRules.length > 0,
    ),
  );
}

// Resolves once fonts have loaded
export async function fontsReady(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

// Files on this site the page links to or loads
export type SiteReferences = {
  files: string[];
  anchors: Array<{ file: string; ids: string[] }>;
};

/**
 * Every reference element that we point at on this site - links, stylesheets, scripts,
 * images. Other sites are left out of this and the pw traces and videos also
 * that are actually published by CI with each deploy.
 */
export async function siteReferences(page: Page): Promise<SiteReferences> {
  const site = `${new URL(page.url()).origin}/`;
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll("a[href], link[href], script[src], img[src], video[src], source[src]")].map(
      (el) => (el as HTMLAnchorElement).href || (el as HTMLImageElement).src,
    ),
  );
  const files = new Set<string>();
  const anchors = new Map<string, Set<string>>();
  for (const raw of urls) {
    if (!raw.startsWith(site) || raw.includes("/assets/qa/artifacts/")) continue;
    const url = new URL(raw);
    const id = decodeURIComponent(url.hash.slice(1));
    url.hash = "";
    files.add(url.href);
    if (id) anchors.set(url.href, (anchors.get(url.href) ?? new Set()).add(id));
  }
  return { files: [...files], anchors: [...anchors].map(([file, ids]) => ({ file, ids: [...ids] })) };
}
