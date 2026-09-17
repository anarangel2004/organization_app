'use client';

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { PaperStyle } from '../types';

type ActiveTool = 'TEXT' | 'PEN' | 'HIGHLIGHTER' | 'ERASER';
type EraserType = 'SMALL' | 'LARGE' | 'OBJECT';

interface Stroke {
  id: string;
  tool: 'PEN' | 'HIGHLIGHTER' | 'ERASER';
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

export interface DrawingCanvasRef {
  undo: () => void;
  redo: () => void;
}

interface DrawingCanvasProps {
  paperStyle: PaperStyle;
  viewMode: 'EDIT' | 'PREVIEW';
  activeTool: ActiveTool;
  penColor: string;
  penSize: number;
  eraserType: EraserType;
  chapterId: string;
  chapterContent?: string;
  drawingDataRaw?: string;
  onUpdateContent?: (content: string) => void;
  onUpdateDrawing?: (drawingData: string) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

function distToSegmentSq(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

const cloneStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ ...p })),
  }));

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      paperStyle,
      viewMode,
      activeTool,
      penColor,
      penSize,
      eraserType,
      chapterId,
      chapterContent,
      drawingDataRaw,
      onUpdateContent,
      onUpdateDrawing,
      onHistoryChange,
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

    const [hoveredLink, setHoveredLink] = useState<{
      text: string;
      top: number;
      left: number;
    } | null>(null);

    const updateHistoryStatus = useCallback(() => {
      onHistoryChange?.(
        undoStackRef.current.length > 0,
        redoStackRef.current.length > 0
      );
    }, [onHistoryChange]);

    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      const pts = stroke.points;
      if (pts.length === 0) return;

      ctx.save();
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'ERASER') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = stroke.size;
      } else if (stroke.tool === 'HIGHLIGHTER') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255, 230, 0, 0.35)';
        ctx.fillStyle = 'rgba(255, 230, 0, 0.35)';
        ctx.lineWidth = stroke.size * 3;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.size;
      }

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);

        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }

        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }

      ctx.restore();
    };

    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const width = rect?.width || 800;
      const height = Math.max(rect?.height || 640, 640);

      ctx.clearRect(0, 0, width, height);

      strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
      if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
    }, []);

    const saveDrawingToCloud = useCallback(() => {
      const jsonStr = JSON.stringify(strokesRef.current);
      onUpdateDrawing?.(jsonStr);
    }, [onUpdateDrawing]);

    const undo = useCallback(() => {
      if (undoStackRef.current.length === 0) return;

      const previousState = undoStackRef.current.pop()!;
      redoStackRef.current.push(cloneStrokes(strokesRef.current));

      strokesRef.current = previousState;
      redrawCanvas();
      saveDrawingToCloud();
      updateHistoryStatus();
    }, [redrawCanvas, saveDrawingToCloud, updateHistoryStatus]);

    const redo = useCallback(() => {
      if (redoStackRef.current.length === 0) return;

      const nextState = redoStackRef.current.pop()!;
      undoStackRef.current.push(cloneStrokes(strokesRef.current));

      strokesRef.current = nextState;
      redrawCanvas();
      saveDrawingToCloud();
      updateHistoryStatus();
    }, [redrawCanvas, saveDrawingToCloud, updateHistoryStatus]);

    useImperativeHandle(ref, () => ({
      undo,
      redo,
    }));

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (viewMode !== 'EDIT' || activeTool === 'TEXT') return;

        const isZ = e.key.toLowerCase() === 'z';
        const isY = e.key.toLowerCase() === 'y';
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        if (isCtrlOrCmd && isZ) {
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
        } else if (isCtrlOrCmd && isY) {
          e.preventDefault();
          redo();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, activeTool, undo, redo]);

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = Math.max(rect.height, 640);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
      }

      redrawCanvas();
    }, [redrawCanvas]);

    useEffect(() => {
      if (loadedChapterIdRef.current !== chapterId) {
        loadedChapterIdRef.current = chapterId;

        if (editorRef.current && editorRef.current.innerHTML !== (chapterContent || '')) {
          editorRef.current.innerHTML = chapterContent || '';
        }

        if (drawingDataRaw) {
          try {
            const parsed = JSON.parse(drawingDataRaw);
            strokesRef.current = Array.isArray(parsed) ? parsed : [];
          } catch {
            strokesRef.current = [];
          }
        } else {
          strokesRef.current = [];
        }

        undoStackRef.current = [];
        redoStackRef.current = [];
        updateHistoryStatus();

        setupCanvas();
      }
    }, [chapterId, chapterContent, drawingDataRaw, setupCanvas, updateHistoryStatus]);

    useEffect(() => {
      window.addEventListener('resize', setupCanvas);
      return () => window.removeEventListener('resize', setupCanvas);
    }, [setupCanvas]);

    const handleInput = () => {
      if (!editorRef.current) return;
      onUpdateContent?.(editorRef.current.innerHTML);
    };

    const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link) {
        const href = link.getAttribute('href');

        if (href && (href.startsWith('#page=') || href.includes('page='))) {
          e.preventDefault();
          e.stopPropagation();

          const pageMatch = href.match(/page=(\d+)/);
          const pageNumber = pageMatch ? pageMatch[1] : null;

          if (pageNumber) {
            window.dispatchEvent(
              new CustomEvent('pdf:navigate', { detail: { page: Number(pageNumber) } })
            );

            const pdfIframe = document.querySelector('iframe') as HTMLIFrameElement;
            if (pdfIframe) {
              const cleanSrc = pdfIframe.src.split('#')[0];
              const targetUrl = `${cleanSrc}#page=${pageNumber}`;

              pdfIframe.src = 'about:blank';
              setTimeout(() => {
                pdfIframe.src = targetUrl;
              }, 10);
            }
          }
        }
      }
    };

    const handleEditorMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && containerRef.current) {
        const href = link.getAttribute('href') || '';
        let label = href;

        const pageMatch = href.match(/page=(\d+)/);
        if (pageMatch) {
          label = `PÁGINA ${pageMatch[1]} DO PDF`;
        } else if (href.startsWith('#')) {
          label = `SECÇÃO ${href.replace('#', '').toUpperCase()}`;
        }

        const linkRect = link.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        setHoveredLink({
          text: label,
          top: linkRect.top - containerRect.top - 28,
          left: Math.max(0, linkRect.left - containerRect.left),
        });
      } else {
        setHoveredLink(null);
      }
    };

    const handleEditorMouseLeave = () => {
      setHoveredLink(null);
    };

    const checkObjectErase = (x: number, y: number) => {
      const thresholdSq = 12 * 12;
      const originalCount = strokesRef.current.length;

      const previousStrokes = cloneStrokes(strokesRef.current);

      strokesRef.current = strokesRef.current.filter((stroke) => {
        if (stroke.tool === 'ERASER') return true;
        for (let i = 0; i < stroke.points.length - 1; i++) {
          if (distToSegmentSq({ x, y }, stroke.points[i], stroke.points[i + 1]) < thresholdSq) {
            return false;
          }
        }
        return true;
      });

      if (strokesRef.current.length !== originalCount) {
        undoStackRef.current.push(previousStrokes);
        redoStackRef.current = [];
        updateHistoryStatus();

        redrawCanvas();
        saveDrawingToCloud();
      }
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (viewMode === 'PREVIEW' || activeTool === 'TEXT') return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      isDrawingRef.current = true;
      preStrokeSnapshotRef.current = cloneStrokes(strokesRef.current);

      if (activeTool === 'ERASER' && eraserType === 'OBJECT') {
        checkObjectErase(x, y);
        return;
      }

      currentStrokeRef.current = {
        id: Date.now().toString(),
        tool: activeTool === 'ERASER' ? 'ERASER' : activeTool === 'HIGHLIGHTER' ? 'HIGHLIGHTER' : 'PEN',
        color: penColor,
        size: activeTool === 'ERASER' ? (eraserType === 'LARGE' ? 24 : 8) : penSize,
        points: [{ x, y }],
      };

      redrawCanvas();
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || viewMode === 'PREVIEW' || activeTool === 'TEXT') return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents
        ? (e.nativeEvent as PointerEvent).getCoalescedEvents()
        : [e];

      for (const ev of events) {
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        if (activeTool === 'ERASER' && eraserType === 'OBJECT') {
          checkObjectErase(x, y);
        } else if (currentStrokeRef.current) {
          currentStrokeRef.current.points.push({ x, y });
          redrawCanvas();
        }
      }
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
        if (preStrokeSnapshotRef.current) {
          undoStackRef.current.push(preStrokeSnapshotRef.current);
          redoStackRef.current = [];
          updateHistoryStatus();
        }
        strokesRef.current.push(currentStrokeRef.current);
      }

      currentStrokeRef.current = null;
      preStrokeSnapshotRef.current = null;

      redrawCanvas();
      saveDrawingToCloud();
    };

    return (
      <div ref={containerRef} className="relative min-h-[640px] w-full">
        {hoveredLink && (
          <div
            style={{ top: `${hoveredLink.top}px`, left: `${hoveredLink.left}px` }}
            className="absolute z-30 pointer-events-none bg-[#111111] text-[#FCF9F2] font-mono text-[10px] font-bold px-2 py-1 shadow-md flex items-center gap-1.5 border border-[#D8D5CC] animate-in fade-in duration-100"
          >
            <span className="text-[#E2DFD6]">🔗</span>
            <span>{hoveredLink.text}</span>
          </div>
        )}

        <div
          className={`absolute inset-0 pointer-events-none z-0 ${
            paperStyle === 'PAUTADO'
              ? 'bg-[linear-gradient(to_bottom,transparent_24px,#D8D5CC_24px,#D8D5CC_25px,transparent_25px)] bg-[size:100%_32px] bg-local'
              : paperStyle === 'QUADRICULA'
              ? 'bg-[linear-gradient(to_right,#E5E2D9_1px,transparent_1px),linear-gradient(to_bottom,transparent_24px,#E5E2D9_24px,#E5E2D9_25px,transparent_25px)] bg-[size:32px_32px] bg-local'
              : ''
          }`}
        />

        <div
          ref={editorRef}
          contentEditable={viewMode === 'EDIT'}
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleEditorClick}
          onMouseOver={handleEditorMouseOver}
          onMouseLeave={handleEditorMouseLeave}
          className="relative z-10 w-full min-h-[640px] font-sans text-base text-[#111111] bg-transparent focus:outline-none 
            [&_*]:m-0 [&_*]:p-0 [&_*]:box-border
            [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:leading-[32px] [&_h2]:min-h-[32px]
            [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:leading-[32px] [&_h3]:min-h-[32px]
            [&_p]:text-[14px] [&_p]:font-normal [&_p]:leading-[32px] [&_p]:min-h-[32px]
            [&_div]:leading-[32px] [&_div]:min-h-[32px]
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:leading-[32px]
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:leading-[32px]
            [&_li]:leading-[32px] [&_li]:min-h-[32px]
            [&_a]:text-[#1D4ED8] [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-2 [&_a]:font-medium [&_a]:cursor-pointer hover:[&_a]:bg-[#1D4ED8]/10 hover:[&_a]:text-[#1E40AF]"
        />

        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className={`absolute inset-0 z-20 touch-none ${
            viewMode === 'EDIT' && activeTool !== 'TEXT'
              ? 'pointer-events-auto cursor-crosshair'
              : 'pointer-events-none'
          }`}
        />
      </div>
    );
  }
);