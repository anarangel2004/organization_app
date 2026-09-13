'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chapter } from './types';

interface NotebookSplitViewProps {
  chapter?: Chapter;
  subjectId: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onPdfUpload: (file: File) => void;
  onPdfRemove: () => void;
}

export function NotebookSplitView({
  chapter,
  width,
  onWidthChange,
  onClose,
  onPdfUpload,
  onPdfRemove,
}: NotebookSplitViewProps) {
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(280, Math.min(newWidth, window.innerWidth * 0.8));
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onPdfUpload(e.target.files[0]);
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="relative border-l border-[#D8D5CC] bg-[#EBE8DF] flex flex-col shrink-0 font-mono select-none h-full"
    >
      {/* DIVIDER ARRASTÁVEL */}
      <div
        onMouseDown={startResizing}
        className={`absolute top-0 left-0 bottom-0 w-2 -ml-1 cursor-col-resize z-30 transition-colors ${
          isResizing ? 'bg-[#111111]' : 'hover:bg-[#111111]'
        }`}
        title="Arrastar para redimensionar"
      />

      {/* TOPBAR DO SPLIT VIEW */}
      <div className="h-10 border-b border-[#D8D5CC] px-3 flex items-center justify-between text-[10px] font-bold bg-[#F6F4EE] shrink-0">
        <span className="truncate max-w-[200px] text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-[#111111] inline-block" />
          {chapter?.pdfName ? chapter.pdfName : 'SEM DOCUMENTO ANEXADO'}
        </span>
        <div className="flex items-center gap-2">
          {chapter?.pdfUrl && (
            <button
              type="button"
              onClick={onPdfRemove}
              className="text-[9px] text-[#767571] hover:text-red-600 font-bold uppercase transition-colors cursor-pointer"
            >
              [ REMOVER ]
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-[#111111] hover:text-[#FCF9F2] px-1.5 py-0.5 border border-[#D8D5CC] font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ÁREA DO LEITOR / UPLOADER */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF8F3] w-full h-full">
        {chapter?.pdfUrl ? (
          <div className={`w-full h-full bg-[#111111] flex-1 ${isResizing ? 'pointer-events-none' : ''}`}>
            <iframe
              src={
                chapter.pdfUrl?.startsWith('data:')
                  ? chapter.pdfUrl
                  : `${chapter.pdfUrl}#view=FitH`
              }
              title={chapter.pdfName || 'Documento PDF'}
              className="w-full h-full border-none block"
            />
          </div>
        ) : (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="border border-dashed border-[#111111] p-8 w-full bg-[#F6F4EE] flex flex-col items-center justify-center space-y-4 rounded-none">
              <div className="w-10 h-10 bg-[#111111] text-[#FCF9F2] flex items-center justify-center font-bold text-lg">
                +
              </div>
              <div className="space-y-1">
                <span className="font-bold text-[11px] text-[#111111] block uppercase tracking-wider">
                  ANEXAR SLIDES / PDF
                </span>
                <span className="text-[9px] text-[#767571] block leading-relaxed uppercase">
                  CARREGUE UM FICHEIRO PDF PARA VISUALIZAR AQUI LADO A LADO COM O SEU CADERNO
                </span>
              </div>

              <label className="mt-2 inline-block bg-[#111111] hover:bg-[#31312C] text-[#FCF9F2] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors border border-[#111111] rounded-none">
                [ CARREGAR FICHEIRO PDF ]
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}