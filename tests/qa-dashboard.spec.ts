import { test, expect } from "./fixtures";
import { qaHistory, qaReport, qaTest } from "./data/qa-report";
import { PERF_BUDGET } from "./data/site";

test.describe("QA dashboard - real report", { tag: "@dashboard" }, () => {
  test("shows the real report's totals for each browser", async ({ page, request, dashboard }) => {
    await dashboard.open();
    await expect(page).toHaveTitle(/QA Suite Runner/);

    const response = await request.get("/assets/qa/report.json");
    await expect(response).toBeOK();
    const report = await response.json();
    await expect(dashboard.stat("passed")).toHaveText(String(report.summary.passed));
    await expect(dashboard.stat("failed")).toHaveText(String(report.summary.failed));
    await expect(dashboard.projectCards).toHaveCount(report.projects.length);
  });

  test("links back to the portfolio and to the raw report", async ({ dashboard }) => {
    await dashboard.open();
    await expect(dashboard.backLink).toHaveAttribute("href", "index.html#projects");
    await expect(dashboard.rawReportLink).toHaveAttribute("href", "assets/qa/report.json");
  });

  test("the portfolio's QA suite card opens the dashboard", async ({ page, homePage }) => {
    await homePage.goto();
    await homePage.suiteRunnerLink.click();
    await expect(page).toHaveURL(/qa-suite\.html$/);
  });
});

// These tests give the page a fake report, so they check how the page shows a run, not what's in report.json.
test.describe("QA dashboard - made-up report", { tag: "@dashboard" }, () => {
  test("a clean run shows its totals and every browser", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport() });
    await dashboard.open();

    await expect(dashboard.stat("total")).toHaveText("3");
    await expect(dashboard.stat("passed")).toHaveText("3");
    await expect(dashboard.stat("failed")).toHaveText("0");
    await expect(dashboard.projectCards).toHaveCount(2);
    await expect(dashboard.banner).toBeEmpty();
  });

  test("a failed test links to its trace", async ({ dashboard, baseURL }) => {
    const broken = qaTest({
      title: "the CV downloads",
      status: "failed",
      error: "expect(locator).toHaveAttribute(expected) failed",
      publishedAttachments: [{ type: "trace", path: "assets/qa/artifacts/abc123/trace.zip" }],
    });
    await dashboard.serve({ report: qaReport({ tests: [qaTest(), broken] }) });
    await dashboard.open();

    await expect(dashboard.stat("failed")).toHaveText("1");
    const row = dashboard.testRow("the CV downloads");
    await expect(dashboard.statusPill(row)).toHaveText("failed");
    await expect(dashboard.testError(row)).toContainText("toHaveAttribute");
    const trace = new URL("/assets/qa/artifacts/abc123/trace.zip", baseURL).href;
    await expect(dashboard.traceLink(row)).toHaveAttribute(
      "href",
      `https://trace.playwright.dev/?trace=${encodeURIComponent(trace)}`,
    );
  });

  test("flaky tests are counted separately", async ({ dashboard }) => {
    const flaky = qaTest({ title: "reload opens at the top", status: "flaky", retries: 1 });
    await dashboard.serve({ report: qaReport({ tests: [qaTest(), flaky] }) });
    await dashboard.open();

    await expect(dashboard.stat("flaky")).toHaveText("1");
    await expect(dashboard.stat("failed")).toHaveText("0");
    await expect(dashboard.statusPill(dashboard.testRow("reload opens at the top"))).toHaveClass(/is-flaky/);
  });

  test("the showcase offers the recorded video and the trace", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({
        showcase: { title: "A recruiter's first minute", project: "desktop-chromium", trace: "assets/qa/artifacts/s1/trace.zip", video: "assets/qa/artifacts/s1/video.webm" },
      }),
    });
    await dashboard.open();

    // The recording loads on demand, so page load doesnt wait on media.
    await expect(dashboard.showcaseVideo).toHaveCount(0);
    await dashboard.playRecording.click();
    await expect(dashboard.showcaseVideo).toHaveAttribute("src", "assets/qa/artifacts/s1/video.webm");
    await expect(dashboard.traceViewerLink).toHaveAttribute("href", /trace\.playwright\.dev\/\?trace=.*s1%2Ftrace\.zip$/);
  });

  test("no recording means no video player", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport({ showcase: null }) });
    await dashboard.open();
    await expect(dashboard.section("summary")).toBeVisible();
    await expect(dashboard.section("showcase")).toHaveCount(0);
  });

  test("accessibility violations are shown per page", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({
        accessibility: [
          { page: "/", project: "desktop-chromium", violations: 0, passes: 41, incomplete: 1, rules: [] },
          { page: "/cv.html", project: "desktop-firefox", violations: 2, passes: 38, incomplete: 0, rules: ["color-contrast", "link-name"] },
        ],
      }),
    });
    await dashboard.open();

    await expect(dashboard.a11yHeadline).toHaveText("2 violations across 2 pages × 2 browsers");
    await expect(dashboard.a11yHeadline).toHaveClass(/is-bad/);
    await expect(dashboard.a11yCount("/cv.html")).toHaveClass(/is-over/);
    await expect(dashboard.a11yRow("/cv.html")).toContainText("color-contrast, link-name");
  });

  test("no accessibility violations shows as passing", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({ accessibility: [{ page: "/", project: "desktop-chromium", violations: 0, passes: 40, incomplete: 0, rules: [] }] }),
    });
    await dashboard.open();
    await expect(dashboard.a11yHeadline).toHaveClass(/is-good/);
    await expect(dashboard.a11yHeadline).toContainText("0 violations");
  });

  test("only the metric over budget is flagged", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({ performance: [{ page: "/", project: "desktop-chromium", lcpMs: 3100, fcpMs: 900, cls: 0.02, transferKb: 48, budget: PERF_BUDGET }] }),
    });
    await dashboard.open();

    await expect(dashboard.perfMetric("/", "lcp")).toHaveClass(/is-over/);
    await expect(dashboard.perfMetric("/", "cls")).toHaveClass(/is-ok/);
    await expect(dashboard.perfMetric("/", "weight")).toHaveClass(/is-ok/);
  });

  test("recently failed or flaky tests show under Stability", async ({ dashboard }) => {
    const report = qaReport();
    const [first] = report.tests;
    await dashboard.serve({
      report,
      testHistory: {
        runs: 8,
        // p passed, f failed, k flaky - one letter per run, oldest first
        tests: { [first.id]: { title: first.title, project: first.project, file: first.file, outcomes: "pppfpkpp", durations: [400, 410, 390, 420, 405, 398, 402, 420] } },
      },
    });
    await dashboard.open();

    await expect(dashboard.stabilityRate(first.id)).toHaveText("2 of 8 runs");
    await expect(dashboard.runStrip(first.id)).toHaveCount(8);
    await expect(dashboard.failedRuns(first.id)).toHaveCount(1);
  });

  test("a test much slower than usual is flagged", async ({ dashboard }) => {
    const slow = qaTest({ title: "the dashboard renders", durationMs: 1400 });
    await dashboard.serve({
      report: qaReport({ tests: [slow, qaTest()] }),
      testHistory: {
        runs: 5,
        tests: { [slow.id]: { title: slow.title, project: slow.project, file: slow.file, outcomes: "ppppp", durations: [400, 420, 380, 410, 1400] } },
      },
    });
    await dashboard.open();

    await expect(dashboard.stabilityEmpty).toContainText("No test failed");
    await expect(dashboard.regressedDurations).toHaveText(/1\.4 s ↑ usually 405 ms/);
  });

  test("tag chips filter the test list", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({
        tests: [
          qaTest({ title: "home page has no WCAG violations", tags: ["@a11y"], path: ["accessibility"] }),
          qaTest({ title: "the nav reaches every section", tags: ["@smoke"] }),
          qaTest({ title: "the CV prints to A4", tags: ["@print"], path: ["CV print"] }),
        ],
      }),
    });
    await dashboard.open();

    const visibleRows = dashboard.testRows.filter({ visible: true });
    const visibleGroups = dashboard.suiteGroups.filter({ visible: true });
    // A green run starts with every group collapsed.
    await expect(visibleRows).toHaveCount(0);

    await dashboard.tagFilter("@a11y 1").click();
    await expect(dashboard.tagFilter("@a11y 1")).toHaveAttribute("aria-pressed", "true");
    await expect(visibleRows).toHaveCount(1);
    await expect(dashboard.testRow("home page has no WCAG violations")).toBeVisible();
    await expect(visibleGroups).toHaveCount(1);

    await dashboard.tagFilter("All 3").click();
    await expect(visibleGroups).toHaveCount(3);
    await expect(dashboard.filteredOutRows).toHaveCount(0);
    await expect(visibleRows).toHaveCount(0);
  });

  test("a local run is labelled as local", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport({ source: "local", runUrl: null }) });
    await dashboard.open();
    await expect(dashboard.banner).toContainText("From a local run");
    await expect(dashboard.meta).toContainText("Commit 0123456");
  });

  test("the trend chart needs at least two runs", async ({ page, dashboard }) => {
    await dashboard.serve({ report: qaReport(), history: qaHistory([100]) });
    await dashboard.open();
    await expect(dashboard.trendEmpty).toBeVisible();

    await page.unrouteAll();
    await dashboard.serve({ report: qaReport(), history: qaHistory([96, 100, 98]) });
    await page.reload();
    await expect(dashboard.trendPoints).toHaveCount(3);
  });

  test("missing history files only empty their own panels", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport(), history: null, testHistory: null });
    await dashboard.open();
    await expect(dashboard.stat("total")).toHaveText("3");
    await expect(dashboard.trendEmpty).toBeVisible();
    await expect(dashboard.section("stability")).toContainText("Stability appears once runs have been recorded");
  });

  test("a missing report shows an error", async ({ dashboard }) => {
    await dashboard.failReport(404);
    await dashboard.open();
    await expect(dashboard.error).toContainText("answered 404");
    await expect(dashboard.section("summary")).toHaveCount(0);
  });

  test("a report that can't be reached shows an error", async ({ dashboard }) => {
    await dashboard.abortReport();
    await dashboard.open();
    // dashboard.error looks for role="alert", so this also checks screen readers hear it.
    await expect(dashboard.error).toContainText("Couldn't load the latest report");
  });
});
