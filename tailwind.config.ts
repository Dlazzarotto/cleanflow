import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade CleanFlow: petróleo profundo (confiança) + aqua (limpeza)
        brand: {
          900: '#083A38',
          800: '#0C4B48',
          700: '#0F5C58',
          600: '#13706B',
          100: '#D9F2F0',
          50: '#EFFAF9',
        },
        aqua: {
          500: '#2BB3A3',
          400: '#4CC6B8',
        },
        sun: '#F2A03D', // acento para alertas/destaques
        ink: '#122221',
        paper: '#F7FAF9',
      },
      fontSize: {
        base: ['18px', '1.6'], // acessibilidade: 18px+
      },
      minHeight: {
        touch: '48px', // alvos de toque 48px+
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};
export default config;
