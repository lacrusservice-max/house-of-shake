/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'hos-primary': '#F5C842',
        'hos-navy': '#1B2F56',
        'hos-navy-dark': '#071E3D',
        'hos-gold': '#F5C842',
        'hos-cream': '#FBF7F0',
      },
    },
  },
  plugins: [],
};
