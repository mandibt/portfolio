import type { Locator, Page } from "@playwright/test";
import { SiteNav } from "../components/site-nav";
import { SkillBars } from "../components/skill-bars";
import { Timeline } from "../components/timeline";
import { SECTIONS, type SectionId } from "../data/site";

// index.html - the actual portfolio and it's components
export class HomePage {
  readonly nav: SiteNav;
  readonly timeline: Timeline;
  readonly skills: SkillBars;

  readonly heading: Locator;
  readonly skipLink: Locator;
  readonly heroCvLink: Locator;
  readonly suiteRunnerLink: Locator;
  readonly contactLink: Locator;
  readonly footer: Locator;
  readonly footerLinkedIn: Locator;
  readonly floatingCta: Locator;

  constructor(
    private readonly page: Page,
    isMobile: boolean,
  ) {
    this.nav = new SiteNav(page, isMobile);
    this.timeline = new Timeline(this.section("experience"));
    this.skills = new SkillBars(this.section("skills"));

    this.heading = page.getByRole("heading", { level: 1 });
    this.skipLink = page.getByRole("link", { name: "Skip to content" });
    this.heroCvLink = page.getByRole("main").getByRole("link", { name: "Download CV", exact: true });
    this.suiteRunnerLink = this.section("projects").getByRole("link", { name: /Open the suite runner/ });
    this.contactLink = this.section("contact").getByRole("link", { name: "Connect on LinkedIn" });
    this.footer = page.getByRole("contentinfo");
    this.footerLinkedIn = this.footer.getByRole("link");
    // The arrow is aria-hidden - links accessible name is only by text
    this.floatingCta = page.getByRole("link", { name: "Let's talk", exact: true });
  }

  // Opens the home page, optionally at a hash such as "#contact"
  async goto(hash = "") {
    await this.page.goto(`/${hash}`);
  }

  // Page section/region by its ID
  section(id: SectionId): Locator {
    return this.page.getByRole("region", { name: SECTIONS[id].heading });
  }

  // A project card by title
  projectCard(title: string): Locator {
    return this.section("projects")
      .locator(".project-card")
      .filter({ has: this.page.getByRole("heading", { name: title }) });
  }
}
