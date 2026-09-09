import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Organiza.me - Dashboard',
  description: 'Gestão centrada de Mestrado em Cibersegurança e Projetos SAP',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col md:flex-row antialiased`}
        suppressHydrationWarning
      >
        <Sidebar />
        <main className="flex-1 p-6 md:p-10 w-full overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}