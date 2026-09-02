import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "'Segoe UI'", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#2b3437",
        steel: "#586064",
        ash: "#8d979b",
        cloud: "#f8f9fa",
        mist: "#f1f4f6",
        surface: "#ffffff",
        "surface-low": "#f1f4f6",
        "surface-container": "#eaeff1",
        "surface-high": "#e2e9ec",
        "surface-highest": "#dbe4e7",
        outline: "#abb3b7",
        pine: "#3f7c6d",
        sand: "#a46a2b",
        ember: "#9f403d",
        secondary: "#0055d7",
        "secondary-dim": "#004abe",
        "secondary-container": "#dae1ff",
      },
      borderRadius: {
        "radius-sm": "10px",
        "radius-md": "14px",
        "radius-lg": "18px",
        "radius-xl": "24px",
      },
      boxShadow: {
        panel: "0px 1px 2px rgba(43, 52, 55, 0.04), 0px 10px 28px rgba(43, 52, 55, 0.05)",
        soft: "0px 12px 32px rgba(43, 52, 55, 0.06)",
        elevated: "0px 18px 44px rgba(43, 52, 55, 0.08)",
        whisper: "0px 12px 32px rgba(43, 52, 55, 0.06)",
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.04", letterSpacing: "-0.045em", fontWeight: "800" }],
        "page-heading": ["3rem", { lineHeight: "1.02", letterSpacing: "-0.055em", fontWeight: "800" }],
        heading: ["1.55rem", { lineHeight: "1.16", letterSpacing: "-0.035em", fontWeight: "700" }],
        subheading: ["1.0625rem", { lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }],
        caption: ["0.6875rem", { lineHeight: "1.35", letterSpacing: "0.12em", fontWeight: "600" }],
        micro: ["0.625rem", { lineHeight: "1.3", letterSpacing: "0.16em", fontWeight: "700" }],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-right": {
          from: { opacity: "0", transform: "translateX(18px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.24s ease-out",
        "slide-up": "slide-up 0.28s ease-out",
        "slide-right": "slide-right 0.24s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
