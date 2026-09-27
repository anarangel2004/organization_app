'use client';

import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import type { AssessmentItem } from '@/types';
import { getItemEffectiveGrade } from '@/lib/utils';
import { parseDueDate } from '@/app/components/homeAgenda';
import d from '@/app/components/denso/denso.module.css';
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
}: {
  code: string;
  name: string;
  meta: string;
  onAddNote: () => void;
  onAddTask: () => void;
  onAddResource: () => void;
}) {
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
function BorderCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderTop: '2px solid var(--accent)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92, minWidth: 0 }}>
      {children}
    </div>
  );
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
}) {
  const due = deadline ? parseDueDate(deadline.due_date) : null;
  const afterDue = deadlineAfter ? parseDueDate(deadlineAfter.due_date) : null;
  const days = due ? daysBetween(today, due) : null;
  const branchTotal = theory + practice || 100;
  const weekDays = Array.from(new Set(weekSlots.map((s) => s.dayNum))).map((n) => WEEKDAY_LONG[n].slice(0, 3));

  return (
    <section id="agora" className={d.agora} style={{ scrollMarginTop: 16 }}>
      <BorderCard>
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
      </BorderCard>

      <div style={{ background: 'var(--ice)', color: 'var(--bg)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92, minWidth: 0 }}>
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
      </div>

      <BorderCard>
        <div className={d.label}>MÉDIA ATUAL</div>
        <div className={d.serif} style={{ fontSize: 30, lineHeight: 1, color: 'var(--sky)' }}>{average !== null ? fmtGrade(average) : '—'}</div>
        <div style={{ display: 'flex', height: 4 }} title={`Pesos: teórica ${theory}%, prática ${practice}%`}>
          <div style={{ width: `${(theory / branchTotal) * 100}%`, background: 'var(--accent)' }} />
          <div style={{ width: `${(practice / branchTotal) * 100}%`, background: 'var(--bone)' }} />
        </div>
        <div className={`${d.muted} ${d.ellipsis}`} style={{ fontSize: 11 }}>
          {gradedCount} de {totalCount} {totalCount === 1 ? 'componente avaliado' : 'componentes avaliados'}
        </div>
      </BorderCard>

      <BorderCard>
        <div className={d.label}>ESTA SEMANA</div>
        <div className={d.serif} style={{ fontSize: 28, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          {weekSlots.length} <span style={{ fontSize: 15, color: 'var(--mut)' }}>{weekSlots.length === 1 ? 'sessão' : 'sessões'}</span>
        </div>
        <div className={d.ellipsis} style={{ fontSize: 12 }}>{weekDays.length ? weekDays.join(' · ') : 'Sem aulas no horário'}</div>
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
          <span className={d.ellipsis}>{t.text}</span>
        </label>
      ))}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, borderBottom: '1px solid var(--line)' }}>
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
          style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 13 }}
        />
        <kbd className={d.kbd}>N</kbd>
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
            style={{ background: sty.bg, color: sty.fg, padding: '9px 12px', display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr) 44px', alignItems: 'center', columnGap: 10, rowGap: 6 }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }}>{st.label.toUpperCase()}</span>
            <span className={d.ellipsis} style={{ fontSize: 12 }}>
              {st.total ? `${st.done} de ${st.total} capítulos concluídos` : 'Abrir caderno'} →
            </span>
            <span className={d.serif} style={{ fontSize: 18, textAlign: 'right' }}>{st.total ? `${pct}%` : '—'}</span>
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
        <div key={sl.key} className={d.row} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 86px minmax(56px, auto)', alignItems: 'center', whiteSpace: 'nowrap', columnGap: 6 }}>
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
        <div key={t.name} className={d.row} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span
            className={d.round}
            aria-hidden="true"
            style={{ width: 22, height: 22, flex: 'none', background: 'var(--ice)', color: 'var(--bg)', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
}: {
  items: AssessmentItem[];
  theory: number;
  practice: number;
  today: Date;
  onEditWeights: () => void;
  onAddGrade: () => void;
}) {
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

  return (
    <section id="avaliacao" style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>AVALIAÇÃO</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', fontSize: 12 }}>
          <span className={d.muted}>Pesos <span style={{ color: 'var(--ink)' }}>{theory} / {practice}</span></span>
          <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={onEditWeights}>Editar pesos</button>
          <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={onAddGrade}>+ Nota</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Sem componentes de avaliação. Usa “+ Nota” para adicionar.</p>
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
                  if (a.id === nextId) stateColor = 'var(--sky)';
                }
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--line2)', borderBottom: '1px solid var(--line2)' }}>
                    <td style={td}>{a.title}</td>
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
}: {
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
