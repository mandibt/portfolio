import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import type { z } from "zod";
import { QaHistorySchema, QaReportSchema, QaTestHistorySchema } from "../../reporters/qa-report-schema";
import { qaReport, qaTest } from "../data/qa-report";

const QA_DIR = path.resolve(__dirname, "..", "..", "assets", "qa");
const committed = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(QA_DIR, file), "utf8"));
const problems = (result: z.ZodSafeParseResult<unknown>) =>
  result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);

test.describe("dashboard data schema", { tag: "@unit" }, () => {
  test("the committed dashboard files are ones qa-suite.html can read", () => {
    expect(problems(QaReportSchema.safeParse(committed("report.json"))), "report.json").toEqual([]);
    expect(problems(QaHistorySchema.safeParse(committed("history.json"))), "history.json").toEqual([]);
    expect(problems(QaTestHistorySchema.safeParse(committed("test-history.json"))), "test-history.json").toEqual([]);
  });

  test("the report builders used for the dashboard tests make valid reports", () => {
    expect(problems(QaReportSchema.safeParse(qaReport()))).toEqual([]);
  });

  test("a report whose totals don't add up is rejected", () => {
    const report = qaReport();
    const inflated = { ...report, summary: { ...report.summary, passed: 99 } };
    expect(problems(QaReportSchema.safeParse(inflated))).toEqual(["summary.passed: says 99, the tests add up to 3"]);
  });

  test("two tests sharing the same id are rejected, since their history would merge", () => {
    const twin = qaTest();
    expect(problems(QaReportSchema.safeParse(qaReport({ tests: [twin, twin] })))).toEqual([`tests.1.id: ${twin.id} is used by more than one test`]);
  });
});
