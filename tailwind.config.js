/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#0f0f14",
        surface: "#17171f",
        card: "#1d1d28",
        accent: { purple: "#8b5cf6", magenta: "#d946ef", pink: "#ec4899" },
      },
    },
  },
  plugins: [],
};
