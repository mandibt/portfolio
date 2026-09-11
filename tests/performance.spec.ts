import { test, expect } from "./fixtures";

/** Budgets under the throttled profile below — roughly a mid-range phone on 4G. */
const BUDGET = { lcpMs: 2500, cls: 0.1, transferKb: 150 };

const PAGES = [
  { path: "/", name: "home" },
  { path: "/cv.html", name: "CV" },
];

test.describe("performance budget", { tag: "@perf" }, () => {
  // CDP is Chromium-only, and one desktop measurement is the meaningful one.
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Chromium desktop only");

  for (const target of PAGES) {
    test(`the ${target.name} page stays inside its budget on a throttled connection`, async ({ page }, testInfo) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Network.enable");
      // Google Fonts is blocked so the budget measures this site, not Google's CDN.
      await cdp.send("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

      let bytes = 0;
      cdp.on("Network.loadingFinished", (event) => {
        bytes += event.encodedDataLength;
      });

      await page.goto(target.path, { waitUntil: "load" });

      const vitals = await page.evaluate(
        () =>
          new Promise<{ lcpMs: number; fcpMs: number; cls: number }>((resolve) => {
            let lcp = 0;
            let cls = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) lcp = entry.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
                if (!entry.hadRecentInput) cls += entry.value;
              }
            }).observe({ type: "layout-shift", buffered: true });
            // Let late layout shifts land before reading.
            setTimeout(() => {
              const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
              resolve({ lcpMs: Math.round(lcp), fcpMs: Math.round(fcp), cls: Math.round(cls * 1000) / 1000 });
            }, 1000);
          }),
      );
      const result = { ...vitals, transferKb: Math.round(bytes / 1024) };

      testInfo.annotations.push({
        type: "qa:perf",
        description: JSON.stringify({ page: target.path, ...result, budget: BUDGET }),
      });

      // Soft assertions: a page over budget on LCP still reports CLS and weight.
      expect.soft(result.lcpMs, "Largest Contentful Paint (ms)").toBeLessThanOrEqual(BUDGET.lcpMs);
      expect.soft(result.cls, "Cumulative Layout Shift").toBeLessThanOrEqual(BUDGET.cls);
      expect.soft(result.transferKb, "bytes over the wire (KB)").toBeLessThanOrEqual(BUDGET.transferKb);
      expect(result.lcpMs, "LCP was never observed").toBeGreaterThan(0);
    });
  }
});
