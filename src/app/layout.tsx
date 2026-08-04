import type { Metadata } from 'next';
import './globals.css';
import ServiceWorkerSetup from '@/components/ServiceWorkerSetup';

export const viewport = {
  themeColor: '#083A38',
};

export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CleanFlow' },
  title: 'CleanFlow AI',
  description: 'A plataforma que administra sua empresa de limpeza praticamente sozinha.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}
        <ServiceWorkerSetup /></body>
    </html>
  );
}
