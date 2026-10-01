'use client';

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import c from '../caderno.module.css';
import { EraserType, MARKER_INKS, NoteMode, PEN_INKS, Tool } from '../types';

interface Point {
  x: number;
  y: number;
  // Pressão da caneta (0–1); ausente em traços de rato e nos antigos.
  p?: number;
}

interface Stroke {
  id: string;
  tool: 'PEN' | 'HIGHLIGHTER' | 'ERASER';
  color: string;
  size: number;
  points: Point[];
}

export interface DrawingCanvasRef {
  undo: () => void;
  redo: () => void;
  getEditor: () => HTMLDivElement | null;
  // Laço: apaga os traços selecionados.
  deleteSelection: () => void;
  // Laço: muda a tinta da seleção (índice em PEN_INKS; o marcador usa MARKER_INKS no mesmo índice).
  recolorSelection: (inkIndex: number) => void;
  // Laço: duplica a seleção um pouco ao lado e passa a selecionar a cópia.
  duplicateSelection: () => void;
  // Grava já os traços que esperavam a caneta parar.
  flush: () => void;
}

interface DrawingCanvasProps {
  chapterId: string;
  chapterContent?: string;
  drawingDataRaw?: string;
  mode: NoteMode;
  tool: Tool;
  color: string;
  size: number;
  eraserType: EraserType;
  placeholder: string;
  onUpdateContent?: (content: string) => void;
  onUpdateDrawing?: (drawingData: string) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onEditorClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onEditorMouseOver?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onEditorMouseLeave?: () => void;
  // Dispositivos táteis: só a caneta (ou o rato) desenha; o dedo desliza a folha.
  penOnly?: boolean;
  // Laço: número de traços selecionados (0 = nenhum).
  onSelectionChange?: (count: number) => void;
  // Tátil: a caneta tocou na folha com a ferramenta Texto; o traço é desenhado e a ferramenta passa a Caneta.
  onPenDetected?: () => void;
  // Zoom da folha, para ajustar a resolução do canvas.
  zoom?: number;
  // Muda quando o caderno é atualizado do servidor: volta a ler o capítulo.
  revision?: number;
}

const MIN_HEIGHT = 640;
const MARKER_COLORS = new Set(MARKER_INKS.map(([, hex]) => hex));

function distToSegmentSq(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

// Ponto dentro de um polígono (contagem de cruzamentos).
function inPolygon(p: Point, poly: Point[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function boundsOf(strokes: Stroke[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    const pad = (s.tool === 'HIGHLIGHTER' ? s.size * 3 : s.size) / 2 + 6;
    for (const pt of s.points) {
      x0 = Math.min(x0, pt.x - pad);
      y0 = Math.min(y0, pt.y - pad);
      x1 = Math.max(x1, pt.x + pad);
      y1 = Math.max(y1, pt.y + pad);
    }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'ERASER') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.size;
  } else if (stroke.tool === 'HIGHLIGHTER') {
    // Traços antigos guardavam a cor da caneta: continuam amarelos.
    const color = MARKER_COLORS.has(stroke.color) ? stroke.color : '#ffe600';
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = MARKER_COLORS.has(stroke.color) ? 0.8 : 0.35;
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = stroke.size * 3;
    ctx.lineCap = 'butt';
  } else {
    ctx.strokeStyle = ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    // Caneta com pressão: cada troço tem a espessura da pressão nesse ponto.
    if (pts.length > 2 && pts.some((pt) => pt.p !== undefined)) {
      const width = (pt: Point) => stroke.size * (0.45 + 1.1 * (pt.p ?? 0.5));
      let from = pts[0];
      for (let i = 1; i < pts.length; i++) {
        const last = i === pts.length - 1;
        const to = last ? pts[i] : { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, to.x, to.y);
        ctx.lineWidth = width(pts[i]);
        ctx.stroke();
        from = to;
      }
      ctx.restore();
      return;
    }
  }

  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      ctx.lineTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      for (let i = 1; i < pts.length - 1; i++) {
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Folga à volta de um traço (para limpar a camada do traço atual).
const padOf = (s: Stroke) => (s.tool === 'HIGHLIGHTER' ? s.size * 3 : s.size * 1.6) / 2 + 4;
// Quantos passos o "desfazer" guarda.
const MAX_UNDO = 300;
// Gravar só quando a caneta pára (não a cada traço).
const SAVE_IDLE_MS = 900;

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(function DrawingCanvas(
  {
    chapterId,
    chapterContent,
    drawingDataRaw,
    mode,
    tool,
    color,
    size,
    eraserType,
    placeholder,
    onUpdateContent,
    onUpdateDrawing,
    onHistoryChange,
    onEditorClick,
    onEditorMouseOver,
    onEditorMouseLeave,
    penOnly = false,
    onSelectionChange,
    onPenDetected,
    zoom = 1,
    revision = 0,
  },
  ref
) {
  // Traço de caneta começado com a ferramenta Texto (ver onPenDetected): desenha como Caneta.
  const forcedPenRef = useRef(false);
  // Arrastar com o dedo quando só a caneta desenha: desliza o contentor da folha.
  const fingerRef = useRef<{ id: number; x: number; y: number; box: HTMLElement | null } | null>(null);
  // Dedos na folha: com dois, é pinça (zoom), não deslizar.
  const touchIdsRef = useRef<Set<number>>(new Set());
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Camada só do traço que está a ser escrito: redesenhá-la é barato, a folha
  // inteira só se redesenha ao desfazer, mover ou mudar de tamanho.
  const liveRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Os traços nunca são alterados no sítio: cada mudança cria uma lista nova.
  // Assim o "desfazer" guarda só a lista anterior, sem copiar pontos.
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const preStrokeSnapshotRef = useRef<Stroke[] | null>(null);
  const undoStackRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const isDrawingRef = useRef(false);
  const loadedChapterIdRef = useRef<string | null>(null);
  const loadedRevisionRef = useRef(-1);
  // Laço: contorno a ser desenhado, traços selecionados e arrasto da seleção.
  const lassoPathRef = useRef<Point[] | null>(null);
  const selectedRef = useRef<Set<string>>(new Set());
  const dragRef = useRef<{ start: Point; base: Stroke[]; moved: boolean } | null>(null);
  // Tamanho lógico da folha (px sem zoom) em que os pontos são guardados.
  const logicalRef = useRef({ w: 0, h: 0 });
  // Pixels do canvas por px lógico da folha.
  const ratioRef = useRef(1);
  // Desenho a um fotograma de cada vez.
  const liveFrameRef = useRef(0);
  const fullFrameRef = useRef(0);
  const liveBoxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // Borracha de área: pontos já aplicados na folha.
  const erasedUpToRef = useRef(0);
  // Borracha de traço inteiro: houve algo apagado neste gesto.
  const objectErasedRef = useRef(false);
  // Gravação adiada: a função e a lista do capítulo em que se escreveu.
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<{ fn: (json: string) => void; strokes: Stroke[] } | null>(null);

  const updateHistoryStatus = useCallback(() => {
    onHistoryChange?.(undoStackRef.current.length > 0, redoStackRef.current.length > 0);
  }, [onHistoryChange]);

  const pushUndo = (snapshot: Stroke[]) => {
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    redoStackRef.current = [];
  };

  const mainCtx = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return null;
    const r = ratioRef.current;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return ctx;
  };
  const liveCtx = () => {
    const ctx = liveRef.current?.getContext('2d', { desynchronized: true }) as CanvasRenderingContext2D | null | undefined;
    if (!ctx) return null;
    const r = ratioRef.current;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return ctx;
  };
  const clearLive = () => {
    const box = liveBoxRef.current;
    liveBoxRef.current = null;
    const ctx = box ? liveCtx() : null;
    if (ctx && box) ctx.clearRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  };

  const redrawCanvas = useCallback(() => {
    if (fullFrameRef.current) {
      cancelAnimationFrame(fullFrameRef.current);
      fullFrameRef.current = 0;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = ratioRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalRef.current.w, logicalRef.current.h);
    strokesRef.current.forEach((s) => drawStroke(ctx, s));
    // A borracha de área a meio do gesto apaga diretamente na folha.
    const cur = currentStrokeRef.current;
    if (cur?.tool === 'ERASER') {
      drawStroke(ctx, cur);
      erasedUpToRef.current = cur.points.length;
    }

    const selected = strokesRef.current.filter((s) => selectedRef.current.has(s.id));
    const box = selected.length ? boundsOf(selected) : null;
    if (box) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#5b93b0';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(91, 147, 176, 0.08)';
      ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.restore();
    }
    const path = lassoPathRef.current;
    if (path && path.length > 1) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#22324a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const pt of path.slice(1)) ctx.lineTo(pt.x, pt.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // Redesenhar a folha no próximo fotograma (laço, borracha de traço inteiro).
  const scheduleRedraw = () => {
    if (!fullFrameRef.current) fullFrameRef.current = requestAnimationFrame(() => {
      fullFrameRef.current = 0;
      redrawCanvas();
    });
  };

  // Traço atual: caneta e marcador na camada de cima; a borracha de área
  // apaga logo na folha, só os pontos novos.
  const renderLive = () => {
    liveFrameRef.current = 0;
    const s = currentStrokeRef.current;
    if (!s) return;
    if (s.tool === 'ERASER') {
      const ctx = mainCtx();
      if (!ctx) return;
      const from = Math.max(0, erasedUpToRef.current - 1);
      if (from < s.points.length) drawStroke(ctx, { ...s, points: s.points.slice(from) });
      erasedUpToRef.current = s.points.length;
      return;
    }
    const ctx = liveCtx();
    if (!ctx) return;
    clearLive();
    const pad = padOf(s);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const pt of s.points) {
      if (pt.x < x0) x0 = pt.x;
      if (pt.y < y0) y0 = pt.y;
      if (pt.x > x1) x1 = pt.x;
      if (pt.y > y1) y1 = pt.y;
    }
    liveBoxRef.current = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
    drawStroke(ctx, s);
  };
  const scheduleLive = () => {
    if (!liveFrameRef.current) liveFrameRef.current = requestAnimationFrame(renderLive);
  };

  const setSelection = useCallback(
    (ids: Set<string>) => {
      selectedRef.current = ids;
      onSelectionChange?.(ids.size);
    },
    [onSelectionChange]
  );

  // Ajusta o canvas à área escrita; cresce para caber os traços mais abaixo.
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const live = liveRef.current;
    const container = containerRef.current;
    if (!canvas || !live || !container) return;

    let maxY = 0;
    for (const s of strokesRef.current) for (const p of s.points) if (p.y > maxY) maxY = p.y;
    const wantMin = Math.max(MIN_HEIGHT, Math.ceil(maxY + 120));
    if (container.style.minHeight !== `${wantMin}px`) container.style.minHeight = `${wantMin}px`;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;
    // Tamanho a que a folha aparece de facto (zoom da folha incluído) e zoom com dois dedos.
    const shown = canvas.getBoundingClientRect().width / w || 1;
    const pinch = window.visualViewport?.scale || 1;
    let ratio = (window.devicePixelRatio || 1) * shown * Math.min(pinch, 3);
    // O Safari do iPad recusa canvas acima de ~16,7 M pixels: baixa a resolução se for preciso.
    const MAX_PIXELS = 16_000_000;
    if (w * h * ratio * ratio > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / (w * h));
    ratio = Math.round(ratio * 100) / 100;

    if (logicalRef.current.w === w && logicalRef.current.h === h && ratioRef.current === ratio) return;

    logicalRef.current = { w, h };
    ratioRef.current = ratio;
    canvas.width = live.width = Math.round(w * ratio);
    canvas.height = live.height = Math.round(h * ratio);
    liveBoxRef.current = null;
    redrawCanvas();
    if (currentStrokeRef.current) renderLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderLive só lê refs
  }, [redrawCanvas]);

  // A folha só cresce quando um traço passa perto do fundo.
  const growIfNeeded = (stroke: Stroke) => {
    const container = containerRef.current;
    if (!container) return;
    let maxY = 0;
    for (const p of stroke.points) if (p.y > maxY) maxY = p.y;
    if (maxY + 120 > (parseFloat(container.style.minHeight) || MIN_HEIGHT)) setupCanvas();
  };

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) pending.fn(JSON.stringify(pending.strokes));
  }, []);

  // Guarda a função deste capítulo e a lista atual; grava quando a caneta pára.
  const saveDrawingToCloud = useCallback(() => {
    if (!onUpdateDrawing) return;
    pendingSaveRef.current = { fn: onUpdateDrawing, strokes: strokesRef.current };
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushSave, SAVE_IDLE_MS);
  }, [onUpdateDrawing, flushSave]);

  // Sair, esconder a app ou fechar o capítulo: grava já o que falta.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSave);
      flushSave();
    };
  }, [flushSave]);

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(strokesRef.current);
    strokesRef.current = prev;
    setSelection(new Set());
    redrawCanvas();
    saveDrawingToCloud();
    updateHistoryStatus();
  }, [redrawCanvas, saveDrawingToCloud, setSelection, updateHistoryStatus]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(strokesRef.current);
    strokesRef.current = next;
    setSelection(new Set());
    redrawCanvas();
    saveDrawingToCloud();
    updateHistoryStatus();
    setupCanvas();
  }, [redrawCanvas, saveDrawingToCloud, setSelection, setupCanvas, updateHistoryStatus]);

  const deleteSelection = useCallback(() => {
    if (selectedRef.current.size === 0) return;
    pushUndo(strokesRef.current);
    strokesRef.current = strokesRef.current.filter((st) => !selectedRef.current.has(st.id));
    setSelection(new Set());
    updateHistoryStatus();
    redrawCanvas();
    saveDrawingToCloud();
  }, [redrawCanvas, saveDrawingToCloud, setSelection, updateHistoryStatus]);

  const recolorSelection = useCallback(
    (inkIndex: number) => {
      if (selectedRef.current.size === 0) return;
      const pen = PEN_INKS[inkIndex]?.[1];
      const marker = MARKER_INKS[inkIndex]?.[1];
      if (!pen || !marker) return;
      const before = strokesRef.current;
      let changed = false;
      const next = before.map((st) => {
        if (!selectedRef.current.has(st.id)) return st;
        const color = st.tool === 'HIGHLIGHTER' ? marker : pen;
        if (st.color === color) return st;
        changed = true;
        return { ...st, color };
      });
      if (!changed) return;
      pushUndo(before);
      strokesRef.current = next;
      updateHistoryStatus();
      redrawCanvas();
      saveDrawingToCloud();
    },
    [redrawCanvas, saveDrawingToCloud, updateHistoryStatus]
  );

  const duplicateSelection = useCallback(() => {
    if (selectedRef.current.size === 0) return;
    const OFFSET = 16;
    const stamp = Date.now();
    const copies = strokesRef.current
      .filter((st) => selectedRef.current.has(st.id))
      .map((st, i) => ({
        ...st,
        id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        points: st.points.map((pt) => ({ ...pt, x: pt.x + OFFSET, y: pt.y + OFFSET })),
      }));
    pushUndo(strokesRef.current);
    strokesRef.current = [...strokesRef.current, ...copies];
    setSelection(new Set(copies.map((st) => st.id)));
    updateHistoryStatus();
    redrawCanvas();
    saveDrawingToCloud();
    setupCanvas();
  }, [redrawCanvas, saveDrawingToCloud, setSelection, setupCanvas, updateHistoryStatus]);

  useImperativeHandle(
    ref,
    () => ({ undo, redo, getEditor: () => editorRef.current, deleteSelection, recolorSelection, duplicateSelection, flush: flushSave }),
    [undo, redo, deleteSelection, recolorSelection, duplicateSelection, flushSave]
  );

  // Sair do laço (ou mudar de capítulo) larga a seleção.
  useEffect(() => {
    if (tool === 'LASSO' && mode === 'EDIT') return;
    lassoPathRef.current = null;
    dragRef.current = null;
    if (selectedRef.current.size) {
      setSelection(new Set());
      redrawCanvas();
    }
  }, [tool, mode, chapterId, setSelection, redrawCanvas]);

  // Delete / Backspace apagam a seleção do laço (fora da escrita).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tool !== 'LASSO' || selectedRef.current.size === 0) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (e.key === 'Escape') {
        setSelection(new Set());
        redrawCanvas();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, deleteSelection, duplicateSelection, setSelection, redrawCanvas]);

  // Ctrl+Z / Ctrl+Shift+Z desfazem traços quando uma ferramenta de desenho está ativa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'EDIT' || tool === 'TEXT') return;
      const k = e.key.toLowerCase();
      if (!(e.ctrlKey || e.metaKey)) return;
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, tool, undo, redo]);

  // Carregar texto e traços quando muda o capítulo.
  useEffect(() => {
    if (loadedChapterIdRef.current === chapterId && loadedRevisionRef.current === revision) return;
    // O que ficou por gravar é do capítulo anterior: grava-o antes de trocar.
    flushSave();
    loadedChapterIdRef.current = chapterId;
    loadedRevisionRef.current = revision;

    if (editorRef.current && editorRef.current.innerHTML !== (chapterContent || '')) {
      editorRef.current.innerHTML = chapterContent || '';
    }
    try {
      const parsed = drawingDataRaw ? JSON.parse(drawingDataRaw) : [];
      strokesRef.current = Array.isArray(parsed)
        ? parsed.map((st: Stroke, i: number) => (st.id ? st : { ...st, id: `old-${i}` }))
        : [];
    } catch {
      strokesRef.current = [];
    }
    currentStrokeRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateHistoryStatus();
    logicalRef.current = { w: 0, h: 0 };
    setupCanvas();
  }, [chapterId, revision, chapterContent, drawingDataRaw, setupCanvas, updateHistoryStatus, flushSave]);

  // Zoom do browser ou com dois dedos: a resolução acompanha.
  useEffect(() => {
    const onZoom = () => setupCanvas();
    window.addEventListener('resize', onZoom);
    window.visualViewport?.addEventListener('resize', onZoom);
    return () => {
      window.removeEventListener('resize', onZoom);
      window.visualViewport?.removeEventListener('resize', onZoom);
    };
  }, [setupCanvas]);

  // Zoom da folha (−/+ ou pinça): o tamanho em CSS não muda, só a escala.
  // A nitidez acerta-se quando o zoom pára (refazer o canvas a cada passo da pinça era lento).
  useEffect(() => {
    const t = window.setTimeout(setupCanvas, 160);
    return () => window.clearTimeout(t);
  }, [zoom, setupCanvas]);

  // O texto cresce, a janela muda, o split abre: o canvas acompanha.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [setupCanvas]);

  // Não deixar fotogramas pendentes ao sair.
  useEffect(
    () => () => {
      cancelAnimationFrame(liveFrameRef.current);
      cancelAnimationFrame(fullFrameRef.current);
    },
    []
  );

  // Ponto do ponteiro em coordenadas da folha (independente do zoom).
  const localPoint = (e: { clientX: number; clientY: number; pointerType?: string; pressure?: number }, rect?: DOMRect): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas || logicalRef.current.w === 0) return null;
    const r = rect ?? canvas.getBoundingClientRect();
    const scale = r.width / logicalRef.current.w || 1;
    const pt: Point = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    if (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0) pt.p = Math.round(e.pressure * 100) / 100;
    return pt;
  };

  // Junta um ponto ao traço, ignorando os que estão a menos de ~0,6 px do anterior.
  const pushPoint = (stroke: Stroke, p: Point) => {
    const prev = stroke.points[stroke.points.length - 1];
    if (prev && (prev.x - p.x) ** 2 + (prev.y - p.y) ** 2 < 0.36) {
      if (p.p !== undefined) prev.p = Math.max(prev.p ?? 0, p.p);
      return;
    }
    stroke.points.push(p);
  };

  // Borracha de traço inteiro: tira os traços tocados (um "desfazer" por gesto).
  const checkObjectErase = (p: Point) => {
    const thresholdSq = 12 * 12;
    const before = strokesRef.current;
    const next = before.filter((s) => {
      if (s.tool === 'ERASER') return true;
      if (s.points.length === 1) return (s.points[0].x - p.x) ** 2 + (s.points[0].y - p.y) ** 2 >= thresholdSq;
      for (let i = 0; i < s.points.length - 1; i++) {
        if (distToSegmentSq(p, s.points[i], s.points[i + 1]) < thresholdSq) return false;
      }
      return true;
    });
    if (next.length !== before.length) {
      strokesRef.current = next;
      objectErasedRef.current = true;
      scheduleRedraw();
    }
  };

  const drawingActive = mode === 'EDIT' && tool !== 'TEXT';
  const toolNow = (): Tool => (forcedPenRef.current ? 'PEN' : tool);

  // Scribble do iPad: se a página trava o toque da caneta, o iPad não converte a letra em texto.
  useEffect(() => {
    const box = containerRef.current;
    if (!box || !penOnly) return;
    const onTouch = (e: TouchEvent) => {
      if (mode !== 'EDIT') return;
      const stylus = Array.from(e.touches).some((t) => (t as Touch & { touchType?: string }).touchType === 'stylus');
      if (stylus) e.preventDefault();
    };
    box.addEventListener('touchstart', onTouch, { passive: false });
    box.addEventListener('touchmove', onTouch, { passive: false });
    return () => {
      box.removeEventListener('touchstart', onTouch);
      box.removeEventListener('touchmove', onTouch);
    };
  }, [penOnly, mode]);

  const startDrawing = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drawingActive && !forcedPenRef.current) return;
    // A caneta nunca deve acionar o Scribble nem selecionar texto.
    if (e.pointerType === 'pen') e.preventDefault();
    const tool = toolNow();
    if (penOnly && e.pointerType === 'touch') {
      touchIdsRef.current.add(e.pointerId);
      if (touchIdsRef.current.size > 1) {
        fingerRef.current = null;
        return;
      }
      e.currentTarget.setPointerCapture?.(e.pointerId);
      fingerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, box: e.currentTarget.closest('[data-scroll]') };
      return;
    }
    const p = localPoint(e);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;

    if (tool === 'LASSO') {
      const selected = strokesRef.current.filter((st) => selectedRef.current.has(st.id));
      const box = selected.length ? boundsOf(selected) : null;
      if (box && p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1) {
        dragRef.current = { start: p, base: strokesRef.current, moved: false };
      } else {
        setSelection(new Set());
        lassoPathRef.current = [p];
        scheduleRedraw();
      }
      return;
    }

    preStrokeSnapshotRef.current = strokesRef.current;
    if (tool === 'ERASER' && eraserType === 'OBJECT') {
      objectErasedRef.current = false;
      checkObjectErase(p);
      return;
    }
    const kind = tool === 'ERASER' ? 'ERASER' : tool === 'HIGHLIGHTER' ? 'HIGHLIGHTER' : 'PEN';
    currentStrokeRef.current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: kind,
      color,
      size: tool === 'ERASER' ? 24 : size,
      points: [p],
    };
    erasedUpToRef.current = 0;
    // O marcador mistura-se com o que está por baixo, como na folha.
    if (liveRef.current) liveRef.current.style.mixBlendMode = kind === 'HIGHLIGHTER' ? 'multiply' : 'normal';
    scheduleLive();
  };

  const draw = (e: ReactPointerEvent<HTMLElement>) => {
    const finger = fingerRef.current;
    if (e.pointerType === 'touch' && touchIdsRef.current.size > 1) return;
    if (finger && finger.id === e.pointerId) {
      finger.box?.scrollBy(finger.x - e.clientX, finger.y - e.clientY);
      finger.x = e.clientX;
      finger.y = e.clientY;
      return;
    }
    if (!isDrawingRef.current || (!drawingActive && !forcedPenRef.current)) return;
    const tool = toolNow();
    if (tool === 'LASSO') {
      const p = localPoint(e);
      if (!p) return;
      const drag = dragRef.current;
      if (drag) {
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        const sel = selectedRef.current;
        strokesRef.current = drag.base.map((st) =>
          sel.has(st.id) ? { ...st, points: st.points.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })) } : st
        );
        drag.moved = dx !== 0 || dy !== 0;
      } else {
        lassoPathRef.current?.push(p);
      }
      scheduleRedraw();
      return;
    }
    const native = e.nativeEvent as PointerEvent;
    const events = native.getCoalescedEvents ? native.getCoalescedEvents() : [native];
    const rect = canvasRef.current?.getBoundingClientRect();
    for (const ev of events.length ? events : [native]) {
      const p = localPoint(ev, rect);
      if (!p) continue;
      if (tool === 'ERASER' && eraserType === 'OBJECT') checkObjectErase(p);
      else if (currentStrokeRef.current) pushPoint(currentStrokeRef.current, p);
    }
    if (currentStrokeRef.current) scheduleLive();
  };

  const stopDrawing = (e?: ReactPointerEvent<HTMLElement>) => {
    if (e?.pointerType === 'touch') touchIdsRef.current.delete(e.pointerId);
    fingerRef.current = null;
    const tool = toolNow();
    forcedPenRef.current = false;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool === 'LASSO') {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        if (drag.moved) {
          pushUndo(drag.base);
          updateHistoryStatus();
          saveDrawingToCloud();
          setupCanvas();
        }
        redrawCanvas();
        return;
      }
      const path = lassoPathRef.current;
      lassoPathRef.current = null;
      if (path && path.length > 2) {
        // Entra na seleção o traço com pelo menos metade dos pontos dentro do contorno.
        const ids = new Set(
          strokesRef.current
            .filter((st) => st.tool !== 'ERASER' && st.points.filter((pt) => inPolygon(pt, path)).length * 2 >= st.points.length)
            .map((st) => st.id)
        );
        setSelection(ids);
      }
      redrawCanvas();
      return;
    }

    if (tool === 'ERASER' && eraserType === 'OBJECT') {
      if (objectErasedRef.current && preStrokeSnapshotRef.current) {
        pushUndo(preStrokeSnapshotRef.current);
        updateHistoryStatus();
        saveDrawingToCloud();
      }
      objectErasedRef.current = false;
      preStrokeSnapshotRef.current = null;
      return;
    }

    const stroke = currentStrokeRef.current;
    if (liveFrameRef.current) {
      cancelAnimationFrame(liveFrameRef.current);
      liveFrameRef.current = 0;
    }
    if (stroke && stroke.points.length > 0) {
      // A borracha já está quase toda aplicada; aplica o resto. A caneta passa
      // da camada de cima para a folha, só este traço.
      if (stroke.tool === 'ERASER') renderLive();
      else {
        const ctx = mainCtx();
        if (ctx) drawStroke(ctx, stroke);
      }
      pushUndo(preStrokeSnapshotRef.current ?? strokesRef.current);
      strokesRef.current = [...strokesRef.current, stroke];
      updateHistoryStatus();
      saveDrawingToCloud();
      growIfNeeded(stroke);
    }
    clearLive();
    currentStrokeRef.current = null;
    preStrokeSnapshotRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={c.inkWrap}
      onPointerDownCapture={(e) => {
        if (!penOnly || mode !== 'EDIT' || tool !== 'TEXT' || e.pointerType !== 'pen') return;
        e.preventDefault();
        e.stopPropagation();
        forcedPenRef.current = true;
        onPenDetected?.();
        startDrawing(e);
      }}
      onPointerMove={(e) => {
        if (forcedPenRef.current) draw(e);
      }}
      onPointerUp={() => {
        if (forcedPenRef.current) stopDrawing();
      }}
      onPointerCancel={() => {
        if (forcedPenRef.current) stopDrawing();
      }}
    >
      <div
        ref={editorRef}
        contentEditable={mode === 'EDIT' && (tool === 'TEXT' || !penOnly)}
        suppressContentEditableWarning
        spellCheck
        // Sem Grammarly na folha (ele mexe no HTML do editor).
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        data-placeholder={placeholder}
        onInput={() => editorRef.current && onUpdateContent?.(editorRef.current.innerHTML)}
        onClick={onEditorClick}
        onMouseOver={onEditorMouseOver}
        onMouseLeave={onEditorMouseLeave}
        className={`${c.editor} ${mode === 'PREVIEW' ? c.editorReadonly : ''}`}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        className={`${c.canvas} ${drawingActive ? c.canvasLive : ''}`}
      />
      <canvas ref={liveRef} aria-hidden="true" className={c.canvasInk} />
    </div>
  );
});
