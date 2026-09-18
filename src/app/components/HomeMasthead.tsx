'use client';

import { useState } from 'react';
import Link from 'next/link';
import UserProfileMenu from '@/components/ui/UserProfileMenu';
import { HomeProfileUser, SearchEntry } from './types';

interface HomeMastheadProps {
  editionLabel: string;
  todayFormatted: string;
  searchIndex: SearchEntry[];
  profileUser: HomeProfileUser | null;
  onOpenProfileModal: () => void;
}

// Capa da página principal: identificador de secção + edição, pesquisa
// sobre os dados já carregados, atalho "Novo Dossiê" e o menu de perfil.
export function HomeMasthead({
  editionLabel,
  todayFormatted,
  searchIndex,
  profileUser,
  onOpenProfileModal,
}: HomeMastheadProps) {
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 6);
  })();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D8D5CC] pb-4">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-[#111111] inline-block"></span>
          SECÇÃO 00 // CAPA — {editionLabel}
        </span>

        <div className="flex items-center gap-3 flex-wrap">
          {/* PESQUISA */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="PESQUISAR AGENDA..."
              className="bg-white border border-[#D8D5CC] px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest focus:outline-none focus:border-[#111111] w-44"
            />
            {searchQuery.trim() && (
              <div className="absolute z-20 top-full left-0 mt-1 w-72 bg-white border border-[#111111] max-h-72 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((entry) => (
                    <Link
                      key={entry.id}
                      href={entry.href}
                      className="block px-3 py-2 border-b border-[#D8D5CC] last:border-b-0 hover:bg-[#F6F3EC]"
                      onClick={() => setSearchQuery('')}
                    >
                      <div className="font-mono text-[10px] tracking-widest text-[#767571] uppercase">
                        {entry.sublabel}
                      </div>
                      <div className="text-[12px] font-bold uppercase truncate">{entry.label}</div>
                    </Link>
                  ))
                ) : (
                  <div className="px-3 py-3 font-mono text-[10px] text-[#767571] uppercase">
                    SEM RESULTADOS
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NOVO DOSSIÊ */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNewMenuOpen((v) => !v)}
              className="bg-[#111111] text-[#FCF9F2] px-4 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase hover:bg-[#767571] transition-colors"
            >
              + NOVO DOSSIÊ
            </button>
            {isNewMenuOpen && (
              <div className="absolute z-20 top-full right-0 mt-1 w-52 bg-white border border-[#111111]">
                <Link
                  href="/faculdade"
                  className="block px-3 py-2.5 border-b border-[#D8D5CC] font-mono text-[10px] tracking-widest uppercase hover:bg-[#F6F3EC]"
                  onClick={() => setIsNewMenuOpen(false)}
                >
                  NOVA DISCIPLINA →
                </Link>
                <Link
                  href="/trabalho"
                  className="block px-3 py-2.5 font-mono text-[10px] tracking-widest uppercase hover:bg-[#F6F3EC]"
                  onClick={() => setIsNewMenuOpen(false)}
                >
                  NOVO PROJETO / TAREFA →
                </Link>
              </div>
            )}
          </div>

          <UserProfileMenu user={profileUser} onOpenProfileModal={onOpenProfileModal} />
        </div>
      </div>

      <h1 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em] pt-2">
        HOJE.
      </h1>
      <p className="font-mono text-[11px] tracking-[0.1em] text-[#767571] uppercase">{todayFormatted}</p>
    </section>
  );
}
