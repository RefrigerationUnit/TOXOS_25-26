const themeToggleEl = document.getElementById("themeToggle");

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.setAttribute("data-theme", isLight ? "light" : "dark");
  themeToggleEl.textContent = isLight ? "Dark Mode" : "Light Mode";
}

function toggleTheme() {
  const isLight = document.body.getAttribute("data-theme") === "light";
  const nextTheme = isLight ? "dark" : "light";
  applyTheme(nextTheme);
  window.localStorage.setItem("pdf-viewer-theme", nextTheme);
}

applyTheme(window.localStorage.getItem("pdf-viewer-theme") === "light" ? "light" : "dark");
themeToggleEl.addEventListener("click", toggleTheme);