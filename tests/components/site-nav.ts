import type { Locator, Page } from "@playwright/test";
import { SECTIONS, type SectionId } from "../data/site";

/**
 * The top navigation: a row of links on desktop, a menu behind a toggle on
 * mobile. Links are matched even while the mobile menu is closed, so their
 * attributes can be checked on every device.
 */
export class SiteNav {
  readonly toggle: Locator;
  readonly cvLink: Locator;
  private readonly menu: Locator;

  constructor(
    page: Page,
    private readonly isMobile: boolean,
  ) {
    const nav = page.getByRole("navigation");
    this.toggle = nav.getByRole("button", { name: "Toggle navigation" });
    this.menu = nav.getByRole("list", { includeHidden: true });
    this.cvLink = this.menu.getByRole("link", { name: "View / Download CV", includeHidden: true });
  }

  link(section: SectionId): Locator {
    return this.menu.getByRole("link", { name: SECTIONS[section].nav, exact: true, includeHidden: true });
  }

  // Opens the mobile menu the way a mobile device would: with a tap
  async openMenu() {
    await this.toggle.tap();
  }

  // Follows a section link - through the menu on mobile, directly on desktop
  async goTo(section: SectionId) {
    if (this.isMobile) {
      await this.openMenu();
      await this.link(section).tap();
    } else {
      await this.link(section).click();
    }
  }
}
