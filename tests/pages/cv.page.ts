import type { Locator, Page } from "@playwright/test";

// cv.html on screen and in print
export class CvPage {
  readonly heading: Locator;
  readonly skipLink: Locator;
  readonly backLink: Locator;
  readonly downloadLink: Locator;
  // TO-DO: Add sporedicena info in personal projects
  readonly entryTitles: Locator;
  readonly contactLinks: Locator;
  readonly entries: Locator;
  readonly body: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 });
    this.skipLink = page.getByRole("link", { name: "Skip to content" });
    this.backLink = page.getByRole("link", { name: /Back to portfolio/ });
    this.downloadLink = page.getByRole("link", { name: "Download PDF" });
    this.entryTitles = page.getByRole("heading", { level: 3 });
    this.contactLinks = page.locator(".cv-header").getByRole("link");
    this.entries = page.locator(".cv-entry");
    this.body = page.locator("body");
  }

  async goto() {
    await this.page.goto("/cv.html");
  }

  async fontsReady() {
    await this.page.evaluate(async () => {
      await document.fonts.ready;
    });
  }
}
