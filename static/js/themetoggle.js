(function () {
  const storageKey = "theme-storage";
  const darkPreference = window.matchMedia("(prefers-color-scheme: dark)");

  function savedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (_) {
      return null;
    }
  }

  function setTheme(mode) {
    const dark = mode === "dark";
    const darkStyle = document.getElementById("darkModeStyle");
    if (darkStyle) darkStyle.disabled = !dark;

    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";

    const toggle = document.getElementById("dark-mode-toggle");
    if (toggle) {
      toggle.setAttribute("aria-label", dark ? "切换到浅色模式" : "切换到深色模式");
      toggle.setAttribute("aria-pressed", String(dark));
      toggle.innerHTML = dark
        ? '<svg class="feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
        : '<svg class="feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>';
    }
  }

  window.toggleTheme = function () {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch (_) {
      // The switch still works when storage is unavailable.
    }
  };

  setTheme(savedTheme() || (darkPreference.matches ? "dark" : "light"));
  darkPreference.addEventListener("change", function (event) {
    if (!savedTheme()) setTheme(event.matches ? "dark" : "light");
  });
})();
