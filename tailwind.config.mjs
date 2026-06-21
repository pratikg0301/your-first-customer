/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        cream: '#F0EDE6',
        'cream-dark': '#E8E4DC',
        teal: {
          DEFAULT: '#2D5F52',
          light: '#3D7A6A',
          pale: '#E8F0EE',
        },
        ink: {
          DEFAULT: '#1A1A18',
          muted: '#4A4A46',
          faint: '#8A8A84',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'sm': '4px',
        DEFAULT: '6px',
        'md': '8px',
        'lg': '12px',
      },
    },
  },
  plugins: [],
};
