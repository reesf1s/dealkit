import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        elevated: 'var(--bg-elevated)',
        sunken: 'var(--bg-sunken)',
        subtle: 'var(--bg-subtle)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-4': 'var(--ink-4)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        signal: 'var(--signal)',
        warn: 'var(--warn)',
        risk: 'var(--risk)',
        cool: 'var(--cool)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        glass: 'linear-gradient(135deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.32) 100%)',
        'glass-strong': 'linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.45) 100%)',
      },
      backdropBlur: {
        glass: '24px',
        'glass-heavy': '40px',
      },
      backdropSaturate: {
        glass: '1.8',
        'glass-heavy': '2',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        'glass-lg': 'var(--glass-shadow-lg)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
