type Theme = "dark" | "light";

const KEY = "aon-theme";

function detect(): Theme {
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function initTheme() {
  document.documentElement.dataset.theme = detect();
}

export function toggleTheme(): Theme {
  const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(KEY, next);
  return next;
}

export function getTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme | undefined) ?? "dark";
}
