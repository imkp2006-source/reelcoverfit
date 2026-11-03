(function () {
  "use strict";

  /* --------------------------------------------------------------------------
     1. Scroll Reveal Intersection Observer
     -------------------------------------------------------------------------- */
  function initScrollReveal() {
    var targets = document.querySelectorAll(
      ".resource-card, .size-card, .info-card, .article-card, .feedback-card, .tool-card, .platform-card, .step-card"
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

  /* --------------------------------------------------------------------------
     2. Responsive Mobile Navigation
     -------------------------------------------------------------------------- */
  function initMobileNav() {
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (!navToggle || !navLinks) return;

    function setMenuState(open) {
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navLinks.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    }

    navToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      var isOpen = navToggle.getAttribute("aria-expanded") === "true";
      setMenuState(!isOpen);
    });

    // Close on navigation link click
    var links = navLinks.querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function () {
        setMenuState(false);
      });
    });

    // Close on Escape key
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setMenuState(false);
        navToggle.focus();
      }
    });

    // Close on outside click
    document.addEventListener("click", function (event) {
      if (navToggle.getAttribute("aria-expanded") === "true") {
        if (!navLinks.contains(event.target) && !navToggle.contains(event.target)) {
          setMenuState(false);
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initScrollReveal();
    initMobileNav();
  });
})();
