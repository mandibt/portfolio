import type { Locator, Page } from "@playwright/test";
import type { QaCounts, QaHistoryEntry, QaReport, QaTestHistory } from "../../reporters/qa-report-types";

type ServeOptions = {
  report: QaReport;
  history?: QaHistoryEntry[] | null;
  testHistory?: QaTestHistory | null;
};

type PerfMetric = "lcp" | "cls" | "weight";

/**
 * qa-suite.html with its data served from the tests. What's being
 * verified is what the page does with a report - a failing run, a missing
 * file, unreachable server
 *
 * Roles are used wherever possible. The rest is the data-* attributes 
 * (data-section, data-stat, data-page, data-test) and the is-* classes.
 */
export class QaDashboard {
  readonly heading: Locator;
  readonly backLink: Locator;
  readonly rawReportLink: Locator;
  readonly meta: Locator;
  readonly banner: Locator;
  readonly error: Locator;
  readonly projectCards: Locator;
  // Tests list and tag filter
  readonly suiteGroups: Locator;
  readonly testRows: Locator;
  readonly filteredOutRows: Locator;
  // Showcase
  readonly showcaseVideo: Locator;
  readonly playRecording: Locator;
  readonly traceViewerLink: Locator;
  // Accessibility, trends
  readonly a11yHeadline: Locator;
  readonly stabilityEmpty: Locator;
  readonly regressedDurations: Locator;
  readonly trendEmpty: Locator;
  readonly trendPoints: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 });
    this.backLink = page.getByRole("link", { name: /Back to portfolio/ });
    this.rawReportLink = page.getByRole("link", { name: "View raw report.json" });
    this.meta = page.locator("#qaMeta");
    this.banner = page.locator("#qaBanner");
    this.error = page.getByRole("alert");
    this.projectCards = page.locator(".qa-project-card");

    this.suiteGroups = page.locator(".qa-suite-group");
    this.testRows = page.locator(".qa-test-row");
    this.filteredOutRows = page.locator(".qa-test-row[hidden]");

    const showcase = this.section("showcase");
    this.showcaseVideo = showcase.locator("video");
    this.playRecording = showcase.getByRole("button", { name: /Play the recording/ });
    this.traceViewerLink = showcase.getByRole("link", { name: /Trace Viewer/ });

    this.a11yHeadline = this.section("accessibility").locator(".qa-headline");
    this.stabilityEmpty = this.section("stability").locator(".qa-stability-empty");
    this.regressedDurations = this.section("stability").locator(".is-regressed");
    this.trendEmpty = this.section("trend").locator(".qa-trend-empty");
    this.trendPoints = this.section("trend").getByRole("img", { name: /Pass rate/ }).locator("circle");
  }

  // What the page fetches
  async serve({ report, history = [], testHistory = null }: ServeOptions) {
    await this.page.route("**/assets/qa/report.json", (route) => route.fulfill({ json: report }));
    await this.page.route("**/assets/qa/history.json", (route) =>
      history ? route.fulfill({ json: history }) : route.fulfill({ status: 404, body: "not found" }),
    );
    await this.page.route("**/assets/qa/test-history.json", (route) =>
      testHistory ? route.fulfill({ json: testHistory }) : route.fulfill({ status: 404, body: "not found" }),
    );
  }

  async failReport(status: number) {
    await this.page.route("**/assets/qa/report.json", (route) => route.fulfill({ status, body: "nope" }));
  }

  async abortReport() {
    await this.page.route("**/assets/qa/report.json", (route) => route.abort("connectionrefused"));
  }

  async open() {
    await this.page.goto("/qa-suite.html");
  }

  // Wait for the report to render and the first section to show up
  async rendered() {
    await this.page.locator(".qa-section").first().waitFor();
  }

  // Page structure

  section(name: string): Locator {
    return this.page.locator(`[data-section="${name}"]`);
  }

  stat(name: keyof QaCounts): Locator {
    return this.page.locator(`.qa-stat[data-stat="${name}"] .num`);
  }

  tagFilter(label: string): Locator {
    return this.page.getByRole("group", { name: "Filter tests by tag" }).getByRole("button", { name: label, exact: true });
  }

  // Test list

  testRow(title: string): Locator {
    return this.testRows.filter({ hasText: title });
  }

  statusPill(row: Locator): Locator {
    return row.locator(".qa-pill");
  }

  testError(row: Locator): Locator {
    return row.locator(".qa-test-error");
  }

  traceLink(row: Locator): Locator {
    return row.getByRole("link", { name: "Replay trace →" });
  }

  // Accessibility, performance and stability

  a11yRow(pagePath: string): Locator {
    return this.section("accessibility").locator(`.qa-a11y-row[data-page="${pagePath}"]`);
  }

  a11yCount(pagePath: string): Locator {
    return this.a11yRow(pagePath).locator(".qa-a11y-count");
  }

  perfMetric(pagePath: string, metric: PerfMetric): Locator {
    return this.section("performance").locator(`.qa-perf-row[data-page="${pagePath}"] .qa-perf-${metric}`);
  }

  stabilityRate(testId: string): Locator {
    return this.stabilityRow(testId).locator(".qa-stability-rate");
  }

  // One mark per run
  runStrip(testId: string): Locator {
    return this.stabilityRow(testId).locator(".qa-run");
  }

  failedRuns(testId: string): Locator {
    return this.stabilityRow(testId).locator(".qa-run.is-f");
  }

  private stabilityRow(testId: string): Locator {
    return this.section("stability").locator(`.qa-stability-row[data-test="${testId}"]`);
  }
}
