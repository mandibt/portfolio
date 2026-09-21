import type { Locator, Page } from "@playwright/test";

// 404.html - page not found
export class PageNotFound {
  readonly code: Locator;
  readonly backLink: Locator;

  constructor(private readonly page: Page) {
    this.code = page.getByRole("heading", { level: 1 });
    this.backLink = page.getByRole("link", { name: "Back to the portfolio" });
  }

  // Open the page directly to check 404 status
  goto(path = "/404.html") {
    return this.page.goto(path);
  }
}
