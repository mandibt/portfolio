import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Locally: a readable list. In CI every browser runs in its own job and
  // writes a blob; the report job merges the blobs into the HTML report and
  // the dashboard data (reporters/qa-dashboard-reporter.ts). The blob name
  // carries the project so four jobs don't overwrite each other's file.
  reporter: isCI
    ? [["blob", { fileName: `report-${process.env.PW_PROJECT || "all"}.zip` }], ["github"]]
    : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    video: isCI ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] } },
    // Device descriptors like "iPhone 13" default to WebKit; pin Chromium so
    // this project is a mobile *viewport* check rather than a second WebKit run.
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
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
