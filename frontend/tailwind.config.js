/** Theme tokens mirror styles/tokens.css so classes and CSS vars stay in sync. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", bg2: "var(--bg2)",
        panel: "var(--panel)", panel2: "var(--panel2)", panel3: "var(--panel3)",
        line: "var(--line)", line2: "var(--line2)",
        text: "var(--text)", muted: "var(--muted)", muted2: "var(--muted2)",
        blue: "var(--blue)", cyan: "var(--cyan)", green: "var(--green)",
        yellow: "var(--yellow)", orange: "var(--orange)", red: "var(--red)",
        purple: "var(--purple)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', "Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // calmer corners: everything converges on the 6–10px range
      borderRadius: {
        lg: "6px", xl: "8px", "2xl": "10px", "3xl": "12px",
        xl2: "10px", xl3: "12px",
      },
    },
  },
  plugins: [],
};
