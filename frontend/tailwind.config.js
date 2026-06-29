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
      borderRadius: { xl2: "18px", xl3: "22px" },
    },
  },
  plugins: [],
};
