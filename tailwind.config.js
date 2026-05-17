/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "#0a0b0f",
          2: "#111318",
          3: "#1a1d26",
          4: "#222635",
        },
        accent: {
          DEFAULT: "#6c63ff",
          light: "#a78bfa",
          dark: "#4c46b5",
        },
        border: {
          DEFAULT: "#2a2d3e",
          light: "#3a3d52",
        },
        cert: {
          gold: "#f59e0b",
          teal: "#14b8a6",
        },
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, #6c63ff, #a78bfa)",
        "gradient-teal": "linear-gradient(135deg, #14b8a6, #6c63ff)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        pulse2: "pulse2 2s infinite",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideUp: { from: { opacity: 0, transform: "translateY(20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulse2: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
      },
      boxShadow: {
        accent: "0 8px 32px rgba(108, 99, 255, 0.4)",
        "accent-sm": "0 4px 16px rgba(108, 99, 255, 0.25)",
        glow: "0 0 20px rgba(108, 99, 255, 0.15)",
      },
    },
  },
  plugins: [],
};
