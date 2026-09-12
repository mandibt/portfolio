# 005 — How the performance budget is measured

**Status:** accepted · 2026-09-11

## Context

Measured on a fast developer machine against a local server, every page is
instant, and a budget would never fail. Measured against the live site, the
number would depend on GitHub Pages and the network that day.

## Decision

- Measure in Chromium only, through a CDP session: 150 ms latency, 1.6 Mbps
  down, 4× CPU slowdown — roughly a mid-range phone on 4G.
- Read LCP, CLS and FCP with `PerformanceObserver` in the page; count bytes
  from CDP `Network.loadingFinished` events.
- Block Google Fonts with `Network.setBlockedURLs`, so the budget measures this
  site and not a third-party CDN.
- Budgets: LCP ≤ 2500 ms, CLS ≤ 0.1, transfer ≤ 150 KB, per page.
- Use `expect.soft` so one broken metric still reports the others.

## Consequences

- The numbers are comparable run to run and across machines, which is what a
  budget needs; they are not field data and aren't presented as such.
- Font-swap layout shift is not measured, since fonts are blocked. The
  `display=swap` fallback stack is chosen to keep that shift small.
- Firefox and WebKit have no equivalent throttling API, so they don't run it.
