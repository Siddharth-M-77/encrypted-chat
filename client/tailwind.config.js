/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: { purple: '#7B2FF7', blue: '#2F80ED', cyan: '#22D3EE', pink: '#D946EF' },
        // Layered near-black surfaces with a faint violet tint
        surface: { DEFAULT: '#06060c', 1: '#0b0b14', 2: '#12121d', 3: '#1a1a28', 4: '#232335' },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7B2FF7 0%, #2F80ED 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(123,47,247,.18) 0%, rgba(47,128,237,.18) 100%)',
      },
      boxShadow: {
        glow: '0 8px 32px -8px rgba(123,47,247,.55)',
        'glow-blue': '0 8px 32px -8px rgba(47,128,237,.55)',
        bubble: '0 6px 24px -10px rgba(123,47,247,.6)',
        float: '0 24px 64px -16px rgba(0,0,0,.7)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.96) translateY(8px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
        'msg-in': { '0%': { opacity: 0, transform: 'translateY(6px) scale(.98)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        ring: { '0%': { transform: 'scale(1)', opacity: 0.45 }, '100%': { transform: 'scale(2.1)', opacity: 0 } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(40px,-30px,0) scale(1.12)' } },
        'drift-2': { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(-50px,30px,0) scale(1.08)' } },
        bars: { '0%,100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
        'gradient-pan': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        'fade-up': 'fade-up .5s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .3s ease both',
        'scale-in': 'scale-in .22s cubic-bezier(.2,.8,.2,1) both',
        'msg-in': 'msg-in .25s cubic-bezier(.2,.8,.2,1) both',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        ring: 'ring 2s cubic-bezier(.2,.6,.4,1) infinite',
        drift: 'drift 18s ease-in-out infinite',
        'drift-2': 'drift-2 22s ease-in-out infinite',
        bars: 'bars 1s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 6s ease infinite',
      },
    },
  },
  plugins: [],
};
