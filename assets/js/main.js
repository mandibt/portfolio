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
})();
