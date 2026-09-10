import type { Metadata } from 'next';
import { Anton, Hanken_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';

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
      className={`${anton.variable} ${hanken.variable} ${spaceMono.variable}`}
    >
      <body className="bg-[#FCF9F2] text-[#111111] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}