import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './context/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0b1220',
          900: '#111827',
          800: '#1b2433',
          700: '#28323f',
        },
        accent: {
          50: '#eef6ff',
          100: '#d9ecff',
          400: '#39a7e8',
          500: '#1b8fd6',
          600: '#1576b4',
        },
      },
    },
  },
  plugins: [],
};

export default config;
