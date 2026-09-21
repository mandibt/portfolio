import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// Screenshot baselines are rendered on CI's Linux runners. Windows and macOS
// draw fonts differently. So @visual runs on Linux only, and only on the
// Chromium projects.
const onLinux = process.platform === "linux";
const excluding = (...tags: string[]) => new RegExp([...tags, ...(onLinux ? [] : ["@visual"])].join("|"));

// Unit tests need no browser, so they run in a project of their own.
const UNIT_TESTS = "**/unit/**";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  // The retry is there to label a flake, not to hide it: a test that only
  // passes on its second attempt still fails the CI run.
  retries: isCI ? 1 : 0,
  failOnFlakyTests: isCI,
  // Pinned rather than "half the cores": at 7 local workers Firefox runs out of
  // time on the axe scans. GitHub's Linux runners have 4 vCPUs.
  workers: isCI ? 2 : 4,
  // Locally: a readable list. In CI every browser runs in its own job and
  // writes a blob. The report job merges the blobs into the HTML report and
  // the dashboard data (reporters/qa-dashboard-reporter.ts). The blob name
  // carries the project so four jobs don't overwrite each other's file.
  reporter: isCI
    ? [["blob", { fileName: `report-${process.env.PW_PROJECT || "all"}.zip` }], ["github"]]
    : [["list"]],
  // CI compares screenshots and never writes baselines: they come from the
  // workflow's "update_snapshots" run, on the same kind of runner.
  updateSnapshots: isCI ? "none" : "missing",
  expect: {
    // The allowance absorbs anti-aliasing noise in text, not a moved or restyled element.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    video: isCI ? "retain-on-failure" : "off",
  },
  // Tags decide which viewport a test belongs to: @mobile tests only mean
  // something on a phone, @desktop ones only on a wide screen. Filtering here
  // keeps them out of the other projects instead of reporting them as skipped.
  projects: [
    { name: "desktop-chromium", testIgnore: UNIT_TESTS, grepInvert: excluding("@mobile"), use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", testIgnore: UNIT_TESTS, grepInvert: /@mobile|@visual/, use: { ...devices["Desktop Firefox"] } },
    { name: "desktop-webkit", testIgnore: UNIT_TESTS, grepInvert: /@mobile|@visual/, use: { ...devices["Desktop Safari"] } },
    // Device descriptors like "iPhone 13" default to WebKit. Pin Chromium so
    // this project is a mobile *viewport* check rather than a second WebKit run.
    {
      name: "mobile-chromium",
      testIgnore: UNIT_TESTS,
      grepInvert: excluding("@desktop"),
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    { name: "unit", testDir: "./tests/unit" },
  ],
  webServer: {
    // Node rather than Python: same command on every OS, and unknown paths get
    // 404.html with a real 404 status, like GitHub Pages. See scripts/serve.mjs.
    command: "node scripts/serve.mjs 8000",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: !isCI,
    timeout: 20_000,
  },
});
