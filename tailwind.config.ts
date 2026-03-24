import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: { DEFAULT: '#c97b84', deep: '#b5606a', pale: '#e8c5c9', blush: '#f5e6e8' },
        ink: { DEFAULT: '#1f1a18', soft: '#3d3330' },
        mid: '#2a2420',
        sand: { DEFAULT: '#faf4ed', pale: '#ede0d0', deep: '#d4b896' },
        green: '#4a7c59',
        amber: '#d4914a',
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;