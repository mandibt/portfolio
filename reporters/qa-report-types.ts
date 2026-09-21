/**
 * Shape of the dashboard files, shared by the reporter and the dashboard test
 * data (tests/data/qa-report.ts). qa-report-schema.ts checks it at runtime.
 */

export type QaStatus = "passed" | "failed" | "flaky" | "skipped";

export interface QaAttachment {
  type: "trace" | "video";
  path: string;
}

export interface QaTest {
  id: string;
  title: string;
  path: string[];
  file: string;
  project: string;
  tags: string[];
  status: QaStatus;
  durationMs: number;
  retries: number;
  error: string | null;
  publishedAttachments: QaAttachment[];
}

export interface QaCounts {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
}

// Recorded by tests/a11y.spec.ts through a "qa:a11y" annotation.
export interface QaAccessibilityResult {
  page: string;
  project: string;
  violations: number;
  passes: number;
  incomplete: number;
  rules: string[];
}

// Recorded by tests/performance.spec.ts through a "qa:perf" annotation.
export interface QaPerformanceResult {
  page: string;
  project: string;
  lcpMs: number;
  fcpMs: number;
  cls: number;
  transferKb: number;
  budget: { lcpMs: number; cls: number; transferKb: number };
}

export interface QaShowcase {
  title: string;
  project: string;
  trace: string | null;
  video: string | null;
}

export interface QaReport {
  schemaVersion: 2;
  generatedAt: string;
  source: "ci" | "local";
  commit: string;
  commitShort: string;
  runUrl: string | null;
  durationMs: number | null;
  summary: QaCounts;
  projects: Array<QaCounts & { name: string }>;
  tags: Array<{ tag: string; total: number }>;
  tests: QaTest[];
  accessibility: QaAccessibilityResult[];
  performance: QaPerformanceResult[];
  showcase: QaShowcase | null;
}

export interface QaHistoryEntry extends QaCounts {
  generatedAt: string;
  source: "ci" | "local";
  commitShort: string;
  passRate: number | null;
}

// Per-test outcomes across recent runs, for the Stability panel.
export interface QaTestHistory {
  runs: number;
  tests: Record<
    string,
    {
      title: string;
      project: string;
      file: string;
      // One letter per run, oldest first: p passed, f failed, k flaky, s skipped.
      outcomes: string;
      durations: number[];
    }
  >;
}
