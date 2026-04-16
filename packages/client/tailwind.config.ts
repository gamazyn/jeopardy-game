import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        jeopardy: {
          blue: '#0600C8',
          'blue-light': '#1A0FD4',
          gold: '#FFD700',
          'gold-dark': '#CC9900',
        },
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
      },
      animation: {
        'flip-in': 'flipIn 0.6s ease-in-out',
        'score-pop': 'scorePop 0.4s ease-out',
        'buzzer-pulse': 'buzzerPulse 1s ease-in-out infinite',
      },
      keyframes: {
        flipIn: {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
        scorePop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        buzzerPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
          '50%': { boxShadow: '0 0 0 20px rgba(239, 68, 68, 0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
