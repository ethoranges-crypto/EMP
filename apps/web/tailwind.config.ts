import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Brand direction (SPEC §13) + the "1b" design-token system (near-black,
// electric accents, three-column grammar): dark UI, neon accents, mono
// numerals. Shared here so every screen draws from the same palette rather
// than re-deriving colours per component — see the design handoff for the
// exact hex sources.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Layer scale, darkest to lightest: page -> nav rail/side panel -> card.
        void: "#06080a",
        rail: "#080b0e",
        surface: "#0a0e11",
        // Text scale, brightest to dimmest — named `ink` to avoid colliding
        // with Tailwind's own `gray`/`slate` scales elsewhere in the app.
        ink: {
          1: "#e8eef2",
          2: "#c3ced4",
          3: "#8b979f",
          4: "#7d8b94",
          5: "#5c6a73",
          6: "#4a565e",
        },
        pulse: {
          cyan: "#35e6f2",
          violet: "#9a7bff",
          green: "#5ef2a8",
          amber: "#ffcb6b",
          red: "#ff7a6b",
        },
        // Text colour for content sitting *on* a solid accent fill (buttons,
        // filled chips) — each accent has its own near-black pairing, not a
        // single generic "on-accent" value.
        onaccent: {
          cyan: "#04070a",
          amber: "#241c08",
          red: "#2a0d09",
        },
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-jetbrains-mono)", ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        chip: "5px",
        card: "9px",
      },
      boxShadow: {
        glow: "0 0 24px rgba(53, 230, 242, 0.35)",
      },
      keyframes: {
        empPulse: {
          "0%": { transform: "scale(.6)", opacity: "0.55" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        // A small "this is live" indicator dot — distinct job from empPulse
        // (an expanding ring broadcasting outward): this just breathes in
        // place, for a status light rather than a signal source.
        empBreathe: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        empPulse: "empPulse 2.6s ease-out infinite",
        empBreathe: "empBreathe 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
