import fs from "node:fs";
import path from "node:path";
import type { FullResult, Suite, TestCase, TestResult } from "@playwright/test/reporter";
import QaDashboardReporter from "../../reporters/qa-dashboard-reporter";
import { QaHistorySchema, QaReportSchema, QaTestHistorySchema } from "../../reporters/qa-report-schema";
import type { QaHistoryEntry, QaReport, QaTestHistory } from "../../reporters/qa-report-types";

const ROOT = path.resolve(__dirname, "..", "..");

export type FakeAttempt = Partial<Pick<TestResult, "status" | "duration" | "error" | "annotations" | "attachments">>;

export type FakeTest = {
  title?: string;
  describe?: string[];
  file?: string;
  project?: string;
  tags?: string[];
  outcome?: ReturnType<TestCase["outcome"]>;
  annotations?: TestCase["annotations"];
  attempts?: FakeAttempt[];
};

// A fake test with just what the reporter expects.
export function fakeTest(options: FakeTest = {}): TestCase {
  const {
    title = "a visitor can open the CV",
    describe = ["home page"],
    file = "smoke.spec.ts",
    project = "desktop-chromium",
    tags = ["@smoke"],
    outcome = "expected",
    annotations = [],
    attempts = [{}],
  } = options;
  return {
    title,
    tags,
    annotations,
    results: attempts.map((attempt) => ({ status: "passed", duration: 400, annotations: [], attachments: [], ...attempt })),
    location: { file: path.join(ROOT, "tests", file), line: 1, column: 1 },
    outcome: () => outcome,
    // Playwright artifacts: suite, project, file, describe, title.
    titlePath: () => ["", project, file, ...describe, title],
    parent: { project: () => ({ name: project }) },
  } as unknown as TestCase;
}

// Attach a trace file
export function fakeAttachment(dir: string, name: "trace" | "video", content: string) {
  const file = path.join(dir, `${content}.${name === "trace" ? "zip" : "webm"}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, content);
  return { name, path: file, contentType: name === "trace" ? "application/zip" : "video/webm" };
}

export type Run = { report: QaReport; history: QaHistoryEntry[]; testHistory: QaTestHistory };

// Run the tests through the reporter to outputDir and check them back against the schemas
export function runReporter(outputDir: string, tests: TestCase[]): Run {
  const reporter = new QaDashboardReporter({ outputDir, quiet: true });
  reporter.onBegin({}, { allTests: () => tests } as unknown as Suite);
  reporter.onEnd({ status: "passed", startTime: new Date(), duration: 61_000 } as FullResult);
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(outputDir, file), "utf8"));
  return {
    report: QaReportSchema.parse(read("report.json")),
    history: QaHistorySchema.parse(read("history.json")),
    testHistory: QaTestHistorySchema.parse(read("test-history.json")),
  };
}

const CI_VARIABLES = ["CI", "GITHUB_SHA", "GITHUB_RUN_ID", "GITHUB_REPOSITORY", "GITHUB_SERVER_URL", "GITHUB_STEP_SUMMARY"] as const;

// clear CI variables.
export function useCiVariables(vars: Partial<Record<(typeof CI_VARIABLES)[number], string>>): () => void {
  const saved = CI_VARIABLES.map((name) => [name, process.env[name]] as const);
  for (const name of CI_VARIABLES) delete process.env[name];
  Object.assign(process.env, vars);
  return () => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}
