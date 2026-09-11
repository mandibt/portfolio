#!/usr/bin/env node
/**
 * Renders cv.html to assets/cv/Stefan-Mandovski-CV.pdf with Playwright's
 * Chromium, using the same options (scripts/cv-pdf.json) that
 * tests/cv-print.spec.ts renders with — so the test can tell when the
 * committed PDF has fallen behind the page.
 *
 * Usage: npm run cv:pdf
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const options = JSON.parse(await readFile(new URL("scripts/cv-pdf.json", root), "utf8"));
const output = new URL("assets/cv/Stefan-Mandovski-CV.pdf", root);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(new URL("cv.html", root).href, { waitUntil: "networkidle" });
  // Web fonts change line breaks, and line breaks change the page count.
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf(options);
  await writeFile(output, pdf);
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`[cv:pdf] wrote ${output.pathname} — ${pages} page(s), ${Math.round(pdf.length / 1024)} KB`);
} finally {
  await browser.close();
}
