/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0D0F14",
          900: "#12151C",
          800: "#1B1F29",
          700: "#262B38",
          600: "#343B4C",
          500: "#4A5268",
        },
        ink: {
          DEFAULT: "#E8EAF0",
          muted: "#8B93A6",
          faint: "#5A6178",
        },
        signal: {
          up: "#4FBF8F",
          "up-dim": "#2A4A3D",
          down: "#D96C5A",
          "down-dim": "#4A322C",
          warn: "#D9A54F",
          "warn-dim": "#4A3F2A",
        },
        accent: {
          DEFAULT: "#5B8DEF",
          dim: "#2A3550",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
      },
    },
  },
  plugins: [],
}
