'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

// Zoom com dois dedos numa área com scroll (a folha do caderno, o PDF):
// - pinça no ecrã tátil (iPad, PC com ecrã tátil): dois toques a afastar/aproximar;
// - pinça no touchpad do PC: o browser envia-a como roda + Ctrl (Ctrl + roda do rato também).
// O ponto entre os dedos (ou debaixo do cursor) fica no mesmo sítio ao ampliar.
// O conteúdo da área tem de crescer na proporção do zoom.
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  zoom: number,
  setZoom: ((zoom: number) => void) | undefined,
  min: number,
  max: number
) {
  const zoomRef = useRef(zoom);
  const anchorRef = useRef<{ cx: number; cy: number; mx: number; my: number } | null>(null);
  useEffect(() => {
    zoomRef.current = zoom;
  });

  // Depois de o zoom mudar, repõe o scroll para o ponto ficar debaixo dos dedos.
  useLayoutEffect(() => {
    const a = anchorRef.current;
    const el = ref.current;
    if (!a || !el) return;
    anchorRef.current = null;
    el.scrollLeft = a.cx * zoom - a.mx;
    el.scrollTop = a.cy * zoom - a.my;
  }, [zoom, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !setZoom) return;

    const apply = (wanted: number, clientX: number, clientY: number) => {
      const z0 = zoomRef.current;
      const z = Math.min(max, Math.max(min, Math.round(wanted * 100) / 100));
      if (z === z0) return;
      const r = el.getBoundingClientRect();
      const mx = clientX - r.left;
      const my = clientY - r.top;
      anchorRef.current = { cx: (mx + el.scrollLeft) / z0, cy: (my + el.scrollTop) / z0, mx, my };
      zoomRef.current = z;
      setZoom(z);
    };

    // Touchpad (e Ctrl + roda): sem isto o browser ampliava a página toda.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      apply(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };

    // Ecrã tátil: dois dedos.
    const pts = new Map<number, { x: number; y: number }>();
    let start: { dist: number; zoom: number } | null = null;
    const pair = () => {
      const [a, b] = Array.from(pts.values());
      return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) start = { dist: pair().dist, zoom: zoomRef.current };
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!start || pts.size < 2) return;
      e.preventDefault();
      const { dist, mx, my } = pair();
      apply(start.zoom * (dist / start.dist), mx, my);
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) start = null;
    };

    const opts = { capture: true, passive: false } as const;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', down, opts);
    el.addEventListener('pointermove', move, opts);
    el.addEventListener('pointerup', up, opts);
    el.addEventListener('pointercancel', up, opts);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', down, opts);
      el.removeEventListener('pointermove', move, opts);
      el.removeEventListener('pointerup', up, opts);
      el.removeEventListener('pointercancel', up, opts);
    };
  }, [ref, setZoom, min, max]);
}
