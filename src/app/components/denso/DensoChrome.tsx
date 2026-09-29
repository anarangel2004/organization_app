'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import d from './denso.module.css';

export interface SearchHit {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  external?: boolean;
}

export type DensoSection = 'home' | 'trabalho' | 'faculdade';

// Fecha um pop-up ao tocar/clicar fora dele ou com Esc. Usa pointerdown:
// no Safari do iPhone um toque numa zona "vazia" não gera mousedown/click.
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose]);
}

// ==========================================
// NAVEGAÇÃO (partilhada pelas páginas densas)
// ==========================================
export function DensoHeader({
  active,
  brandNote,
  dateLabel,
  searchIndex,
  searchRef,
  searchPlaceholder = 'Pesquisar índice…',
  userName,
  userEmail,
  onOpenProfile,
  onLogout,
  inset = false,
  compact = false,
}: {
  active: DensoSection;
  brandNote?: string;
  dateLabel?: string;
  searchIndex: SearchHit[];
  searchRef: RefObject<HTMLInputElement | null>;
  searchPlaceholder?: string;
  userName: string | null;
  userEmail: string | null;
  onOpenProfile: () => void;
  onLogout: () => void;
  // true: a linha inferior fica dentro das margens (painel); false: a toda a largura do conteúdo.
  inset?: boolean;
  // true: versão baixa (48px) e a toda a largura, para ecrãs de trabalho como o caderno.
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const clearQuery = useCallback(() => setQuery(''), []);
  useDismiss(menuRef, menuOpen, closeMenu);
  const q = query.trim().toLowerCase();
  useDismiss(searchBoxRef, !!q, clearQuery);
  const hits = q ? searchIndex.filter((h) => h.label.toLowerCase().includes(q)).slice(0, 8) : [];

  const links: [DensoSection, string, string][] = [
    ['home', 'Visão Geral', '/'],
    ['trabalho', 'Trabalho', '/trabalho'],
    ['faculdade', 'Faculdade', '/faculdade'],
  ];

  return (
    <div className={compact ? undefined : d.inner} style={compact ? { padding: '0 16px' } : undefined}>
      <header
        style={{
          minHeight: compact ? 48 : inset ? 60 : 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px 24px',
          flexWrap: 'wrap',
          padding: compact ? '6px 0' : '9px 0',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '8px 36px' : '12px 40px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap' }}>
            <Link href="/" style={{ fontSize: compact ? 19 : 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Organiza-me
            </Link>
            {brandNote && <span style={{ fontSize: 12, color: 'var(--mut2)' }}>{brandNote}</span>}
          </div>
          <nav style={{ display: 'flex', gap: compact ? 24 : 28, fontSize: compact ? 13 : 14, whiteSpace: 'nowrap' }}>
            {links.map(([id, label, href]) => (
              <Link
                key={id}
                href={href}
                aria-current={active === id ? 'page' : undefined}
                style={
                  active === id
                    ? { borderBottom: '2px solid var(--accent)', paddingBottom: 3 }
                    : { color: 'var(--mut)' }
                }
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 12, flexWrap: 'wrap' }}>
          {dateLabel && <span className={d.muted} style={{ fontSize: compact ? 12 : 13, whiteSpace: 'nowrap' }}>{dateLabel}</span>}
          <div ref={searchBoxRef} style={{ position: 'relative' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: compact ? 'min(220px, 80vw)' : 'min(250px, 80vw)',
                height: compact ? 30 : 38,
                border: '1px solid var(--box)',
                padding: compact ? '0 8px' : '0 10px',
              }}
            >
              <span className={d.sr}>Pesquisa global</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setQuery('');
                }}
                placeholder={searchPlaceholder}
                style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: compact ? 12 : 14 }}
              />
              <kbd className={`${d.kbd} ${d.noTouch}`} style={{ fontSize: 11 }}>Ctrl K</kbd>
            </label>
            {q && (
              <div className={d.popover} style={{ left: 0, right: 'auto', width: 'min(340px, 90vw)', padding: 0, maxHeight: 320, overflowY: 'auto' }}>
                {hits.length === 0 && <div style={{ padding: '10px 12px' }}>Sem resultados.</div>}
                {hits.map((h) => {
                  const content = (
                    <>
                      <span style={{ display: 'block', fontSize: 11, color: '#4b4842' }}>{h.sublabel}</span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{h.label}</span>
                    </>
                  );
                  const style = { display: 'block', padding: '8px 12px', borderBottom: '1px solid rgba(13,13,13,.12)', color: 'var(--bg)' } as const;
                  return h.external ? (
                    <a key={h.id} href={h.href} target="_blank" rel="noreferrer" style={style}>{content}</a>
                  ) : (
                    <Link key={h.id} href={h.href} onClick={() => setQuery('')} style={style}>{content}</Link>
                  );
                })}
              </div>
            )}
          </div>
          <Link
            href="/faculdade#nova-disciplina"
            className={d.btnFill}
            style={compact ? { height: 30, padding: '0 12px', fontSize: 12 } : { padding: '0 16px' }}
          >
            Novo dossiê
          </Link>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Perfil"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={d.round}
              style={{
                width: compact ? 30 : 38,
                height: compact ? 30 : 38,
                fontSize: compact ? 12 : undefined,
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: 0,
                fontWeight: 600,
              }}
            >
              {(userName || '·').charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <div className={d.popover} role="menu">
                <span className={d.serif} style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{userName || 'A conta'}</span>
                {userEmail && <span style={{ display: 'block', color: '#4b4842' }}>{userEmail}</span>}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                  style={{ display: 'block', marginTop: 10, background: 'none', border: 0, padding: 0 }}
                >
                  Perfil
                </button>
                <button type="button" onClick={onLogout} style={{ display: 'block', marginTop: 6, background: 'none', border: 0, padding: 0 }}>
                  Terminar sessão
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

// ==========================================
// BARRA DE ATALHOS
// ==========================================
export interface ShortcutItem {
  id: string;
  key: string;
  label: string;
  badge?: string;
}

export function ShortcutBar({
  items,
  active,
  onPick,
  help,
  helpOpen,
  onToggleHelp,
  extra,
  hint,
}: {
  items: ShortcutItem[];
  active: string;
  onPick: (id: string) => void;
  help: [string, string][];
  helpOpen: boolean;
  onToggleHelp: () => void;
  extra?: ReactNode;
  hint?: string;
}) {
  const helpRef = useRef<HTMLDivElement>(null);
  const closeHelp = useCallback(() => {
    if (helpOpen) onToggleHelp();
  }, [helpOpen, onToggleHelp]);
  useDismiss(helpRef, helpOpen, closeHelp);
  return (
    <nav aria-label="Secções da página" className={d.shortcuts}>
      <div className={d.inner} style={{ minHeight: 40, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: '0 28px', fontSize: 13, whiteSpace: 'nowrap', overflowX: 'auto', alignItems: 'stretch' }}>
          {items.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              onClick={() => onPick(it.id)}
              className={`${d.shortcut} ${active === it.id ? d.shortcutOn : ''}`}
            >
              <kbd className={`${d.kbd} ${d.noTouch}`} style={{ borderColor: active === it.id ? '#555' : undefined }}>{it.key}</kbd>
              {it.label}
              {it.badge && <span style={{ color: 'var(--sky)' }}>{it.badge}</span>}
            </a>
          ))}
          {extra}
        </div>
        <div ref={helpRef} className={d.noTouch} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          {hint && <span className={d.hideSm} style={{ fontSize: 12, color: 'var(--mut2)', whiteSpace: 'nowrap' }}>{hint}</span>}
          <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={onToggleHelp} aria-expanded={helpOpen} style={{ height: 28 }}>
            Atalhos ?
          </button>
          {helpOpen && (
            <div className={d.popover} role="dialog" aria-label="Atalhos de teclado">
              {help.map(([k, label]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '3px 0' }}>
                  <span>{label}</span>
                  <kbd style={{ fontFamily: 'inherit', fontWeight: 600 }}>{k}</kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ==========================================
// DETALHES AO PASSAR O RATO (clicar fixa)
// ==========================================
export interface HoverBind {
  open: boolean;
  pinned: boolean;
  hint: string;
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onClick?: () => void;
  };
}

// Um só cartão aberto por página: o do elemento sob o rato, senão o fixado.
export function useHoverPin() {
  const [hov, setHov] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const active = hov ?? pin;

  // Esc ou clique fora de qualquer elemento com detalhes desfaz o fixado.
  useEffect(() => {
    if (!pin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPin(null);
    };
    // pointerdown e não mousedown: no iPhone um toque fora não gera mousedown.
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('[data-hoverpin]')) setPin(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [pin]);

  const bind = useCallback(
    (key: string, canPin = true): HoverBind => ({
      open: active === key,
      pinned: pin === key,
      hint: !canPin ? 'Passa o rato para ver detalhes' : pin === key ? 'Fixado · clica outra vez para fechar' : 'Clica para fixar',
      handlers: {
        onMouseEnter: () => setHov(key),
        onMouseLeave: () => setHov((h) => (h === key ? null : h)),
        onFocus: () => setHov(key),
        onBlur: () => setHov((h) => (h === key ? null : h)),
        onClick: canPin
          ? () => {
              setPin((p) => (p === key ? null : key));
              setHov(null);
            }
          : undefined,
      },
    }),
    [active, pin]
  );

  return { bind, active };
}

export interface PopData {
  title: string;
  tag?: string;
  lines: [string, ReactNode][];
  pct?: number | null;
  pctLabel?: string;
  action?: { label: string; href: string; external?: boolean };
}

export function HoverPop({ data, hint, style }: { data: PopData; hint: string; style?: CSSProperties }) {
  return (
    <div className={d.pop} style={style} role="tooltip" data-hoverpin onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <span className={d.serif} style={{ fontSize: 21, lineHeight: 1.15 }}>{data.title}</span>
        {data.tag && <span className={d.tag}>{data.tag}</span>}
      </div>
      {data.lines.map(([k, v]) => (
        <div key={k} className={d.popLine}>
          <span className={d.popKey}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      {typeof data.pct === 'number' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          <span style={{ flexGrow: 1, display: 'flex', height: 5, background: 'rgba(13,13,13,0.12)' }}>
            <span style={{ width: `${data.pct}%`, background: 'var(--amberdk)' }} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{data.pctLabel ?? `${data.pct}% preparado`}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--papermut)' }}>{hint}</span>
        {data.action &&
          (data.action.external ? (
            <a href={data.action.href} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {data.action.label}
            </a>
          ) : (
            <Link href={data.action.href} style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {data.action.label}
            </Link>
          ))}
      </div>
    </div>
  );
}

// Atalhos de teclado de uma página: ignora teclas enquanto se escreve,
// exceto Esc e Ctrl/⌘+K.
export function useShortcuts(handler: (key: string, e: KeyboardEvent) => boolean, focusSearch: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (e.key === 'Escape') {
        if (typing) el?.blur();
        handler('escape', e);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (handler(e.key === '?' ? '?' : e.key.toLowerCase(), e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, focusSearch]);
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
