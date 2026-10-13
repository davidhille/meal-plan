/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Hauptfarbe „Aubergine“
        brand: {
          50: '#FAF5FB',
          100: '#F3E6F5',
          200: '#E7CCEC',
          300: '#D3A6DB',
          400: '#B477C0',
          500: '#9550A3',
          600: '#7D3A8B',
          700: '#6B2E7A',
          800: '#56245F',
          900: '#421C4A',
        },
        // Akzent „Koralle“ (günstiger, Fortschritt)
        coral: {
          50: '#FFF4F1',
          100: '#FFE3DC',
          300: '#F4A592',
          500: '#E8735A',
          700: '#9A3A24',
        },
        // Neutrale Töne mit leichtem Pflaumenstich
        gray: {
          50: '#FAF7FA',
          100: '#F3EEF4',
          200: '#E6DEE8',
          300: '#D2C6D5',
          400: '#A396A7',
          500: '#6B5870',
          600: '#574A5C',
          700: '#42364A',
          800: '#2E2333',
          900: '#241628',
        },
      },
    },
  },
  plugins: [],
};
