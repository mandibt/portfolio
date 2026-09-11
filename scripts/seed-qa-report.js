#!/usr/bin/env node
/**
 * One-time local seed for assets/qa/report.json + history.json, so
 * qa-suite.html isn't empty before this repo has ever run in GitHub
 * Actions. Mirrors the exact shape scripts/build-qa-report.js produces
 * from a real Playwright JSON reporter run, but is hand-built from the
 * actual tests in tests/smoke.spec.ts rather than a real run — this
 * sandbox can't install @playwright/test to produce a genuine one.
 *
 * Marked source: "seed" throughout. qa-suite.html reads that flag and
 * shows a banner explaining it hasn't seen a real CI run yet. history.json
 * intentionally gets exactly one entry — a fabricated multi-point trend
 * would be misleading; the trend view instead waits for real history.
 *
 * This file is meant to be run once, now. It is NOT wired into CI —
 * scripts/build-qa-report.js overwrites both output files on every
 * real run, seed included.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const QA_DIR = path.join(ROOT, "assets", "qa");
const REPORT_PATH = path.join(QA_DIR, "report.json");
const HISTORY_PATH = path.join(QA_DIR, "history.json");

function slug(str) {
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, 12);
}

const FILE = "tests/smoke.spec.ts";

// [suite path, title, durationMs, mobileOnly]
const CASES = [
  [["home page"], "loads with the right title and hero content", 210, false],
  [["home page"], "nav links resolve to real sections on the page", 340, false],
  [["home page"], "experience section lists all four roles in order", 260, false],
  [["home page"], "current role carries the Current badge and the rest don't", 190, false],
  [["home page"], "projects section features Shift Board with its AI-provider tags", 230, false],
  [["home page"], "contact section links to LinkedIn in a new tab", 175, false],
  [["home page"], "hero and nav both offer a way to reach the CV", 200, false],
  [["home page"], "footer LinkedIn link matches the contact link", 165, false],
  [["cv page"], "renders the résumé with a working PDF download link", 420, false],
  [["cv page"], "lists all four experience entries and the certifications block", 280, false],
  [["cv page"], "back link returns to the portfolio", 310, false],
  [["404 page"], "shows a friendly not-found message with a way back", 190, false],
  [["mobile viewport"], "nav collapses behind a toggle and opens on tap", 250, true],
  [["mobile viewport"], "hero content is visible without horizontal scroll", 300, true],
];

const PROJECTS = ["desktop-chromium", "mobile-chromium"];

function buildTests() {
  const tests = [];
  for (const project of PROJECTS) {
    for (const [suitePath, title, durationMs, mobileOnly] of CASES) {
      const skipped = mobileOnly && project === "desktop-chromium";
      tests.push({
        id: slug(`${FILE}::${suitePath.join(" > ")}::${title}::${project}`),
        title,
        path: suitePath,
        file: FILE,
        project,
        status: skipped ? "skipped" : "passed",
        durationMs: skipped ? 0 : durationMs,
        retries: 0,
        error: null,
        publishedAttachments: [],
      });
    }
  }
  return tests;
}

function main() {
  fs.mkdirSync(QA_DIR, { recursive: true });

  const tests = buildTests();
  const byProject = {};
  for (const t of tests) {
    byProject[t.project] = byProject[t.project] || { name: t.project, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 };
    byProject[t.project].total += 1;
    byProject[t.project][t.status] += 1;
  }
  const summary = tests.reduce(
    (acc, t) => {
      acc.total += 1;
      if (t.status === "passed") acc.passed += 1;
      else if (t.status === "skipped") acc.skipped += 1;
      else if (t.status === "failed") acc.failed += 1;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0 }
  );

  const report = {
    generatedAt: new Date().toISOString(),
    source: "seed",
    commit: "local",
    commitShort: "local",
    runUrl: null,
    durationMs: tests.reduce((s, t) => s + t.durationMs, 0),
    summary,
    projects: Object.values(byProject),
    tests,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  const history = [
    {
      generatedAt: report.generatedAt,
      source: "seed",
      commitShort: "local",
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      passRate: Math.round((summary.passed / summary.total) * 1000) / 10,
    },
  ];
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

  console.log(`[seed-qa-report] wrote seed report: ${summary.passed}/${summary.total} passed, ${summary.skipped} skipped (by design).`);
}

main();
