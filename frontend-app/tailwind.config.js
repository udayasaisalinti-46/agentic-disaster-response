/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        emergency: {
          50: "#fff1f2",
          600: "#dc2626",
          700: "#b91c1c"
        }
      }
    }
  },
  plugins: []
};
