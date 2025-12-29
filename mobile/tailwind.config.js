/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2D6A4F",
        background: "#F9F7F2",
        accent: "#FFB400",
        success: "#4BB543",
        error: "#E63946",
        "text-main": "#1B1B1B",
        "text-muted": "#6C757D",
      },
      fontFamily: {
        sans: ["Inter", "system-ui"],
        arabic: ["Cairo", "system-ui"],
      },
      spacing: {
        base: "4px",
      },
      borderRadius: {
        card: "24px",
        button: "12px",
      },
    },
  },
  plugins: [],
};

