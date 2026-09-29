'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import d from './denso.module.css';
import { useDismiss, type DensoSection, type SearchHit, type ShortcutItem } from './DensoChrome';

// ==========================================
// QUE ECRÃ É ESTE
// ==========================================
// phone   → iPhone (e janelas estreitas). iPhone 11: 414px.
// tabletH → iPad deitado: ecrã tátil a partir de 1024px. iPad 9: 1080px.
// tabletV → iPad de pé (e janelas médias). iPad 9: 810px.
// desktop → computador
export type DensoLayout = 'phone' | 'tabletV' | 'tabletH' | 'desktop';

const Q_PHONE = '(max-width: 699px)';
const Q_TABLET_H = '(min-width: 1024px) and (max-width: 1400px) and (pointer: coarse)';
const Q_TABLET_V = '(min-width: 700px) and (max-width: 1099px)';

// O iPad deitado é testado antes do vertical: 1080px cabe nas duas regras.
function readLayout(): DensoLayout {
  if (window.matchMedia(Q_PHONE).matches) return 'phone';
  if (window.matchMedia(Q_TABLET_H).matches) return 'tabletH';
  if (window.matchMedia(Q_TABLET_V).matches) return 'tabletV';
  return 'desktop';
}

function subscribeLayout(onChange: () => void) {
  const lists = [Q_PHONE, Q_TABLET_V, Q_TABLET_H].map((q) => window.matchMedia(q));
  lists.forEach((m) => m.addEventListener('change', onChange));
  return () => lists.forEach((m) => m.removeEventListener('change', onChange));
}

// No servidor desenha-se a versão de computador; o browser corrige logo a seguir.
export function useDensoLayout(): DensoLayout {
  return useSyncExternalStore(subscribeLayout, readLayout, () => 'desktop');
}

export function layoutClasses(layout: DensoLayout): string {
  if (layout === 'desktop') return '';
  return `${d.touch} ${d[layout]}`;
}

const NAV: [DensoSection, string, string][] = [
  ['home', 'Visão Geral', '/'],
  ['trabalho', 'Trabalho', '/trabalho'],
  ['faculdade', 'Faculdade', '/faculdade'],
];

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </svg>
  );
}

function useHits(searchIndex: SearchHit[], query: string) {
  const q = query.trim().toLowerCase();
  return q ? searchIndex.filter((h) => h.label.toLowerCase().includes(q)).slice(0, 12) : [];
}

function HitLink({ hit, onPick, dark }: { hit: SearchHit; onPick: () => void; dark?: boolean }) {
  const content = (
    <>
      <span style={{ display: 'block', fontSize: 11, color: dark ? 'var(--mut2)' : '#4b4842' }}>{hit.sublabel}</span>
      <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{hit.label}</span>
    </>
  );
  const style = dark ? undefined : ({ display: 'block', padding: '10px 12px', borderBottom: '1px solid rgba(13,13,13,.12)', color: 'var(--bg)' } as const);
  return hit.external ? (
    <a href={hit.href} target="_blank" rel="noreferrer" className={dark ? d.hit : undefined} style={style} onClick={onPick}>
      {content}
    </a>
  ) : (
    <Link href={hit.href} className={dark ? d.hit : undefined} style={style} onClick={onPick}>
      {content}
    </Link>
  );
}

// ==========================================
// CABEÇALHO DO IPAD
// ==========================================
export function TabletHeader({
  active,
  searchIndex,
  userName,
  userEmail,
  onOpenProfile,
  onLogout,
}: {
  active: DensoSection;
  searchIndex: SearchHit[];
  userName: string | null;
  userEmail: string | null;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const hits = useHits(searchIndex, query);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, []);
  const closeAll = useCallback(() => {
    closeSearch();
    setMenuOpen(false);
  }, [closeSearch]);
  // Tocar em qualquer sítio fora da pesquisa/menu fecha-os.
  useDismiss(rightRef, searchOpen || menuOpen, closeAll);

  return (
    <header className={d.tabHeader}>
      <Link href="/" style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        Organiza-me
      </Link>
      <nav className={d.segNav} aria-label="Navegação principal">
        {NAV.map(([id, label, href]) => (
          <Link key={id} href={href} aria-current={active === id ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <div ref={rightRef} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'relative' }}>
        <button type="button" className={d.iconBtn} aria-label="Pesquisar" aria-expanded={searchOpen} onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}>
          <SearchIcon />
        </button>
        <Link href="/faculdade#nova-disciplina" className={d.btnFill}>
          Novo dossiê
        </Link>
        <button
          type="button"
          aria-label="Perfil"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className={d.round}
          style={{ width: 40, height: 40, background: 'var(--ink)', color: 'var(--bg)', border: 0, fontWeight: 600 }}
        >
          {(userName || '·').charAt(0).toUpperCase()}
        </button>

        {searchOpen && (
          <div className={d.popover} style={{ width: 'min(380px, 90vw)', padding: 0 }} role="dialog" aria-label="Pesquisa global">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', borderBottom: '1px solid rgba(13,13,13,.15)' }}>
              <span className={d.sr}>Pesquisar</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                placeholder="Pesquisar índice…"
                style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 16, color: 'var(--bg)' }}
              />
            </label>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {query.trim() && hits.length === 0 && <div style={{ padding: '10px 12px' }}>Sem resultados.</div>}
              {hits.map((h) => (
                <HitLink key={h.id} hit={h} onPick={closeSearch} />
              ))}
            </div>
          </div>
        )}
        {menuOpen && (
          <ProfileMenu userName={userName} userEmail={userEmail} onOpenProfile={onOpenProfile} onLogout={onLogout} onClose={() => setMenuOpen(false)} />
        )}
      </div>
    </header>
  );
}

export function ProfileMenu({
  userName,
  userEmail,
  onOpenProfile,
  onLogout,
  onClose,
  style,
}: {
  userName: string | null;
  userEmail: string | null;
  onOpenProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
  style?: CSSProperties;
}) {
  return (
    <div className={d.popover} role="menu" style={style}>
      <span className={d.serif} style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{userName || 'A conta'}</span>
      {userEmail && <span style={{ display: 'block', color: '#4b4842' }}>{userEmail}</span>}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenProfile();
        }}
        style={{ display: 'block', marginTop: 10, background: 'none', border: 0, padding: '6px 0', fontSize: 14 }}
      >
        Perfil
      </button>
      <button type="button" onClick={onLogout} style={{ display: 'block', background: 'none', border: 0, padding: '6px 0', fontSize: 14 }}>
        Terminar sessão
      </button>
    </div>
  );
}

// Avatar com menu de perfil (iPhone, onde não há cabeçalho da app).
export function AvatarMenu({
  userName,
  userEmail,
  onOpenProfile,
  onLogout,
}: {
  userName: string | null;
  userEmail: string | null;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Perfil"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={d.round}
        style={{ width: 36, height: 36, background: 'var(--ink)', color: 'var(--bg)', border: 0, fontWeight: 600, fontSize: 14 }}
      >
        {(userName || '·').charAt(0).toUpperCase()}
      </button>
      {open && <ProfileMenu userName={userName} userEmail={userEmail} onOpenProfile={onOpenProfile} onLogout={onLogout} onClose={close} />}
    </div>
  );
}

// ==========================================
// PAINEL DE DETALHES (sobe do fundo; toca fora para fechar)
// ==========================================
export function BottomSheet({
  title,
  tag,
  onClose,
  children,
}: {
  title: string;
  tag?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // A página por trás não faz scroll enquanto o painel está aberto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={d.sheetBackdrop} onClick={onClose} role="presentation">
      <div className={d.sheet} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <span className={d.sheetGrip} aria-hidden="true" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <span className={d.serif} style={{ fontSize: 24, lineHeight: 1.15 }}>{title}</span>
          {tag && <span className={d.tag}>{tag}</span>}
        </div>
        {children}
        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 6, width: '100%', height: 44, background: 'var(--bg)', color: 'var(--ink)', border: 0, fontSize: 14, fontWeight: 500 }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// Uma linha "rótulo · valor" dentro do painel de detalhes.
export function SheetLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={d.popLine}>
      <span className={d.popKey}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

// ==========================================
// SECÇÕES EM BOTÕES (iPad e iPhone)
// ==========================================
export function SectionChips({
  items,
  active,
  onPick,
  links = [],
}: {
  items: ShortcutItem[];
  active: string;
  onPick: (id: string) => void;
  // Atalhos para outras páginas no fim (ex.: siglas das disciplinas).
  links?: { href: string; label: string }[];
}) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const chip = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !chip) return;
    const left = chip.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft + 16 || left + chip.offsetWidth > nav.scrollLeft + nav.clientWidth - 16) {
      nav.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
    }
  }, [active]);
  return (
    <nav ref={navRef} aria-label="Secções" className={d.chips}>
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          onClick={(e) => {
            e.preventDefault();
            onPick(it.id);
          }}
          aria-current={active === it.id ? 'true' : undefined}
          className={`${d.chip} ${active === it.id ? d.chipOn : ''}`}
        >
          {it.label}
          {it.badge && <span style={{ color: active === it.id ? 'inherit' : 'var(--sky)' }}>{it.badge}</span>}
        </a>
      ))}
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={d.chip}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// ==========================================
// IPHONE: BARRA DE BAIXO + PESQUISA
// ==========================================
const TAB_ICONS: Record<DensoSection, ReactNode> = {
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </svg>
  ),
  trabalho: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3.5" y="7.5" width="17" height="12" />
      <path d="M8.5 7.5V4.5h7v3" />
      <path d="M3.5 12.5h17" />
    </svg>
  ),
  faculdade: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 5.5h6.5a2 2 0 012 2V20a1.5 1.5 0 00-1.5-1.5H4z" />
      <path d="M20 5.5h-6.5a2 2 0 00-2 2V20a1.5 1.5 0 011.5-1.5H20z" />
    </svg>
  ),
};

export function PhoneTabBar({ active, searchIndex }: { active: DensoSection; searchIndex: SearchHit[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const hits = useHits(searchIndex, query);
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <nav aria-label="Navegação principal" className={d.tabBar}>
        {NAV.map(([id, label, href]) => (
          <Link key={id} href={href} aria-current={active === id ? 'page' : undefined}>
            {TAB_ICONS[id]}
            <span>{label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open}>
          <SearchIcon size={24} />
          <span>Pesquisar</span>
        </button>
      </nav>

      {open && (
        <div className={d.searchSheet} role="dialog" aria-label="Pesquisa global">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label className={d.searchField} style={{ flexGrow: 1 }}>
              <span className={d.sr}>Pesquisar</span>
              <SearchIcon />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar índice…"
              />
            </label>
            <button type="button" onClick={close} style={{ background: 'none', border: 0, color: 'var(--sky)', fontSize: 15, padding: '8px 0' }}>
              Cancelar
            </button>
          </div>
          <div style={{ overflowY: 'auto', flexGrow: 1 }}>
            {query.trim() && hits.length === 0 && <p className={d.muted} style={{ margin: '8px 2px' }}>Sem resultados.</p>}
            {hits.map((h) => (
              <HitLink key={h.id} hit={h} onPick={close} dark />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
