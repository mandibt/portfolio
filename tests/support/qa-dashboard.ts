import type { Locator, Page } from "@playwright/test";
import type {
  QaCounts,
  QaHistoryEntry,
  QaReport,
  QaTest,
  QaTestHistory,
} from "../../reporters/qa-report-types";

/** A single test result with sensible defaults; override only what a case is about. */
export function qaTest(overrides: Partial<QaTest> = {}): QaTest {
  const title = overrides.title ?? "a visitor can open the CV";
  const project = overrides.project ?? "desktop-chromium";
  return {
    id: `${title}-${project}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    title,
    path: ["home page"],
    file: "smoke.spec.ts",
    project,
    tags: ["@smoke"],
    status: "passed",
    durationMs: 420,
    retries: 0,
    error: null,
    publishedAttachments: [],
    ...overrides,
  };
}

function countsOf(tests: QaTest[]): QaCounts {
  return {
    total: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed").length,
    flaky: tests.filter((t) => t.status === "flaky").length,
    skipped: tests.filter((t) => t.status === "skipped").length,
  };
}

/**
 * A whole report. Summary, per-project and per-tag numbers are derived from
 * the tests unless a case overrides them, so a fixture can't contradict itself
 * by accident.
 */
export function qaReport(overrides: Partial<QaReport> = {}): QaReport {
  const tests = overrides.tests ?? [
    qaTest(),
    qaTest({ title: "the nav reaches every section" }),
    qaTest({ project: "mobile-chromium" }),
  ];
  const projects = [...new Set(tests.map((t) => t.project))].map((name) => ({
    name,
    ...countsOf(tests.filter((t) => t.project === name)),
  }));
  const tags = [...new Set(tests.flatMap((t) => t.tags))].map((tag) => ({
    tag,
    total: tests.filter((t) => t.tags.includes(tag)).length,
  }));
  return {
    schemaVersion: 2,
    generatedAt: "2026-09-12T08:30:00.000Z",
    source: "ci",
    commit: "0123456789abcdef",
    commitShort: "0123456",
    runUrl: "https://github.com/mandibt/portfolio/actions/runs/1",
    durationMs: 61_000,
    summary: countsOf(tests),
    projects,
    tags,
    accessibility: [],
    performance: [],
    showcase: null,
    ...overrides,
    tests,
  };
}

export function qaHistory(passRates: number[]): QaHistoryEntry[] {
  return passRates.map((passRate, i) => ({
    generatedAt: new Date(Date.UTC(2026, 8, 1 + i, 8)).toISOString(),
    source: "ci",
    commitShort: `c0ffee${i}`,
    total: 100,
    passed: passRate,
    failed: 100 - passRate,
    flaky: 0,
    skipped: 0,
    passRate,
  }));
}

type ServeOptions = {
  report: QaReport;
  history?: QaHistoryEntry[] | null;
  testHistory?: QaTestHistory | null;
};

/**
 * qa-suite.html under test with its data served from the test. What's being
 * verified is what the page does with a report — a failing run, a missing
 * file, an unreachable server — not whatever happens to be committed today.
 */
export class QaDashboard {
  constructor(readonly page: Page) {}

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

  section(name: string): Locator {
    return this.page.locator(`[data-section="${name}"]`);
  }

  stat(name: keyof QaCounts): Locator {
    return this.page.locator(`.qa-stat[data-stat="${name}"] .num`);
  }

  testRow(title: string): Locator {
    return this.page.locator(".qa-test-row", { hasText: title });
  }

  get banner(): Locator {
    return this.page.locator("#qaBanner");
  }

  get error(): Locator {
    return this.page.locator(".qa-fetch-error");
  }
}
