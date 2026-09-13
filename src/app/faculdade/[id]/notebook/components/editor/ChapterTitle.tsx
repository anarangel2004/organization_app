'use client';

interface ChapterTitleProps {
  chapterIndexStr: string;
  title: string;
  localTitle: string;
  setLocalTitle: (title: string) => void;
  isEditingTitle: boolean;
  setIsEditingTitle: (isEditing: boolean) => void;
  onUpdateTitle?: (newTitle: string) => void;
  viewMode: 'EDIT' | 'PREVIEW';
  updatedAtFormatted: string;
}

export function ChapterTitle({
  chapterIndexStr,
  title,
  localTitle,
  setLocalTitle,
  isEditingTitle,
  setIsEditingTitle,
  onUpdateTitle,
  viewMode,
  updatedAtFormatted,
}: ChapterTitleProps) {
  return (
    <div className="border-b border-[#D8D5CC] pb-4 mb-6 space-y-2">
      {/* LINHA TÉCNICA SUPERIOR */}
      <div className="flex items-center justify-between font-mono text-[10px] md:text-xs text-[#767571] tracking-widest uppercase select-none">
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[#111111]" />
          CAPÍTULO {chapterIndexStr} // CADERNO ACADÉMICO
        </span>
        <span>ÚLTIMA EDIÇÃO: {updatedAtFormatted}</span>
      </div>

      {/* TÍTULO PRINCIPAL E NÚMERO COM A MESMA FONTE E TAMANHO */}
      <div className="flex items-baseline gap-4 pt-1">
        <span className="font-sans font-black text-4xl md:text-5xl tracking-tight text-[#111111] leading-none shrink-0 select-none">
          {chapterIndexStr}
        </span>

        <div className="flex-1">
          {isEditingTitle && viewMode === 'EDIT' ? (
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                if (localTitle.trim() !== title) {
                  onUpdateTitle?.(localTitle);
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              autoFocus
              className="w-full font-sans font-black text-4xl md:text-5xl uppercase tracking-tight text-[#111111] bg-transparent border-none p-0 focus:outline-none focus:ring-0 leading-none"
            />
          ) : (
            <h1
              onClick={() => {
                if (viewMode === 'EDIT') setIsEditingTitle(true);
              }}
              title={viewMode === 'EDIT' ? 'Clica para editar o título' : ''}
              className={`font-sans font-black text-4xl md:text-5xl uppercase tracking-tight text-[#111111] leading-none ${
                viewMode === 'EDIT' ? 'cursor-pointer hover:opacity-80' : ''
              }`}
            >
              {title ? `${title.toUpperCase()}.` : 'SEM TÍTULO.'}
            </h1>
          )}
        </div>
      </div>
    </div>
  );
}