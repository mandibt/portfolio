import type { Locator } from "@playwright/test";

// The skill bars. They're labels, a percentage and a fill that screen readers get as plain text
export class SkillBars {
  readonly bars: Locator;

  constructor(section: Locator) {
    this.bars = section.locator(".skill-bar");
  }

  bar(skill: string): Locator {
    return this.bars.filter({ hasText: skill });
  }

  percentage(bar: Locator): Locator {
    return bar.locator(".skill-bar-pct");
  }

  // The percentage the bar declares in its label
  async declaredPercent(bar: Locator): Promise<number> {
    return parseFloat((await this.percentage(bar).textContent()) ?? "");
  }

  // Centres a bar in the viewport
  async centre(bar: Locator) {
    await bar.evaluate((el) => el.scrollIntoView({ block: "center" }));
  }

  // How far the fill reaches, in a whole number percent
  fillPercent(bar: Locator): Promise<number> {
    return bar.evaluate((el) => {
      const fill = el.querySelector<HTMLElement>(".skill-bar-fill")!;
      const track = el.querySelector<HTMLElement>(".skill-bar-track")!;
      return Math.round((fill.getBoundingClientRect().width / track.getBoundingClientRect().width) * 100);
    });
  }

  // Animations attached to the fill - none when the client wants reduced motion
  runningAnimations(): Promise<number> {
    return this.bars
      .locator(".skill-bar-fill")
      .evaluateAll((fills) => fills.reduce((n, el) => n + el.getAnimations().length, 0));
  }
}
