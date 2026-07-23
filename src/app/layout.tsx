import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CleanFlow AI',
  description: 'A plataforma que administra sua empresa de limpeza praticamente sozinha.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
