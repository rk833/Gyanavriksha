/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3F72AF',
          light: '#DBE2EF',
          dark: '#112D4E',
          deep: '#1a227f',
          50: '#F9F7F7',
        },
        accent: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
        },
        background: {
          DEFAULT: '#F9F7F7',
          alt: '#f6f6f8',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
}
