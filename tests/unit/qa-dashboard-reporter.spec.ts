import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { fakeAttachment, fakeTest, runReporter, useCiVariables, type Run } from "./fake-run";

const test = base.extend<{ outputDir: string; localRun: void }>({
  // Start as local and no CI
  localRun: [
    async ({}, use) => {
      const restore = useCiVariables({ GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567" });
      await use();
      restore();
    },
    { auto: true },
  ],
  outputDir: async ({}, use, testInfo) => {
    await use(testInfo.outputPath("qa"));
  },
});

test.describe("dashboard reporter", { tag: "@unit" }, () => {
  test("counts every outcome, per browser and per tag", async ({ outputDir }) => {
    const { report } = runReporter(outputDir, [
      fakeTest({ title: "passes" }),
      fakeTest({ title: "fails", outcome: "unexpected", attempts: [{ status: "failed" }, { status: "failed" }] }),
      fakeTest({ title: "flakes", outcome: "flaky", tags: ["@smoke", "@a11y"], attempts: [{ status: "failed" }, { status: "passed" }] }),
      fakeTest({ title: "skips", outcome: "skipped", project: "mobile-chromium", attempts: [{ status: "skipped" }] }),
    ]);

    expect(report.summary).toEqual({ total: 4, passed: 1, failed: 1, flaky: 1, skipped: 1 });
    expect(report.projects).toEqual([
      { name: "desktop-chromium", total: 3, passed: 1, failed: 1, flaky: 1, skipped: 0 },
      { name: "mobile-chromium", total: 1, passed: 0, failed: 0, flaky: 0, skipped: 1 },
    ]);
    expect(report.tags).toEqual([
      { tag: "@a11y", total: 1 },
      { tag: "@smoke", total: 4 },
    ]);
    expect(report.tests.find((t) => t.title === "flakes")?.retries).toBe(1);
  });

  test("keeps the first line of an error, without terminal colours", async ({ outputDir }) => {
    const message = "\u001b[31mexpect(locator).toHaveText(expected) failed\u001b[39m\n\nLocator: getByRole('heading')";
    const { report } = runReporter(outputDir, [fakeTest({ outcome: "unexpected", attempts: [{ status: "failed", error: { message } }] })]);
    expect(report.tests[0].error).toBe("expect(locator).toHaveText(expected) failed");
  });

  test("records an accessibility scan once, however often its annotation appears", async ({ outputDir }) => {
    const scan = { type: "qa:a11y", description: JSON.stringify({ page: "/cv.html", violations: 1, passes: 40, incomplete: 0, rules: ["link-name"] }) };
    const budget = { lcpMs: 2500, cls: 0.1, transferKb: 150 };
    const perf = { type: "qa:perf", description: JSON.stringify({ page: "/", lcpMs: 900, fcpMs: 400, cls: 0, transferKb: 60, budget }) };
    const { report } = runReporter(outputDir, [
      fakeTest({
        project: "desktop-firefox",
        outcome: "flaky",
        annotations: [scan, perf],
        attempts: [
          { status: "failed", annotations: [scan, perf] },
          { status: "passed", annotations: [scan, perf] },
        ],
      }),
    ]);

    expect(report.accessibility).toEqual([{ page: "/cv.html", project: "desktop-firefox", violations: 1, passes: 40, incomplete: 0, rules: ["link-name"] }]);
    expect(report.performance).toEqual([{ page: "/", project: "desktop-firefox", lcpMs: 900, fcpMs: 400, cls: 0, transferKb: 60, budget }]);
  });

  test("failed and flaky tests publish the attempt that went wrong; passing tests publish nothing", async ({ outputDir }, testInfo) => {
    const files = testInfo.outputPath("attachments");
    const { report } = runReporter(outputDir, [
      fakeTest({ title: "passes", attempts: [{ attachments: [fakeAttachment(files, "trace", "passing-trace")] }] }),
      fakeTest({
        title: "fails",
        outcome: "unexpected",
        attempts: [{ status: "failed", attachments: [fakeAttachment(files, "trace", "failed-trace"), fakeAttachment(files, "video", "failed-video")] }],
      }),
      fakeTest({
        title: "flakes",
        outcome: "flaky",
        attempts: [
          { status: "failed", attachments: [fakeAttachment(files, "trace", "first-attempt-trace")] },
          { status: "passed", attachments: [fakeAttachment(files, "trace", "retry-trace")] },
        ],
      }),
    ]);
    const byTitle = (title: string) => report.tests.find((t) => t.title === title)!;

    expect(byTitle("passes").publishedAttachments).toEqual([]);

    const failed = byTitle("fails");
    expect(failed.publishedAttachments).toEqual([
      { type: "trace", path: `assets/qa/artifacts/${failed.id}/trace.zip` },
      { type: "video", path: `assets/qa/artifacts/${failed.id}/video.webm` },
    ]);
    expect(fs.readFileSync(path.join(outputDir, "artifacts", failed.id, "trace.zip"), "utf8")).toBe("failed-trace");

    const flaky = byTitle("flakes");
    expect(fs.readFileSync(path.join(outputDir, "artifacts", flaky.id, "trace.zip"), "utf8")).toBe("first-attempt-trace");
  });

  test("publishes the showcase journey even when it passes", async ({ outputDir }, testInfo) => {
    const files = testInfo.outputPath("attachments");
    const { report } = runReporter(outputDir, [
      fakeTest({
        title: "a recruiter's first minute on the site",
        annotations: [{ type: "qa:showcase", description: "A recruiter's first minute" }],
        attempts: [{ attachments: [fakeAttachment(files, "trace", "journey-trace"), fakeAttachment(files, "video", "journey-video")] }],
      }),
    ]);
    const [journey] = report.tests;

    expect(report.showcase).toEqual({
      title: "A recruiter's first minute",
      project: "desktop-chromium",
      trace: `assets/qa/artifacts/${journey.id}/trace.zip`,
      video: `assets/qa/artifacts/${journey.id}/video.webm`,
    });
  });

  test("a test keeps its id from run to run, and a renamed one starts a new history", async ({ outputDir }) => {
    const first = runReporter(outputDir, [fakeTest({ title: "old name" }), fakeTest({ title: "unchanged" })]);
    const second = runReporter(outputDir, [
      fakeTest({ title: "new name" }),
      fakeTest({ title: "unchanged", tags: ["@smoke", "@a11y"] }),
      fakeTest({ title: "unchanged", project: "mobile-chromium" }),
    ]);
    const id = (run: Run, title: string, project = "desktop-chromium") =>
      run.report.tests.find((t) => t.title === title && t.project === project)!.id;

    // Title, path, file and project.
    expect(id(second, "unchanged")).toBe(id(first, "unchanged"));
    expect(id(second, "unchanged", "mobile-chromium")).not.toBe(id(first, "unchanged"));
    expect(id(second, "new name")).not.toBe(id(first, "old name"));

    expect(second.testHistory.runs).toBe(2);
    expect(second.testHistory.tests[id(first, "unchanged")].outcomes).toBe("pp");
    expect(Object.keys(second.testHistory.tests)).not.toContain(id(first, "old name"));
  });

  test("the run history keeps the last 30 runs and counts a flaky pass as a pass", async ({ outputDir }) => {
    for (let run = 0; run < 31; run++) runReporter(outputDir, [fakeTest()]);
    const { history } = runReporter(outputDir, [
      fakeTest({ title: "passes" }),
      fakeTest({ title: "flakes", outcome: "flaky" }),
      fakeTest({ title: "fails", outcome: "unexpected" }),
      fakeTest({ title: "skips", outcome: "skipped" }),
    ]);

    expect(history).toHaveLength(30);
    // 2/3 tests ran and held up - we dont count a skipped one.
    expect(history.at(-1)?.passRate).toBe(66.7);
  });

  test("a run where nothing ran has no pass rate - no 100% success", async ({ outputDir }) => {
    const { history } = runReporter(outputDir, [fakeTest({ outcome: "skipped" })]);
    expect(history.at(-1)?.passRate).toBeNull();
  });

  test("the test history keeps the last 20 outcomes and durations", async ({ outputDir }) => {
    for (let run = 0; run < 20; run++) runReporter(outputDir, [fakeTest()]);
    const { report, testHistory } = runReporter(outputDir, [
      fakeTest({ outcome: "unexpected", attempts: [{ status: "failed", duration: 900 }] }),
    ]);
    const entry = testHistory.tests[report.tests[0].id];

    expect(entry.outcomes).toBe(`${"p".repeat(19)}f`);
    expect(entry.durations).toHaveLength(20);
    expect(entry.durations.at(-1)).toBe(900);
  });

  test("a CI run carries commit and links to the workflow", async ({ outputDir }) => {
    Object.assign(process.env, {
      CI: "true",
      GITHUB_SHA: "fedcba9876543210fedcba9876543210fedcba98",
      GITHUB_REPOSITORY: "mandibt/portfolio",
      GITHUB_RUN_ID: "42",
    });
    const { report } = runReporter(outputDir, [fakeTest()]);
    expect(report).toMatchObject({
      source: "ci",
      commit: "fedcba9876543210fedcba9876543210fedcba98",
      commitShort: "fedcba9",
      runUrl: "https://github.com/mandibt/portfolio/actions/runs/42",
    });
  });

  test("a local run links nowhere and sets source as local", async ({ outputDir }) => {
    const { report } = runReporter(outputDir, [fakeTest()]);
    expect(report).toMatchObject({ source: "local", commitShort: "0123456", runUrl: null });
  });

  test("in GitHub Actions, the run summary lists what failed", async ({ outputDir }, testInfo) => {
    const summary = testInfo.outputPath("step-summary.md");
    process.env.GITHUB_STEP_SUMMARY = summary;
    runReporter(outputDir, [
      fakeTest(),
      fakeTest({ title: "the CV downloads", outcome: "unexpected", attempts: [{ status: "failed", error: { message: "expected a PDF | got HTML" } }] }),
    ]);
    const markdown = fs.readFileSync(summary, "utf8");

    expect(markdown).toContain("Suite failed");
    expect(markdown).toContain("| home page › the CV downloads | desktop-chromium | failed | expected a PDF \\| got HTML |");
  });

  test("refuse to write a report the dashboard cant read", async ({ outputDir }) => {
    expect(() => runReporter(outputDir, [fakeTest({ tags: ["smoke"] })])).toThrow(/refusing to write report\.json/);
    expect(fs.existsSync(path.join(outputDir, "report.json"))).toBe(false);
  });
});