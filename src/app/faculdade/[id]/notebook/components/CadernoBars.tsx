'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import c from './caderno.module.css';
import { NextAssessment, NotebookTab, PAPER_LABEL, PaperStyle, SyncStatus, TABS, inDaysLabel } from './types';
import { fmtStudy, type StudyState } from '@/lib/study';

// ==========================================
// BARRA DE CONTEXTO: disciplina + volume
// ==========================================
export interface SubjectChip {
  id: string;
  code: string;
  name: string;
  dot: string;
}

export function ContextBar({
  subjectId,
  subjects,
  tab,
  onTab,
  hrefFor,
  switchKeys,
  canComplete,
  isCompleted,
  onToggleCompleted,
  onExport,
}: {
  subjectId: string;
  subjects: SubjectChip[];
  tab: NotebookTab;
  onTab: (tab: NotebookTab) => void;
  hrefFor: (id: string) => string;
  switchKeys: string;
  canComplete: boolean;
  isCompleted: boolean;
  onToggleCompleted: () => void;
  onExport: () => void;
}) {
  return (
    <div className={`${c.ctx} no-print`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', minWidth: 0 }}>
        <Link href={`/faculdade/${subjectId}`} aria-label="Voltar à disciplina" title="Voltar à disciplina" className={c.back}>
          ←
        </Link>
        <span style={{ fontSize: 12, color: 'var(--mut2)' }}>Faculdade {'//'}</span>
        <div role="tablist" aria-label="Disciplinas" className={c.subjects}>
          {subjects.map((s) => {
            const on = s.id === subjectId;
            return (
              <Link
                key={s.id}
                href={hrefFor(s.id)}
                role="tab"
                aria-selected={on}
                title={`${s.name} · ${switchKeys} para mudar`}
                className={`${c.subject} ${on ? c.subjectOn : ''}`}
              >
                <span className={c.dot} style={{ background: s.dot }} />
                {on && s.name && s.name !== s.code ? `${s.code} · ${s.name}` : s.code}
              </Link>
            );
          })}
        </div>
      </div>

      <div role="tablist" aria-label="Volumes" className={`${c.seg} ${c.segMuted} ${c.volumes}`}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} style={tab === id ? { fontWeight: 600 } : undefined}>
            {label}
          </button>
        ))}
      </div>

      <div className={c.ctxRight} style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button type="button" className={c.btn} disabled={!canComplete} aria-pressed={isCompleted} onClick={onToggleCompleted}>
          {isCompleted ? '✓ Concluído' : '○ Marcar concluído'}
        </button>
        <button type="button" className={c.fill} style={{ padding: '0 12px' }} onClick={onExport} disabled={!canComplete}>
          Exportar PDF
        </button>
      </div>
    </div>
  );
}

// ==========================================
// BARRA DE MENUS (estilo Notepad)
// ==========================================
export interface MenuItem {
  label: string;
  keys?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface MenuDef {
  label: string;
  items: MenuItem[];
}

export function MenuBar({
  menus,
  sideOpen,
  onToggleSide,
  sideKeys,
  paper,
  onPaper,
  split,
  onToggleSplit,
  splitKeys,
}: {
  menus: MenuDef[];
  sideOpen: boolean;
  onToggleSide: () => void;
  sideKeys: string;
  paper: PaperStyle;
  onPaper: (p: PaperStyle) => void;
  split: boolean;
  onToggleSplit: () => void;
  splitKeys: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={barRef} className={`${c.menubar} no-print`}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <button
          type="button"
          onClick={onToggleSide}
          aria-pressed={sideOpen}
          title={`Mostrar ou ocultar capítulos (${sideKeys})`}
          aria-label="Capítulos"
          className={c.icon}
          style={{ height: 22, marginRight: 4, border: '1px solid var(--box)', background: sideOpen ? 'var(--line0)' : 'transparent', color: 'var(--ink)' }}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="0.65" y="0.65" width="12.7" height="10.7" />
            <line x1="4.5" y1="1" x2="4.5" y2="11" />
          </svg>
        </button>
        {menus.map((m) => (
          <div key={m.label} style={{ position: 'relative', height: '100%' }}>
            <button
              type="button"
              className={c.menuBtn}
              aria-expanded={open === m.label}
              aria-haspopup="menu"
              // Não tirar a seleção do texto ao abrir o menu.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen((o) => (o === m.label ? null : m.label))}
              onMouseEnter={() => setOpen((o) => (o && o !== m.label ? m.label : o))}
            >
              {m.label}
            </button>
            {open === m.label && (
              <div role="menu" className={c.menu}>
                {m.items.map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    className={c.menuItem}
                    disabled={it.disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(null);
                      it.onClick();
                    }}
                  >
                    <span>{it.label}</span>
                    {it.keys && <span className={c.menuKey}>{it.keys}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--mut)' }}>
        <span className={c.hideNarrow}>Página</span>
        <div className={`${c.seg} ${c.segMuted} ${c.small}`}>
          {(Object.keys(PAPER_LABEL) as PaperStyle[]).map((p) => (
            <button key={p} type="button" aria-pressed={paper === p} onClick={() => onPaper(p)}>
              {PAPER_LABEL[p]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggleSplit}
          aria-pressed={split}
          className={c.btn}
          style={{ height: 22, padding: '0 8px', background: split ? 'var(--bone)' : 'transparent', color: split ? 'var(--bg)' : 'var(--ink)' }}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="0.65" y="0.65" width="12.7" height="10.7" />
            <line x1="7" y1="1" x2="7" y2="11" />
          </svg>
          Split view <span className={c.hideNarrow} style={{ opacity: 0.6 }}>{splitKeys}</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// CONTADOR DE ESTUDO
// ==========================================
export interface StudyInfo {
  state: StudyState;
  todaySec: number;
  sessionSec: number;
  onPause: () => void;
  onResume: () => void;
  onAdd: () => void;
}

// "● Estudo · 34 min" com pausa e "+ sessão". data-study-ignore: tocar aqui não conta como estudo.
export function StudyCounter({ study }: { study: StudyInfo }) {
  const color = study.state === 'counting' ? 'var(--ok)' : study.state === 'paused' ? 'var(--amber)' : study.state === 'class' ? 'var(--sky)' : 'var(--faint)';
  const label = study.state === 'paused' ? 'Pausa' : study.state === 'class' ? 'Aula' : 'Estudo';
  const title =
    study.state === 'counting'
      ? `A contar · sessão atual ${fmtStudy(study.sessionSec)} · hoje nesta disciplina ${fmtStudy(study.todaySec)}`
      : study.state === 'paused'
        ? 'Em pausa · volta a contar quando escreveres'
        : study.state === 'class'
        ? 'Aula desta disciplina (pelo horário) · o tempo de aula não conta como estudo'
        : 'Parado · conta quando escreves, desenhas ou mexes no PDF (sessões com mais de 2 min)';
  return (
    <span className={c.study} data-study-ignore title={title}>
      <span className={`${c.led} ${study.state === 'counting' ? c.ledPulse : ''}`} style={{ background: color }} />
      <span style={{ color: 'var(--ink)' }}>
        {label} · {fmtStudy(study.todaySec)}
      </span>
      <button
        type="button"
        className={c.studyBtn}
        aria-label={study.state === 'paused' ? 'Retomar contagem' : 'Pausar contagem'}
        onClick={study.state === 'paused' ? study.onResume : study.onPause}
      >
        {study.state === 'paused' ? '▶' : '❚❚'}
      </button>
      <button type="button" className={c.studyBtn} aria-label="Registar sessão de estudo feita fora da app" title="+ sessão (estudo fora da app)" onClick={study.onAdd}>
        +
      </button>
    </span>
  );
}

// ==========================================
// BARRA DE ESTADO
// ==========================================
export function StatusBar({
  line,
  col,
  words,
  paper,
  modeLabel,
  next,
  deviceLabel,
  sync,
  onRefresh,
  refreshing = false,
  zoom,
  onZoom,
  study,
}: {
  line: number;
  col: number;
  words: number;
  paper: PaperStyle;
  modeLabel: string;
  next: NextAssessment | null;
  deviceLabel: string;
  sync: SyncStatus;
  // Grava o que falta e volta a ler o caderno (sincronizar com outros aparelhos).
  onRefresh?: () => void;
  refreshing?: boolean;
  zoom: number;
  onZoom: (delta: number) => void;
  study?: StudyInfo;
}) {
  const syncLabel = sync === 'saving' ? 'A guardar…' : sync === 'error' ? 'Erro ao guardar' : 'Sincronizado';
  const syncColor = sync === 'saving' ? 'var(--amber)' : sync === 'error' ? '#e38b7a' : 'var(--ok)';
  return (
    <footer className={`${c.status} no-print`}>
      <span>
        <span>
          Ln {line}, Col {col}
        </span>
        <span>
          {words} {words === 1 ? 'palavra' : 'palavras'}
        </span>
        <span className={c.hideNarrow}>{PAPER_LABEL[paper]}</span>
        <span className={c.hideNarrow}>{modeLabel}</span>
      </span>
      <span>
        {next && (
          <>
            <span className={c.tagAmber} style={{ padding: '0 5px' }}>
              {next.tag}
            </span>
            <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {next.title} {inDaysLabel(next.days)}
            </span>
          </>
        )}
      </span>
      <span style={{ justifyContent: 'flex-end' }}>
        {study && <StudyCounter study={study} />}
        <span className={c.hideNarrow} style={{ alignItems: 'center', gap: 6 }}>
          <span className={c.led} style={{ background: 'var(--sky)' }} />
          {deviceLabel}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={c.led} style={{ background: syncColor }} />
          {refreshing ? 'A atualizar…' : syncLabel}
          {onRefresh && (
            <button
              type="button"
              className={c.zoomBtn}
              onClick={onRefresh}
              disabled={refreshing}
              title="Atualizar: grava o que falta e traz o que foi escrito noutro aparelho"
              aria-label="Atualizar o caderno"
              style={{ width: 'auto', height: 22, padding: '0 8px', gap: 5, display: 'inline-flex', alignItems: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? c.spin : undefined}>
                <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9" />
                <path d="M13.5 2.5v3.6H9.9" />
              </svg>
              Atualizar
            </button>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button type="button" className={c.zoomBtn} aria-label="Diminuir zoom" onClick={() => onZoom(-0.1)}>
            −
          </button>
          <span style={{ minWidth: 36, textAlign: 'center', color: 'var(--ink)' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={c.zoomBtn} aria-label="Aumentar zoom" onClick={() => onZoom(0.1)}>
            +
          </button>
        </span>
      </span>
    </footer>
  );
}
