import type { QaCounts, QaHistoryEntry, QaReport, QaTest } from "../../reporters/qa-report-types";

// A defaults test result - override only what the case is about
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
 * The full report. Summary, per-project and per-tag numbers extracted from
 * the tests unless a case overrides them, so a fixture can't contradict by accident.
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
