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
    <div className="h-10 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[10px] font-mono shrink-0">
      <div className="flex items-center gap-3">
        {/* BOTÃO DO ÍNDICE: ESCURO SE ABERTO, CLARO SE FECHADO */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`font-bold border px-2 py-0.5 transition-colors cursor-pointer uppercase ${
            isSidebarOpen
              ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
              : 'bg-transparent text-[#111111] border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2]'
          }`}
        >
          ÍNDICE
        </button>

        <span className="text-[#D8D5CC]">|</span>

        <button type="button" className="flex items-center gap-1 font-bold hover:text-[#767571] cursor-pointer">
          <span>T</span> TEXTO
        </button>
        <span className="text-[#D8D5CC]">|</span>
        <button type="button" className="hover:text-[#767571] cursor-pointer">TRAÇO 0.5MM</button>
        <span className="text-[#D8D5CC]">|</span>

        <div className="flex items-center gap-2">
          <span className="text-[#767571]">PÁGINA:</span>
          {(['PAUTADO', 'QUADRICULA', 'LISO'] as PaperStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onPaperStyleChange(style)}
              className={`px-1.5 py-0.5 font-bold uppercase cursor-pointer ${
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

      <button
        type="button"
        onClick={onToggleSplitView}
        className={`font-bold border px-2 py-0.5 transition-colors cursor-pointer uppercase ${
          isSplitViewOpen
            ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
            : 'bg-transparent text-[#111111] border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2]'
        }`}
      >
        SPLIT VIEW
      </button>
    </div>
  );
}