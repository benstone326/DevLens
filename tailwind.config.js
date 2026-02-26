/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './popup.html',
    './panel.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6ff',
          300: '#a5b8ff',
          400: '#8192ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#3d35c5',
          800: '#2e28a0',
          900: '#1e1a7a',
        },
        surface: {
          DEFAULT: '#0f0f13',
          50:  '#1a1a22',
          100: '#16161e',
          200: '#12121a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
