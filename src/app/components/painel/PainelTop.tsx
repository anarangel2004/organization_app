'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import type { SearchEntry } from '../types';

export type CtxFilter = 'all' | 'trab';

// Faixa osso no topo: foco de hoje, próxima aula, citação e botão de foco.
export function TopStrip({
  focusLabel,
  nextLabel,
  quote,
  focusRunning,
  onToggleFocus,
}: {
  focusLabel: string;
  nextLabel: string;
  quote: string;
  focusRunning: boolean;
  onToggleFocus: () => void;
}) {
  return (
    <div style={{ background: 'var(--bone)', color: 'var(--inkdark)' }}>
      <div
        className={s.inner}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '6px 20px',
          minHeight: 38,
          paddingTop: 5,
          paddingBottom: 5,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <span>{focusLabel}</span>
        <span>{nextLabel}</span>
        <span className={`${s.serif} ${s.hideSm}`} style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 14 }}>
          {quote}
        </span>
        <button type="button" onClick={onToggleFocus} className={s.btnDark} aria-pressed={focusRunning}>
          {focusRunning ? 'Pausar foco' : 'Iniciar foco'}
        </button>
      </div>
    </div>
  );
}

export interface AccountProps {
  userName: string | null;
  userEmail: string | null;
  onOpenProfile: () => void;
  onLogout: () => void;
}

// Medidas que mudam entre o painel compacto e as páginas de secção.
interface Scale {
  text: number;
  small: number;
  brand: number;
  avatar: number;
  navGap: number;
  gap: number;
  rowMargin: number;
  rowPadding: number;
  searchWidth: number;
}

const REGULAR: Scale = { text: 15, small: 13, brand: 30, avatar: 40, navGap: 36, gap: 16, rowMargin: 24, rowPadding: 14, searchWidth: 260 };
const COMPACT: Scale = { text: 12, small: 11, brand: 25, avatar: 33, navGap: 30, gap: 13, rowMargin: 20, rowPadding: 12, searchWidth: 216 };

// Pesquisa + "Novo dossiê" + menu da conta, partilhados pelos cabeçalhos.
function HeaderTools({
  scale,
  searchIndex,
  searchPlaceholder,
  newDossierHref,
  userName,
  userEmail,
  onOpenProfile,
  onLogout,
}: AccountProps & { scale: Scale; searchIndex: SearchEntry[]; searchPlaceholder: string; newDossierHref?: string }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = q ? searchIndex.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 6) : [];
  const menuLink = { display: 'block', fontSize: scale.small + 1 } as const;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: scale.gap, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'block' }}>
          <span className={s.sr}>Pesquisar</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={s.boxInput}
            style={{ width: `min(${scale.searchWidth}px, 70vw)` }}
          />
        </label>
        {q && (
          <div
            style={{
              position: 'absolute',
              zIndex: 50,
              top: 'calc(100% + 6px)',
              left: 0,
              width: 'min(320px, 90vw)',
              background: 'var(--bone)',
              color: 'var(--inkdark)',
              boxShadow: '6px 6px 0 var(--petro2)',
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {results.length > 0 ? (
              results.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  onClick={() => setQuery('')}
                  style={{ display: 'block', padding: '10px 14px', borderBottom: '1px solid rgba(12,12,12,.12)' }}
                >
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--subdark)' }}>{r.sublabel}</span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{r.label}</span>
                </Link>
              ))
            ) : (
              <div style={{ padding: '12px 14px', fontSize: 14, color: 'var(--subdark)' }}>Sem resultados.</div>
            )}
          </div>
        )}
      </div>

      {newDossierHref ? (
        <a href={newDossierHref} className={s.btnBone}>
          Nova disciplina
        </a>
      ) : (
        <div className={s.hv}>
          <button type="button" className={s.btnBone} aria-haspopup="menu">
            Novo dossiê
          </button>
          <div className={s.menu} role="menu">
            <Link className={s.nl} href="/faculdade#nova-disciplina" style={menuLink}>
              Nova disciplina
            </Link>
            <Link className={s.nl} href="/trabalho" style={{ ...menuLink, marginTop: 8 }}>
              Novo projeto ou tarefa
            </Link>
          </div>
        </div>
      )}

      <div className={s.hv}>
        <button
          type="button"
          aria-label="A minha conta"
          className={s.round}
          style={{
            width: scale.avatar,
            height: scale.avatar,
            background: 'var(--bone)',
            color: 'var(--inkdark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: scale.text,
            textAlign: 'center',
          }}
        >
          {(userName || '·').charAt(0).toUpperCase()}
        </button>
        <div className={s.menu} role="menu">
          <span className={s.serif} style={{ display: 'block', fontWeight: 600, fontSize: scale.text + 4, lineHeight: 1.1 }}>
            {userName || 'A conta'}
          </span>
          {userEmail && (
            <span style={{ display: 'block', marginTop: 2, fontSize: scale.small, color: 'var(--subdark)' }}>{userEmail}</span>
          )}
          <button type="button" className={s.nl} onClick={onOpenProfile} style={{ ...menuLink, marginTop: 12 }}>
            Perfil
          </button>
          <button type="button" className={s.nl} onClick={onLogout} style={{ ...menuLink, marginTop: 8 }}>
            Terminar sessão
          </button>
        </div>
      </div>
    </div>
  );
}

function headerRow(scale: Scale) {
  return {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: scale.gap,
    marginTop: scale.rowMargin,
    borderTop: '1px solid var(--hair)',
    paddingTop: scale.rowPadding,
  } as const;
}

function Brand({ size }: { size: number }) {
  return (
    <Link href="/" className={s.display} style={{ fontSize: size, letterSpacing: '-.03em' }}>
      Organiza-me
    </Link>
  );
}

interface HeaderProps extends AccountProps {
  location: string;
  editionNumber: number;
  dateLabel: string;
  ctx: CtxFilter;
  onCtxChange: (c: CtxFilter) => void;
  searchIndex: SearchEntry[];
}

// Cabeçalho da página principal (escala compacta) com filtro de contexto.
export function PainelHeader({ location, editionNumber, dateLabel, ctx, onCtxChange, searchIndex, ...account }: HeaderProps) {
  const sc = COMPACT;
  return (
    <header className={s.inner} style={{ paddingTop: 23 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: sc.gap }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 23, flexWrap: 'wrap' }}>
          <Brand size={sc.brand} />
          <span className={s.muted} style={{ fontSize: sc.text }}>{location}</span>
          <span className={s.muted} style={{ fontSize: sc.text }}>N.º {editionNumber}</span>
        </div>
        <span style={{ fontSize: sc.text }}>{dateLabel}</span>
      </div>

      <div style={headerRow(sc)}>
        <nav aria-label="Contexto" style={{ display: 'flex', gap: sc.navGap, fontSize: sc.text, flexWrap: 'wrap' }}>
          {(
            [
              ['all', 'Visão Geral'],
              ['trab', 'Trabalho'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${s.nl} ${ctx === id ? s.nlOn : ''}`}
              aria-pressed={ctx === id}
              onClick={() => onCtxChange(id)}
            >
              {label}
            </button>
          ))}
          <Link className={s.nl} href="/faculdade">Faculdade</Link>
          <Link className={s.nl} href="/trabalho">Projetos</Link>
        </nav>
        <HeaderTools scale={sc} searchIndex={searchIndex} searchPlaceholder="Pesquisar em tudo" {...account} />
      </div>
    </header>
  );
}

export type SiteSection = 'faculdade' | 'trabalho';

// Cabeçalho das páginas de secção (Faculdade, …), na escala original.
export function SiteHeader({
  active,
  dateLabel,
  searchIndex,
  searchPlaceholder,
  newDossierHref,
  ...account
}: AccountProps & {
  active: SiteSection;
  dateLabel: string;
  searchIndex: SearchEntry[];
  searchPlaceholder: string;
  newDossierHref?: string;
}) {
  const sc = REGULAR;
  const links: [SiteSection | 'home', string, string][] = [
    ['home', 'Visão Geral', '/'],
    ['trabalho', 'Trabalho', '/trabalho'],
    ['faculdade', 'Faculdade', '/faculdade'],
  ];
  return (
    <header className={s.inner} style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: sc.gap }}>
        <Brand size={sc.brand} />
        <span style={{ fontSize: sc.text }}>{dateLabel}</span>
      </div>
      <div style={headerRow(sc)}>
        <nav aria-label="Secções" style={{ display: 'flex', gap: sc.navGap, fontSize: sc.text, flexWrap: 'wrap' }}>
          {links.map(([id, label, href]) => (
            <Link
              key={id}
              href={href}
              className={`${s.nl} ${active === id ? s.nlOn : ''}`}
              aria-current={active === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <HeaderTools
          scale={sc}
          searchIndex={searchIndex}
          searchPlaceholder={searchPlaceholder}
          newDossierHref={newDossierHref}
          {...account}
        />
      </div>
    </header>
  );
}
