/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        'king-blue': '#1e3a8a',
        'king-blue-light': '#1e40af',
        'king-blue-dark': '#172554',
      },
    },
  },
  plugins: [],
}
