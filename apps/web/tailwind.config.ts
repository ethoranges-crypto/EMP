import type { Config } from "tailwindcss";

// Brand direction (SPEC §13): dark UI, electric neon accents, near-black base.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        void: "#05050a",
        surface: "#0d0d16",
        pulse: {
          cyan: "#3ef2ff",
          violet: "#a259ff",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(62, 242, 255, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
