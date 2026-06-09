import type { Config } from "tailwindcss";

const config = {
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1A1A2E",
          red: "#E94560",
          amber: "#F5A623",
          dark: "#16213E",
          card: "#0F3460",
        },
        status: {
          success: "#27AE60",
          warning: "#F39C12",
          error: "#E74C3C",
          info: "#2980B9",
          purple: "#8E44AD",
          teal: "#1ABC9C",
        },
        ui: {
          textPrimary: "#1A1A2E",
          textMuted: "#5A6478",
          border: "#E0E4EE",
          rowAlt: "#F4F6FB",
          codeBg: "#F0F2F8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
} satisfies Config;

export default config;
