# 002 - Dashboard JSON is committed; traces and videos are not

**Status:** accepted · 2026-09-11

## Context

The dashboard needs two kinds of data: small JSON files that must persist
across runs (history only exists if the previous run's file is still there),
and large binaries (trace.zip, video) that only matter for the latest run.
The showcase journey records a trace and video on *every* run.

## Decision

- `report.json`, `history.json` and `test-history.json` are committed back to
  `main` by the report job, with `[skip ci]`. The repository is the datastore;
  no external service or token is needed.
- `assets/qa/artifacts/` is git-ignored. The report job uploads it as a
  workflow artifact, and the deploy job downloads it into the Pages bundle.

## Consequences

- History persists across deploys for free; the repo grows by a few KB per run
  instead of megabytes.
- Traces for a deploy exist only on the published site (and in the run's
  artifacts for 14 days), which is exactly their useful lifetime.
- The bot commit means contributors must `git pull` before pushing.
- Traces open in trace.playwright.dev because GitHub Pages sends
  `Access-Control-Allow-Origin: *`; `scripts/serve.mjs` does the same locally.
