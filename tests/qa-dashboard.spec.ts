import { test, expect } from "./fixtures";
import { qaHistory, qaReport, qaTest } from "./support/qa-dashboard";

test.describe("qa suite page — published report", { tag: "@dashboard" }, () => {
  test("renders the committed report with a per-browser breakdown", async ({ page }) => {
    await page.goto("/qa-suite.html");
    await expect(page).toHaveTitle(/QA Suite Runner/);

    const report = await (await page.request.get("/assets/qa/report.json")).json();
    await expect(page.locator('.qa-stat[data-stat="passed"] .num')).toHaveText(String(report.summary.passed));
    await expect(page.locator('.qa-stat[data-stat="failed"] .num')).toHaveText(String(report.summary.failed));
    await expect(page.locator(".qa-project-card")).toHaveCount(report.projects.length);
  });

  test("links back to the portfolio and to the raw report", async ({ page }) => {
    await page.goto("/qa-suite.html");
    await expect(page.locator(".cv-toolbar a.back")).toHaveAttribute("href", "index.html#projects");
    await expect(page.locator("#rawReportLink")).toHaveAttribute("href", "assets/qa/report.json");
  });

  test("the suite card on the portfolio opens the runner", async ({ page }) => {
    await page.goto("/");
    await page.locator("#projects a", { hasText: "Open the suite runner" }).click();
    await expect(page).toHaveURL(/qa-suite\.html$/);
  });
});

// Everything below serves its own report through page.route, so each case is
// about what the page does with a given run — not about the committed file.
test.describe("qa suite page — rendering any run", { tag: "@dashboard" }, () => {
  test("a clean run shows its totals and every browser", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport() });
    await dashboard.open();

    await expect(dashboard.stat("total")).toHaveText("3");
    await expect(dashboard.stat("passed")).toHaveText("3");
    await expect(dashboard.stat("failed")).toHaveText("0");
    await expect(dashboard.page.locator(".qa-project-card")).toHaveCount(2);
    await expect(dashboard.banner).toBeEmpty();
  });

  test("a failing test links straight to its trace in Playwright's Trace Viewer", async ({ dashboard, baseURL }) => {
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
    await expect(row.locator(".qa-pill")).toHaveText("failed");
    await expect(row.locator(".qa-test-error")).toContainText("toHaveAttribute");
    const trace = new URL("/assets/qa/artifacts/abc123/trace.zip", baseURL).href;
    await expect(row.getByRole("link", { name: "Replay trace →" })).toHaveAttribute(
      "href",
      `https://trace.playwright.dev/?trace=${encodeURIComponent(trace)}`,
    );
  });

  test("a flaky test is counted apart from passes and failures", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport({ tests: [qaTest(), qaTest({ title: "reload opens at the top", status: "flaky", retries: 1 })] }) });
    await dashboard.open();

    await expect(dashboard.stat("flaky")).toHaveText("1");
    await expect(dashboard.stat("failed")).toHaveText("0");
    await expect(dashboard.testRow("reload opens at the top").locator(".qa-pill")).toHaveClass(/is-flaky/);
  });

  test("the showcase offers the recorded video and the trace", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({
        showcase: { title: "A recruiter's first minute", project: "desktop-chromium", trace: "assets/qa/artifacts/s1/trace.zip", video: "assets/qa/artifacts/s1/video.webm" },
      }),
    });
    await dashboard.open();

    const showcase = dashboard.section("showcase");
    // The recording loads on demand, so page load never waits on media.
    await expect(showcase.locator("video")).toHaveCount(0);
    await showcase.getByRole("button", { name: /Play the recording/ }).click();
    await expect(showcase.locator("video")).toHaveAttribute("src", "assets/qa/artifacts/s1/video.webm");
    await expect(showcase.getByRole("link", { name: /Trace Viewer/ })).toHaveAttribute("href", /trace\.playwright\.dev\/\?trace=.*s1%2Ftrace\.zip$/);
  });

  test("a run that recorded no showcase shows no empty player", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport({ showcase: null }) });
    await dashboard.open();
    await expect(dashboard.section("summary")).toBeVisible();
    await expect(dashboard.section("showcase")).toHaveCount(0);
  });

  test("accessibility violations are called out rather than averaged away", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({
        accessibility: [
          { page: "/", project: "desktop-chromium", violations: 0, passes: 41, incomplete: 1, rules: [] },
          { page: "/cv.html", project: "desktop-firefox", violations: 2, passes: 38, incomplete: 0, rules: ["color-contrast", "link-name"] },
        ],
      }),
    });
    await dashboard.open();

    const a11y = dashboard.section("accessibility");
    await expect(a11y.locator(".qa-headline")).toHaveText("2 violations across 2 pages × 2 browsers");
    await expect(a11y.locator(".qa-headline")).toHaveClass(/is-bad/);
    const cvRow = a11y.locator('.qa-a11y-row[data-page="/cv.html"]');
    await expect(cvRow.locator(".qa-a11y-count")).toHaveClass(/is-over/);
    await expect(cvRow).toContainText("color-contrast, link-name");
  });

  test("a clean accessibility gate says so", async ({ dashboard }) => {
    await dashboard.serve({
      report: qaReport({ accessibility: [{ page: "/", project: "desktop-chromium", violations: 0, passes: 40, incomplete: 0, rules: [] }] }),
    });
    await dashboard.open();
    await expect(dashboard.section("accessibility").locator(".qa-headline")).toHaveClass(/is-good/);
    await expect(dashboard.section("accessibility").locator(".qa-headline")).toContainText("0 violations");
  });

  test("a page over its performance budget is flagged on the metric that broke it", async ({ dashboard }) => {
    const budget = { lcpMs: 2500, cls: 0.1, transferKb: 150 };
    await dashboard.serve({
      report: qaReport({ performance: [{ page: "/", project: "desktop-chromium", lcpMs: 3100, fcpMs: 900, cls: 0.02, transferKb: 48, budget }] }),
    });
    await dashboard.open();

    const row = dashboard.section("performance").locator('.qa-perf-row[data-page="/"]');
    await expect(row.locator(".qa-perf-lcp")).toHaveClass(/is-over/);
    await expect(row.locator(".qa-perf-cls")).toHaveClass(/is-ok/);
    await expect(row.locator(".qa-perf-weight")).toHaveClass(/is-ok/);
  });

  test("tests that failed or retried in recent runs surface under Stability", async ({ dashboard }) => {
    const report = qaReport();
    const [first] = report.tests;
    await dashboard.serve({
      report,
      testHistory: {
        runs: 8,
        tests: { [first.id]: { title: first.title, project: first.project, file: first.file, outcomes: "pppfpkpp", durations: [400, 410, 390, 420, 405, 398, 402, 420] } },
      },
    });
    await dashboard.open();

    const row = dashboard.section("stability").locator(`.qa-stability-row[data-test="${first.id}"]`);
    await expect(row.locator(".qa-stability-rate")).toHaveText("2 of 8 runs");
    await expect(row.locator(".qa-run")).toHaveCount(8);
    await expect(row.locator(".qa-run.is-f")).toHaveCount(1);
  });

  test("a test much slower than its usual pace is marked as regressed", async ({ dashboard }) => {
    const slow = qaTest({ title: "the dashboard renders", durationMs: 1400 });
    await dashboard.serve({
      report: qaReport({ tests: [slow, qaTest()] }),
      testHistory: {
        runs: 5,
        tests: { [slow.id]: { title: slow.title, project: slow.project, file: slow.file, outcomes: "ppppp", durations: [400, 420, 380, 410, 1400] } },
      },
    });
    await dashboard.open();

    const stability = dashboard.section("stability");
    await expect(stability.locator(".qa-stability-empty")).toContainText("No test failed");
    await expect(stability.locator(".is-regressed")).toHaveText(/1\.4 s ↑ usually 405 ms/);
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

    const rows = dashboard.page.locator(".qa-test-row");
    const groups = dashboard.page.locator(".qa-suite-group");
    // A green run starts with every group collapsed.
    await expect(rows.filter({ visible: true })).toHaveCount(0);

    await dashboard.page.getByRole("button", { name: "@a11y 1" }).click();
    await expect(dashboard.page.getByRole("button", { name: "@a11y 1" })).toHaveAttribute("aria-pressed", "true");
    await expect(rows.filter({ visible: true })).toHaveCount(1);
    await expect(dashboard.testRow("home page has no WCAG violations")).toBeVisible();
    await expect(groups.filter({ visible: true })).toHaveCount(1);

    await dashboard.page.getByRole("button", { name: "All 3" }).click();
    await expect(groups.filter({ visible: true })).toHaveCount(3);
    await expect(dashboard.page.locator(".qa-test-row[hidden]")).toHaveCount(0);
    await expect(rows.filter({ visible: true })).toHaveCount(0);
  });

  test("results from a local run are labelled as such", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport({ source: "local", runUrl: null }) });
    await dashboard.open();
    await expect(dashboard.banner).toContainText("From a local run");
    await expect(dashboard.page.locator("#qaMeta")).toContainText("Commit 0123456");
  });

  test("the trend waits for a second run before drawing a line", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport(), history: qaHistory([100]) });
    await dashboard.open();
    await expect(dashboard.section("trend").locator(".qa-trend-empty")).toBeVisible();

    await dashboard.page.unrouteAll();
    await dashboard.serve({ report: qaReport(), history: qaHistory([96, 100, 98]) });
    await dashboard.page.reload();
    await expect(dashboard.section("trend").locator("svg circle")).toHaveCount(3);
  });

  test("missing history files cost their panels, not the page", async ({ dashboard }) => {
    await dashboard.serve({ report: qaReport(), history: null, testHistory: null });
    await dashboard.open();
    await expect(dashboard.stat("total")).toHaveText("3");
    await expect(dashboard.section("trend").locator(".qa-trend-empty")).toBeVisible();
    await expect(dashboard.section("stability")).toContainText("Stability appears once runs have been recorded");
  });

  test("a report that isn't there says so instead of showing a blank page", async ({ dashboard }) => {
    await dashboard.failReport(404);
    await dashboard.open();
    await expect(dashboard.error).toContainText("answered 404");
    await expect(dashboard.section("summary")).toHaveCount(0);
  });

  test("an unreachable report says so too", async ({ dashboard }) => {
    await dashboard.abortReport();
    await dashboard.open();
    await expect(dashboard.error).toBeVisible();
    await expect(dashboard.error).toHaveAttribute("role", "alert");
  });
});
