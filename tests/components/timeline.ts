import type { Locator } from "@playwright/test";

// The experience timeline: the recent roles, with earlier ones hidden
export class Timeline {
  // Role titles, newest first
  readonly visibleRoles: Locator;
  // Every role title
  readonly allRoles: Locator;
  // The roles under 'Show earlier roles'
  readonly earlierRoles: Locator;
  // The 'Show / Hide earlier roles' toggle
  readonly earlierRolesToggle: Locator;

  constructor(section: Locator) {
    this.visibleRoles = section.getByRole("heading", { level: 3 });
    this.allRoles = section.getByRole("heading", { level: 3, includeHidden: true });
    const earlier = section.locator("details");
    this.earlierRoles = earlier.getByRole("heading", { level: 3, includeHidden: true });
    this.earlierRolesToggle = earlier.locator("summary");
  }

  // Role title with "Current" badge
  get currentRoles(): Locator {
    return this.allRoles.filter({ hasText: /Current$/ });
  }

  async showEarlierRoles() {
    await this.earlierRolesToggle.click();
  }
}
