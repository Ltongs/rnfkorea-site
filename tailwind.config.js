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
    },
  },
  plugins: [],
};