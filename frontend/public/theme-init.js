// Apply the saved theme before first paint to avoid a flash of the wrong theme.
// Kept as an external file (not inline) so the app's Content-Security-Policy can
// keep script-src 'self' without needing 'unsafe-inline'.
(function () {
  try {
    document.documentElement.setAttribute(
      "data-theme", localStorage.getItem("theme") || "dark");
  } catch (e) {}
})();
