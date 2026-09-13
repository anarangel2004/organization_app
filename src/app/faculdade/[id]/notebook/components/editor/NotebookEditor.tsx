'use client';

import { useState, useEffect } from 'react';
import { Chapter, NotebookTab, PaperStyle } from '../types';
import { EditorToolbar } from './EditorToolbar';
import { ChapterTitle } from './ChapterTitle';
import { DrawingCanvas } from './DrawingCanvas';

interface NotebookEditorProps {
  chapter?: Chapter & {
    updatedAt?: string | Date;
    lastEdited?: string | Date;
    drawingData?: string;
    drawing?: string;
  };
  paperStyle: PaperStyle;
  activeTab: NotebookTab;
  onUpdateContent?: (content: string) => void;
  onUpdateTitle?: (title: string) => void;
  onUpdateDrawing?: (drawingData: string) => void;
}

type ActiveTool = 'TEXT' | 'PEN' | 'HIGHLIGHTER' | 'ERASER';
type EraserType = 'SMALL' | 'LARGE' | 'OBJECT';

export function NotebookEditor({
  chapter,
  paperStyle,
  activeTab,
  onUpdateContent,
  onUpdateTitle,
  onUpdateDrawing,
}: NotebookEditorProps) {
  const [localTitle, setLocalTitle] = useState(chapter?.title || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [activeTool, setActiveTool] = useState<ActiveTool>('TEXT');

  const [penColor, setPenColor] = useState<string>('#111111');
  const [penSize, setPenSize] = useState<number>(3);
  const [eraserType, setEraserType] = useState<EraserType>('SMALL');

  useEffect(() => {
    setLocalTitle(chapter?.title || '');
  }, [chapter?.id, chapter?.title]);

  const formatLastEdited = (dateInput?: string | Date) => {
    if (!dateInput) return 'Hoje às 13:28';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    const dateStr = date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} às ${timeStr}`;
  };

  const execFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
  };

  const applyHeading = (tag: string) => execFormat('formatBlock', `<${tag}>`);

  const applyFontSize = (sizePx: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = sizePx;
    span.appendChild(range.extractContents());
    range.insertNode(span);
  };

  const chapterIndexStr = chapter?.number
    ? String(chapter.number).padStart(2, '0')
    : '00';

  return (
    <main className="flex-1 flex flex-col bg-[#FAF8F3] overflow-y-auto border-r border-[#D8D5CC] relative">
      <EditorToolbar
        chapterIndexStr={chapterIndexStr}
        category={chapter?.category}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        penColor={penColor}
        setPenColor={setPenColor}
        penSize={penSize}
        setPenSize={setPenSize}
        eraserType={eraserType}
        setEraserType={setEraserType}
        execFormat={execFormat}
        applyHeading={applyHeading}
        applyFontSize={applyFontSize}
      />

      <div className="flex-1 p-8 md:p-12 max-w-4xl mx-auto w-full space-y-4">
        {chapter ? (
          <>
            <ChapterTitle
              chapterIndexStr={chapterIndexStr}
              title={chapter.title}
              localTitle={localTitle}
              setLocalTitle={setLocalTitle}
              isEditingTitle={isEditingTitle}
              setIsEditingTitle={setIsEditingTitle}
              onUpdateTitle={onUpdateTitle}
              viewMode={viewMode}
              updatedAtFormatted={formatLastEdited(
                chapter.updatedAt || chapter.lastEdited
              )}
            />

            <DrawingCanvas
              chapterId={chapter.id}
              chapterContent={chapter.content}
              drawingDataRaw={chapter.drawingData || chapter.drawing}
              paperStyle={paperStyle}
              viewMode={viewMode}
              activeTool={activeTool}
              penColor={penColor}
              penSize={penSize}
              eraserType={eraserType}
              onUpdateContent={onUpdateContent}
              onUpdateDrawing={onUpdateDrawing}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center font-mono space-y-4">
            <div className="border border-[#D8D5CC] bg-[#EBE8DF] p-8 max-w-md w-full space-y-3">
              <div className="w-8 h-8 bg-[#111111] text-[#FCF9F2] flex items-center justify-center font-bold mx-auto text-sm">
                !
              </div>
              <span className="font-bold text-xs text-[#111111] uppercase block tracking-wider">
                SEM CAPÍTULOS EM {activeTab}
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}