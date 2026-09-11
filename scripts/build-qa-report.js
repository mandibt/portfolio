#!/usr/bin/env node
/**
 * Turns Playwright's raw JSON reporter output (playwright-report/results.json)
 * into the compact shape qa-suite.html actually fetches:
 *
 *   assets/qa/report.json   — latest run: summary, per-project breakdown, per-test list
 *   assets/qa/history.json  — rolling list of past runs' summaries (for the trend view)
 *
 * Trace/video files for failed tests are copied out of Playwright's
 * test-results/ working directory into assets/qa/artifacts/<test-id>/ so
 * they get published as static files alongside the site, and report.json
 * points at those published paths instead of the ephemeral CI paths.
 *
 * Run after `npx playwright test` in CI. Never throws on a shape it
 * doesn't recognize — a QA dashboard that goes blank because Playwright
 * changed its reporter schema is worse than one that just says so.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const RAW_RESULTS = path.join(ROOT, "playwright-report", "results.json");
const QA_DIR = path.join(ROOT, "assets", "qa");
const ARTIFACTS_DIR = path.join(QA_DIR, "artifacts");
const REPORT_PATH = path.join(QA_DIR, "report.json");
const HISTORY_PATH = path.join(QA_DIR, "history.json");
const HISTORY_LIMIT = 30;

function slug(str) {
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, 12);
}

function outcomeOf(test) {
  // Playwright's per-test "status" field is the computed outcome:
  // "expected" | "unexpected" | "flaky" | "skipped". Older/rare shapes
  // fall back to the last attempt's raw result status.
  if (test.status === "expected") return "passed";
  if (test.status === "flaky") return "flaky";
  if (test.status === "skipped") return "skipped";
  if (test.status === "unexpected") return "failed";
  const last = Array.isArray(test.results) && test.results[test.results.length - 1];
  if (last && last.status) return last.status === "passed" ? "passed" : "failed";
  return "unknown";
}

function collectTests(suite, filePath, trail, out) {
  const nextTrail = suite.title ? trail.concat(suite.title) : trail;
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const results = test.results || [];
      const last = results[results.length - 1] || {};
      const attachments = (last.attachments || []).filter(
        (a) => a.name === "trace" || a.name === "video"
      );
      out.push({
        id: slug(`${filePath}::${nextTrail.join(" > ")}::${spec.title}::${test.projectName || ""}`),
        title: spec.title,
        path: nextTrail,
        file: filePath,
        project: test.projectName || "default",
        status: outcomeOf(test),
        durationMs: last.duration || 0,
        retries: results.length - 1,
        error: last.error && last.error.message ? String(last.error.message).split("\n")[0] : null,
        attachments: attachments.map((a) => ({ type: a.name, sourcePath: a.path || null })),
      });
    }
  }
  for (const child of suite.suites || []) {
    collectTests(child, filePath, nextTrail, out);
  }
}

function copyArtifact(test, attachment) {
  if (!attachment.sourcePath || !fs.existsSync(attachment.sourcePath)) return null;
  const destDir = path.join(ARTIFACTS_DIR, test.id);
  fs.mkdirSync(destDir, { recursive: true });
  const ext = attachment.type === "trace" ? "zip" : path.extname(attachment.sourcePath) || ".webm";
  const destName = attachment.type === "trace" ? "trace.zip" : `video${ext.startsWith(".") ? ext : "." + ext}`;
  const destPath = path.join(destDir, destName);
  fs.copyFileSync(attachment.sourcePath, destPath);
  return `assets/qa/artifacts/${test.id}/${destName}`;
}

function main() {
  fs.mkdirSync(QA_DIR, { recursive: true });
  // Start artifacts fresh each run so a test that used to fail (and had a
  // trace/video committed) doesn't leave orphaned files behind forever
  // once it's passing again.
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });

  if (!fs.existsSync(RAW_RESULTS)) {
    console.error(`[build-qa-report] No raw results at ${RAW_RESULTS} — nothing to summarize.`);
    process.exitCode = 1;
    return;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(RAW_RESULTS, "utf8"));
  } catch (err) {
    console.error(`[build-qa-report] Could not parse ${RAW_RESULTS}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const tests = [];
  for (const suite of raw.suites || []) {
    collectTests(suite, suite.file || suite.title || "unknown", [], tests);
  }

  for (const t of tests) {
    t.publishedAttachments = t.attachments
      .map((a) => {
        const publishedPath = copyArtifact(t, a);
        return publishedPath ? { type: a.type, path: publishedPath } : null;
      })
      .filter(Boolean);
    delete t.attachments;
  }

  const byProject = {};
  for (const t of tests) {
    byProject[t.project] = byProject[t.project] || { name: t.project, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 };
    byProject[t.project].total += 1;
    if (t.status === "passed") byProject[t.project].passed += 1;
    else if (t.status === "flaky") byProject[t.project].flaky += 1;
    else if (t.status === "skipped") byProject[t.project].skipped += 1;
    else if (t.status === "failed") byProject[t.project].failed += 1;
  }

  const summary = tests.reduce(
    (acc, t) => {
      acc.total += 1;
      if (t.status === "passed" || t.status === "flaky") acc.passed += 1;
      else if (t.status === "skipped") acc.skipped += 1;
      else if (t.status === "failed") acc.failed += 1;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0 }
  );

  const sha = process.env.GITHUB_SHA || "local";
  const runId = process.env.GITHUB_RUN_ID || null;
  const repo = process.env.GITHUB_REPOSITORY || null;
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";

  const report = {
    generatedAt: new Date().toISOString(),
    source: process.env.CI ? "ci" : "seed",
    commit: sha,
    commitShort: sha.slice(0, 7),
    runUrl: runId && repo ? `${serverUrl}/${repo}/actions/runs/${runId}` : null,
    durationMs: raw.stats && raw.stats.duration ? Math.round(raw.stats.duration) : null,
    summary,
    projects: Object.values(byProject),
    tests,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  let history = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
  }
  history.push({
    generatedAt: report.generatedAt,
    source: report.source,
    commitShort: report.commitShort,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    passRate: summary.total ? Math.round((summary.passed / summary.total) * 1000) / 10 : null,
  });
  history = history.slice(-HISTORY_LIMIT);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

  console.log(
    `[build-qa-report] ${summary.passed}/${summary.total} passed (${summary.failed} failed, ${summary.skipped} skipped) → ${REPORT_PATH}`
  );
}

main();
