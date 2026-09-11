// Stefan Mandovski — Portfolio
// Progressive enhancement only: every feature here degrades to a fully
// visible, fully usable page if JavaScript fails to load.

(function () {
  "use strict";

  // Footer year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Note: this used to include a scroll-reveal (fade/slide-in via
  // IntersectionObserver). It was removed after testing showed a timing
  // race that could leave sections permanently invisible — not an
  // acceptable failure mode on a résumé site. Content is simply visible.

  // Earlier-roles toggle label — the <details>/<summary> element already
  // does the actual expand/collapse with zero JS; this only swaps the label.
  var tlMore = document.getElementById("tlMore");
  if (tlMore) {
    var label = tlMore.querySelector(".tl-more-label");
    if (label) {
      tlMore.addEventListener("toggle", function () {
        label.textContent = tlMore.open ? "Hide earlier roles" : "Show earlier roles";
      });
    }
  }

  // Floating CTA — visible by default (see CSS); JS only hides it once the
  // Projects section is on screen. If this never runs, the CTA just stays
  // visible the whole time, which is a harmless degraded state rather than
  // a broken one.
  var cta = document.getElementById("floatingCta");
  var projectsSection = document.getElementById("projects");
  if (cta && projectsSection && "IntersectionObserver" in window) {
    var ctaObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          cta.classList.toggle("is-hidden", entry.isIntersecting);
        });
      },
      { rootMargin: "0px 0px -40% 0px" }
    );
    ctaObserver.observe(projectsSection);
  }

  // Scroll position on reload: some browsers restore the previous scroll
  // offset on a plain reload. For a one-page résumé site that reads as a
  // bug ("where did I end up?"), so a reload with no hash always opens at
  // the top; a reload with a hash still lets the browser's normal anchor
  // scrolling do its job.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.addEventListener("load", function () {
    if (!location.hash) window.scrollTo(0, 0);
  });

  // Section-hash routing: redirect a handful of retired anchors to where
  // that content lives now, and send anything unrecognized to the 404
  // page rather than silently doing nothing. Only applies to in-page
  // section hashes on this page — cv.html and qa-suite.html are unaffected.
  var KNOWN_SECTIONS = ["#top", "#about", "#experience", "#skills", "#projects", "#contact"];
  var LEGACY_ANCHORS = { "#work": "#projects", "#resume": "cv.html", "#cv": "cv.html" };
  function routeHash() {
    var hash = location.hash;
    if (!hash) return;
    if (LEGACY_ANCHORS[hash]) {
      var target = LEGACY_ANCHORS[hash];
      if (target.indexOf("#") === 0) {
        location.replace(target);
      } else {
        location.href = target;
      }
      return;
    }
    if (KNOWN_SECTIONS.indexOf(hash) === -1) {
      location.href = "404.html";
    }
  }
  routeHash();
  window.addEventListener("hashchange", routeHash);
})();
