'use client';

import Link from 'next/link';
import { NotebookTab } from './types';

interface NotebookHeaderProps {
  subjectId: string;
  activeTab: NotebookTab;
  onTabChange: (tab: NotebookTab) => void;
}

export function NotebookHeader({
  subjectId,
  activeTab,
  onTabChange,
}: NotebookHeaderProps) {
  return (
    <header className="h-12 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
      <div className="flex items-center gap-3 font-bold">
        <Link
          href={`/faculdade/${subjectId}`}
          className="hover:bg-[#111111] hover:text-[#FCF9F2] px-2 py-1 border border-[#D8D5CC] transition-colors uppercase text-[#111111] flex items-center gap-1"
        >
          ← VOLTAR
        </Link>
        <span className="text-[#D8D5CC]">//</span>
        <span className="text-[#767571] uppercase tracking-wider">FACULDADE</span>
        <span className="text-[#D8D5CC]">//</span>
        <span className="text-[#111111] uppercase tracking-wider font-extrabold">CADERNO</span>

        {/* BOTÕES DAS ABAS */}
        <div className="flex items-center gap-1 bg-[#EBE8DF] p-0.5 border border-[#D8D5CC] ml-2">
          {(['TEORICAS', 'PRATICAS', 'TESTES'] as NotebookTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer rounded-none border ${
                activeTab === tab
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'text-[#767571] border-transparent hover:text-[#111111]'
              }`}
            >
              {tab === 'TEORICAS' ? 'TEÓRICAS' : tab === 'PRATICAS' ? 'PRÁTICAS' : 'TESTES'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px]">
        <div className="hidden sm:flex items-center gap-2 text-[#767571] font-mono">
          <span className="w-2 h-2 bg-[#111111] inline-block"></span>
          <span>IPAD PRO VINCULADO</span>
          <span className="text-[#D8D5CC]">//</span>
          <span className="text-[#111111] font-bold">100% SINCRONIZADO</span>
        </div>

        <button className="bg-[#111111] text-[#FCF9F2] hover:bg-[#31312C] px-3.5 py-1.5 font-bold uppercase transition-colors cursor-pointer rounded-none border border-[#111111] tracking-wider">
          [ EXPORTAR PDF ]
        </button>
      </div>
    </header>
  );
}