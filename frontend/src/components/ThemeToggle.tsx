import { useTheme } from "@/hooks/useTheme";

/** Animated pill switch: a sliding knob that crossfades a sun/moon. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={!dark}
      aria-label="Toggle light/dark theme"
      title={dark ? "Switch to light" : "Switch to dark"}
      className="relative w-12 h-6 rounded-full border border-line2 bg-bg2 shrink-0 transition-colors hover:border-blue"
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none shadow transition-all duration-300 ease-out ${
          dark ? "left-[3px] bg-panel3 text-cyan" : "left-[25px] bg-yellow text-bg"
        }`}
      >
        <span className={`absolute transition-all duration-300 ${dark ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"}`}>🌙</span>
        <span className={`absolute transition-all duration-300 ${dark ? "opacity-0 rotate-90" : "opacity-100 rotate-0"}`}>☀️</span>
      </span>
    </button>
  );
}
