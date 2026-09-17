'use client';

import { PaperStyle } from './types';

interface NotebookToolbarProps {
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  isSplitViewOpen: boolean;
  onToggleSplitView: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function NotebookToolbar({
  paperStyle,
  onPaperStyleChange,
  isSplitViewOpen,
  onToggleSplitView,
  isSidebarOpen,
  onToggleSidebar,
}: NotebookToolbarProps) {
  return (
    <div className="h-10 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[10px] font-mono shrink-0 select-none">
      <div className="flex items-center gap-3">
        {/* BOTÃO DO ÍNDICE */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`font-bold border px-2.5 py-1 transition-colors cursor-pointer uppercase rounded-none ${
            isSidebarOpen
              ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
              : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2]'
          }`}
        >
          [ ÍNDICE ]
        </button>

        <span className="text-[#D8D5CC]">{'//'}</span>

        <button type="button" className="flex items-center gap-1 font-bold hover:text-[#767571] cursor-pointer uppercase">
          <span>TEXTO</span>
        </button>
        <span className="text-[#D8D5CC]">{'//'}</span>
        <button type="button" className="hover:text-[#767571] cursor-pointer font-bold uppercase">TRAÇO 0.5MM</button>
        <span className="text-[#D8D5CC]">{'//'}</span>

        {/* ESTILO DE PÁGINA */}
        <div className="flex items-center gap-2">
          <span className="text-[#767571] font-bold">PÁGINA:</span>
          <div className="flex items-center gap-1 bg-[#EBE8DF] p-0.5 border border-[#D8D5CC]">
            {(['PAUTADO', 'QUADRICULA', 'LISO'] as PaperStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onPaperStyleChange(style)}
                className={`px-2 py-0.5 font-bold uppercase cursor-pointer rounded-none transition-colors ${
                  paperStyle === style
                    ? 'bg-[#111111] text-[#FCF9F2]'
                    : 'text-[#767571] hover:text-[#111111]'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SPLIT VIEW BUTTON */}
      <button
        type="button"
        onClick={onToggleSplitView}
        className={`font-bold border px-2.5 py-1 transition-colors cursor-pointer uppercase rounded-none ${
          isSplitViewOpen
            ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
            : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2]'
        }`}
      >
        [ SPLIT VIEW ]
      </button>
    </div>
  );
}