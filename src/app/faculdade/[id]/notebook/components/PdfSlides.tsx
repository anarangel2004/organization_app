'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type RenderTask = { cancel: () => void };
import c from './caderno.module.css';
import { usePinchZoom } from './usePinchZoom';

// O pdf.js só existe no browser: carrega-se uma vez, quando é preciso.
// Versão "legacy": a normal (v5) usa JavaScript que só o Safari mais recente
// tem; no iPad/iPhone com iOS mais antigo lia o PDF mas desenhava páginas brancas.
type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfJs>).then((lib) => {
      // Worker da mesma versão, servido pelo jsDelivr (o pdf.js embrulha-o para outra origem).
      lib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/legacy/build/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsPromise;
}

interface PdfSlidesProps {
  url: string;
  page: number;
  onPageChange: (page: number) => void;
  onCount: (total: number) => void;
  linkedPages: Set<number>;
  onError: () => void;
}

// Páginas desenhadas antes e depois das que estão à vista.
const RENDER_MARGIN = 2;
// Zoom do PDF (pinça): de "largura da coluna" até 4×.
const PDF_ZOOM_MIN = 1;
const PDF_ZOOM_MAX = 4;

export function PdfSlides({ url, page, onPageChange, onCount, linkedPages, onError }: PdfSlidesProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderedWidth = useRef<Map<number, number>>(new Map());
  const tasks = useRef<Map<number, RenderTask>>(new Map());
  // Mudança de página que veio do próprio scroll: não voltar a fazer scroll.
  const fromScroll = useRef(false);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratios, setRatios] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState<[number, number]>([1, 3]);
  const [loading, setLoading] = useState(true);
  // Páginas que não se conseguiram desenhar (mensagem à vista no cartão, com "Tentar outra vez").
  const [failed, setFailed] = useState<Map<number, string>>(new Map());
  const [retry, setRetry] = useState(0);
  const failedRef = useRef<Set<number>>(new Set());
  // Zoom: os cartões crescem logo; a nitidez acompanha quando a pinça pára.
  const [zoom, setZoom] = useState(1);
  const [sharpZoom, setSharpZoom] = useState(1);
  usePinchZoom(scrollerRef, zoom, setZoom, PDF_ZOOM_MIN, PDF_ZOOM_MAX);
  useEffect(() => {
    const t = window.setTimeout(() => setSharpZoom(zoom), 200);
    return () => window.clearTimeout(t);
  }, [zoom]);
  const renderWidth = Math.round(width * sharpZoom);

  // Abrir o PDF e ler o formato de cada página.
  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- novo documento
    setLoading(true);
    setDoc(null);
    setRatios([]);
    setFailed(new Map());
    failedRef.current.clear();
    renderedWidth.current.clear();
    cardRefs.current = [];
    canvasRefs.current = [];
    (async () => {
      try {
        const lib = await loadPdfJs();
        opened = await lib.getDocument({ url }).promise;
        if (cancelled) return;
        const list: number[] = [];
        for (let i = 1; i <= opened.numPages; i++) {
          const p = await opened.getPage(i);
          const vp = p.getViewport({ scale: 1 });
          list.push(vp.height / vp.width);
          if (cancelled) return;
        }
        setRatios(list);
        setDoc(opened);
        onCount(opened.numPages);
      } catch (err) {
        if (!cancelled) {
          console.error('Erro ao abrir o PDF:', err);
          onError();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      tasks.current.forEach((t) => t.cancel());
      tasks.current.clear();
      opened?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reabre quando muda o ficheiro
  }, [url]);

  // A largura acompanha o divisor: os cartões esticam logo e são redesenhados nítidos a seguir.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let t: number | undefined;
    const ro = new ResizeObserver(([entry]) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setWidth(Math.floor(entry.contentRect.width)), 120);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  // Que páginas estão à vista e qual é a atual.
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || ratios.length === 0) return;
    const top = el.scrollTop;
    const bottom = top + el.clientHeight;
    let first = 0;
    let last = 0;
    let current = 1;
    let bestDist = Infinity;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const cTop = card.offsetTop;
      const cBottom = cTop + card.offsetHeight;
      if (cBottom >= top && cTop <= bottom) {
        if (!first) first = i + 1;
        last = i + 1;
      }
      // A atual é a que está mais perto do primeiro terço da área visível.
      const dist = Math.abs(cTop + card.offsetHeight / 2 - (top + el.clientHeight / 3));
      if (dist < bestDist) {
        bestDist = dist;
        current = i + 1;
      }
    });
    if (first) setVisible([Math.max(1, first - RENDER_MARGIN), Math.min(ratios.length, last + RENDER_MARGIN)]);
    if (current !== page) {
      fromScroll.current = true;
      onPageChange(current);
    }
  }, [onPageChange, page, ratios.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [measure]);

  // Página pedida de fora (referência nas notas, botões ‹ ›): levar o cartão à vista.
  useEffect(() => {
    if (!doc) return;
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    const card = cardRefs.current[page - 1];
    const el = scrollerRef.current;
    if (card && el) el.scrollTo({ top: card.offsetTop - 16, behavior: 'smooth' });
  }, [doc, page]);

  // Primeira medição quando o documento aparece.
  useEffect(() => {
    if (!doc) return;
    const el = scrollerRef.current;
    const card = cardRefs.current[page - 1];
    if (el && card) el.scrollTop = card.offsetTop - 16;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir o documento
  }, [doc]);

  // Desenhar as páginas à vista na largura atual.
  useEffect(() => {
    if (!doc || renderWidth === 0) return;
    const dpr = window.devicePixelRatio || 1;
    for (let n = visible[0]; n <= visible[1]; n++) {
      if (renderedWidth.current.get(n) === renderWidth) continue;
      if (failedRef.current.has(n)) continue;
      const canvas = canvasRefs.current[n - 1];
      if (!canvas) continue;
      renderedWidth.current.set(n, renderWidth);
      tasks.current.get(n)?.cancel();
      doc
        .getPage(n)
        .then((p) => {
          const base = p.getViewport({ scale: 1 });
          const viewport = p.getViewport({ scale: (renderWidth * dpr) / base.width });
          const off = document.createElement('canvas');
          off.width = Math.floor(viewport.width);
          off.height = Math.floor(viewport.height);
          const ctx = off.getContext('2d');
          if (!ctx) return;
          const task = p.render({ canvas: off, canvasContext: ctx, viewport });
          tasks.current.set(n, task);
          return task.promise.then(() => {
            // Só troca a imagem quando a nova está pronta (sem piscar ao redimensionar).
            canvas.width = off.width;
            canvas.height = off.height;
            canvas.getContext('2d')?.drawImage(off, 0, 0);
            tasks.current.delete(n);
            setFailed((prev) => {
              if (!prev.has(n)) return prev;
              const next = new Map(prev);
              next.delete(n);
              return next;
            });
          });
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
            renderedWidth.current.delete(n);
            console.error(`Erro ao desenhar a página ${n}:`, err);
            const msg = err instanceof Error ? err.message : String(err);
            failedRef.current.add(n);
            setFailed((prev) => new Map(prev).set(n, msg));
          }
        });
    }
  }, [doc, visible, renderWidth, retry]);

  return (
    <div ref={scrollerRef} className={c.slides} style={{ touchAction: 'pan-x pan-y' }}>
      {loading && <p className={c.slidesNote}>A abrir o PDF…</p>}
      {ratios.map((ratio, i) => {
        const n = i + 1;
        const current = n === page;
        const linked = linkedPages.has(n);
        return (
          <div
            key={n}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className={`${c.slide} ${current ? c.slideOn : ''}`}
            style={{ aspectRatio: `1 / ${ratio}`, width: zoom === 1 ? undefined : `${zoom * 100}%` }}
            onClick={() => onPageChange(n)}
            role="button"
            tabIndex={0}
            aria-label={`Página ${n}${linked ? ', ligada às notas' : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPageChange(n);
              }
            }}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              className={c.slideCanvas}
            />
            {failed.has(n) && (
              <span
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, textAlign: 'center', fontSize: 12, color: '#4b4842' }}
              >
                Não foi possível mostrar esta página.
                <span style={{ fontSize: 11, color: '#8a857d', wordBreak: 'break-word' }}>{failed.get(n)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFailed(new Map());
                    failedRef.current.clear();
                    renderedWidth.current.clear();
                    setRetry((r) => r + 1);
                  }}
                  style={{ height: 30, padding: '0 12px', border: '1px solid #b9b3a8', background: '#fff', color: '#1b1b1b', fontSize: 12 }}
                >
                  Tentar outra vez
                </button>
              </span>
            )}
            {linked && <span className={c.slideBadge}>LIGADO ÀS NOTAS</span>}
            <span className={c.slideNum}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}
