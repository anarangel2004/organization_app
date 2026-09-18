'use client';

import Link from 'next/link';

// Rodapé da página principal.
export function HomeFooter() {
  return (
    <footer className="border-t border-[#D8D5CC] mt-20 py-8 text-[#767571] font-mono text-[10px] tracking-widest uppercase bg-[#FCF9F2]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>© 2026 ATELIER AGENDA - CATALOGUE SYSTEM V.04 // ALL RIGHTS RESERVED</div>
        <div className="flex space-x-6">
          <Link href="/faculdade" className="hover:text-[#111111] transition-colors">
            FACULDADE
          </Link>
          <Link href="/trabalho" className="hover:text-[#111111] transition-colors">
            TRABALHO
          </Link>
        </div>
      </div>
    </footer>
  );
}
