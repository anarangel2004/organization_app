'use client';

import { useState, useEffect } from 'react';
import { PaperStyle } from '@/types';

export type ActiveTool = 'TEXT' | 'PEN' | 'HIGHLIGHTER' | 'ERASER';
export type EraserType = 'SMALL' | 'LARGE' | 'OBJECT';

interface EditorToolbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  penColor: string;
  setPenColor: (color: string) => void;
  penSize: number;
  setPenSize: (size: number) => void;
  eraserType: EraserType;
  setEraserType: (type: EraserType) => void;
  execFormat?: (command: string, value?: string) => void;
  executeCommand?: (command: string, value?: string) => void;
  applyHeading?: (tag: string) => void;

  viewMode?: 'EDIT' | 'PREVIEW';
  setViewMode?: (mode: 'EDIT' | 'PREVIEW') => void;
  paperStyle?: PaperStyle;
  onPaperStyleChange?: (style: PaperStyle) => void;

  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const COLORS = [
  { hex: '#111111', name: 'Preto' },
  { hex: '#1D4ED8', name: 'Azul' },
  { hex: '#B91C1C', name: 'Vermelho' },
  { hex: '#047857', name: 'Verde' },
];

const PEN_SIZES = [
  { size: 0.5, label: '0.5MM' },
  { size: 1, label: '1.0MM' },
  { size: 2, label: '2.0MM' },
  { size: 4, label: '4.0MM' },
];

const ERASER_TYPES: { type: EraserType; label: string }[] = [
  { type: 'SMALL', label: 'PEQUENA' },
  { type: 'LARGE', label: 'GRANDE' },
  { type: 'OBJECT', label: 'OBJECTO' },
];

export function EditorToolbar({
  activeTool,
  setActiveTool,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  eraserType,
  setEraserType,
  execFormat,
  executeCommand,
  applyHeading,
  viewMode = 'EDIT',
  setViewMode,
  paperStyle,
  onPaperStyleChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: EditorToolbarProps) {
  const [isLinkSelected, setIsLinkSelected] = useState(false);
  const [isBoldSelected, setIsBoldSelected] = useState(false);
  const [isItalicSelected, setIsItalicSelected] = useState(false);
  const [isListSelected, setIsListSelected] = useState(false);
  const [currentBlockTag, setCurrentBlockTag] = useState<'h2' | 'h3' | 'p'>('p');

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setIsLinkSelected(false);
        setIsBoldSelected(false);
        setIsItalicSelected(false);
        setIsListSelected(false);
        return;
      }

      const anchor = sel.anchorNode;
      if (!anchor) {
        setIsLinkSelected(false);
        setIsBoldSelected(false);
        setIsItalicSelected(false);
        setIsListSelected(false);
        return;
      }

      const element =
        anchor.nodeType === Node.ELEMENT_NODE
          ? (anchor as HTMLElement)
          : anchor.parentElement;

      const linkElement = element?.closest('a');
      setIsLinkSelected(!!linkElement);

      try {
        setIsBoldSelected(
          document.queryCommandState('bold') || !!element?.closest('b, strong')
        );
        setIsItalicSelected(
          document.queryCommandState('italic') || !!element?.closest('i, em')
        );
        setIsListSelected(
          document.queryCommandState('insertUnorderedList') || !!element?.closest('ul, li')
        );
      } catch {
        setIsBoldSelected(!!element?.closest('b, strong'));
        setIsItalicSelected(!!element?.closest('i, em'));
        setIsListSelected(!!element?.closest('ul, li'));
      }

      if (element) {
        const heading2 = element.closest('h2');
        const heading3 = element.closest('h3');

        if (heading2) {
          setCurrentBlockTag('h2');
        } else if (heading3) {
          setCurrentBlockTag('h3');
        } else {
          setCurrentBlockTag('p');
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const runCommand = (command: string, value?: string) => {
    if (execFormat) {
      execFormat(command, value);
    } else if (executeCommand) {
      executeCommand(command, value);
    }
  };

  const forceApplyBlock = (targetTag: 'h2' | 'h3' | 'p') => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node = sel.anchorNode;
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    const element = node as HTMLElement;
    const editor = element.closest('[contenteditable="true"]');
    if (!editor) return;

    const currentBlock = element.closest('h2, h3, p, div') || element;

    if (currentBlock && currentBlock !== editor) {
      const newElem = document.createElement(targetTag);
      newElem.innerHTML = currentBlock.innerHTML;
      currentBlock.parentNode?.replaceChild(newElem, currentBlock);
    } else {
      runCommand('formatBlock', `<${targetTag.toUpperCase()}>`);
    }

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    setCurrentBlockTag(targetTag);
  };

  const handleHeadingClick = (tag: 'h2' | 'h3' | 'p') => {
    if (applyHeading) {
      applyHeading(tag);
      setCurrentBlockTag(tag);
    } else {
      forceApplyBlock(tag);
    }
  };

  const handleAddInternalLink = () => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      alert('Por favor, seleciona primeiro o texto que queres transformar em link!');
      return;
    }

    const input = prompt('Insira o número da página do PDF (ex: 3) ou ID de destino:');
    if (!input) return;

    const trimmed = input.trim();
    const linkHref = /^\d+$/.test(trimmed) ? `#page=${trimmed}` : `#${trimmed.replace('#', '')}`;

    runCommand('createLink', linkHref);
  };

  const handleRemoveLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const anchor = sel.anchorNode;
    const element =
      anchor?.nodeType === Node.ELEMENT_NODE
        ? (anchor as HTMLElement)
        : anchor?.parentElement;

    const linkElement = element?.closest('a');

    if (linkElement) {
      const editorDiv = linkElement.closest('[contenteditable="true"]');
      const parent = linkElement.parentNode;
      while (linkElement.firstChild) {
        parent?.insertBefore(linkElement.firstChild, linkElement);
      }
      parent?.removeChild(linkElement);

      if (editorDiv) {
        editorDiv.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    setIsLinkSelected(false);
  };

  return (
    <div className="sticky top-0 z-40 bg-[#EBE8DF] border-b border-[#D8D5CC] font-mono text-[10px] select-none no-print px-4 h-12 flex items-center justify-between gap-4 overflow-x-auto overflow-y-hidden">
      <div className="flex items-center gap-3 shrink-0">
        {setViewMode && (
          <div className="flex items-center border border-[#111111] bg-[#E2DFD6] p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('EDIT')}
              className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                viewMode === 'EDIT'
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              EDIÇÃO
            </button>
            <button
              onClick={() => setViewMode('PREVIEW')}
              className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                viewMode === 'PREVIEW'
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              REVIEW
            </button>
          </div>
        )}

        <span className="text-[#D8D5CC]">|</span>

        <div className="flex items-center gap-1 shrink-0">
          {(['TEXT', 'PEN', 'HIGHLIGHTER', 'ERASER'] as ActiveTool[]).map((tool) => {
            const labels: Record<ActiveTool, string> = {
              TEXT: 'TEXTO',
              PEN: 'CANETA',
              HIGHLIGHTER: 'MARCADOR',
              ERASER: 'BORRACHA',
            };
            const isActive = activeTool === tool && viewMode === 'EDIT';

            return (
              <button
                key={tool}
                disabled={viewMode === 'PREVIEW'}
                onClick={() => setActiveTool(tool)}
                className={`px-2.5 py-1 font-bold uppercase border border-[#111111] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive ? 'bg-[#111111] text-[#FCF9F2]' : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
                }`}
              >
                {labels[tool]}
              </button>
            );
          })}
        </div>

        {/* SETAS DE UNDO / REDO QUANDO FERRAMENTAS DE DESENHO ESTÃO ATIVAS */}
        {activeTool !== 'TEXT' && viewMode === 'EDIT' && (
          <>
            <span className="text-[#D8D5CC]">|</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="px-2 py-1 font-bold border border-[#111111] bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Desfazer Desenho (Ctrl+Z)"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="px-2 py-1 font-bold border border-[#111111] bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Refazer Desenho (Ctrl+Y / Cmd+Shift+Z)"
              >
                ↷
              </button>
            </div>
          </>
        )}

        <span className="text-[#D8D5CC]">|</span>

        {activeTool === 'TEXT' && viewMode === 'EDIT' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleHeadingClick('h2')}
              className={`px-2.5 py-1 border border-[#111111] font-bold uppercase transition-colors ${
                currentBlockTag === 'h2'
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              TÍTULO
            </button>
            <button
              onClick={() => handleHeadingClick('h3')}
              className={`px-2.5 py-1 border border-[#111111] font-bold uppercase transition-colors ${
                currentBlockTag === 'h3'
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              SUBTÍTULO
            </button>
            <button
              onClick={() => handleHeadingClick('p')}
              className={`px-2.5 py-1 border border-[#111111] font-bold uppercase transition-colors ${
                currentBlockTag === 'p'
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              NORMAL
            </button>

            <span className="text-[#D8D5CC] mx-0.5">|</span>

            <button
              onClick={() => runCommand('bold')}
              className={`px-2 py-1 border border-[#111111] font-extrabold uppercase transition-colors ${
                isBoldSelected
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              NEGRITO
            </button>
            <button
              onClick={() => runCommand('italic')}
              className={`px-2 py-1 border border-[#111111] italic font-bold uppercase transition-colors ${
                isItalicSelected
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              ITÁLICO
            </button>
            <button
              onClick={() => runCommand('insertUnorderedList')}
              className={`px-2 py-1 border border-[#111111] font-bold uppercase transition-colors ${
                isListSelected
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              LISTA
            </button>
            <button
              onClick={() => runCommand('insertHTML', '<input type="checkbox" class="mr-2 accent-[#111111]" />&nbsp;')}
              className="px-2 py-1 bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC] border border-[#111111] font-bold uppercase transition-colors"
            >
              CHECKLIST
            </button>
            <button
              onClick={handleAddInternalLink}
              className={`px-2 py-1 border border-[#111111] font-bold uppercase transition-colors ${
                isLinkSelected
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : 'bg-[#E2DFD6] text-[#111111] hover:bg-[#D8D5CC]'
              }`}
            >
              LINK
            </button>

            {isLinkSelected && (
              <button
                onClick={handleRemoveLink}
                className="px-2 py-1 bg-[#B91C1C] text-[#FCF9F2] hover:bg-[#991B1B] border border-[#B91C1C] font-bold uppercase transition-colors"
              >
                ✕ REMOVER LINK
              </button>
            )}
          </div>
        )}

        {(activeTool === 'PEN' || activeTool === 'HIGHLIGHTER') && viewMode === 'EDIT' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[#767571] font-bold uppercase mr-1">TRAÇO:</span>
            {PEN_SIZES.map((ps) => (
              <button
                key={ps.size}
                onClick={() => setPenSize(ps.size)}
                className={`px-2 py-1 font-bold uppercase border transition-colors ${
                  penSize === ps.size
                    ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                    : 'bg-[#E2DFD6] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
                }`}
              >
                {ps.label}
              </button>
            ))}
          </div>
        )}

        {activeTool === 'ERASER' && viewMode === 'EDIT' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[#767571] font-bold uppercase mr-1">TAMANHO:</span>
            {ERASER_TYPES.map((et) => (
              <button
                key={et.type}
                onClick={() => setEraserType(et.type)}
                className={`px-2 py-1 font-bold uppercase border transition-colors ${
                  eraserType === et.type
                    ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                    : 'bg-[#E2DFD6] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>
        )}

        {activeTool !== 'ERASER' && viewMode === 'EDIT' && (
          <>
            <span className="text-[#D8D5CC]">|</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[#767571] font-bold uppercase">COR:</span>
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      setPenColor(c.hex);
                      runCommand('foreColor', c.hex);
                    }}
                    style={{ backgroundColor: c.hex }}
                    className={`w-4 h-4 rounded-none border transition-transform ${
                      penColor === c.hex ? 'ring-2 ring-[#111111] ring-offset-1 scale-110' : 'border-[#111111]'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {onPaperStyleChange && (
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <span className="text-[#767571] font-bold uppercase mr-1">PÁGINA:</span>
          {(['PAUTADO', 'QUADRICULA', 'LISO'] as const).map((style) => (
            <button
              key={style}
              onClick={() => onPaperStyleChange(style)}
              className={`px-2 py-1 font-bold uppercase border transition-colors ${
                paperStyle === style
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'bg-[#E2DFD6] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}