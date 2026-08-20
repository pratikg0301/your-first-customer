/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // brand aliases (used in Layout nav)
        brand: {
          purple: '#534AB7',
          'purple-light': '#EEEDFE',
          teal: '#1D9E75',
          'teal-light': '#E1F5EE',
        },
        // design tokens used throughout IntakeFlow / Dashboard
        teal: '#1D9E75',
        'teal-light': '#E1F5EE',
        'teal-pale': '#F0FAF6',
        cream: '#FAF8F3',
        'cream-dark': '#E8E3D9',
        ink: '#1A1A18',
        'ink-muted': '#5A5A5A',
        'ink-faint': '#9E9B95',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
