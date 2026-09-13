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
    <header className="h-12 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[11px] font-mono shrink-0">
      <div className="flex items-center gap-3 font-bold">
        <Link
          href={`/faculdade/${subjectId}`}
          className="hover:opacity-70 transition-opacity uppercase text-[#767571] flex items-center gap-1"
        >
          ← VOLTAR
        </Link>
        <span className="text-[#D8D5CC]">|</span>
        <span className="text-[#767571] uppercase">FACULDADE</span>
        <span className="text-[#D8D5CC]">//</span>
        <span className="text-[#767571] uppercase">CADERNO</span>
        <span className="text-[#D8D5CC]">//</span>

        {/* BOTÕES DAS ABAS */}
        <div className="flex items-center gap-1 bg-[#EBE8DF] p-0.5 border border-[#D8D5CC]">
          {(['TEORICAS', 'PRATICAS', 'TESTES'] as NotebookTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'text-[#767571] hover:text-[#111111]'
              }`}
            >
              {tab === 'TEORICAS' ? 'TEÓRICAS' : tab === 'PRATICAS' ? 'PRÁTICAS' : 'TESTES'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px]">
        <div className="hidden sm:flex items-center gap-2 text-[#767571]">
          <span className="w-2 h-2 bg-green-600 inline-block"></span>
          <span>IPAD PRO VINCULADO</span>
          <span>·</span>
          <span>100% SINCRONIZADO</span>
        </div>

        <button className="bg-[#EBE8DF] hover:bg-[#111111] hover:text-[#FCF9F2] px-3 py-1.5 border border-[#D8D5CC] font-bold uppercase transition-colors cursor-pointer">
          EXPORTAR PDF
        </button>
      </div>
    </header>
  );
}