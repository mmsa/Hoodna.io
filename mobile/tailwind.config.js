/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#158074",
        background: "#F9F8F1",
        accent: "#FF6F61",
        success: "#158074",
        error: "#DC2626",
        "text-main": "#2D2D2A",
        "text-muted": "#707070",
        whatsapp: "#25D366",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Arabic", "system-ui"],
      },
      borderRadius: {
        card: "16px",
        button: "24px",
        chip: "32px",
      },
    },
  },
  plugins: [],
};
