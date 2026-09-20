/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FAFAFA',          // Background
          dark: '#22223B',        // Primary / Dark
          secondary: '#4A4E69',   // Secondary / Interactions
          muted: '#9A8C98',       // Accent / Muted / Borders
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 4px 20px -2px rgba(34, 34, 59, 0.08)',
        'brand-lg': '0 10px 30px -4px rgba(34, 34, 59, 0.12)',
        'brand-inner': 'inset 0 2px 4px 0 rgba(34, 34, 59, 0.06)',
      }
    },
  },
  plugins: [],
}
