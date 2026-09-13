'use client';

import { Chapter, NotebookTab } from './types';

interface NotebookSidebarProps {
  chapters: Chapter[];
  selectedChapterId?: string;
  onSelectChapter: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab?: NotebookTab;
  onAddChapter: (title?: string) => void;
  onDeleteChapter?: (id: string) => void;
}

export function NotebookSidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  searchQuery,
  onSearchChange,
  activeTab = 'TEORICAS',
  onAddChapter,
  onDeleteChapter,
}: NotebookSidebarProps) {
  return (
    <aside className="w-64 h-full bg-[#F6F4EE] border-r border-[#D8D5CC] flex flex-col justify-between select-none font-mono no-print">
      {/* PARTE SUPERIOR: ÍNDICE E PESQUISA */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="text-[10px] tracking-wider text-[#767571] font-bold uppercase mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#111111] inline-block" />
            CAPÍTULOS ({activeTab})
          </span>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="[ PESQUISAR NO NOTEBOOK... ]"
          className="w-full bg-[#EBE8DF] border border-[#D8D5CC] px-2.5 py-1.5 text-[10px] uppercase font-mono placeholder-[#767571] focus:outline-none focus:border-[#111111] mb-4"
        />

        {/* LISTA DE CAPÍTULOS */}
        <div className="space-y-1">
          {chapters.length === 0 ? (
            <div className="text-[10px] text-[#767571] p-2 text-center border border-dashed border-[#D8D5CC]">
              SEM CAPÍTULOS
            </div>
          ) : (
            chapters.map((chapter) => {
              const isSelected = chapter.id === selectedChapterId;
              const chapterNum = String(chapter.number || 1).padStart(2, '0');

              return (
                <div
                  key={chapter.id}
                  className={`group relative flex items-center justify-between p-2.5 text-[11px] font-mono transition-all border ${
                    isSelected
                      ? 'bg-[#EBE8DF] border-[#111111] font-bold'
                      : 'border-transparent hover:bg-[#EBE8DF] text-[#767571] hover:text-[#111111]'
                  }`}
                >
                  <button
                    onClick={() => onSelectChapter(chapter.id)}
                    className="flex-1 text-left overflow-hidden mr-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="uppercase text-[#111111] truncate">
                        {chapterNum} // {chapter.title}
                      </span>
                      {chapter.isCompleted && (
                        <span className="text-[9px] bg-[#111111] text-[#FCF9F2] px-1 font-bold shrink-0">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-[#767571] mt-1">
                      <span>EDITADO: {chapter.updatedAt || '14:01'}</span>
                      {isSelected && <span className="text-[#111111] font-bold">[ ATIVO ]</span>}
                    </div>
                  </button>

                  {/* BOTÃO PARA APAGAR CAPÍTULO */}
                  {onDeleteChapter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Eliminar o capítulo "${chapter.title}"?`)) {
                          onDeleteChapter(chapter.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[#B91C1C] hover:bg-[#B91C1C] hover:text-white px-1.5 py-0.5 text-[9px] font-bold transition-all"
                      title="Apagar Capítulo"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PARTE INFERIOR: BOTÃO FIXO DE NOVO CAPÍTULO */}
      <div className="p-3 border-t border-[#D8D5CC] bg-[#F6F4EE]">
        <button
          onClick={() => onAddChapter()}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[10px] font-bold tracking-wider text-[#FCF9F2] bg-[#111111] border border-[#111111] hover:bg-[#EBE8DF] hover:text-[#111111] transition-colors uppercase font-mono"
        >
          <span>+ NOVO CAPÍTULO</span>
        </button>
      </div>
    </aside>
  );
}