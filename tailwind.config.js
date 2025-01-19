/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      zIndex: {
        '9999': '9999',
      },
    },
  },
  plugins: [],
  important: true, // 确保 Tailwind 样式优先级
} 