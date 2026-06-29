import { useState } from "react";

export type Theme = "dark" | "light";

function current(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
}

/** Read/toggle the light/dark theme. Persists to localStorage and eases the
 *  whole UI between palettes via the temporary `.theme-anim` class. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const el = document.documentElement;
    el.classList.add("theme-anim");
    el.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* ignore */ }
    setTheme(next);
    window.setTimeout(() => el.classList.remove("theme-anim"), 450);
  };

  return { theme, toggle };
}
