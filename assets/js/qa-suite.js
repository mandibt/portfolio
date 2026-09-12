// QA Suite Runner — renders assets/qa/report.json (+ history.json and
// test-history.json) as a CI dashboard. Written by
// reporters/qa-dashboard-reporter.ts; shape in reporters/qa-report-types.ts.
// Only report.json is required: a missing optional file costs its panel, not
// the page, and a missing report says so instead of staying blank.
(function () {
  "use strict";

  var contentEl = document.getElementById("qaContent");
  var metaEl = document.getElementById("qaMeta");
  var bannerEl = document.getElementById("qaBanner");

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return iso;
    }
  }

  function fmtMs(ms) {
    if (ms == null) return "—";
    if (ms < 1000) return Math.round(ms) + " ms";
    if (ms < 60000) return (ms / 1000).toFixed(1) + " s";
    return Math.floor(ms / 60000) + "m " + Math.round((ms % 60000) / 1000) + "s";
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + " answered " + res.status);
      return res.json();
    });
  }

  function optional(url) {
    return fetchJson(url).catch(function () { return null; });
  }

  function traceViewerUrl(path) {
    return "https://trace.playwright.dev/?trace=" + encodeURIComponent(new URL(path, location.href).href);
  }

  // A table that scrolls sideways on a phone must be reachable by keyboard
  // (axe: scrollable-region-focusable), so the wrapper is a named, focusable region.
  function tableWrap(label, table, extraClass) {
    return '<div class="qa-table-wrap' + (extraClass ? " " + extraClass : "") + '" role="region" tabindex="0" aria-label="' + esc(label) + '">' + table + "</div>";
  }

  function section(name, title, body, lede) {
    return '<section class="qa-section" data-section="' + name + '"><h2>' + esc(title) + "</h2>" +
      (lede ? '<p class="qa-lede">' + lede + "</p>" : "") + body + "</section>";
  }

  // ---------- header ----------
  function renderMeta(report) {
    var bits = ["<span>Generated " + esc(fmtDate(report.generatedAt)) + "</span>"];
    bits.push(report.runUrl
      ? '<span><a href="' + esc(report.runUrl) + '" target="_blank" rel="noopener">Run ' + esc(report.commitShort) + " on GitHub Actions →</a></span>"
      : "<span>Commit " + esc(report.commitShort) + "</span>");
    if (report.durationMs) bits.push("<span>Wall time " + esc(fmtMs(report.durationMs)) + "</span>");
    metaEl.innerHTML = bits.join("");

    if (report.source !== "ci") {
      bannerEl.innerHTML = '<div class="qa-banner"><strong>From a local run.</strong> These results come from running the suite on a developer machine, not from GitHub Actions. The next push replaces them with a CI run.</div>';
    }
  }

  // ---------- summary ----------
  function renderSummary(summary) {
    var ran = summary.total - summary.skipped;
    var rate = ran ? Math.round(((summary.passed + (summary.flaky || 0)) / ran) * 1000) / 10 : 0;
    var stats = [["total", "total checks", ""], ["passed", "passed", "is-pass"], ["failed", "failed", "is-fail"], ["flaky", "flaky (passed on retry)", "is-skip"], ["skipped", "skipped by design", "is-skip"]];
    return '<div class="qa-stats">' + stats.map(function (s) {
      return '<div class="qa-stat ' + s[2] + '" data-stat="' + s[0] + '"><div class="num">' + (summary[s[0]] || 0) + '</div><div class="label">' + s[1] + "</div></div>";
    }).join("") + '</div><p class="qa-trend-caption" style="margin-top:12px;">' + rate + "% of executed checks passed on the latest run.</p>";
  }

  // ---------- showcase ----------
  function renderShowcase(showcase) {
    if (!showcase || (!showcase.trace && !showcase.video)) return "";
    var media = showcase.video
      // Click-to-load rather than a <video> in the markup: a media element holds
      // the page's load event in WebKit until its media engine answers (which
      // never happens on some builds), and most visitors won't play ~500 KB.
      ? '<button type="button" class="qa-showcase-play" data-video="' + esc(showcase.video) + '"><span aria-hidden="true">▶</span> Play the recording</button>'
      : "";
    var trace = showcase.trace
      ? '<a class="btn btn-primary qa-showcase-trace" href="' + esc(traceViewerUrl(showcase.trace)) + '" target="_blank" rel="noopener">Open in Playwright Trace Viewer →</a>'
      : "";
    return section("showcase", "Watch a real run",
      '<div class="qa-card qa-showcase"><div>' + media + "</div><div><h3>" + esc(showcase.title) + "</h3>" +
      "<p>Recorded on every CI run — even when it passes — on " + esc(showcase.project) + ". The trace holds every action, network call, console message and a DOM snapshot per step.</p>" +
      trace + "</div></div>");
  }

  // ---------- accessibility ----------
  function renderAccessibility(results) {
    if (!results || !results.length) return "";
    var violations = results.reduce(function (n, r) { return n + r.violations; }, 0);
    var pages = unique(results.map(function (r) { return r.page; }));
    var browsers = unique(results.map(function (r) { return r.project; }));
    var headline = '<p class="qa-headline ' + (violations ? "is-bad" : "is-good") + '">' +
      plural(violations, "violation") + " across " + plural(pages.length, "page") + " × " + plural(browsers.length, "browser") + "</p>";
    var rows = results.map(function (r) {
      return '<tr class="qa-a11y-row" data-page="' + esc(r.page) + '" data-project="' + esc(r.project) + '">' +
        "<td>" + esc(r.page) + "</td><td>" + esc(r.project) + "</td>" +
        '<td class="qa-a11y-count ' + (r.violations ? "is-over" : "is-ok") + '">' + r.violations + "</td>" +
        "<td>" + r.passes + "</td><td>" + esc((r.rules || []).join(", ") || "—") + "</td></tr>";
    }).join("");
    return section("accessibility", "Accessibility gate",
      '<div class="qa-card">' + headline + tableWrap("Accessibility results per page and browser", '<table class="qa-table"><thead><tr><th>Page</th><th>Browser</th><th>Violations</th><th>Rules passed</th><th>Failing rules</th></tr></thead><tbody>' + rows + "</tbody></table>") + "</div>",
      "axe-core scans every page against WCAG 2.2 levels A and AA on every browser. Any violation fails the build.");
  }

  // ---------- performance ----------
  function renderPerformance(results) {
    if (!results || !results.length) return "";
    function cell(cls, value, over, text) {
      return '<td class="' + cls + " " + (over ? "is-over" : "is-ok") + '">' + text + "</td>";
    }
    var rows = results.map(function (r) {
      var b = r.budget || {};
      return '<tr class="qa-perf-row" data-page="' + esc(r.page) + '"><td>' + esc(r.page) + "</td>" +
        cell("qa-perf-lcp", r.lcpMs, r.lcpMs > b.lcpMs, r.lcpMs + " ms <small>/ " + b.lcpMs + "</small>") +
        cell("qa-perf-cls", r.cls, r.cls > b.cls, r.cls + " <small>/ " + b.cls + "</small>") +
        cell("qa-perf-weight", r.transferKb, r.transferKb > b.transferKb, r.transferKb + " KB <small>/ " + b.transferKb + "</small>") +
        "<td>" + r.fcpMs + " ms</td></tr>";
    }).join("");
    return section("performance", "Performance budget",
      tableWrap("Performance results per page", '<table class="qa-table"><thead><tr><th>Page</th><th>LCP / budget</th><th>CLS / budget</th><th>Transfer / budget</th><th>FCP</th></tr></thead><tbody>' + rows + "</tbody></table>", "qa-card"),
      "Measured in Chromium through the DevTools protocol on a throttled profile (150 ms latency, 1.6 Mbps, 4× CPU slowdown).");
  }

  // ---------- browsers ----------
  function renderProjects(projects) {
    return '<div class="qa-projects">' + projects.map(function (p) {
      var ran = p.total - p.skipped;
      var rate = ran ? Math.round(((p.passed + (p.flaky || 0)) / ran) * 1000) / 10 : 0;
      function seg(cls, n) { return n ? '<div class="' + cls + '" style="width:' + (n / p.total) * 100 + '%"></div>' : ""; }
      return '<div class="qa-project-card"><h3>' + esc(p.name) + '<span class="rate">' + rate + "%</span></h3>" +
        '<div class="qa-project-bar">' + seg("seg-pass", p.passed) + seg("seg-skip", p.flaky || 0) + seg("seg-fail", p.failed) + seg("seg-skip", p.skipped) + "</div>" +
        '<div class="qa-project-legend"><span>' + p.passed + " passed</span><span>" + p.failed + " failed</span><span>" + (p.flaky || 0) + " flaky</span><span>" + p.skipped + " skipped</span></div></div>";
    }).join("") + "</div>";
  }

  // ---------- stability ----------
  function median(values) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function renderStability(report, testHistory) {
    var entries = testHistory && testHistory.tests ? testHistory.tests : {};
    var unstable = Object.keys(entries).map(function (id) {
      var e = entries[id];
      var executed = e.outcomes.replace(/s/g, "");
      var bad = (executed.match(/[fk]/g) || []).length;
      return { id: id, entry: e, bad: bad, executed: executed.length };
    }).filter(function (u) { return u.bad > 0; }).sort(function (a, b) { return b.bad / b.executed - a.bad / a.executed; });

    var left;
    if (!testHistory) {
      left = '<p class="qa-stability-empty">Stability appears once runs have been recorded.</p>';
    } else if (!unstable.length) {
      left = '<p class="qa-stability-empty">No test failed or needed a retry in the last ' + plural(testHistory.runs > 20 ? 20 : testHistory.runs, "recorded run") + ".</p>";
    } else {
      left = '<ul class="qa-slowest">' + unstable.slice(0, 8).map(function (u) {
        var strip = u.entry.outcomes.split("").map(function (o) { return '<span class="qa-run is-' + o + '"></span>'; }).join("");
        return '<li class="qa-stability-row" data-test="' + esc(u.id) + '"><span>' + esc(u.entry.title) + ' <span class="qa-tag">' + esc(u.entry.project) + "</span></span>" +
          '<span><span class="qa-runs" aria-hidden="true">' + strip + '</span> <span class="qa-stability-rate">' + u.bad + " of " + plural(u.executed, "run") + "</span></span></li>";
      }).join("") + "</ul>";
    }

    var slowest = report.tests.filter(function (t) { return t.status !== "skipped"; })
      .sort(function (a, b) { return b.durationMs - a.durationMs; }).slice(0, 5);
    var right = '<ol class="qa-slowest">' + slowest.map(function (t) {
      var past = entries[t.id] ? entries[t.id].durations.slice(0, -1) : [];
      var usual = past.length >= 3 ? median(past) : null;
      var regressed = usual != null && t.durationMs > usual * 1.5 && t.durationMs - usual > 250;
      return "<li><span>" + esc(t.title) + ' <span class="qa-tag">' + esc(t.project) + "</span></span>" +
        '<span class="qa-test-duration' + (regressed ? " is-regressed" : "") + '">' + fmtMs(t.durationMs) +
        (regressed ? " ↑ usually " + fmtMs(usual) : "") + "</span></li>";
    }).join("") + "</ol>";

    return section("stability", "Stability",
      '<div class="qa-grid-2"><div class="qa-card"><h3 class="qa-card-title">Failed or retried recently</h3>' + left +
      '</div><div class="qa-card"><h3 class="qa-card-title">Slowest this run</h3>' + right + "</div></div>",
      "Outcomes per test across the recent runs: green passed, red failed, amber passed only on retry.");
  }

  // ---------- trend ----------
  function renderTrend(history) {
    if (!history || history.length < 2) {
      return '<div class="qa-trend-empty">The trend appears once a second run has been published.</div>';
    }
    var w = 640, h = 160, padL = 34, padR = 12, padT = 14, padB = 26;
    var innerW = w - padL - padR, innerH = h - padT - padB, n = history.length;
    var points = history.map(function (run, i) {
      return { x: padL + (i / (n - 1)) * innerW, y: padT + innerH - ((run.passRate || 0) / 100) * innerH, run: run };
    });
    var path = points.map(function (p, i) { return (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
    var grid = [0, 50, 100].map(function (v) {
      var y = padT + innerH - (v / 100) * innerH;
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="var(--line)"/>' +
        '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="var(--ink-soft)">' + v + "%</text>";
    }).join("");
    var dots = points.map(function (p) {
      return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="var(--accent)"><title>' +
        esc(fmtDate(p.run.generatedAt)) + " — " + p.run.passRate + "%</title></circle>";
    }).join("");
    return '<div class="qa-trend"><svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Pass rate across the last ' + n + ' runs">' +
      grid + '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="2"/>' + dots + "</svg>" +
      '<p class="qa-trend-caption">Pass rate, ' + esc(fmtDate(history[0].generatedAt).split(",")[0]) + " → " + esc(fmtDate(history[n - 1].generatedAt).split(",")[0]) + " · " + n + " runs</p></div>";
  }

  // ---------- tests ----------
  function unique(list) {
    return list.filter(function (v, i) { return list.indexOf(v) === i; });
  }

  function replayLink(test) {
    var attachments = test.publishedAttachments || [];
    var trace = attachments.filter(function (a) { return a.type === "trace"; })[0];
    var video = attachments.filter(function (a) { return a.type === "video"; })[0];
    if (trace) return '<a class="qa-replay" href="' + esc(traceViewerUrl(trace.path)) + '" target="_blank" rel="noopener">Replay trace →</a>';
    if (video) return '<a class="qa-replay" href="' + esc(video.path) + '" target="_blank" rel="noopener">Watch video →</a>';
    return "";
  }

  function renderTests(report) {
    var tests = report.tests || [];
    if (!tests.length) return '<div class="qa-empty-state">No test results in this report.</div>';

    var chips = '<div class="qa-chips" role="group" aria-label="Filter tests by tag">' +
      '<button type="button" class="qa-chip" data-tag="" aria-pressed="true">All ' + tests.length + "</button>" +
      (report.tags || []).map(function (t) {
        return '<button type="button" class="qa-chip" data-tag="' + esc(t.tag) + '" aria-pressed="false">' + esc(t.tag) + " " + t.total + "</button>";
      }).join("") + "</div>";

    var groups = {}, order = [];
    tests.forEach(function (t) {
      var key = (t.path && t.path.length ? t.path.join(" › ") : t.file) + " — " + t.project;
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(t);
    });

    // Groups are collapsed unless something in them failed or needed a retry:
    // a green run of 200+ checks shouldn't be a 20,000px scroll.
    return chips + order.map(function (key) {
      var list = groups[key];
      var n = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
      list.forEach(function (t) { n[t.status] = (n[t.status] || 0) + 1; });
      var broken = n.failed + n.flaky > 0;
      var counts = [n.passed + " passed", n.failed && n.failed + " failed", n.flaky && n.flaky + " flaky", n.skipped && n.skipped + " skipped"]
        .filter(Boolean).join(" · ");
      return '<details class="qa-suite-group"' + (broken ? " open" : "") + ' data-default-open="' + broken + '">' +
        '<summary><span class="qa-group-name">' + esc(key) + '</span><span class="qa-group-counts' + (broken ? " is-bad" : "") + '">' + counts + "</span></summary>" +
        list.map(function (t) {
        var broken = t.status === "failed" || t.status === "flaky";
        return '<div class="qa-test-row" data-tags="' + esc((t.tags || []).join(" ")) + '">' +
          '<span class="qa-test-title">' + esc(t.title) + "</span>" +
          (t.tags || []).map(function (tag) { return '<span class="qa-tag">' + esc(tag) + "</span>"; }).join("") +
          '<span class="qa-pill is-' + esc(t.status) + '">' + esc(t.status) + "</span>" +
          (t.status === "skipped" ? "" : '<span class="qa-test-duration">' + fmtMs(t.durationMs) + "</span>") +
          (broken ? replayLink(t) : "") +
          (t.error ? '<div class="qa-test-error">' + esc(t.error) + "</div>" : "") +
          "</div>";
      }).join("") + "</details>";
    }).join("");
  }

  function wireShowcase() {
    var play = contentEl.querySelector(".qa-showcase-play");
    if (!play) return;
    play.addEventListener("click", function () {
      var video = document.createElement("video");
      video.className = "qa-showcase-video";
      video.controls = true;
      video.muted = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-label", "Recording of the showcase test run");
      video.src = play.getAttribute("data-video");
      play.parentNode.replaceChild(video, play);
      video.focus();
    });
  }

  function wireTagFilter() {
    var chips = contentEl.querySelectorAll(".qa-chip");
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        var tag = chip.getAttribute("data-tag");
        Array.prototype.forEach.call(chips, function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        Array.prototype.forEach.call(contentEl.querySelectorAll(".qa-suite-group"), function (group) {
          var visible = 0;
          Array.prototype.forEach.call(group.querySelectorAll(".qa-test-row"), function (row) {
            var match = !tag || (" " + row.getAttribute("data-tags") + " ").indexOf(" " + tag + " ") !== -1;
            row.hidden = !match;
            if (match) visible++;
          });
          group.hidden = visible === 0;
          // A filter opens what it found; "All" restores the default state.
          group.open = tag ? visible > 0 : group.getAttribute("data-default-open") === "true";
        });
      });
    });
  }

  Promise.all([fetchJson("assets/qa/report.json"), optional("assets/qa/history.json"), optional("assets/qa/test-history.json")])
    .then(function (files) {
      var report = files[0], history = files[1], testHistory = files[2];
      renderMeta(report);

      var noFailures = !report.summary.failed
        ? '<p class="qa-trend-caption" style="margin-top:14px;">No failing tests right now — when one fails, a link to its trace in Playwright\'s Trace Viewer appears next to it.</p>'
        : "";

      contentEl.innerHTML =
        section("summary", "Summary", renderSummary(report.summary)) +
        renderShowcase(report.showcase) +
        renderAccessibility(report.accessibility) +
        renderPerformance(report.performance) +
        section("browsers", "By browser", renderProjects(report.projects || [])) +
        renderStability(report, testHistory) +
        section("trend", "Trend", renderTrend(history)) +
        section("tests", "Tests", renderTests(report) + noFailures);
      wireShowcase();
      wireTagFilter();
    })
    .catch(function (err) {
      contentEl.innerHTML =
        '<div class="qa-fetch-error" role="alert">Couldn\'t load the latest report (' + esc(err.message) + "). " +
        "Served from the filesystem, fetch() can't read local JSON — use <code>npm run serve</code>. " +
        "On the published site it means no run has been published yet.</div>";
    });
})();
