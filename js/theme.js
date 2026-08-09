(function () {
  var THEMES = ["light", "dark", "ocean"];
  var STORE_KEY = "tools-v3-theme";

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch (e) {
      return null;
    }
  }

  function applyTheme(theme, save) {
    if (THEMES.indexOf(theme) === -1) {
      theme = "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
    if (save) {
      try {
        localStorage.setItem(STORE_KEY, theme);
      } catch (e) {}
    }
    var btns = document.querySelectorAll(".theme-btn");
    btns.forEach(function (btn) {
      if (btn.dataset.theme === theme) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function highlightActiveFooterLink() {
    var current = location.pathname.replace(/\/index\.html$/, "/");
    if (current.charAt(current.length - 1) !== "/") {
      current += "/";
    }
    document.querySelectorAll(".footer__link").forEach(function (link) {
      var resolver = document.createElement("a");
      resolver.href = link.getAttribute("href");
      var target = resolver.pathname.replace(/\/index\.html$/, "/");
      if (target.charAt(target.length - 1) !== "/") {
        target += "/";
      }
      if (target === current) {
        link.classList.add("active");
      }
    });
  }

  function init() {
    var saved = getSavedTheme();
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"), false);
    highlightActiveFooterLink();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".theme-btn");
      if (btn) {
        applyTheme(btn.dataset.theme, true);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();