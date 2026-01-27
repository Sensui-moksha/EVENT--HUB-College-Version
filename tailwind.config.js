/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '375px',      // Small phones
        'sm': '640px',      // Large phones  
        'md': '768px',      // Tablets
        'lg': '1024px',     // Small laptops
        'xl': '1280px',     // Desktops
        '2xl': '1536px',    // Large desktops
        '3xl': '1920px',    // Ultra-wide
        '4k': '2560px',     // 4K displays
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      animation: {
        // Floating animations
        'float': 'float 3s ease-in-out infinite',
        'float-delayed': 'float 3s ease-in-out infinite 1.5s',
        'float-slow': 'float 4s ease-in-out infinite',
        
        // Typing animation
        'typing': 'typing 4s steps(40) infinite',
        
        // Bounce variations
        'bounce-slow': 'bounce 2s infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        
        // Pulse variations
        'pulse-slow': 'pulse 3s infinite',
        'pulse-fast': 'pulse 1s infinite',
        
        // Glow effect
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        
        // Slide animations
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-in-up': 'slide-in-up 0.3s ease-out',
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        
        // Fade animations
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-fast': 'fade-in 0.2s ease-out',
        'fade-in-slow': 'fade-in 0.5s ease-out',
        
        // Scale animations
        'scale-in': 'scale-in 0.3s ease-out',
        'scale-up': 'scale-up 0.2s ease-out',
        
        // Spin variations
        'spin-slow': 'spin 3s linear infinite',
        'spin-fast': 'spin 0.5s linear infinite',
        
        // Shake animation
        'shake': 'shake 0.5s ease-in-out',
        
        // Wiggle animation
        'wiggle': 'wiggle 1s ease-in-out infinite',
        
        // Scroll animation
        'scroll-left': 'scroll-left 20s linear infinite',
        'scroll-right': 'scroll-right 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        typing: {
          '0%': { width: '0' },
          '50%': { width: '100%' },
          '100%': { width: '0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        },
        'glow-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)',
            opacity: '1',
          },
          '50%': { 
            boxShadow: '0 0 25px rgba(59, 130, 246, 1)',
            opacity: '0.8',
          },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'scale-up': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-10px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'scroll-left': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'scroll-right': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'snappy': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      },
      transitionDuration: {
        '0': '0ms',
        '350': '350ms',
        '400': '400ms',
        '600': '600ms',
      },
      minHeight: {
        'touch': '44px', // Minimum touch target size for mobile
        'screen-mobile': 'calc(100vh - 4rem)', // Screen height minus nav
      },
      minWidth: {
        'touch': '44px', // Minimum touch target size for mobile
      },
      backdropBlur: {
        'xs': '2px',
      },
      fontSize: {
        // Responsive fluid typography using clamp
        'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.375vw, 1rem)',
        'fluid-base': 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
        'fluid-lg': 'clamp(1.125rem, 1rem + 0.625vw, 1.25rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
        'fluid-3xl': 'clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem)',
        'fluid-4xl': 'clamp(2.25rem, 1.75rem + 2.5vw, 3rem)',
        'fluid-5xl': 'clamp(3rem, 2rem + 3vw, 4rem)',
      },
      // Responsive container padding
      padding: {
        'responsive-sm': 'clamp(0.75rem, 2vw, 1rem)',
        'responsive-md': 'clamp(1rem, 3vw, 1.5rem)',
        'responsive-lg': 'clamp(1.5rem, 4vw, 2rem)',
        'responsive-xl': 'clamp(2rem, 5vw, 3rem)',
      },
      // Responsive gap utilities
      gap: {
        'responsive-sm': 'clamp(0.5rem, 1.5vw, 0.75rem)',
        'responsive-md': 'clamp(0.75rem, 2vw, 1rem)',
        'responsive-lg': 'clamp(1rem, 3vw, 1.5rem)',
        'responsive-xl': 'clamp(1.5rem, 4vw, 2rem)',
      },
      // Dynamic border radius
      borderRadius: {
        'responsive': 'clamp(0.5rem, 1.5vw, 1rem)',
        'responsive-lg': 'clamp(0.75rem, 2vw, 1.5rem)',
      },
      // Container width utilities
      maxWidth: {
        'readable': '65ch',
        'content': '90rem',
        'wide': '100rem',
      },
      // Aspect ratios for media
      aspectRatio: {
        'poster': '2/3',
        'card': '4/3',
        'hero': '16/9',
        'square': '1/1',
      },
    },
  },
  plugins: [],
};