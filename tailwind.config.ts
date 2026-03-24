import type { Config } from 'tailwindcss'

// Note: This project uses Tailwind v4. The canonical design tokens live in
// src/app/globals.css inside the @theme block. This file is kept for editor
// intellisense and any tooling that still reads tailwind.config.ts.
// Colors aligned with Linear-style design system (design-system.css).
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
        // ── Backgrounds (light glass design system) ─────────────────
        background: '#f5f5f7',
        surface: 'rgba(255,255,255,0.72)',
        elevated: 'rgba(255,255,255,0.90)',
        overlay: 'rgba(255,255,255,0.97)',

        // ── Text (dark on light) ─────────────────────────────────────
        'text-primary': '#1d1d1f',
        'text-secondary': '#6e6e73',
        'text-tertiary': '#aeaeb2',
        'text-disabled': 'rgba(0,0,0,0.25)',

        // ── Accent (indigo) ──────────────────────────────────────────
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: 'rgba(99,102,241,0.10)',
          subtle: 'rgba(99,102,241,0.06)',
        },

        // ── Semantic ─────────────────────────────────────────────────
        success: {
          DEFAULT: '#10b981',
          muted: 'rgba(16,185,129,0.10)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: 'rgba(245,158,11,0.10)',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: 'rgba(239,68,68,0.10)',
        },
        info: {
          DEFAULT: '#3B82F6',
          muted: 'rgba(59,130,246,0.10)',
        },

        // ── Borders ──────────────────────────────────────────────────
        border: {
          DEFAULT: 'rgba(0,0,0,0.08)',
          subtle: 'rgba(0,0,0,0.04)',
          strong: 'rgba(0,0,0,0.14)',
          accent: 'rgba(99,102,241,0.25)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", "'Roboto'", 'sans-serif'],
        mono: ["'SF Mono'", "'Menlo'", "'Consolas'", 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        xs: ['0.6875rem', { lineHeight: '1rem' }],       // 11px — labels
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],     // 13px — body
        base: ['0.8125rem', { lineHeight: '1.5rem' }],    // 13px — body
        md: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1rem', { lineHeight: '1.625rem' }],
        xl: ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.875rem' }],   // 20px — titles
        '3xl': ['1.5rem', { lineHeight: '2rem' }],
        '4xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '10px',
        full: '9999px',
      },
      spacing: {
        px: '1px',
        0: '0',
        0.5: '2px',
        1: '4px',
        1.5: '6px',
        2: '8px',
        2.5: '10px',
        3: '12px',
        3.5: '14px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        11: '44px',
        12: '48px',
        14: '56px',
        16: '64px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
        36: '144px',
        40: '160px',
        44: '176px',
        48: '192px',
        52: '208px',
        56: '224px',
        60: '240px',
        64: '256px',
        72: '288px',
        80: '320px',
        96: '384px',
      },
      boxShadow: {
        sm: '0 1px 4px rgba(0,0,0,0.06)',
        DEFAULT: '0 2px 12px rgba(0,0,0,0.08)',
        md: '0 4px 20px rgba(0,0,0,0.10)',
        lg: '0 8px 40px rgba(0,0,0,0.12)',
        xl: '0 16px 60px rgba(0,0,0,0.14)',
        accent: '0 0 0 2px rgba(99,102,241,0.35)',
        'inset-border': 'inset 0 0 0 1px rgba(0,0,0,0.08)',
        glow: '0 0 20px rgba(99,102,241,0.20)',
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'fade-out': 'fade-out 0.1s ease-in',
        'slide-in-up': 'slide-in-up 0.2s ease-out',
        'slide-in-down': 'slide-in-down 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
        spin: 'spin 1s linear infinite',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      transitionTimingFunction: {
        'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '100ms',
        DEFAULT: '150ms',
        slow: '250ms',
        slower: '350ms',
      },
      zIndex: {
        base: '0',
        raised: '10',
        dropdown: '100',
        sticky: '200',
        overlay: '300',
        modal: '400',
        popover: '500',
        toast: '600',
        tooltip: '700',
      },
    },
  },
  plugins: [],
}

export default config
