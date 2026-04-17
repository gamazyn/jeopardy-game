import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        jeopardy: {
          blue: '#0F172A',
          'blue-light': '#1E2D40',
          gold: '#E8B84B',
          'gold-dark': '#C59830',
        },
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        ui: ['Lato', 'system-ui', 'sans-serif'],
        value: ['Oswald', 'Georgia', 'serif'],
        arcade: ['Bungee', 'Georgia', 'serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        'flip-in': 'flipIn 0.6s ease-in-out',
        'score-pop': 'scorePop 0.4s ease-out',
        'buzzer-pulse': 'buzzerPulse 1s ease-in-out infinite',
        'glow-breathe': 'glowBreathe 2s ease-in-out infinite',
        'winner-shimmer': 'winnerShimmer 2s ease-in-out infinite',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5), 0 6px 0 #7f1d1d' },
          '50%': { boxShadow: '0 0 0 20px rgba(239, 68, 68, 0), 0 6px 0 #7f1d1d' },
        },
        glowBreathe: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        winnerShimmer: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(232,184,75,0.4)' },
          '50%': { boxShadow: '0 0 28px rgba(232,184,75,0.9)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
