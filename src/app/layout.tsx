import './globals.css';

export const metadata = {
  title: 'Atelier Agenda',
  description: 'Gestão de tarefas e projetos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="antialiased min-h-screen bg-[#f7f6f2]">
        <main className="w-full">
          {children}
        </main>
      </body>
    </html>
  );
}