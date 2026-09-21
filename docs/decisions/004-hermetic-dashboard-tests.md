# 004 - The dashboard is tested against reports the tests serve

**Status:** accepted · 2026-09-11

## Context

The committed `report.json` is green almost all of the time. Tests that only
read it would never execute the code that renders a failure, a flaky test, an
accessibility violation or a blown budget - the states the dashboard exists
for.

## Decision

`tests/qa-dashboard.spec.ts` intercepts `assets/qa/*.json` with `page.route`
and serves reports built by typed helpers (`qaReport`, `qaTest`, `qaHistory`).
A `dashboard` fixture wraps the routes and locators. Missing and unreachable
files are simulated with `route.fulfill({ status: 404 })` and `route.abort()`.

Three tests still read the committed files, to prove the real data renders.

## Consequences

- Every rendering state is exercised on every run, on every browser.
- Builders derive totals from the tests they contain, so a fixture can't
  contradict itself.
- Because the builders and the reporter share `reporters/qa-report-types.ts`,
  a change to the report shape breaks compilation in both places at once.
