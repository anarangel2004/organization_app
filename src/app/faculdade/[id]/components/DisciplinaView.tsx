'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import type { AssessmentItem } from '@/types';
import { getItemEffectiveGrade } from '@/lib/utils';
import { parseDueDate } from '@/app/components/homeAgenda';
import d from '@/app/components/denso/denso.module.css';
import { BottomSheet, SheetLine, type DensoLayout } from '@/app/components/denso/DensoTouch';
import { assessmentTag } from '../notebook/components/types';
import {
  DocType,
  LibCategory,
  LibDoc,
  LocalTask,
  NextSlot,
  SECTION_SHORT,
  Slot,
  TYPE_COLOR,
  WEEKDAY_LONG,
  dayWord,
  daysBetween,
  effectiveWeight,
  fmtGrade,
  fmtPercent,
  initials,
  shortDate,
} from './disciplinaData';

// ==========================================
// CABEÇALHO NUMA LINHA
// ==========================================
export function DHeading({
  code,
  name,
  meta,
  onAddNote,
  onAddTask,
  onAddResource,
  layout = 'desktop',
  avatar,
}: {
  code: string;
  name: string;
  meta: string;
  onAddNote: () => void;
  onAddTask: () => void;
  onAddResource: () => void;
  layout?: DensoLayout;
  // Só no iPhone: o botão de perfil (não há cabeçalho da app).
  avatar?: ReactNode;
}) {
  if (layout === 'phone') {
    return (
      <section className={d.inner} style={{ paddingTop: 12, paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/faculdade" style={{ fontSize: 15, color: 'var(--sky)' }}>‹ Faculdade</Link>
          {avatar}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>{code}</h1>
          <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 19, color: 'var(--sky)', lineHeight: 1.15 }}>{name}</span>
        </div>
        {meta && <span className={d.muted} style={{ fontSize: 13 }}>{meta}</span>}
      </section>
    );
  }

  if (layout !== 'desktop') {
    const big = layout === 'tabletH';
    return (
      <section className={d.inner} style={{ minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap', minWidth: 0 }}>
          <Link href="/faculdade" style={{ fontSize: 13, color: 'var(--mut2)' }}>Faculdade {'//'}</Link>
          <h1 style={{ margin: 0, fontSize: big ? 40 : 36, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>{code}</h1>
          <span className={`${d.serif} ${d.ellipsis}`} style={{ fontStyle: 'italic', fontSize: big ? 21 : 19, color: 'var(--sky)', minWidth: 0 }} title={meta}>
            {name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button type="button" className={d.btnFill} onClick={onAddNote}>+ Nota</button>
          <button type="button" className={d.btnLine} onClick={onAddTask}>+ Tarefa</button>
          <button type="button" className={d.btnLine} onClick={onAddResource}>+ Recurso</button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={d.inner}
      style={{ minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px 24px', flexWrap: 'wrap', paddingTop: 12, paddingBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 18px', flexWrap: 'wrap', minWidth: 0 }}>
        <span className={d.muted} style={{ fontSize: 13 }}>
          <Link href="/faculdade" style={{ color: 'var(--mut)' }}>Faculdade</Link> {'//'}
        </span>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>{code}</h1>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 24, color: 'var(--sky)' }}>{name}</span>
        <span className={d.muted} style={{ fontSize: 13 }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={d.btnFill} onClick={onAddNote}>+ Nota</button>
        <button type="button" className={d.btnLine} onClick={onAddTask}>+ Tarefa</button>
        <button type="button" className={d.btnLine} onClick={onAddResource}>+ Recurso</button>
      </div>
    </section>
  );
}

// ==========================================
// AGORA (4 cartões)
// ==========================================
// No iPhone cada cartão abre um painel com a informação completa.
type AgoraKey = 'aula' | 'prazo' | 'media' | 'semana';

function tapProps(onTap?: () => void) {
  if (!onTap) return {};
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onTap,
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap();
      }
    },
    style: { cursor: 'pointer' },
  };
}

function BorderCard({ children, onTap }: { children: ReactNode; onTap?: () => void }) {
  const tap = tapProps(onTap);
  return (
    <div
      className={d.agoraCard}
      {...tap}
      style={{ borderTop: '2px solid var(--accent)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92, minWidth: 0, ...tap.style }}
    >
      {children}
    </div>
  );
}

function MoreHint({ show, dark }: { show: boolean; dark?: boolean }) {
  if (!show) return null;
  return <div style={{ marginTop: 'auto', fontSize: 11, color: dark ? 'rgba(13,13,13,0.7)' : 'var(--sky)' }}>Ver tudo ›</div>;
}

export function AgoraCards({
  next,
  deadline,
  deadlineAfter,
  deadlineWeight,
  today,
  average,
  gradedCount,
  totalCount,
  theory,
  practice,
  weekSlots,
  layout = 'desktop',
}: {
  next: NextSlot | null;
  deadline: AssessmentItem | null;
  deadlineAfter: AssessmentItem | null;
  deadlineWeight: number | null;
  today: Date;
  average: number | null;
  gradedCount: number;
  totalCount: number;
  theory: number;
  practice: number;
  weekSlots: Slot[];
  layout?: DensoLayout;
}) {
  const due = deadline ? parseDueDate(deadline.due_date) : null;
  const afterDue = deadlineAfter ? parseDueDate(deadlineAfter.due_date) : null;
  const days = due ? daysBetween(today, due) : null;
  const branchTotal = theory + practice || 100;
  const weekDays = Array.from(new Set(weekSlots.map((s) => s.dayNum))).map((n) => WEEKDAY_LONG[n].slice(0, 3));

  const phone = layout === 'phone';
  const [sheet, setSheet] = useState<AgoraKey | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const tap = (key: AgoraKey) => (phone ? () => setSheet(key) : undefined);
  const deadlineTap = tapProps(tap('prazo'));
  const timeRange = (s: Slot) => `${s.start}${s.end ? `–${s.end}` : ''}`;

  return (
    <section id="agora" className={d.agora} style={{ scrollMarginTop: 16 }}>
      {sheet === 'aula' && (
        <BottomSheet title={next?.inProgress ? 'Aula em curso' : 'Próxima aula'} onClose={closeSheet}>
          {next ? (
            <>
              <SheetLine label="QUANDO">{dayWord(next.offset, next.slot.dayNum)} · {timeRange(next.slot)}</SheetLine>
              <SheetLine label="TIPO">{next.slot.typeLabel}</SheetLine>
              <SheetLine label="SALA">{next.slot.room || '—'}</SheetLine>
            </>
          ) : (
            <p style={{ margin: 0 }}>Esta disciplina ainda não tem horário.</p>
          )}
        </BottomSheet>
      )}
      {sheet === 'prazo' && (
        <BottomSheet title={deadline?.title || 'Próximo prazo'} tag={deadline ? assessmentTag(deadline.title || '') : undefined} onClose={closeSheet}>
          {deadline && due && days !== null ? (
            <>
              <SheetLine label="DATA">{WEEKDAY_LONG[due.getDay()]}, {shortDate(due)}</SheetLine>
              <SheetLine label="FALTAM">{days === 0 ? 'É hoje' : `${days} ${days === 1 ? 'dia' : 'dias'}`}</SheetLine>
              <SheetLine label="RAMO">{deadline.category === 'PRATICA' ? 'Prático' : 'Teórico'}</SheetLine>
              <SheetLine label="PESO NA NOTA">{deadlineWeight !== null ? fmtPercent(deadlineWeight) : '—'}</SheetLine>
              <SheetLine label="PESO NO RAMO">{deadline.weight_percent ? `${deadline.weight_percent}%` : '—'}</SheetLine>
              {deadlineAfter && afterDue && (
                <SheetLine label="DEPOIS">{deadlineAfter.title} · {shortDate(afterDue)}</SheetLine>
              )}
            </>
          ) : (
            <p style={{ margin: 0 }}>Sem prazos marcados.</p>
          )}
        </BottomSheet>
      )}
      {sheet === 'media' && (
        <BottomSheet title={average !== null ? `Média atual: ${fmtGrade(average)}` : 'Média atual'} onClose={closeSheet}>
          <SheetLine label="PESOS">Teórica {theory}% · Prática {practice}%</SheetLine>
          <SheetLine label="AVALIADOS">
            {gradedCount} de {totalCount} {totalCount === 1 ? 'componente' : 'componentes'}
          </SheetLine>
          {average === null && <p style={{ margin: 0 }}>Ainda não há notas lançadas.</p>}
        </BottomSheet>
      )}
      {sheet === 'semana' && (
        <BottomSheet title={`${weekSlots.length} ${weekSlots.length === 1 ? 'sessão' : 'sessões'} esta semana`} onClose={closeSheet}>
          {weekSlots.length === 0 && <p style={{ margin: 0 }}>Sem aulas no horário.</p>}
          {weekSlots.map((s) => (
            <SheetLine key={s.key} label={WEEKDAY_LONG[s.dayNum].toUpperCase()}>
              {timeRange(s)} · {s.typeLabel}
              {s.room ? ` · Sala ${s.room}` : ''}
            </SheetLine>
          ))}
        </BottomSheet>
      )}

      <BorderCard onTap={tap('aula')}>
        <div className={d.label}>{next?.inProgress ? 'AULA EM CURSO' : 'PRÓXIMA AULA'}</div>
        {next ? (
          <>
            <div className={d.serif} style={{ fontSize: 28, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
              {next.slot.start}
              {next.slot.end && <span style={{ fontSize: 16, color: 'var(--mut)' }}>–{next.slot.end}</span>}
            </div>
            <div className={d.ellipsis} style={{ fontSize: 12 }}>
              {dayWord(next.offset, next.slot.dayNum)} · {next.slot.typeLabel}
              {next.slot.room ? ` · Sala ${next.slot.room}` : ''}
            </div>
          </>
        ) : (
          <div className={d.muted} style={{ fontSize: 12 }}>Sem horário definido.</div>
        )}
        <MoreHint show={phone} />
      </BorderCard>

      <div
        className={`${d.deadline} ${d.agoraCard}`}
        {...deadlineTap}
        style={{ color: 'var(--bg)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92, minWidth: 0, ...deadlineTap.style }}
      >
        <div className={d.label} style={{ color: 'var(--bg)', fontWeight: 600 }}>PRÓXIMO PRAZO</div>
        {deadline && due && days !== null ? (
          <>
            <div className={d.serif} style={{ fontSize: 30, lineHeight: 1, whiteSpace: 'nowrap' }}>
              {days === 0 ? 'Hoje' : days}
              {days !== 0 && <span style={{ fontSize: 15 }}> {days === 1 ? 'dia' : 'dias'}</span>}
            </div>
            <div className={d.ellipsis} style={{ fontSize: 12, fontWeight: 500 }}>
              {deadline.title} · {shortDate(due)}
              {deadlineWeight !== null ? ` · ${fmtPercent(deadlineWeight)}` : ''}
            </div>
            {deadlineAfter && afterDue && (
              <div className={d.ellipsis} style={{ fontSize: 11 }}>Depois: {deadlineAfter.title} · {shortDate(afterDue)}</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12 }}>Sem prazos marcados.</div>
        )}
        <MoreHint show={phone} dark />
      </div>

      <BorderCard onTap={tap('media')}>
        <div className={d.label}>MÉDIA ATUAL</div>
        <div className={d.serif} style={{ fontSize: 30, lineHeight: 1, color: 'var(--sky)' }}>{average !== null ? fmtGrade(average) : '—'}</div>
        <div style={{ display: 'flex', height: 4 }} title={`Pesos: teórica ${theory}%, prática ${practice}%`}>
          <div style={{ width: `${(theory / branchTotal) * 100}%`, background: 'var(--accent)' }} />
          <div style={{ width: `${(practice / branchTotal) * 100}%`, background: 'var(--bone)' }} />
        </div>
        <div className={`${d.muted} ${d.ellipsis}`} style={{ fontSize: 11 }}>
          {gradedCount} de {totalCount} {totalCount === 1 ? 'componente avaliado' : 'componentes avaliados'}
        </div>
        <MoreHint show={phone} />
      </BorderCard>

      <BorderCard onTap={tap('semana')}>
        <div className={d.label}>ESTA SEMANA</div>
        <div className={d.serif} style={{ fontSize: 28, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          {weekSlots.length} <span style={{ fontSize: 15, color: 'var(--mut)' }}>{weekSlots.length === 1 ? 'sessão' : 'sessões'}</span>
        </div>
        <div className={d.ellipsis} style={{ fontSize: 12 }}>{weekDays.length ? weekDays.join(' · ') : 'Sem aulas no horário'}</div>
        <MoreHint show={phone} />
      </BorderCard>
    </section>
  );
}

// ==========================================
// TAREFAS (locais, por disciplina)
// ==========================================
export function TasksPanel({
  tasks,
  onToggle,
  onAdd,
  onClearDone,
  inputRef,
}: {
  tasks: LocalTask[];
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
  onClearDone: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState('');
  const done = tasks.filter((t) => t.done).length;
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <section id="tarefas" style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>TAREFAS</h2>
        <span className={d.muted} style={{ fontSize: 12, display: 'flex', gap: 10 }}>
          {done > 0 && (
            <button type="button" onClick={onClearDone} style={{ background: 'none', border: 0, padding: 0, color: 'var(--mut)', textDecoration: 'underline', fontSize: 11 }}>
              limpar feitas
            </button>
          )}
          {done}/{tasks.length}
        </span>
      </div>
      {sorted.map((t) => (
        <label key={t.id} className={d.row} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 34, cursor: 'pointer', color: t.done ? 'var(--faint)' : undefined, textDecoration: t.done ? 'line-through' : undefined }}>
          <input type="checkbox" className={d.chk} checked={t.done} onChange={() => onToggle(t.id)} />
          <span className={`${d.ellipsis} ${d.wrapPhone}`}>{t.text}</span>
        </label>
      ))}
      <label className={d.taskInput} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, fontSize: 13, borderBottom: '1px solid var(--line)' }}>
        <span className={d.sr}>Nova tarefa</span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const v = draft.trim();
            if (!v) return;
            onAdd(v);
            setDraft('');
          }}
          placeholder="+ nova tarefa"
          style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 'inherit' }}
        />
        <kbd className={`${d.kbd} ${d.hideTouch}`}>N</kbd>
      </label>
      <p className={d.muted} style={{ margin: '6px 0 0', fontSize: 10 }}>Guardadas só neste browser.</p>
    </section>
  );
}

// ==========================================
// CADERNOS
// ==========================================
export interface NotebookStat {
  tab: 'TEORICAS' | 'PRATICAS' | 'TESTES';
  label: string;
  done: number;
  total: number;
}

const NOTEBOOK_STYLE: Record<NotebookStat['tab'], { bg: string; fg: string; track: string; bar: string }> = {
  TEORICAS: { bg: 'var(--deep)', fg: 'var(--onfill)', track: 'rgba(243,239,231,0.3)', bar: 'var(--onfill)' },
  PRATICAS: { bg: 'var(--bone)', fg: 'var(--bg)', track: 'rgba(13,13,13,0.2)', bar: 'var(--bg)' },
  TESTES: { bg: 'var(--ice)', fg: 'var(--bg)', track: 'rgba(13,13,13,0.2)', bar: 'var(--bg)' },
};

export function NotebooksPanel({ subjectId, stats }: { subjectId: string; stats: NotebookStat[] }) {
  const done = stats.reduce((n, x) => n + x.done, 0);
  const total = stats.reduce((n, x) => n + x.total, 0);
  return (
    <section id="cadernos" style={{ display: 'flex', flexDirection: 'column', gap: 8, scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>CADERNOS</h2>
        <span className={d.muted} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {total ? `${done} de ${total} capítulos · ${Math.round((done / total) * 100)}%` : 'sem capítulos'}
        </span>
      </div>
      {stats.map((st) => {
        const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
        const sty = NOTEBOOK_STYLE[st.tab];
        return (
          <Link
            key={st.tab}
            href={`/faculdade/${subjectId}/notebook?tab=${st.tab}`}
            className={d.nbCard}
            style={{ background: sty.bg, color: sty.fg, display: 'grid', alignItems: 'center', columnGap: 10, rowGap: 6 }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }}>{st.label.toUpperCase()}</span>
            <span className={`${d.ellipsis} ${d.nbText}`} style={{ fontSize: 12 }}>
              {st.total ? `${st.done} de ${st.total} capítulos concluídos` : 'Abrir caderno'} →
            </span>
            <span className={`${d.serif} ${d.nbPct}`} style={{ fontSize: 18, textAlign: 'right' }}>{st.total ? `${pct}%` : '—'}</span>
            <span style={{ gridColumn: '1 / -1', display: 'flex', height: 3, background: sty.track }}>
              <span style={{ width: `${pct}%`, background: sty.bar }} />
            </span>
          </Link>
        );
      })}
    </section>
  );
}

// ==========================================
// HORÁRIO + DOCENTES
// ==========================================
const BRANCH_COLOR: Record<Slot['branch'], string> = { T: 'var(--sky)', P: 'var(--bone)', TP: 'var(--ice)', O: 'var(--mut)' };

export function SchedulePanel({ slots, onManage }: { slots: Slot[]; onManage: () => void }) {
  return (
    <section id="horario" style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>HORÁRIO</h2>
        <button type="button" className={`${d.btnGhost} ${d.xs}`} onClick={onManage}>+ Sessão</button>
      </div>
      {slots.length === 0 && <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Sem sessões no horário.</p>}
      {slots.map((sl) => (
        <div key={sl.key} className={`${d.row} ${d.slotRow}`} style={{ display: 'grid', alignItems: 'center', whiteSpace: 'nowrap', columnGap: 6 }}>
          <span className={d.ellipsis} style={{ color: BRANCH_COLOR[sl.branch], fontSize: 12 }}>{sl.typeLabel}</span>
          <span>{WEEKDAY_LONG[sl.dayNum]}</span>
          <span className={d.muted}>{sl.start}{sl.end ? `–${sl.end}` : ''}</span>
          <span className={d.muted} style={{ textAlign: 'right' }}>{sl.room || '—'}</span>
        </div>
      ))}
    </section>
  );
}

export function TeachersPanel({ teachers }: { teachers: { name: string; role: string }[] }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>DOCENTES</h2>
      </div>
      {teachers.length === 0 && <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Sem docentes registados.</p>}
      {teachers.map((t) => (
        <div key={t.name} className={`${d.row} ${d.teacherRow}`} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span
            className={`${d.round} ${d.avatar}`}
            aria-hidden="true"
            style={{ flex: 'none', background: 'var(--ice)', color: 'var(--bg)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {initials(t.name)}
          </span>
          <span className={d.ellipsis}>{t.name}</span>
          <span className={d.muted} style={{ fontSize: 12 }}>{t.role}</span>
        </div>
      ))}
    </section>
  );
}

// ==========================================
// AVALIAÇÃO
// ==========================================
export function AssessmentTable({
  items,
  theory,
  practice,
  today,
  onEditWeights,
  onAddGrade,
  layout = 'desktop',
}: {
  items: AssessmentItem[];
  theory: number;
  practice: number;
  today: Date;
  onEditWeights: () => void;
  onAddGrade: () => void;
  layout?: DensoLayout;
}) {
  const touch = layout !== 'desktop';
  const nextId = useMemo(() => {
    const upcoming = items
      .filter((a) => getItemEffectiveGrade(a) === null)
      .map((a) => ({ a, due: parseDueDate(a.due_date) }))
      .filter((r): r is { a: AssessmentItem; due: Date } => r.due !== null && r.due >= today)
      .sort((x, y) => x.due.getTime() - y.due.getTime());
    return upcoming[0]?.a.id ?? null;
  }, [items, today]);

  const rows = [...items].sort((a, b) => {
    const da = parseDueDate(a.due_date)?.getTime() ?? Infinity;
    const db = parseDueDate(b.due_date)?.getTime() ?? Infinity;
    return da - db;
  });

  const th = { fontWeight: 500, padding: '7px 8px 4px 0', textAlign: 'left' } as const;
  const td = { padding: '8px 8px 8px 0' } as const;

  const rowInfo = (a: AssessmentItem) => {
    const grade = getItemEffectiveGrade(a);
    const due = parseDueDate(a.due_date);
    const theoretical = a.category !== 'PRATICA';
    let state = 'Sem data';
    let stateColor = 'var(--mut)';
    if (grade !== null) state = 'Avaliado';
    else if (due) {
      const days = daysBetween(today, due);
      if (days > 0) state = `Daqui a ${days} ${days === 1 ? 'dia' : 'dias'}`;
      else if (days === 0) state = 'Hoje';
      else state = 'Por classificar';
      // No iPad/iPhone o próximo prazo é âmbar, como no cartão "Próximo prazo".
      if (a.id === nextId) stateColor = touch ? 'var(--amber)' : 'var(--sky)';
    }
    return { grade, due, theoretical, state, stateColor };
  };

  return (
    <section id="avaliacao" style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>AVALIAÇÃO</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', fontSize: 12 }}>
          <span className={d.muted}>Pesos <span style={{ color: 'var(--ink)' }}>{theory} / {practice}</span></span>
          {layout !== 'phone' && <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={onEditWeights}>Editar pesos</button>}
          <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={onAddGrade}>+ Nota</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Sem componentes de avaliação. Usa “+ Nota” para adicionar.</p>
      ) : layout === 'phone' ? (
        <div>
          {rows.map((a) => {
            const r = rowInfo(a);
            return (
              <div key={a.id} className={d.gradeCard}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, minWidth: 0 }}>
                  <span className={`${d.ellipsis} ${d.wrapPhone}`}>{a.title}</span>
                  {r.grade === null && <span className={d.tag} style={{ padding: '2px 6px', flexShrink: 0 }}>{assessmentTag(a.title || '')}</span>}
                </span>
                <span className={d.serif} style={{ fontSize: 20, textAlign: 'right', color: r.grade !== null ? 'var(--ink)' : 'var(--faint)' }}>
                  {r.grade !== null ? fmtGrade(r.grade) : '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--mut)' }}>
                  <span style={{ color: r.theoretical ? 'var(--sky)' : 'var(--bone)' }}>{r.theoretical ? 'Teórico' : 'Prático'}</span>
                  {' · '}
                  {fmtPercent(effectiveWeight(a, theory, practice))}
                  {r.due ? ` · ${shortDate(r.due)}` : ''}
                </span>
                <span style={{ fontSize: 12, textAlign: 'right', color: r.stateColor }}>{r.state}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr style={{ color: 'var(--mut2)', fontSize: 10, letterSpacing: '0.08em' }}>
                <th style={{ ...th, width: '30%' }}>COMPONENTE</th>
                <th style={th}>RAMO</th>
                <th style={th} title="Peso na nota final (peso no ramo × peso do ramo)">PESO</th>
                <th style={th}>DATA</th>
                <th style={th}>ESTADO</th>
                <th style={{ ...th, textAlign: 'right', paddingRight: 0 }}>NOTA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const { grade, due, theoretical, state, stateColor } = rowInfo(a);
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--line2)', borderBottom: '1px solid var(--line2)', height: touch ? 44 : undefined }}>
                    <td style={td}>
                      {touch && grade === null ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.title}
                          <span className={d.tag} style={{ padding: '2px 6px' }}>{assessmentTag(a.title || '')}</span>
                        </span>
                      ) : (
                        a.title
                      )}
                    </td>
                    <td style={{ ...td, color: theoretical ? 'var(--sky)' : 'var(--bone)' }}>{theoretical ? 'Teórico' : 'Prático'}</td>
                    <td style={{ ...td, color: 'var(--mut)' }} title={`${a.weight_percent || 0}% do ramo ${theoretical ? 'teórico' : 'prático'}`}>
                      {fmtPercent(effectiveWeight(a, theory, practice))}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{due ? shortDate(due) : '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: stateColor }}>{state}</td>
                    <td
                      className={grade !== null ? d.serif : undefined}
                      style={{ ...td, paddingRight: 0, textAlign: 'right', color: grade !== null ? 'var(--ink)' : 'var(--faint)', fontSize: grade !== null ? 17 : 13 }}
                    >
                      {grade !== null ? fmtGrade(grade) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ==========================================
// BIBLIOTECA
// ==========================================
type Filter = 'todos' | LibCategory;
type Sort = 'recent' | 'name' | 'type' | 'section';

const FILTERS: [Filter, string][] = [
  ['todos', 'Todos'],
  ['TEÓRICAS', 'Teóricas'],
  ['PRÁTICAS', 'Práticas'],
  ['EXAMES', 'Exames'],
  ['GERAL', 'Geral'],
];

const TYPE_ORDER: DocType[] = ['PDF', 'DOC', 'MD', 'IMG', 'ZIP', 'LINK'];

function DocLine({ doc, pinned, onTogglePin, showDate }: { doc: LibDoc; pinned: boolean; onTogglePin: () => void; showDate: boolean }) {
  const created = new Date(doc.createdAt);
  return (
    <div className={d.docRow} style={showDate ? undefined : { gridTemplateColumns: '40px minmax(0, 1fr) 48px 20px', minHeight: 28, borderBottomColor: '#1f1f1f' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.04em', color: TYPE_COLOR[doc.type], border: '1px solid #333', textAlign: 'center' }}>{doc.type}</span>
      {doc.url ? (
        <a href={doc.url} target="_blank" rel="noreferrer" className={d.ellipsis} title={doc.title}>{doc.title}</a>
      ) : (
        <span className={d.ellipsis}>{doc.title}</span>
      )}
      <span style={{ fontSize: 11, color: 'var(--mut2)', textAlign: 'right', whiteSpace: 'nowrap' }}>{SECTION_SHORT[doc.category]}</span>
      {showDate && (
        <span className={d.muted} style={{ fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {Number.isNaN(created.getTime()) ? '—' : shortDate(created)}
        </span>
      )}
      <button
        type="button"
        className={`${d.pin} ${pinned ? d.pinOn : ''}`}
        onClick={onTogglePin}
        aria-pressed={pinned}
        aria-label={pinned ? `Desafixar ${doc.title}` : `Fixar ${doc.title}`}
        title={pinned ? 'Desafixar' : 'Fixar no topo'}
      >
        {pinned ? '●' : '○'}
      </button>
    </div>
  );
}

export function Library({
  docs,
  loading,
  pins,
  onTogglePin,
  onUpload,
  uploading,
  uploadError,
  fullscreen,
  onToggleFullscreen,
  onManage,
  searchRef,
  layout = 'desktop',
}: {
  layout?: DensoLayout;
  docs: LibDoc[];
  loading: boolean;
  pins: string[];
  onTogglePin: (id: string) => void;
  onUpload: (files: File[], category: LibCategory) => void;
  uploading: boolean;
  uploadError: string | null;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onManage: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [sort, setSort] = useState<Sort>('recent');
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = docs.filter(
      (x) =>
        (filter === 'todos' || x.category === filter) &&
        (!q || x.title.toLowerCase().includes(q) || x.type.toLowerCase().includes(q) || x.category.toLowerCase().includes(q))
    );
    const byName = (a: LibDoc, b: LibDoc) => a.title.localeCompare(b.title, 'pt');
    if (sort === 'name') list.sort(byName);
    else if (sort === 'type') list.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || byName(a, b));
    else if (sort === 'section') list.sort((a, b) => a.category.localeCompare(b.category, 'pt') || byName(a, b));
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [docs, filter, sort, q]);

  const pinned = docs.filter((x) => pins.includes(x.id));
  const uploadCategory: LibCategory = filter === 'todos' ? 'GERAL' : filter;

  const handleFiles = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length) onUpload(files, uploadCategory);
  };

  // ==========================================
  // IPAD / IPHONE (design "SSC — iPad / iPhone")
  // ==========================================
  if (layout !== 'desktop') {
    const phone = layout === 'phone';
    // No iPhone mostra 6 recentes; o resto abre em ecrã inteiro.
    const recent = phone && !fullscreen ? shown.slice(0, 6) : shown;
    const touchRow = (doc: LibDoc, isPinned: boolean) => {
      const created = new Date(doc.createdAt);
      return (
        <div key={`${isPinned ? 'p' : 'r'}-${doc.id}`} className={d.touchDoc}>
          <span style={{ fontSize: 10, color: TYPE_COLOR[doc.type], border: '1px solid #333', textAlign: 'center', padding: '1px 0' }}>{doc.type}</span>
          {doc.url ? (
            <a href={doc.url} target="_blank" rel="noreferrer" className={`${d.ellipsis} ${d.wrapPhone}`} title={doc.title}>{doc.title}</a>
          ) : (
            <span className={`${d.ellipsis} ${d.wrapPhone}`}>{doc.title}</span>
          )}
          <span style={{ fontSize: 12, color: 'var(--mut)', whiteSpace: 'nowrap' }}>
            {SECTION_SHORT[doc.category]}
            {Number.isNaN(created.getTime()) ? '' : ` · ${shortDate(created)}`}
          </span>
          <button
            type="button"
            className={`${d.pin} ${pins.includes(doc.id) ? d.pinOn : ''}`}
            onClick={() => onTogglePin(doc.id)}
            aria-pressed={pins.includes(doc.id)}
            aria-label={pins.includes(doc.id) ? `Desafixar ${doc.title}` : `Fixar ${doc.title}`}
          >
            {pins.includes(doc.id) ? '●' : '○'}
          </button>
        </div>
      );
    };

    return (
      <section id="biblioteca" className={`${d.lib} ${fullscreen ? d.libFull : ''}`} style={{ scrollMarginTop: 60, gap: 0 }}>
        <div className={d.sectionHead} style={{ flexShrink: 0 }}>
          <h2 className={d.h2}>BIBLIOTECA</h2>
          <span style={{ display: 'flex', gap: 6 }}>
            {fullscreen ? (
              <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={onToggleFullscreen}>Fechar ✕</button>
            ) : (
              <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={onManage}>Gerir</button>
            )}
            <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? 'A enviar…' : '+ Adicionar'}
            </button>
          </span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, flexShrink: 0, border: '1px solid var(--box)', padding: '0 10px', background: 'var(--bg)', marginTop: 10 }}>
          <span className={d.sr}>Pesquisar na biblioteca</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome, secção ou tipo…"
            style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 16 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0 6px', flexShrink: 0, scrollbarWidth: 'none' }}>
          {FILTERS.map(([id, label]) => {
            const on = filter === id;
            const count = id === 'todos' ? docs.length : docs.filter((x) => x.category === id).length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={on}
                style={{ height: 32, padding: '0 12px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0, background: on ? 'var(--bone)' : 'transparent', color: on ? 'var(--bg)' : 'var(--ink)', border: `1px solid ${on ? 'var(--bone)' : 'var(--box2)'}` }}
              >
                {label} <span style={{ opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
        {uploadError && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#e38b7a' }}>{uploadError}</p>}

        {pinned.length > 0 && (
          <>
            <div className={d.libGroup} style={{ color: 'var(--sky)', paddingTop: 14 }}>FIXADOS</div>
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>{pinned.map((doc) => touchRow(doc, true))}</div>
          </>
        )}
        <div className={d.libGroup} style={{ color: 'var(--mut2)' }}>{q || filter !== 'todos' ? `${shown.length} A MOSTRAR` : 'MAIS RECENTES'}</div>
        <div className={phone && !fullscreen ? undefined : d.libList}>
          {loading && <p className={d.muted} style={{ margin: '12px 0', fontSize: 13 }}>A carregar ficheiros…</p>}
          {!loading && shown.length === 0 && (
            <p className={d.muted} style={{ margin: '12px 0', fontSize: 13 }}>
              {docs.length === 0 ? 'Esta biblioteca ainda não tem ficheiros.' : 'Nenhum documento corresponde à pesquisa.'}
            </p>
          )}
          {recent.map((doc) => touchRow(doc, false))}
        </div>
        {phone && !fullscreen && shown.length > recent.length && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            style={{ minHeight: 44, background: 'none', border: 0, fontSize: 14, color: 'var(--sky)' }}
          >
            Ver os {shown.length} documentos →
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </section>
    );
  }

  return (
    <section id="biblioteca" className={`${d.lib} ${fullscreen ? d.libFull : ''}`} style={{ scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap' }}>
          <h2 className={d.h2}>BIBLIOTECA</h2>
          <span className={d.muted} style={{ fontSize: 12 }}>{docs.length} {docs.length === 1 ? 'documento' : 'documentos'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={() => fileInput.current?.click()}>+ Adicionar</button>
          <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={onManage} title="Editar, apagar ou adicionar ligações">Gerir</button>
          <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={onToggleFullscreen} aria-pressed={fullscreen}>
            {fullscreen ? 'Fechar ✕' : 'Ecrã inteiro ↗'}
          </button>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, border: '1px solid var(--box)', padding: '0 10px', background: 'var(--bg)', flexShrink: 0 }}>
        <span className={d.sr}>Pesquisar na biblioteca</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome, secção ou tipo…"
          style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 13 }}
        />
        <kbd className={d.kbd}>/</kbd>
      </label>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {FILTERS.map(([id, label]) => {
          const on = filter === id;
          const count = id === 'todos' ? docs.length : docs.filter((x) => x.category === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={on}
              style={{ height: 26, padding: '0 10px', fontSize: 12, whiteSpace: 'nowrap', background: on ? 'var(--bone)' : 'transparent', color: on ? 'var(--bg)' : 'var(--ink)', border: `1px solid ${on ? 'var(--bone)' : 'var(--box2)'}` }}
            >
              {label} <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className={d.muted} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Ordenar
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--box)', fontSize: 12, height: 24 }}
          >
            <option value="recent">Mais recentes</option>
            <option value="name">Nome</option>
            <option value="type">Tipo</option>
            <option value="section">Secção</option>
          </select>
        </label>
        <span>{shown.length} a mostrar</span>
      </div>

      {pinned.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--sky)', fontWeight: 600, paddingBottom: 2 }}>FIXADOS</div>
          {pinned.map((doc) => (
            <DocLine key={doc.id} doc={doc} pinned onTogglePin={() => onTogglePin(doc.id)} showDate={false} />
          ))}
        </div>
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) 48px 44px 20px', gap: 10, fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)', paddingTop: 4, borderBottom: '1px solid var(--line)', paddingBottom: 4, flexShrink: 0 }}
      >
        <span>TIPO</span>
        <span>NOME</span>
        <span style={{ textAlign: 'right' }}>SECÇÃO</span>
        <span style={{ textAlign: 'right' }}>DATA</span>
        <span />
      </div>
      <div className={d.libList} style={{ marginTop: -10 }}>
        {loading && <p className={d.muted} style={{ margin: '12px 0', fontSize: 13 }}>A carregar ficheiros…</p>}
        {!loading && shown.length === 0 && (
          <p className={d.muted} style={{ margin: '12px 0', fontSize: 13 }}>
            {docs.length === 0 ? 'Esta biblioteca ainda não tem ficheiros.' : 'Nenhum documento corresponde à pesquisa.'}
          </p>
        )}
        {shown.map((doc) => (
          <DocLine key={doc.id} doc={doc} pinned={pins.includes(doc.id)} onTogglePin={() => onTogglePin(doc.id)} showDate />
        ))}
      </div>

      {uploadError && <p style={{ margin: 0, fontSize: 12, color: '#e38b7a' }}>{uploadError}</p>}
      <button
        type="button"
        className={`${d.dropZone} ${dragOver ? d.dropActive : ''}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        disabled={uploading}
      >
        {uploading
          ? 'A enviar…'
          : `Larga ficheiros aqui para adicionar${filter === 'todos' ? '' : ` a ${FILTERS.find((f) => f[0] === filter)?.[1]}`}`}
      </button>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </section>
  );
}
