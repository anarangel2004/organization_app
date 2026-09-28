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
import { EraserType, MARKER_INKS, NoteMode, Tool } from '../types';

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
  },
  ref
) {
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
  }, []);

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

  useImperativeHandle(ref, () => ({ undo, redo, getEditor: () => editorRef.current }), [undo, redo]);

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
      strokesRef.current = Array.isArray(parsed) ? parsed : [];
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
    const p = localPoint(e);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;

    if (tool === 'ERASER' && eraserType === 'OBJECT') {
      checkObjectErase(p);
      return;
    }
    preStrokeSnapshotRef.current = cloneStrokes(strokesRef.current);
    currentStrokeRef.current = {
      id: `${Date.now()}`,
      tool: tool === 'ERASER' ? 'ERASER' : tool === 'HIGHLIGHTER' ? 'HIGHLIGHTER' : 'PEN',
      color,
      size: tool === 'ERASER' ? 24 : size,
      points: [p],
    };
    redrawCanvas();
  };

  const draw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !drawingActive) return;
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
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
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
