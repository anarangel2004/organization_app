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

const cloneStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }));

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
  },
  ref
) {
  // Arrastar com o dedo quando só a caneta desenha: desliza o contentor da folha.
  const fingerRef = useRef<{ id: number; x: number; y: number; box: HTMLElement | null } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const preStrokeSnapshotRef = useRef<Stroke[] | null>(null);
  const undoStackRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const isDrawingRef = useRef(false);
  const loadedChapterIdRef = useRef<string | null>(null);
  // Laço: contorno a ser desenhado, traços selecionados e arrasto da seleção.
  const lassoPathRef = useRef<Point[] | null>(null);
  const selectedRef = useRef<Set<string>>(new Set());
  const dragRef = useRef<{ last: Point; snapshot: Stroke[]; moved: boolean } | null>(null);
  // Tamanho lógico da folha (px sem zoom) em que os pontos são guardados.
  const logicalRef = useRef({ w: 0, h: 0 });

  const updateHistoryStatus = useCallback(() => {
    onHistoryChange?.(undoStackRef.current.length > 0, redoStackRef.current.length > 0);
  }, [onHistoryChange]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalRef.current.w, logicalRef.current.h);
    strokesRef.current.forEach((s) => drawStroke(ctx, s));
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);

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
    const container = containerRef.current;
    if (!canvas || !container) return;

    let maxY = 0;
    for (const s of strokesRef.current) for (const p of s.points) if (p.y > maxY) maxY = p.y;
    const wantMin = Math.max(MIN_HEIGHT, Math.ceil(maxY + 120));
    if (container.style.minHeight !== `${wantMin}px`) container.style.minHeight = `${wantMin}px`;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;
    if (logicalRef.current.w === w && logicalRef.current.h === h) return;

    logicalRef.current = { w, h };
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    redrawCanvas();
  }, [redrawCanvas]);

  const saveDrawingToCloud = useCallback(() => {
    onUpdateDrawing?.(JSON.stringify(strokesRef.current));
  }, [onUpdateDrawing]);

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(cloneStrokes(strokesRef.current));
    strokesRef.current = prev;
    redrawCanvas();
    saveDrawingToCloud();
    updateHistoryStatus();
  }, [redrawCanvas, saveDrawingToCloud, updateHistoryStatus]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(cloneStrokes(strokesRef.current));
    strokesRef.current = next;
    redrawCanvas();
    saveDrawingToCloud();
    updateHistoryStatus();
  }, [redrawCanvas, saveDrawingToCloud, updateHistoryStatus]);

  const deleteSelection = useCallback(() => {
    if (selectedRef.current.size === 0) return;
    undoStackRef.current.push(cloneStrokes(strokesRef.current));
    redoStackRef.current = [];
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
      const snapshot = cloneStrokes(strokesRef.current);
      let changed = false;
      strokesRef.current = strokesRef.current.map((st) => {
        if (!selectedRef.current.has(st.id)) return st;
        const color = st.tool === 'HIGHLIGHTER' ? marker : pen;
        if (st.color === color) return st;
        changed = true;
        return { ...st, color };
      });
      if (!changed) return;
      undoStackRef.current.push(snapshot);
      redoStackRef.current = [];
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
        points: st.points.map((pt) => ({ x: pt.x + OFFSET, y: pt.y + OFFSET })),
      }));
    undoStackRef.current.push(cloneStrokes(strokesRef.current));
    redoStackRef.current = [];
    strokesRef.current = [...strokesRef.current, ...copies];
    setSelection(new Set(copies.map((st) => st.id)));
    updateHistoryStatus();
    redrawCanvas();
    saveDrawingToCloud();
    setupCanvas();
  }, [redrawCanvas, saveDrawingToCloud, setSelection, setupCanvas, updateHistoryStatus]);

  useImperativeHandle(
    ref,
    () => ({ undo, redo, getEditor: () => editorRef.current, deleteSelection, recolorSelection, duplicateSelection }),
    [undo, redo, deleteSelection, recolorSelection, duplicateSelection]
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
    if (loadedChapterIdRef.current === chapterId) return;
    loadedChapterIdRef.current = chapterId;

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
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateHistoryStatus();
    logicalRef.current = { w: 0, h: 0 };
    setupCanvas();
  }, [chapterId, chapterContent, drawingDataRaw, setupCanvas, updateHistoryStatus]);

  // O texto cresce, a janela muda, o split abre: o canvas acompanha.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [setupCanvas]);

  // Ponto do ponteiro em coordenadas da folha (independente do zoom).
  const localPoint = (e: { clientX: number; clientY: number }): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas || logicalRef.current.w === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / logicalRef.current.w || 1;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const checkObjectErase = (p: Point) => {
    const thresholdSq = 12 * 12;
    const before = strokesRef.current.length;
    const snapshot = cloneStrokes(strokesRef.current);
    strokesRef.current = strokesRef.current.filter((s) => {
      if (s.tool === 'ERASER') return true;
      if (s.points.length === 1) return (s.points[0].x - p.x) ** 2 + (s.points[0].y - p.y) ** 2 >= thresholdSq;
      for (let i = 0; i < s.points.length - 1; i++) {
        if (distToSegmentSq(p, s.points[i], s.points[i + 1]) < thresholdSq) return false;
      }
      return true;
    });
    if (strokesRef.current.length !== before) {
      undoStackRef.current.push(snapshot);
      redoStackRef.current = [];
      updateHistoryStatus();
      redrawCanvas();
      saveDrawingToCloud();
    }
  };

  const drawingActive = mode === 'EDIT' && tool !== 'TEXT';

  const startDrawing = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingActive) return;
    if (penOnly && e.pointerType === 'touch') {
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
        dragRef.current = { last: p, snapshot: cloneStrokes(strokesRef.current), moved: false };
      } else {
        setSelection(new Set());
        lassoPathRef.current = [p];
        redrawCanvas();
      }
      return;
    }

    if (tool === 'ERASER' && eraserType === 'OBJECT') {
      checkObjectErase(p);
      return;
    }
    preStrokeSnapshotRef.current = cloneStrokes(strokesRef.current);
    currentStrokeRef.current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: tool === 'ERASER' ? 'ERASER' : tool === 'HIGHLIGHTER' ? 'HIGHLIGHTER' : 'PEN',
      color,
      size: tool === 'ERASER' ? 24 : size,
      points: [p],
    };
    redrawCanvas();
  };

  const draw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const finger = fingerRef.current;
    if (finger && finger.id === e.pointerId) {
      finger.box?.scrollBy(finger.x - e.clientX, finger.y - e.clientY);
      finger.x = e.clientX;
      finger.y = e.clientY;
      return;
    }
    if (!isDrawingRef.current || !drawingActive) return;
    if (tool === 'LASSO') {
      const p = localPoint(e);
      if (!p) return;
      const drag = dragRef.current;
      if (drag) {
        const dx = p.x - drag.last.x;
        const dy = p.y - drag.last.y;
        if (dx === 0 && dy === 0) return;
        for (const st of strokesRef.current) {
          if (!selectedRef.current.has(st.id)) continue;
          for (const pt of st.points) {
            pt.x += dx;
            pt.y += dy;
          }
        }
        drag.last = p;
        drag.moved = true;
      } else {
        lassoPathRef.current?.push(p);
      }
      redrawCanvas();
      return;
    }
    const native = e.nativeEvent as PointerEvent;
    const events = native.getCoalescedEvents ? native.getCoalescedEvents() : [native];
    for (const ev of events.length ? events : [native]) {
      const p = localPoint(ev);
      if (!p) continue;
      if (tool === 'ERASER' && eraserType === 'OBJECT') checkObjectErase(p);
      else currentStrokeRef.current?.points.push(p);
    }
    if (currentStrokeRef.current) redrawCanvas();
  };

  const stopDrawing = () => {
    fingerRef.current = null;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool === 'LASSO') {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        if (drag.moved) {
          undoStackRef.current.push(drag.snapshot);
          redoStackRef.current = [];
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
    const stroke = currentStrokeRef.current;
    if (stroke && stroke.points.length > 0) {
      if (preStrokeSnapshotRef.current) undoStackRef.current.push(preStrokeSnapshotRef.current);
      redoStackRef.current = [];
      strokesRef.current.push(stroke);
      updateHistoryStatus();
      currentStrokeRef.current = null;
      preStrokeSnapshotRef.current = null;
      redrawCanvas();
      saveDrawingToCloud();
      setupCanvas();
    }
    currentStrokeRef.current = null;
    preStrokeSnapshotRef.current = null;
  };

  return (
    <div ref={containerRef} className={c.inkWrap}>
      <div
        ref={editorRef}
        contentEditable={mode === 'EDIT'}
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
    </div>
  );
});
