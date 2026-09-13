'use client';

import { useState } from 'react';
import { Chapter, NotebookTab } from './types';

interface NotebookSidebarProps {
  chapters: Chapter[];
  selectedChapterId: string;
  onSelectChapter: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: NotebookTab;
  onAddChapter: (title: string) => void;
  onDeleteChapter: (id: string) => void;
}

export function NotebookSidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  searchQuery,
  onSearchChange,
  activeTab,
  onAddChapter,
  onDeleteChapter,
}: NotebookSidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddChapter(newTitle.trim());
    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <aside className="w-72 border-r border-[#D8D5CC] flex flex-col bg-[#F6F4EE] shrink-0 font-mono select-none">
      {/* PESQUISA */}
      <div className="p-4 border-b border-[#D8D5CC] space-y-2.5">
        <h2 className="text-[10px] font-bold tracking-widest text-[#767571] uppercase flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-[#111111]" />
          ÍNDICE DE CAPÍTULOS
        </h2>
        <input
          type="text"
          placeholder="[ PESQUISAR NO NOTEBOOK... ]"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#EBE8DF] border border-[#D8D5CC] p-2 text-[10px] focus:outline-none focus:border-[#111111] focus:bg-[#FAF8F3] placeholder-[#A1A09A] uppercase font-mono rounded-none"
        />
      </div>

      {/* LISTA DE CAPÍTULOS */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#D8D5CC]">
        {chapters.length === 0 ? (
          <div className="p-4 text-[10px] text-[#767571] uppercase">
            Sem capítulos em {activeTab.toLowerCase()}.
          </div>
        ) : (
          chapters.map((chap) => {
            const isSelected = selectedChapterId === chap.id;
            return (
              <div
                key={chap.id}
                className={`group relative w-full p-3.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#EBE8DF] border-l-4 border-l-[#111111]'
                    : 'hover:bg-[#EBE8DF]/60'
                }`}
                onClick={() => onSelectChapter(chap.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-[#111111] uppercase line-clamp-1">
                    {chap.number} // {chap.title}
                  </div>
                  <button
                    type="button"
                    title="Apagar Capítulo"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Tem a certeza que deseja apagar "${chap.title}"?`)) {
                        onDeleteChapter(chap.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-red-600 hover:bg-red-600 hover:text-white px-1 transition-opacity cursor-pointer"
                  >
                    [ APAGAR ]
                  </button>
                </div>

                <div className="flex justify-between items-center text-[9px] text-[#767571] mt-2">
                  <span>EDITADO: {chap.updatedAt}</span>
                  {isSelected && (
                    <span className="font-extrabold text-[#111111] uppercase tracking-wider">[ ATIVO ]</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FORMULÁRIO DE NOVO CAPÍTULO */}
      <div className="p-3 border-t border-[#D8D5CC] bg-[#F6F4EE]">
        {!isAdding ? (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full bg-[#111111] text-[#FCF9F2] py-2.5 px-4 text-[10px] font-bold tracking-widest hover:bg-[#31312C] transition-colors uppercase cursor-pointer rounded-none border border-[#111111]"
          >
            + NOVO CAPÍTULO
          </button>
        ) : (
          <form
            onSubmit={handleFormSubmit}
            className="bg-[#111111] text-[#FCF9F2] p-3 border border-[#111111] text-[10px] space-y-2.5 uppercase rounded-none"
          >
            <div className="flex justify-between items-center border-b border-[#31312C] pb-1.5">
              <span className="font-bold text-[#FCF9F2] text-[9.5px] tracking-wider">
                NOVO CAPÍTULO ({activeTab})
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-[8.5px] text-[#A1A09A] hover:text-[#FCF9F2] cursor-pointer"
              >
                [ X ]
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold text-[#A1A09A] tracking-wider">
                TÍTULO DO CAPÍTULO
              </label>
              <input
                type="text"
                autoFocus
                placeholder="EX: CRIPTOGRAFIA DE BLOCO"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px] rounded-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2 py-1 text-[#A1A09A] hover:text-[#FCF9F2] text-[9px] font-bold cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#FCF9F2] text-[#111111] hover:bg-[#E5E2D9] text-[9px] font-bold cursor-pointer transition-colors rounded-none"
              >
                CRIAR
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}