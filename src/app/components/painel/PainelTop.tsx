'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import type { SearchEntry } from '../types';

export type CtxFilter = 'all' | 'trab';
export type ViewMode = 'revue' | 'cahier';

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
          gap: '8px 24px',
          minHeight: 46,
          paddingTop: 6,
          paddingBottom: 6,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <span>{focusLabel}</span>
        <span>{nextLabel}</span>
        <span className={`${s.serif} ${s.hideSm}`} style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 17 }}>
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

// Pesquisa + "Novo dossiê" + menu da conta, partilhados pelos cabeçalhos.
function HeaderTools({
  searchIndex,
  searchPlaceholder,
  newDossierHref,
  userName,
  userEmail,
  onOpenProfile,
  onLogout,
}: AccountProps & { searchIndex: SearchEntry[]; searchPlaceholder: string; newDossierHref?: string }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = q ? searchIndex.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 6) : [];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'block' }}>
          <span className={s.sr}>Pesquisar</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={s.boxInput}
            style={{ width: 'min(260px, 70vw)' }}
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
            <Link className={s.nl} href="/faculdade#nova-disciplina" style={{ display: 'block', fontSize: 14 }}>
              Nova disciplina
            </Link>
            <Link className={s.nl} href="/trabalho" style={{ display: 'block', marginTop: 10, fontSize: 14 }}>
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
            width: 40,
            height: 40,
            background: 'var(--bone)',
            color: 'var(--inkdark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 15,
            textAlign: 'center',
          }}
        >
          {(userName || '·').charAt(0).toUpperCase()}
        </button>
        <div className={s.menu} role="menu">
          <span className={s.serif} style={{ display: 'block', fontWeight: 600, fontSize: 19, lineHeight: 1.1 }}>
            {userName || 'A conta'}
          </span>
          {userEmail && (
            <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--subdark)' }}>{userEmail}</span>
          )}
          <button type="button" className={s.nl} onClick={onOpenProfile} style={{ display: 'block', marginTop: 14, fontSize: 14 }}>
            Perfil
          </button>
          <button type="button" className={s.nl} onClick={onLogout} style={{ display: 'block', marginTop: 10, fontSize: 14 }}>
            Terminar sessão
          </button>
        </div>
      </div>
    </div>
  );
}

const headerRow = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  marginTop: 24,
  borderTop: '1px solid var(--hair)',
  paddingTop: 14,
} as const;

function Brand() {
  return (
    <Link href="/" className={s.display} style={{ fontSize: 30, letterSpacing: '-.03em' }}>
      Organiza-me
    </Link>
  );
}

interface HeaderProps extends AccountProps {
  location: string;
  editionNumber: number;
  dateLabel: string;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  ctx: CtxFilter;
  onCtxChange: (c: CtxFilter) => void;
  searchIndex: SearchEntry[];
}

// Cabeçalho da página principal: modo Revue/Cahier e filtro de contexto.
export function PainelHeader({
  location,
  editionNumber,
  dateLabel,
  mode,
  onModeChange,
  ctx,
  onCtxChange,
  searchIndex,
  ...account
}: HeaderProps) {
  return (
    <header className={s.inner} style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, flexWrap: 'wrap' }}>
          <Brand />
          <span className={s.muted} style={{ fontSize: 15 }}>{location}</span>
          <span className={s.muted} style={{ fontSize: 15 }}>N.º {editionNumber}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>{dateLabel}</span>
          <div role="group" aria-label="Modo de visualização" className={s.segGroup}>
            {(
              [
                ['revue', 'Revue'],
                ['cahier', 'Cahier'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`${s.seg} ${mode === id ? s.segOn : ''}`}
                aria-pressed={mode === id}
                onClick={() => onModeChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={headerRow}>
        <nav aria-label="Contexto" style={{ display: 'flex', gap: 36, fontSize: 15, flexWrap: 'wrap' }}>
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
        <HeaderTools searchIndex={searchIndex} searchPlaceholder="Pesquisar em tudo" {...account} />
      </div>
    </header>
  );
}

export type SiteSection = 'faculdade' | 'trabalho';

// Cabeçalho das páginas de secção (Faculdade, …), no mesmo estilo do painel.
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
  const links: [SiteSection | 'home', string, string][] = [
    ['home', 'Visão Geral', '/'],
    ['trabalho', 'Trabalho', '/trabalho'],
    ['faculdade', 'Faculdade', '/faculdade'],
  ];
  return (
    <header className={s.inner} style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
        <Brand />
        <span style={{ fontSize: 15 }}>{dateLabel}</span>
      </div>
      <div style={headerRow}>
        <nav aria-label="Secções" style={{ display: 'flex', gap: 36, fontSize: 15, flexWrap: 'wrap' }}>
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
          searchIndex={searchIndex}
          searchPlaceholder={searchPlaceholder}
          newDossierHref={newDossierHref}
          {...account}
        />
      </div>
    </header>
  );
}
