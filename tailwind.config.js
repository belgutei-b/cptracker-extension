/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  darkMode: "media",
  prefix: "plasmo-",
  theme: {
    extend: {
      colors: {
        background: "#0b0d0e",
        card: "#0e1112",
        muted: { DEFAULT: "#161a1c", foreground: "#8a9299" },
        border: "#23292d",
        input: "#2a3035",
        foreground: "#e8eaeb",
        primary: { DEFAULT: "#c6f36d", foreground: "#0b0d0e" },
        destructive: "#f0716a",
        easy: "#4fc3b4",
        medium: "#e9b44c",
        hard: "#f0716a"
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace"
        ]
      }
    }
  }
}
