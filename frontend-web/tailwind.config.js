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
        /** On colored surfaces (Terms AI block, badges) — light tint for contrast */
        'primary-fixed': '#dbeafe',
        /** Icon accent when sitting on saturated primary fills */
        'secondary-fixed': '#bfdbfe',
        accent: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
        },
        background: {
          DEFAULT: '#F9F7F7',
          alt: '#f6f6f8',
        },
        secondary: '#2d6299',
        error: '#b3261e',
        outline: '#94a3b8',
        'outline-variant': '#cbd5e1',
        surface: '#ffffff',
        'on-surface': '#191c1e',
        'on-surface-variant': '#5c6071',
        'surface-container': '#f1f5f9',
        'surface-container-low': '#f8fafc',
        'surface-container-lowest': '#fefeff',
        'surface-container-high': '#e9eef5',
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
