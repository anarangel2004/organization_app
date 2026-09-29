'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import c from './caderno.module.css';
import { DrawingCanvas, DrawingCanvasRef } from './editor/DrawingCanvas';
import {
  Chapter,
  EditorStats,
  EraserType,
  MARKER_INKS,
  MARKER_WIDTHS,
  NoteMode,
  OutlineItem,
  PaperStyle,
  PEN_INKS,
  PEN_WIDTHS,
  Tool,
  editedLabel,
  pdfPageFromHref,
  wordCount,
} from './types';

export type BlockTag = 'h2' | 'h3' | 'p';

// desktop: barra de ferramentas completa; tablet: barra flutuante do Apple Pencil;
// phone: folha a toda a largura (a formatação vem da barra do fundo).
export type NotesLayout = 'desktop' | 'tablet' | 'phone';

export interface FormatState {
  block: BlockTag;
  bold: boolean;
  italic: boolean;
}

export interface NotesPaneRef {
  exec: (command: string, value?: string) => void;
  block: (tag: BlockTag) => void;
  insertRef: () => void;
  insertChecklist: () => void;
  insertLink: () => void;
  insertImage: () => void;
  undo: () => void;
  redo: () => void;
  replace: () => void;
  scrollToHeading: (index: number) => void;
  isEditorFocused: () => boolean;
  // Transforma as referências ao PDF em texto normal e devolve o HTML final.
  unwrapPageRefs: () => string | null;
}

interface NotesPaneProps {
  chapter: Chapter;
  mode: NoteMode;
  onModeChange: (mode: NoteMode) => void;
  paperStyle: PaperStyle;
  zoom: number;
  pageWidth: number | string;
  layout?: NotesLayout;
  onFormatState?: (state: FormatState) => void;
  pdfName?: string;
  pdfPage: number;
  onUpdateContent: (html: string) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateDrawing: (json: string) => void;
  onOpenRef: (page: number) => void;
  onCaretRef: (page: number) => void;
  onStats: (stats: EditorStats) => void;
  onOutline: (items: OutlineItem[]) => void;
}

const PAPER_CLASS: Record<PaperStyle, string> = {
  PAUTADO: c.paperPautado,
  QUADRICULA: c.paperQuadricula,
  LISO: '',
};

const TOOL_KEYS: Record<string, Tool> = { t: 'TEXT', p: 'PEN', m: 'HIGHLIGHTER', e: 'ERASER', l: 'LASSO' };

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
}

// Evita que um clique num botão tire a seleção do texto.
const keepSelection = (e: ReactMouseEvent) => e.preventDefault();

export const NotesPane = forwardRef<NotesPaneRef, NotesPaneProps>(function NotesPane(
  {
    chapter,
    mode,
    onModeChange,
    paperStyle,
    zoom,
    pageWidth,
    pdfName,
    pdfPage,
    onUpdateContent,
    onUpdateTitle,
    onUpdateDrawing,
    onOpenRef,
    onCaretRef,
    onStats,
    onOutline,
    layout = 'desktop',
    onFormatState,
  },
  ref
) {
  const inkRef = useRef<DrawingCanvasRef>(null);
  const paperRef = useRef<HTMLElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastCaretRef = useRef<number | null>(null);

  const [tool, setTool] = useState<Tool>('TEXT');
  const [penInk, setPenInk] = useState(0);
  const [markerInk, setMarkerInk] = useState(0);
  const [penWidth, setPenWidth] = useState(1);
  const [markerWidth, setMarkerWidth] = useState(1);
  const [eraserType, setEraserType] = useState<EraserType>('OBJECT');
  const [selectedCount, setSelectedCount] = useState(0);

  const [blockTag, setBlockTag] = useState<BlockTag>('p');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [refPop, setRefPop] = useState<{ page: number; top: number; left: number } | null>(null);

  const editor = useCallback(() => inkRef.current?.getEditor() ?? null, []);

  // As barras táteis ficam fora deste componente: avisa-as do estado do texto.
  useEffect(() => {
    onFormatState?.({ block: blockTag, bold, italic });
  }, [blockTag, bold, italic, onFormatState]);

  // ==========================================
  // ÍNDICE, PALAVRAS, LINHA/COLUNA
  // ==========================================
  const reportOutline = useCallback(() => {
    const el = editor();
    if (!el) return;
    const items: OutlineItem[] = Array.from(el.querySelectorAll('h2, h3'))
      .map((h) => ({ level: (h.tagName === 'H2' ? 2 : 3) as 2 | 3, text: (h.textContent || '').trim() }))
      .filter((h) => h.text);
    onOutline(items);
  }, [editor, onOutline]);

  const reportStats = useCallback(() => {
    const el = editor();
    if (!el) return;
    const words = wordCount(el.innerText || '');
    let line = 1;
    let col = 1;
    let heading = -1;
    const sel = window.getSelection();
    const anchor = sel && sel.rangeCount ? sel.anchorNode : null;
    if (anchor && el.contains(anchor)) {
      const blocks = Array.from(el.childNodes).filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()));
      let top: Node | null = anchor;
      while (top && top.parentNode !== el) top = top.parentNode;
      const idx = top ? blocks.indexOf(top as ChildNode) : -1;
      if (idx >= 0) {
        line = idx + 1;
        try {
          const r = document.createRange();
          r.setStart(top as Node, 0);
          r.setEnd(anchor, sel!.anchorOffset);
          col = r.toString().length + 1;
        } catch {
          col = 1;
        }
        const headings = Array.from(el.querySelectorAll('h2, h3')).filter((h) => (h.textContent || '').trim());
        headings.forEach((h, i) => {
          let hTop: Node | null = h;
          while (hTop && hTop.parentNode !== el) hTop = hTop.parentNode;
          if (hTop && blocks.indexOf(hTop as ChildNode) <= idx) heading = i;
        });
      }
    }
    onStats({ words, line, col, heading });
  }, [editor, onStats]);

  // Ao mudar de capítulo: título, índice e contagem.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho com o capítulo aberto
    setTitleDraft(chapter.title);
    setEditingTitle(false);
    const t = window.setTimeout(() => {
      reportOutline();
      reportStats();
    }, 0);
    return () => window.clearTimeout(t);
  }, [chapter.id, chapter.title, reportOutline, reportStats]);

  // Seleção: estado dos botões, linha/coluna e "seguir notas".
  useEffect(() => {
    const onSel = () => {
      const el = editor();
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
      savedRange.current = sel.getRangeAt(0).cloneRange();
      const node = sel.anchorNode;
      const elem = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement;
      setBlockTag(elem?.closest('h2') ? 'h2' : elem?.closest('h3') ? 'h3' : 'p');
      try {
        setBold(document.queryCommandState('bold'));
        setItalic(document.queryCommandState('italic'));
      } catch {
        setBold(false);
        setItalic(false);
      }
      const page = pdfPageFromHref(elem?.closest('a')?.getAttribute('href') ?? null);
      if (page !== null && page !== lastCaretRef.current) onCaretRef(page);
      lastCaretRef.current = page;
      reportStats();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [editor, onCaretRef, reportStats]);

  // Atalhos das ferramentas (T, P, M, E) fora da escrita.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey || mode !== 'EDIT') return;
      const next = TOOL_KEYS[e.key.toLowerCase()];
      if (next) {
        e.preventDefault();
        setTool(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // ==========================================
  // COMANDOS DE TEXTO
  // ==========================================
  const restore = () => {
    const el = editor();
    if (!el || mode !== 'EDIT') return false;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel && el.contains(savedRange.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    return true;
  };

  const emit = () => {
    const el = editor();
    if (!el) return;
    onUpdateContent(el.innerHTML);
    reportOutline();
    reportStats();
  };

  const exec = (command: string, value?: string) => {
    if (!restore()) return;
    document.execCommand(command, false, value);
    emit();
  };

  const selectedText = () => {
    const sel = window.getSelection();
    return sel && !sel.isCollapsed ? sel.toString().trim() : '';
  };

  const insertRef = () => {
    if (!restore()) return;
    let page = pdfPage;
    if (!pdfName) {
      const raw = window.prompt('Número da página do PDF a referenciar:', String(pdfPage || 1));
      if (!raw || !/^\d+$/.test(raw.trim())) return;
      page = Number(raw.trim());
      restore();
    }
    const text = selectedText();
    if (text) {
      document.execCommand('createLink', false, `#page=${page}`);
    } else {
      const short = (pdfName || 'PDF').replace(/\.pdf$/i, '');
      document.execCommand('insertHTML', false, `<a href="#page=${page}">↗ ${escapeHtml(short)} · p. ${page}</a>&nbsp;`);
    }
    emit();
  };

  const insertLink = () => {
    if (!restore()) return;
    const raw = window.prompt('Endereço do link (ou número de página do PDF):');
    if (!raw?.trim()) return;
    const v = raw.trim();
    const href = /^\d+$/.test(v) ? `#page=${v}` : /^[a-z]+:/i.test(v) || v.startsWith('#') ? v : `https://${v}`;
    restore();
    if (selectedText()) document.execCommand('createLink', false, href);
    else document.execCommand('insertHTML', false, `<a href="${escapeHtml(href)}">${escapeHtml(v)}</a>&nbsp;`);
    emit();
  };

  const insertImage = () => {
    if (!restore()) return;
    const url = window.prompt('Endereço da imagem:');
    if (!url?.trim()) return;
    restore();
    document.execCommand('insertImage', false, url.trim());
    emit();
  };

  const insertChecklist = () => exec('insertHTML', '<div><input type="checkbox">&nbsp;</div>');

  const replaceAll = () => {
    const el = editor();
    if (!el || mode !== 'EDIT') return;
    const find = window.prompt('Procurar:');
    if (!find) return;
    const repl = window.prompt(`Substituir "${find}" por:`, '');
    if (repl === null) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const t = node.textContent || '';
      if (t.includes(find)) {
        n += t.split(find).length - 1;
        node.textContent = t.split(find).join(repl);
      }
    }
    if (n > 0) emit();
    window.alert(n > 0 ? `${n} substituição${n === 1 ? '' : 'ões'}.` : 'Sem ocorrências.');
  };

  useImperativeHandle(ref, () => ({
    exec,
    block: (tag) => exec('formatBlock', `<${tag}>`),
    insertRef,
    insertChecklist,
    insertLink,
    insertImage,
    undo: () => (tool === 'TEXT' ? exec('undo') : inkRef.current?.undo()),
    redo: () => (tool === 'TEXT' ? exec('redo') : inkRef.current?.redo()),
    replace: replaceAll,
    scrollToHeading: (index) => {
      const el = editor();
      const h = el ? Array.from(el.querySelectorAll('h2, h3')).filter((x) => (x.textContent || '').trim())[index] : null;
      h?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    isEditorFocused: () => {
      const el = editor();
      return !!el && el.contains(document.activeElement);
    },
    unwrapPageRefs: () => {
      const el = editor();
      if (!el) return null;
      el.querySelectorAll('a[href*="page="]').forEach((a) => {
        const parent = a.parentNode;
        while (a.firstChild) parent?.insertBefore(a.firstChild, a);
        parent?.removeChild(a);
      });
      reportOutline();
      return el.innerHTML;
    },
  }));

  // ==========================================
  // CLIQUES E REFERÊNCIAS NA FOLHA
  // ==========================================
  const onEditorClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      if (mode !== 'EDIT') {
        e.preventDefault();
        return;
      }
      // O estado tem de ficar no HTML para ser guardado.
      if (target.checked) target.setAttribute('checked', '');
      else target.removeAttribute('checked');
      emit();
      return;
    }
    const link = target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const page = pdfPageFromHref(href);
    if (page !== null) {
      e.preventDefault();
      onOpenRef(page);
    } else if (/^https?:/i.test(href) && (mode === 'PREVIEW' || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener');
    }
  };

  const onEditorMouseOver = (e: ReactMouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a');
    const page = pdfPageFromHref(link?.getAttribute('href') ?? null);
    const paper = paperRef.current;
    if (!link || page === null || !paper) {
      if (refPop) setRefPop(null);
      return;
    }
    const pr = paper.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    const scale = pr.width / paper.offsetWidth || 1;
    setRefPop({ page, top: (lr.bottom - pr.top) / scale + 4, left: Math.max(0, (lr.left - pr.left) / scale) });
  };

  // ==========================================
  // RENDER
  // ==========================================
  const isStroke = tool === 'PEN' || tool === 'HIGHLIGHTER';
  const inks = tool === 'HIGHLIGHTER' ? MARKER_INKS : PEN_INKS;
  const inkIdx = tool === 'HIGHLIGHTER' ? markerInk : penInk;
  const widths = tool === 'HIGHLIGHTER' ? MARKER_WIDTHS : PEN_WIDTHS;
  const widthIdx = tool === 'HIGHLIGHTER' ? markerWidth : penWidth;
  const strokeColor = tool === 'HIGHLIGHTER' ? MARKER_INKS[markerInk][1] : PEN_INKS[penInk][1];
  const strokeSize = tool === 'HIGHLIGHTER' ? MARKER_WIDTHS[markerWidth][1] : PEN_WIDTHS[penWidth][1];
  const editable = mode === 'EDIT';

  const toolBtn = (id: Tool, label: string, key: string, icon: ReactNode) => (
    <button
      type="button"
      className={c.icon}
      title={`${label} (${key})`}
      aria-label={label}
      aria-pressed={editable && tool === id}
      disabled={!editable}
      onMouseDown={keepSelection}
      onClick={() => setTool(id)}
    >
      {icon}
    </button>
  );

  return (
    <section aria-label="Notas" className={c.pane} style={{ position: 'relative' }}>
      {layout === 'tablet' && editable && (
        <PencilBar
          tool={tool}
          onTool={setTool}
          inks={inks}
          inkIdx={inkIdx}
          onInk={(i) => (tool === 'HIGHLIGHTER' ? setMarkerInk(i) : setPenInk(i))}
          widths={widths}
          widthIdx={widthIdx}
          onWidth={(i) => (tool === 'HIGHLIGHTER' ? setMarkerWidth(i) : setPenWidth(i))}
          eraserType={eraserType}
          onEraserType={setEraserType}
          selectedCount={selectedCount}
          onDeleteSelection={() => inkRef.current?.deleteSelection()}
          onRecolorSelection={(i) => inkRef.current?.recolorSelection(i)}
          onDuplicateSelection={() => inkRef.current?.duplicateSelection()}
        />
      )}
      <div className={`${c.toolbar} no-print`} style={layout === 'desktop' ? undefined : { display: 'none' }}>
        <div className={c.seg} style={{ height: 26 }}>
          {(
            [
              ['EDIT', 'Escrever'],
              ['PREVIEW', 'Rever'],
            ] as [NoteMode, string][]
          ).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => onModeChange(m)}>
              {label}
            </button>
          ))}
        </div>
        <span className={c.vsep} />
        <div style={{ display: 'flex', gap: 2, opacity: editable ? 1 : 0.4 }}>
          {toolBtn('TEXT', 'Texto', 'T', <span style={{ fontSize: 15, fontWeight: 600 }}>T</span>)}
          {toolBtn(
            'PEN',
            'Caneta',
            'P',
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
              <path d="M2.5 13.5l1-4 7.5-7.5 3 3-7.5 7.5-4 1z" />
              <path d="M9.5 3.5l3 3" />
            </svg>
          )}
          {toolBtn(
            'HIGHLIGHTER',
            'Marcador',
            'M',
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
              <path d="M4 10.5l6.5-6.5 2.5 2.5-6.5 6.5H4v-2.5z" />
              <path d="M2 15h12" />
            </svg>
          )}
          {toolBtn(
            'ERASER',
            'Borracha',
            'E',
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
              <path d="M9.5 2.5l4 4-6.5 6.5H4l-2-2 7.5-8.5z" />
              <path d="M7 13h7" />
            </svg>
          )}
          {toolBtn(
            'LASSO',
            'Laço',
            'L',
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2">
              <ellipse cx="8" cy="7" rx="6" ry="4.5" />
            </svg>
          )}
        </div>
        <span className={c.vsep} />

        {editable && tool === 'TEXT' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <select
              aria-label="Estilo do parágrafo"
              className={c.select}
              style={{ marginRight: 6 }}
              value={blockTag}
              onChange={(e) => exec('formatBlock', `<${e.target.value}>`)}
            >
              <option value="p">Normal</option>
              <option value="h2">Título</option>
              <option value="h3">Subtítulo</option>
            </select>
            <button type="button" className={c.icon} title="Negrito" aria-label="Negrito" aria-pressed={bold} onMouseDown={keepSelection} onClick={() => exec('bold')} style={{ width: 26, fontWeight: 700 }}>
              B
            </button>
            <button
              type="button"
              className={c.icon}
              title="Itálico"
              aria-label="Itálico"
              aria-pressed={italic}
              onMouseDown={keepSelection}
              onClick={() => exec('italic')}
              style={{ width: 26, fontFamily: "var(--font-newsreader), 'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 16 }}
            >
              I
            </button>
            <button type="button" className={c.icon} title="Lista" aria-label="Lista" onMouseDown={keepSelection} onClick={() => exec('insertUnorderedList')} style={{ width: 26 }}>
              <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                <circle cx="2" cy="2" r="1.3" />
                <circle cx="2" cy="7" r="1.3" />
                <circle cx="2" cy="12" r="1.3" />
                <rect x="5" y="1.3" width="10" height="1.4" />
                <rect x="5" y="6.3" width="10" height="1.4" />
                <rect x="5" y="11.3" width="10" height="1.4" />
              </svg>
            </button>
            <button type="button" className={c.icon} title="Checklist" aria-label="Checklist" onMouseDown={keepSelection} onClick={insertChecklist} style={{ width: 26 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="1.7" y="1.7" width="12.6" height="12.6" />
                <path d="M4.5 8.2l2.3 2.3 4.7-5" />
              </svg>
            </button>
            <button type="button" className={c.icon} title="Link" aria-label="Link" onMouseDown={keepSelection} onClick={insertLink} style={{ width: 26 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M6.5 9.5l3-3" />
                <path d="M7 4.5l1.5-1.5a2.8 2.8 0 014 4L11 8.5" />
                <path d="M9 11.5L7.5 13a2.8 2.8 0 01-4-4L5 7.5" />
              </svg>
            </button>
            <button
              type="button"
              className={c.refBtn}
              title={pdfName ? `Referência à página ${pdfPage} de ${pdfName}` : 'Referência a uma página do PDF'}
              onMouseDown={keepSelection}
              onClick={insertRef}
            >
              ↗ Ref. PDF
            </button>
          </div>
        )}

        {editable && isStroke && (
          <div className={c.toolOpts}>
            <span>Cor</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {inks.map(([name, hex], i) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={name}
                  title={name}
                  aria-pressed={inkIdx === i}
                  className={`${c.swatch} ${inkIdx === i ? c.swatchOn : ''}`}
                  style={{ background: hex }}
                  onClick={() => (tool === 'HIGHLIGHTER' ? setMarkerInk(i) : setPenInk(i))}
                />
              ))}
            </div>
            <span>Traço</span>
            <div className={c.seg} style={{ height: 26 }}>
              {widths.map(([label], i) => (
                <button key={label} type="button" aria-pressed={widthIdx === i} onClick={() => (tool === 'HIGHLIGHTER' ? setMarkerWidth(i) : setPenWidth(i))}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {editable && tool === 'ERASER' && (
          <div className={c.toolOpts}>
            <span>Apagar</span>
            <div className={c.seg} style={{ height: 26 }}>
              <button type="button" aria-pressed={eraserType === 'OBJECT'} onClick={() => setEraserType('OBJECT')}>
                Traço inteiro
              </button>
              <button type="button" aria-pressed={eraserType === 'AREA'} onClick={() => setEraserType('AREA')}>
                Área
              </button>
            </div>
          </div>
        )}

        {editable && tool === 'LASSO' && (
          <div className={c.toolOpts}>
            <span>{selectedCount ? `${selectedCount} ${selectedCount === 1 ? 'traço selecionado' : 'traços selecionados'} · arrasta para mover` : 'Desenha à volta dos traços para os selecionar'}</span>
            {selectedCount > 0 && (
              <>
                <span>Cor</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PEN_INKS.map(([name, hex], i) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Mudar a cor da seleção para ${name}`}
                      title={name}
                      className={c.swatch}
                      style={{ background: hex }}
                      onClick={() => inkRef.current?.recolorSelection(i)}
                    />
                  ))}
                </div>
                <button type="button" className={c.btn} title="Duplicar (Ctrl+D)" onClick={() => inkRef.current?.duplicateSelection()}>
                  Duplicar
                </button>
                <button type="button" className={c.btn} title="Apagar (Delete)" onClick={() => inkRef.current?.deleteSelection()}>
                  Apagar seleção
                </button>
              </>
            )}
          </div>
        )}

        {!editable && <span style={{ fontSize: 12, color: 'var(--mut)' }}>Só leitura · clica numa referência para abrir o PDF</span>}
      </div>

      <div
        data-scroll
        className={`${c.sheetArea} ${layout === 'phone' ? c.sheetAreaFlush : layout === 'tablet' ? c.sheetAreaTablet : ''}`}
      >
        <article
          ref={paperRef}
          className={`${c.paper} ${PAPER_CLASS[paperStyle]} ${layout === 'phone' ? c.paperPhone : ''} printable-editor`}
          style={{ width: pageWidth, zoom }}
          onMouseLeave={() => setRefPop(null)}
        >
          <div className={c.paperMeta}>
            <span>
              CAPÍTULO {chapter.number || '00'} · CADERNO ACADÉMICO{chapter.isCompleted ? ' · ✓ CONCLUÍDO' : ''}
            </span>
            <span>ÚLTIMA EDIÇÃO {editedLabel(chapter.updatedAt).toUpperCase()}</span>
          </div>

          {editingTitle && editable ? (
            <input
              autoFocus
              className={c.titleInput}
              data-gramm="false"
              data-enable-grammarly="false"
              value={titleDraft}
              aria-label="Título do capítulo"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                const t = titleDraft.trim();
                if (t && t !== chapter.title) onUpdateTitle(t);
                else setTitleDraft(chapter.title);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setTitleDraft(chapter.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <h1
              className={c.title}
              title={editable ? 'Clica para mudar o título' : undefined}
              onClick={() => editable && setEditingTitle(true)}
            >
              {chapter.title || 'Sem título'}
            </h1>
          )}

          <DrawingCanvas
            ref={inkRef}
            chapterId={chapter.id}
            chapterContent={chapter.content}
            drawingDataRaw={chapter.drawingData}
            mode={mode}
            tool={tool}
            color={strokeColor}
            size={strokeSize}
            eraserType={eraserType}
            penOnly={layout !== 'desktop'}
            onSelectionChange={setSelectedCount}
            onPenDetected={() => setTool('PEN')}
            zoom={zoom}
            placeholder="Continua a escrever, ou pega na caneta…"
            onUpdateContent={(html) => {
              onUpdateContent(html);
              reportOutline();
              reportStats();
            }}
            onUpdateDrawing={onUpdateDrawing}
            onEditorClick={onEditorClick}
            onEditorMouseOver={onEditorMouseOver}
            onEditorMouseLeave={() => setRefPop(null)}
          />

          {refPop && (
            <div className={c.refPop} style={{ top: refPop.top, left: refPop.left }} role="tooltip">
              <span style={{ fontWeight: 600 }}>
                {(pdfName || 'PDF de consulta').replace(/\.pdf$/i, '')} · página {refPop.page}
              </span>
              <span style={{ color: 'var(--mut)' }}>
                {pdfName ? 'Clica para abrir esta página no split view' : 'Este capítulo ainda não tem PDF de consulta'}
              </span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
});

// ==========================================
// BARRA FLUTUANTE DO APPLE PENCIL (iPad)
// ==========================================
const PENCIL_TOOLS: [Tool, string, ReactNode][] = [
  [
    'PEN',
    'Caneta',
    <svg key="p" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M2.5 13.5l1-4 7.5-7.5 3 3-7.5 7.5-4 1z" />
    </svg>,
  ],
  [
    'HIGHLIGHTER',
    'Marcador',
    <svg key="m" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M4 10.5l6.5-6.5 2.5 2.5-6.5 6.5H4v-2.5z" />
      <path d="M2 15h12" />
    </svg>,
  ],
  [
    'ERASER',
    'Borracha',
    <svg key="e" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M9.5 2.5l4 4-6.5 6.5H4l-2-2 7.5-8.5z" />
      <path d="M7 13h7" />
    </svg>,
  ],
  [
    'LASSO',
    'Laço',
    <svg key="l" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2">
      <ellipse cx="8" cy="7" rx="6" ry="4.5" />
    </svg>,
  ],
  ['TEXT', 'Texto', <span key="t" style={{ fontSize: 17, fontWeight: 600 }}>T</span>],
];

function PencilBar({
  tool,
  onTool,
  inks,
  inkIdx,
  onInk,
  widths,
  widthIdx,
  onWidth,
  eraserType,
  onEraserType,
  selectedCount,
  onDeleteSelection,
  onRecolorSelection,
  onDuplicateSelection,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  inks: [string, string][];
  inkIdx: number;
  onInk: (i: number) => void;
  widths: [string, number][];
  widthIdx: number;
  onWidth: (i: number) => void;
  eraserType: EraserType;
  onEraserType: (t: EraserType) => void;
  selectedCount: number;
  onDeleteSelection: () => void;
  onRecolorSelection: (inkIndex: number) => void;
  onDuplicateSelection: () => void;
}) {
  const stroke = tool === 'PEN' || tool === 'HIGHLIGHTER';
  return (
    <div role="toolbar" aria-label="Ferramentas do Apple Pencil" className={`${c.pencilBar} no-print`}>
      {PENCIL_TOOLS.map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={tool === id}
          className={c.pencilTool}
          onMouseDown={keepSelection}
          onClick={() => onTool(id)}
        >
          {icon}
        </button>
      ))}
      {stroke && (
        <>
          <span className={c.pencilSep} />
          <div style={{ display: 'flex', gap: 8 }}>
            {inks.map(([name, hex], i) => (
              <button
                key={hex}
                type="button"
                aria-label={name}
                title={name}
                aria-pressed={inkIdx === i}
                className={`${c.pencilInk} ${inkIdx === i ? c.pencilInkOn : ''}`}
                style={{ background: hex }}
                onClick={() => onInk(i)}
              />
            ))}
          </div>
          <span className={c.pencilSep} />
          <div className={c.pencilWidths}>
            {widths.map(([label], i) => (
              <button key={label} type="button" aria-pressed={widthIdx === i} onClick={() => onWidth(i)}>
                {label.replace(' mm', '')}
              </button>
            ))}
          </div>
        </>
      )}
      {tool === 'ERASER' && (
        <>
          <span className={c.pencilSep} />
          <div className={c.pencilWidths}>
            <button type="button" aria-pressed={eraserType === 'OBJECT'} onClick={() => onEraserType('OBJECT')}>
              Traço inteiro
            </button>
            <button type="button" aria-pressed={eraserType === 'AREA'} onClick={() => onEraserType('AREA')}>
              Área
            </button>
          </div>
        </>
      )}
      {tool === 'LASSO' && (
        <>
          <span className={c.pencilSep} />
          {selectedCount > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                {PEN_INKS.map(([name, hex], i) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Mudar a cor da seleção para ${name}`}
                    title={name}
                    className={c.pencilInk}
                    style={{ background: hex }}
                    onClick={() => onRecolorSelection(i)}
                  />
                ))}
              </div>
              <span className={c.pencilSep} />
              <div className={c.pencilWidths}>
                <button type="button" onClick={onDuplicateSelection}>
                  Duplicar
                </button>
                <button type="button" onClick={onDeleteSelection}>
                  Apagar {selectedCount}
                </button>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>Contorna os traços</span>
          )}
        </>
      )}
    </div>
  );
}
