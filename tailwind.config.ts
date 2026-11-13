import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        elevated: v("elevated"),
        line: v("line"),
        fg: v("fg"),
        muted: v("muted"),
        subtle: v("subtle"),
        ok: { DEFAULT: "#10B981", soft: "rgb(16 185 129 / 0.12)" },
        bad: { DEFAULT: "#EF4444", soft: "rgb(239 68 68 / 0.12)" },
        warn: { DEFAULT: "#F59E0B", soft: "rgb(245 158 11 / 0.12)" },
        info: { DEFAULT: "#60A5FA", soft: "rgb(96 165 250 / 0.12)" },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
      boxShadow: {
        card: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 1px 2px 0 rgb(0 0 0 / 0.25)",
        pop: "0 20px 50px -12px rgb(0 0 0 / 0.5)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "none" } },
        pulsar: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        barrido: { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "scale-in": "scale-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        pulsar: "pulsar 1.6s ease-in-out infinite",
        barrido: "barrido linear forwards",
      },
    },
  },
  plugins: [],
};
export default config;
