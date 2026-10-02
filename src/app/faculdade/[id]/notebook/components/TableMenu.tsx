'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Botão "Tabela" do caderno: fora de uma tabela abre a grelha para escolher o
// tamanho (como no Word); dentro de uma tabela abre as ações (linhas, colunas…).

export type TableAction = 'rowAbove' | 'rowBelow' | 'colLeft' | 'colRight' | 'delRow' | 'delCol' | 'header' | 'delTable';

const MAX_ROWS = 8;
const MAX_COLS = 8;

const keepSelection = (e: ReactMouseEvent) => e.preventDefault();

// O menu é desenhado no <body> (portal) e preso ao ecrã: as barras do caderno
// cortam o que sai delas (overflow), por isso não pode ficar lá dentro.
const panel: CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  fontFamily: "var(--font-instrument), 'Instrument Sans', system-ui, sans-serif",
  maxWidth: 'calc(100vw - 16px)',
  background: '#161616',
  border: '1px solid #333',
  boxShadow: '0 14px 36px rgba(0, 0, 0, 0.55)',
  color: '#efe9df',
  padding: 10,
  minWidth: 200,
};

const item: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  width: '100%',
  minHeight: 34,
  padding: '0 8px',
  background: 'none',
  border: 0,
  color: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};

export function TableMenu({
  inTable,
  header,
  disabled,
  onInsert,
  onAction,
  buttonClass,
  buttonStyle,
  label,
  up = false,
  alignRight = false,
  docked = false,
}: {
  inTable: boolean;
  header: boolean;
  disabled?: boolean;
  onInsert: (rows: number, cols: number) => void;
  onAction: (action: TableAction) => void;
  buttonClass?: string;
  buttonStyle?: CSSProperties;
  label?: ReactNode;
  // Abre para cima (barra do fundo no iPhone).
  up?: boolean;
  // iPhone: a barra faz scroll lateral e cortaria o menu; abre fixo por cima dela.
  docked?: boolean;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [shiftX, setShiftX] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    // Fixo no ecrã: se a página mexer, fecha (em vez de ficar desalinhado).
    const close = () => setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  // Se sair pelos lados do ecrã, encosta à margem.
  useLayoutEffect(() => {
    if (!open || docked) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const dx = r.right > vw - 8 ? vw - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    if (Math.abs(dx) > 0.5) setShiftX((v) => v + dx);
  }, [open, docked, anchor, inTable]);

  const vw = typeof window !== 'undefined' ? document.documentElement.clientWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const pos: CSSProperties = docked
    ? { left: 8, right: 8, bottom: 'calc(64px + env(safe-area-inset-bottom))' }
    : anchor
      ? {
          ...(up ? { bottom: vh - anchor.top + 6 } : { top: anchor.bottom + 6 }),
          ...(alignRight ? { right: vw - anchor.right - shiftX } : { left: anchor.left + shiftX }),
        }
      : { visibility: 'hidden' };

  const act = (a: TableAction) => {
    onAction(a);
    setOpen(false);
  };

  const actions: [TableAction, string, string?][] = [
    ['rowAbove', 'Linha acima'],
    ['rowBelow', 'Linha abaixo', 'Tab na última célula'],
    ['colLeft', 'Coluna à esquerda'],
    ['colRight', 'Coluna à direita'],
    ['header', header ? 'Tirar linha de cabeçalho' : 'Primeira linha como cabeçalho'],
    ['delRow', 'Apagar linha'],
    ['delCol', 'Apagar coluna'],
    ['delTable', 'Apagar tabela'],
  ];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={buttonClass}
        style={buttonStyle}
        disabled={disabled}
        aria-label={inTable ? 'Tabela: linhas e colunas' : 'Inserir tabela'}
        title={inTable ? 'Tabela: linhas e colunas' : 'Inserir tabela'}
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={(e) => {
          setHover([0, 0]);
          setShiftX(0);
          setAnchor(e.currentTarget.getBoundingClientRect());
          setOpen((v) => !v);
        }}
      >
        {label ?? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="1.5" y="2.5" width="13" height="11" />
            <path d="M1.5 6.2h13M1.5 9.8h13M5.8 2.5v11M10.2 2.5v11" />
          </svg>
        )}
      </button>

      {open && createPortal(
        <div ref={panelRef} style={{ ...panel, ...pos }} role="menu" onMouseDown={keepSelection}>
          {inTable ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {actions.map(([a, text, hint], i) => (
                <div key={a}>
                  {(i === 4 || i === 5) && <div style={{ height: 1, background: '#2a2a2a', margin: '4px 0' }} />}
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={keepSelection}
                    onClick={() => act(a)}
                    style={{ ...item, color: a === 'delTable' ? '#e38b7a' : 'inherit' }}
                  >
                    <span>{text}</span>
                    {hint && <span style={{ fontSize: 11, color: '#8a857d' }}>{hint}</span>}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#a7a29a' }}>
                {hover[0] ? `Tabela ${hover[1]} × ${hover[0]}` : 'Escolhe o tamanho'}
                <span style={{ color: '#6b675f' }}>{hover[0] ? ' (colunas × linhas)' : ''}</span>
              </span>
              <div
                style={{ display: 'grid', gridTemplateColumns: `repeat(${MAX_COLS}, ${docked ? 34 : 22}px)`, gap: docked ? 4 : 3, justifyContent: docked ? 'center' : undefined }}
                onMouseLeave={() => setHover([0, 0])}
              >
                {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
                  const r = Math.floor(i / MAX_COLS) + 1;
                  const col = (i % MAX_COLS) + 1;
                  const on = r <= hover[0] && col <= hover[1];
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Tabela de ${col} colunas por ${r} linhas`}
                      onMouseDown={keepSelection}
                      onMouseEnter={() => setHover([r, col])}
                      onFocus={() => setHover([r, col])}
                      onClick={() => {
                        onInsert(r, col);
                        setOpen(false);
                      }}
                      style={{ width: docked ? 34 : 22, height: docked ? 34 : 22, padding: 0, background: on ? '#7fb0cb' : 'transparent', border: `1px solid ${on ? '#7fb0cb' : '#4a4a4a'}` }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onMouseDown={keepSelection}
                onClick={() => {
                  onInsert(3, 3);
                  setOpen(false);
                }}
                style={{ ...item, border: '1px solid #3a3a3a', justifyContent: 'center' }}
              >
                Tabela 3 × 3
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ==========================================
// "Inserir → Tabela…" (computador): janela como a do Word
// ==========================================
// Grelha para escolher com o rato, ou colunas/linhas escritas à mão (até 20).
export function TableSizeDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const [cols, setCols] = useState('3');
  const [rows, setRows] = useState('3');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const clamp = (v: string) => Math.max(1, Math.min(20, Number(v) || 0));
  const valid = Number(cols) >= 1 && Number(cols) <= 20 && Number(rows) >= 1 && Number(rows) <= 20;
  const pick = (r: number, k: number) => {
    onPick(r, k);
    onClose();
  };
  const field: CSSProperties = { width: 64, height: 34, background: '#0d0d0d', color: '#efe9df', border: '1px solid #3a3a3a', padding: '0 8px', fontSize: 14 };

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Inserir tabela"
        style={{ ...panel, position: 'relative', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 300 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Inserir tabela</span>
          <span style={{ fontSize: 12, color: '#a7a29a' }}>{hover[0] ? `${hover[1]} × ${hover[0]}` : 'colunas × linhas'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MAX_COLS}, 26px)`, gap: 4 }} onMouseLeave={() => setHover([0, 0])}>
          {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
            const r = Math.floor(i / MAX_COLS) + 1;
            const k = (i % MAX_COLS) + 1;
            const on = r <= hover[0] && k <= hover[1];
            return (
              <button
                key={i}
                type="button"
                aria-label={`Tabela de ${k} colunas por ${r} linhas`}
                onMouseEnter={() => {
                  setHover([r, k]);
                  setCols(String(k));
                  setRows(String(r));
                }}
                onClick={() => pick(r, k)}
                style={{ width: 26, height: 26, padding: 0, background: on ? '#7fb0cb' : 'transparent', border: `1px solid ${on ? '#7fb0cb' : '#4a4a4a'}` }}
              />
            );
          })}
        </div>
        <div style={{ height: 1, background: '#2a2a2a' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, letterSpacing: '0.06em', color: '#a7a29a' }}>
            COLUNAS
            <input style={field} inputMode="numeric" value={cols} onChange={(e) => setCols(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, letterSpacing: '0.06em', color: '#a7a29a' }}>
            LINHAS
            <input
              style={field}
              inputMode="numeric"
              value={rows}
              onChange={(e) => setRows(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) pick(clamp(rows), clamp(cols));
              }}
            />
          </label>
          <span style={{ flexGrow: 1 }} />
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 12px', background: 'transparent', color: '#a7a29a', border: '1px solid #3a3a3a', fontSize: 13 }}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => pick(clamp(rows), clamp(cols))}
            style={{ height: 34, padding: '0 14px', background: '#e4ded3', color: '#0d0d0d', border: 0, fontSize: 13, fontWeight: 600, opacity: valid ? 1 : 0.5 }}
          >
            Inserir
          </button>
        </div>
        {!valid && <span style={{ fontSize: 12, color: '#e38b7a' }}>Entre 1 e 20 colunas e linhas.</span>}
      </div>
    </div>,
    document.body
  );
}
