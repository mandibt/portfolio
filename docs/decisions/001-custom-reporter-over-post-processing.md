# 001 - A custom Playwright reporter builds the dashboard data

**Status:** accepted · 2026-09-11

## Context

The first version of the dashboard ran a Node script after the suite, parsing
Playwright's JSON reporter output. CI now runs each browser in its own job, so
there is no single JSON file to parse - results arrive as four blob reports.

## Decision

Write the dashboard data from a `Reporter` implementation
(`reporters/qa-dashboard-reporter.ts`) and run it at merge time:

```
npx playwright merge-reports --reporter html,./reporters/qa-dashboard-reporter.ts ./all-blob-reports
```

Tests hand extra data to it through annotations (`qa:a11y`, `qa:perf`,
`qa:showcase`) instead of writing side files.

## Consequences

- One code path for local runs (`npm run qa:report`) and merged CI runs.
- Annotations and attachments ride inside the blobs, so accessibility results,
  performance numbers and the showcase trace survive the merge with no extra
  artifact plumbing.
- The reporter works against Playwright's typed `TestCase`/`TestResult` API
  (`outcome()`, `tags`, `attachments`) instead of a JSON schema that can drift.
- The report shape is a TypeScript interface shared with the dashboard tests,
  so the builders in `tests/support/qa-dashboard.ts` can't describe a report
  the reporter would never write.
