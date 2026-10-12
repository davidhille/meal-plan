/** @type {import('tailwindcss').Config} */
// Farbwelt angelehnt an die Emergent-Version: warmes Off-White, tiefes Salbeigrün.
// "gray" und "green" werden bewusst überschrieben, damit alle Komponenten den warmen Ton übernehmen.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#F9F8F6',
          100: '#F1EFEA',
          200: '#E5E3DC',
          300: '#D3D0C6',
          400: '#9AA39D',
          500: '#5C7063',
          600: '#4A5C51',
          700: '#3A4C42',
          800: '#2C3E35',
          900: '#22312A',
        },
        green: {
          50: '#EEF4EF',
          100: '#DCE9DF',
          200: '#BCD4C2',
          300: '#93B89D',
          400: '#6A9A77',
          500: '#4A7C59',
          600: '#3F6B4C',
          700: '#355A40',
          800: '#2C4A35',
          900: '#233B2B',
        },
        cream: '#F9F8F6',
        sand: '#F3EBDD',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Manrope', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(44, 62, 53, 0.04), 0 4px 16px rgba(44, 62, 53, 0.05)',
      },
    },
  },
  plugins: [],
};
