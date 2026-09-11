#!/usr/bin/env node
/**
 * Static file server for local previews and the Playwright suite.
 *
 * Replaces `python -m http.server` for two reasons:
 *   - one command on every OS (Windows ships a "python3" Store stub, Linux
 *     often has no "python"), and no Python dependency at all;
 *   - an unknown path answers with 404.html and a real 404 status, the way
 *     GitHub Pages does, so the not-found behaviour can be tested locally.
 *
 * Usage: node scripts/serve.mjs [port]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const HOST = "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = normalize(join(ROOT, decoded));
  // Refuse anything that escapes the site root (../../etc).
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      return (await stat(index)).isFile() ? index : null;
    }
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url || "/");
  const status = file ? 200 : 404;
  const target = file || join(ROOT, "404.html");
  try {
    const body = await readFile(target);
    res.writeHead(status, {
      "Content-Type": TYPES[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      // GitHub Pages sends this too; it is what lets trace.playwright.dev
      // fetch a published trace.zip.
      "Access-Control-Allow-Origin": "*",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
