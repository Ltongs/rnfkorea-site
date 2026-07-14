/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans KR"', "sans-serif"],
      },
      colors: {
        navy: {
          900: "#0a192f",
          800: "#112240",
          50: "#f0f4f8",
        },
        brand: {
          lime: "#a3e635",
          yellow: "#facc15",
        },
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": {
            boxShadow:
              "0 0 10px rgba(163,230,53,0.55), 0 0 22px rgba(163,230,53,0.3)",
          },
          "50%": {
            boxShadow:
              "0 0 18px rgba(163,230,53,0.9), 0 0 38px rgba(163,230,53,0.55)",
          },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};