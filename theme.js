(function () {
  "use strict";

  function initThemeToggle() {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("reelcoverfit-theme", next);
      } catch (e) {}
      if (typeof window.gtag === "function") {
        window.gtag("event", "theme_toggle", { theme: next });
      }
    });
  }

  function initScrollReveal() {
    var targets = document.querySelectorAll(
      ".resource-card, .size-card, .info-card, .article-card, .feedback-card"
    );
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    targets.forEach(function (el) { el.classList.add("reveal-on-scroll"); });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initScrollReveal();
  });
})();
