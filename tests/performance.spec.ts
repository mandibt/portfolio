import { test, expect } from "./fixtures";
import { PERF_BUDGET, SITE_PAGES } from "./data/site";

const PAGES = SITE_PAGES.filter(({ path }) => path === "/" || path === "/cv.html");

test.describe("performance", { tag: "@perf" }, () => {
  // CDP is Chrome only
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chrome only");

  for (const target of PAGES) {
    test(`the ${target.name} page loads within budget on slow 4G`, async ({ page }, testInfo) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Network.enable");
      // Google Fonts is blocked to measure this site, not Google's.
      await cdp.send("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
      // Lighthouse's "Slow 4G": 150 ms latency, 1.6 Mbps down, 4x slower CPU
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
            // Wait a second so late layout changes still get counted.
            setTimeout(() => {
              const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
              resolve({ lcpMs: Math.round(lcp), fcpMs: Math.round(fcp), cls: Math.round(cls * 1000) / 1000 });
            }, 1000);
          }),
      );
      const result = { ...vitals, transferKb: Math.round(bytes / 1024) };

      testInfo.annotations.push({
        type: "qa:perf",
        description: JSON.stringify({ page: target.path, ...result, budget: PERF_BUDGET }),
      });

      expect(result.lcpMs, "LCP was never observed").toBeGreaterThan(0);
      // Soft checks, so one metric over budget doesn't fail the others.
      expect.soft(result.lcpMs, "Largest Contentful Paint (ms)").toBeLessThanOrEqual(PERF_BUDGET.lcpMs);
      expect.soft(result.cls, "Cumulative Layout Shift").toBeLessThanOrEqual(PERF_BUDGET.cls);
      expect.soft(result.transferKb, "page weight (KB)").toBeLessThanOrEqual(PERF_BUDGET.transferKb);
    });
  }
});
