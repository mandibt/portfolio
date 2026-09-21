import { z } from "zod";
import type { QaHistoryEntry, QaReport, QaTestHistory } from "./qa-report-types";

/**
 * Runtime validation for the dashboard files. The reporter won't write a file
 * that fails, and the unit tests check the committed ones. The type check at
 * the bottom fails the build if schema and types drift apart.
 */

const count = z.number().int().nonnegative();
const counts = { total: count, passed: count, failed: count, flaky: count, skipped: count };
const source = z.enum(["ci", "local"]);
const timestamp = z.iso.datetime();

const QaTestSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.array(z.string()),
  file: z.string().min(1),
  project: z.string().min(1),
  tags: z.array(z.string().startsWith("@")),
  status: z.enum(["passed", "failed", "flaky", "skipped"]),
  durationMs: z.number().nonnegative(),
  retries: count,
  error: z.string().nullable(),
  publishedAttachments: z.array(
    z.strictObject({ type: z.enum(["trace", "video"]), path: z.string().startsWith("assets/qa/artifacts/") }),
  ),
});

export const QaReportSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    generatedAt: timestamp,
    source,
    commit: z.string().min(1),
    commitShort: z.string().min(1),
    runUrl: z.url().nullable(),
    durationMs: z.number().nonnegative().nullable(),
    summary: z.strictObject(counts),
    projects: z.array(z.strictObject({ name: z.string().min(1), ...counts })),
    tags: z.array(z.strictObject({ tag: z.string().startsWith("@"), total: count })),
    tests: z.array(QaTestSchema),
    accessibility: z.array(
      z.strictObject({
        page: z.string(),
        project: z.string(),
        violations: count,
        passes: count,
        incomplete: count,
        rules: z.array(z.string()),
      }),
    ),
    performance: z.array(
      z.strictObject({
        page: z.string(),
        project: z.string(),
        lcpMs: z.number().nonnegative(),
        fcpMs: z.number().nonnegative(),
        cls: z.number().nonnegative(),
        transferKb: z.number().nonnegative(),
        budget: z.strictObject({ lcpMs: z.number().positive(), cls: z.number().positive(), transferKb: z.number().positive() }),
      }),
    ),
    showcase: z
      .strictObject({ title: z.string(), project: z.string(), trace: z.string().nullable(), video: z.string().nullable() })
      .nullable(),
  })
  .superRefine((report, ctx) => {
    // The dashboard shows these numbers side by side, so they must agree.
    const tally = (tests: typeof report.tests) => ({
      total: tests.length,
      passed: tests.filter((t) => t.status === "passed").length,
      failed: tests.filter((t) => t.status === "failed").length,
      flaky: tests.filter((t) => t.status === "flaky").length,
      skipped: tests.filter((t) => t.status === "skipped").length,
    });
    const check = (path: Array<string | number>, stated: z.infer<z.ZodObject<typeof counts>>, tests: typeof report.tests) => {
      const actual = tally(tests);
      for (const key of Object.keys(actual) as Array<keyof typeof actual>) {
        if (stated[key] !== actual[key]) {
          ctx.addIssue({ code: "custom", path: [...path, key], message: `says ${stated[key]}, the tests add up to ${actual[key]}` });
        }
      }
    };
    check(["summary"], report.summary, report.tests);
    report.projects.forEach((project, i) => check(["projects", i], project, report.tests.filter((t) => t.project === project.name)));

    // Ids key the stability history - two tests sharing one would merge their records.
    const seen = new Set<string>();
    report.tests.forEach((test, i) => {
      if (seen.has(test.id)) ctx.addIssue({ code: "custom", path: ["tests", i, "id"], message: `${test.id} is used by more than one test` });
      seen.add(test.id);
    });
  });

export const QaHistorySchema = z.array(
  z.strictObject({
    generatedAt: timestamp,
    source,
    commitShort: z.string().min(1),
    ...counts,
    passRate: z.number().min(0).max(100).nullable(),
  }),
);

export const QaTestHistorySchema = z
  .strictObject({
    runs: count,
    tests: z.record(
      z.string().min(1),
      z.strictObject({
        title: z.string(),
        project: z.string(),
        file: z.string(),
        outcomes: z.string().regex(/^[pfks]*$/, "one letter per run: p, f, k or s"),
        durations: z.array(z.number().nonnegative()),
      }),
    ),
  })
  .superRefine((history, ctx) => {
    for (const [id, test] of Object.entries(history.tests)) {
      if (test.outcomes.length !== test.durations.length) {
        ctx.addIssue({ code: "custom", path: ["tests", id], message: `${test.outcomes.length} outcomes but ${test.durations.length} durations` });
      }
      if (test.outcomes.length > history.runs) {
        ctx.addIssue({ code: "custom", path: ["tests", id, "outcomes"], message: `more outcomes than the ${history.runs} runs recorded` });
      }
    }
  });

// Schema and types must describe the same data, in both directions.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemasMatchTypes: [
  Same<z.infer<typeof QaReportSchema>, QaReport>,
  Same<z.infer<typeof QaHistorySchema>, QaHistoryEntry[]>,
  Same<z.infer<typeof QaTestHistorySchema>, QaTestHistory>,
] = [true, true, true];
void schemasMatchTypes;
