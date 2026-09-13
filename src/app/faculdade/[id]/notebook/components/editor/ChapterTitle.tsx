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
    <div className="border-b border-[#D8D5CC] pb-3 mb-4 space-y-1">
      <div className="flex items-baseline gap-3">
        {/* NÚMERO COM LINING-NUMS E TRACKING-TIGHT IDENTICO AO TÍTULO */}
        <span className="font-serif lining-nums text-3xl md:text-4xl font-bold text-[#111111] shrink-0 select-none tracking-tight">
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
              className="w-full font-serif lining-nums text-3xl md:text-4xl font-bold text-[#111111] tracking-tight bg-transparent border-none p-0 focus:outline-none focus:ring-0"
            />
          ) : (
            <h1
              onClick={() => {
                if (viewMode === 'EDIT') setIsEditingTitle(true);
              }}
              title={viewMode === 'EDIT' ? 'Clica para editar o título' : ''}
              className={`font-serif lining-nums text-3xl md:text-4xl font-bold text-[#111111] tracking-tight ${
                viewMode === 'EDIT' ? 'cursor-pointer hover:opacity-75' : ''
              }`}
            >
              {title || 'Sem título'}
            </h1>
          )}
        </div>
      </div>

      <div className="font-mono text-[10px] text-[#767571] tracking-wider uppercase">
        Última edição: {updatedAtFormatted}
      </div>
    </div>
  );
}