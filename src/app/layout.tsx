import type { Metadata } from 'next';
import { Anton, Hanken_Grotesk, Instrument_Sans, Newsreader, Space_Mono } from 'next/font/google';
import './globals.css';
import SWRegister from '@/components/SWRegister';
import OfflineIndicator from '@/components/OfflineIndicator';

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

// Serifa editorial do painel da página principal (títulos, números, itálicos).
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

// Sans da página de cada disciplina (design "SSC — denso").
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Organiza-me // Faculdade',
  description: 'Dossié Curricular',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt"
      // Extensões do browser acrescentam atributos ao <html> antes do React carregar.
      suppressHydrationWarning
      className={`${anton.variable} ${hanken.variable} ${newsreader.variable} ${instrument.variable} ${spaceMono.variable}`}
    >
      <body className="bg-[#FCF9F2] text-[#111111] font-sans antialiased" suppressHydrationWarning>
        <SWRegister />
        {children}
        <OfflineIndicator />
      </body>
    </html>
  );
}