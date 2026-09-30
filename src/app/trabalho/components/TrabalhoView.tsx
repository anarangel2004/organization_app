'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { WorkProject, WorkTask } from '@/lib/workData';
import { parseDueDate } from '@/app/components/homeAgenda';
import d from '@/app/components/denso/denso.module.css';
import { DateField } from '@/components/ui/DateTimeFields';
import { DeleteButton, Field } from '@/app/components/denso/DensoForm';
import type { DensoLayout } from '@/app/components/denso/DensoTouch';

// Peças da página Trabalho (estilo denso): título, números do topo,
// projetos, tarefas agrupadas por prazo e painéis laterais de edição.

export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Cores para projetos novos, tiradas da paleta das outras páginas.
export const PROJECT_COLORS = ['#2f5f78', '#7fb0cb', '#93b6c8', '#e4ded3', '#c9a27a', '#e3a857', '#8fa88a', '#b98aa0'];

export function startOfDay(x: Date): Date {
  const c = new Date(x);
  c.setHours(0, 0, 0, 0);
  return c;
}
export function daysFrom(today: Date, date: Date): number {
  return Math.round((startOfDay(date).getTime() - today.getTime()) / 86400000);
}
export function dueOf(t: WorkTask): Date | null {
  return parseDueDate(t.due_date);
}
// "YYYY-MM-DD" do input de data → valor da coluna due_date (como o formulário antigo).
export function toDueValue(date: string): string | null {
  return date ? `${date}T00:00:00.000Z` : null;
}
export function toDateInput(t: WorkTask): string {
  return t.due_date ? t.due_date.slice(0, 10) : '';
}

export function dueLabel(due: Date, today: Date): string {
  const n = daysFrom(today, due);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  if (n < 0) return `Há ${-n} dias`;
  if (n < 7) return WEEKDAY_SHORT[due.getDay()].replace(/^./, (c) => c.toUpperCase());
  return `${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}`;
}

export type Group = 'late' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';
export const GROUP_LABEL: Record<Group, string> = {
  late: 'ATRASADAS',
  today: 'HOJE',
  tomorrow: 'AMANHÃ',
  week: 'ESTA SEMANA',
  later: 'MAIS TARDE',
  none: 'SEM DATA',
};
export const GROUP_ORDER: Group[] = ['late', 'today', 'tomorrow', 'week', 'later', 'none'];

export function groupOf(t: WorkTask, today: Date): Group {
  const due = dueOf(t);
  if (!due) return 'none';
  const n = daysFrom(today, due);
  if (n < 0) return 'late';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  // Até domingo desta semana.
  const toSunday = (7 - today.getDay()) % 7;
  return n <= toSunday ? 'week' : 'later';
}

export function fmtHours(n: number): string {
  return `${(Math.round(n * 10) / 10).toString().replace('.', ',')} h`;
}

// ==========================================
// TÍTULO
// ==========================================
export function WorkHeading({
  layout,
  subtitle,
  meta,
  onAddTask,
  onAddProject,
  trailing,
}: {
  layout: DensoLayout;
  subtitle: string;
  meta: string;
  onAddTask: () => void;
  onAddProject: () => void;
  trailing?: ReactNode;
}) {
  if (layout === 'phone') {
    return (
      <section className={d.inner} style={{ paddingTop: 16, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>Trabalho</h1>
          {trailing}
        </div>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 19, color: 'var(--sky)' }}>{subtitle}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className={d.btnFill} onClick={onAddTask}>+ Tarefa</button>
          <button type="button" className={d.btnLine} onClick={onAddProject}>+ Projeto</button>
        </div>
      </section>
    );
  }
  return (
    <section
      className={d.inner}
      style={{ minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px 24px', flexWrap: 'wrap', paddingTop: 12, paddingBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 18px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: layout === 'desktop' ? 48 : 40, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>Trabalho</h1>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 24, color: 'var(--sky)' }}>{subtitle}</span>
        <span className={d.muted} style={{ fontSize: 13 }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={d.btnLine} onClick={onAddProject}>+ Projeto</button>
        <button type="button" className={d.btnFill} onClick={onAddTask}>+ Tarefa</button>
      </div>
    </section>
  );
}

// ==========================================
// NÚMEROS DO TOPO
// ==========================================
export interface Stat {
  label: string;
  value: string;
  note: string;
  tone?: 'amber' | 'sky';
  pct?: number;
  mock?: boolean;
  onTap?: () => void;
}

export function WorkStats({ stats, columns }: { stats: Stat[]; columns: number }) {
  return (
    <section id="resumo" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12, scrollMarginTop: 64 }}>
      {stats.map((s) => {
        const color = s.tone === 'amber' ? 'var(--amber, #e3a857)' : s.tone === 'sky' ? 'var(--sky)' : 'var(--ink)';
        const body = (
          <>
            <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--mut2)' }}>{s.label}</span>
            <span className={d.serif} style={{ fontSize: 38, lineHeight: 1, color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>{s.note}</span>
            {typeof s.pct === 'number' && (
              <span style={{ display: 'flex', height: 3, background: 'var(--line)', marginTop: 2 }}>
                <span style={{ width: `${Math.min(100, s.pct)}%`, background: 'var(--accent)' }} />
              </span>
            )}
          </>
        );
        const style = {
          minHeight: 118,
          border: '1px solid #262626',
          background: 'var(--panel2)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          textAlign: 'left',
          color: 'var(--ink)',
        } as const;
        return s.onTap ? (
          <button key={s.label} type="button" onClick={s.onTap} className={d.rowLink} style={style}>{body}</button>
        ) : (
          <div key={s.label} style={style} title={s.mock ? 'Valor de exemplo: ainda não há registo de horas' : undefined}>{body}</div>
        );
      })}
    </section>
  );
}

// ==========================================
// PROJETOS
// ==========================================
export interface ProjectRowView {
  id: string | null; // null = "Sem projeto"
  name: string;
  color: string;
  total: number;
  done: number;
  next: WorkTask | null;
  hours: number | null;
}

const PROJ_COLS = 'minmax(0, 1.6fr) minmax(0, 1.1fr) minmax(0, 1.5fr) 64px';

export function ProjectsTable({
  rows,
  today,
  selected,
  onSelect,
  onEdit,
  cards = false,
}: {
  rows: ProjectRowView[];
  today: Date;
  selected: string | null | undefined;
  onSelect: (id: string | null) => void;
  onEdit: (id: string) => void;
  cards?: boolean;
}) {
  const nextText = (r: ProjectRowView) => {
    if (!r.next) return { title: r.total && r.done === r.total ? 'Tudo feito' : 'Sem entregas', when: '', late: false };
    const due = dueOf(r.next);
    return { title: r.next.title, when: due ? dueLabel(due, today) : 'Sem data', late: !!due && daysFrom(today, due) <= 0 };
  };

  return (
    <section id="projetos" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>PROJETOS</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>
          {selected !== undefined ? (
            <button type="button" onClick={() => onSelect(selected)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--sky)', fontSize: 12 }}>
              Mostrar todos ✕
            </button>
          ) : (
            'toca num projeto para filtrar as tarefas'
          )}
        </span>
      </div>
      {rows.length === 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Ainda não há projetos. Usa “+ Projeto”.</p>}

      {cards ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
          {rows.map((r) => {
            const n = nextText(r);
            const on = selected === r.id;
            return (
              <div key={r.id ?? 'none'} style={{ border: `1px solid ${on ? 'var(--bone)' : '#262626'}`, background: 'var(--panel2)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  aria-pressed={on}
                  style={{ background: 'none', border: 0, padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, color: 'var(--ink)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, flexShrink: 0, background: r.color }} />
                    <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 19 }}>{r.name}</span>
                    <span className={d.muted} style={{ fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>{r.done}/{r.total}</span>
                  </span>
                  <span style={{ display: 'flex', height: 3, background: 'var(--line)' }}>
                    <span style={{ width: `${r.total ? (r.done / r.total) * 100 : 0}%`, background: r.color }} />
                  </span>
                  <span className={d.ellipsis} style={{ fontSize: 12, color: 'var(--mut)' }}>
                    {n.title}
                    {n.when && <span style={{ color: n.late ? 'var(--amber, #e3a857)' : 'var(--mut2)' }}> · {n.when}</span>}
                    {r.hours !== null && <span style={{ color: 'var(--mut2)' }}> · {fmtHours(r.hours)}</span>}
                  </span>
                </button>
                {r.id && (
                  <button type="button" onClick={() => onEdit(r.id!)} aria-label={`Editar ${r.name}`} style={{ width: 48, background: 'none', border: 0, borderLeft: '1px solid #262626', color: 'var(--mut)', fontSize: 18 }}>
                    ⋯
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        rows.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: `${PROJ_COLS} 40px`, gap: 14, fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)', padding: '7px 0 4px' }}>
              <span>PROJETO</span>
              <span>PROGRESSO</span>
              <span>PRÓXIMA ENTREGA</span>
              <span style={{ textAlign: 'right' }} title="Valores de exemplo: ainda não há registo de horas">HORAS*</span>
              <span />
            </div>
            {rows.map((r) => {
              const n = nextText(r);
              const on = selected === r.id;
              return (
                <div
                  key={r.id ?? 'none'}
                  style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) 40px`, borderTop: '1px solid var(--line2)', background: on ? '#161616' : undefined, boxShadow: on ? 'inset 2px 0 0 var(--sky)' : undefined }}
                >
                  <button
                    type="button"
                    className={d.rowLink}
                    onClick={() => onSelect(r.id)}
                    aria-pressed={on}
                    style={{ display: 'grid', gridTemplateColumns: PROJ_COLS, gap: 14, alignItems: 'center', minHeight: 52, background: 'none', border: 0, padding: '0 0 0 6px', textAlign: 'left', fontSize: 13, color: 'var(--ink)' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, flexShrink: 0, background: r.color, border: r.id ? 0 : '1px solid var(--box2)' }} />
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 17 }}>{r.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--mut2)' }}>
                          {r.total - r.done} {r.total - r.done === 1 ? 'pendente' : 'pendentes'}
                        </span>
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ flexGrow: 1, display: 'flex', height: 4, background: 'var(--line)' }}>
                        <span style={{ width: `${r.total ? (r.done / r.total) * 100 : 0}%`, background: r.color }} />
                      </span>
                      <span className={d.muted} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.done}/{r.total}</span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span className={d.ellipsis}>{n.title}</span>
                      <span className={d.ellipsis} style={{ fontSize: 11, color: n.late ? 'var(--amber, #e3a857)' : 'var(--mut2)' }}>{n.when}</span>
                    </span>
                    <span className={d.muted} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.hours !== null ? fmtHours(r.hours) : '—'}</span>
                  </button>
                  {r.id ? (
                    <button type="button" onClick={() => onEdit(r.id!)} aria-label={`Editar ${r.name}`} title="Editar projeto" style={{ background: 'none', border: 0, color: 'var(--mut)', fontSize: 16 }}>
                      ⋯
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}

// ==========================================
// TAREFAS
// ==========================================
export function TasksPanel({
  tasks,
  done,
  projects,
  today,
  filterProject,
  onClearFilter,
  notes,
  onToggle,
  onOpen,
  onQuickAdd,
  inputRef,
  pendingIds,
  showDone,
  onToggleShowDone,
  boxed,
}: {
  tasks: WorkTask[];
  done: WorkTask[];
  projects: WorkProject[];
  today: Date;
  filterProject: WorkProject | null | undefined;
  onClearFilter: () => void;
  notes: Record<string, string>;
  onToggle: (t: WorkTask) => void;
  onOpen: (t: WorkTask) => void;
  onQuickAdd: (title: string, date: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  pendingIds: Set<string>;
  showDone: boolean;
  onToggleShowDone: () => void;
  boxed: boolean;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const byId = new Map(projects.map((p) => [p.id, p]));

  const groups = GROUP_ORDER.map((g) => ({ g, list: tasks.filter((t) => groupOf(t, today) === g) })).filter((x) => x.list.length);

  const submit = () => {
    if (!title.trim()) return;
    onQuickAdd(title.trim(), date);
    setTitle('');
    setDate('');
  };

  const row = (t: WorkTask) => {
    const p = t.project_id ? byId.get(t.project_id) : undefined;
    const due = dueOf(t);
    const n = due ? daysFrom(today, due) : null;
    const note = notes[t.id];
    return (
      <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', alignItems: 'center', gap: 6, minHeight: 48, borderBottom: '1px solid var(--line2)', opacity: pendingIds.has(t.id) ? 0.5 : 1 }}>
        <input
          type="checkbox"
          className={d.chk}
          checked={t.completed}
          onChange={() => onToggle(t)}
          aria-label={t.completed ? `Marcar “${t.title}” como por fazer` : `Concluir “${t.title}”`}
        />
        <button
          type="button"
          onClick={() => onOpen(t)}
          style={{ background: 'none', border: 0, padding: '6px 0', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, color: 'var(--ink)' }}
        >
          <span className={d.ellipsis} style={{ fontSize: 14, textDecoration: t.completed ? 'line-through' : undefined, color: t.completed ? 'var(--mut2)' : undefined }}>{t.title}</span>
          <span className={d.ellipsis} style={{ fontSize: 11, color: 'var(--mut2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {p && (
              <>
                <span style={{ width: 7, height: 7, flexShrink: 0, background: p.color }} />
                {p.name}
              </>
            )}
            {!p && 'Sem projeto'}
            {note && <span title={note}>· nota</span>}
          </span>
        </button>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: n !== null && n <= 0 && !t.completed ? 'var(--amber, #e3a857)' : 'var(--mut)' }}>
          {due ? dueLabel(due, today) : ''}
        </span>
      </div>
    );
  };

  return (
    <section
      id="tarefas"
      className={boxed ? d.aside : undefined}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: boxed ? 18 : 0, scrollMarginTop: 64 }}
    >
      <div className={d.sectionHead}>
        <h2 className={d.h2}>TAREFAS</h2>
        {filterProject !== undefined ? (
          <button type="button" onClick={onClearFilter} className={d.tag} style={{ border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {filterProject ? filterProject.name : 'Sem projeto'} ✕
          </button>
        ) : (
          <span className={d.muted} style={{ fontSize: 12 }}>{tasks.length} por fazer</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, padding: '12px 0 4px' }}>
        <input
          ref={inputRef}
          className={d.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={filterProject ? `Nova tarefa em ${filterProject.name}…` : 'Nova tarefa… (Enter)'}
          aria-label="Nova tarefa"
        />
        <DateField className={d.input} invalidClassName={d.inputInvalid} value={date} onChange={setDate} aria-label="Prazo da nova tarefa" style={{ width: 150, flexShrink: 0, colorScheme: 'dark' }} />
      </div>

      {tasks.length === 0 && (
        <p className={d.muted} style={{ margin: '12px 0 0', fontSize: 13 }}>{filterProject !== undefined ? 'Nada por fazer neste projeto.' : 'Nada por fazer.'}</p>
      )}
      {groups.map(({ g, list }) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', paddingTop: 14, paddingBottom: 2, color: g === 'late' ? 'var(--amber, #e3a857)' : g === 'today' ? 'var(--sky)' : 'var(--mut2)' }}>
            {GROUP_LABEL[g]} <span style={{ color: 'var(--mut2)' }}>{list.length}</span>
          </div>
          {list.map(row)}
        </div>
      ))}

      {done.length > 0 && (
        <div id="concluidas" style={{ display: 'flex', flexDirection: 'column', paddingTop: 14, scrollMarginTop: 64 }}>
          <button type="button" onClick={onToggleShowDone} aria-expanded={showDone} style={{ background: 'none', border: 0, padding: '4px 0', textAlign: 'left', fontSize: 11, letterSpacing: '0.08em', color: 'var(--mut2)' }}>
            {showDone ? '▾' : '▸'} CONCLUÍDAS {done.length}
          </button>
          {showDone && done.map(row)}
        </div>
      )}
    </section>
  );
}

// ==========================================
// PAINÉIS LATERAIS
// ==========================================
function Drawer({ title, sub, onClose, children, foot }: { title: string; sub?: string; onClose: () => void; children: ReactNode; foot: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <button type="button" className={d.drawerScrim} aria-label="Fechar" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className={d.drawer}>
        <div className={d.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</h2>
              {sub && <span className={`${d.serif} ${d.ellipsis}`} style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--sky)' }}>{sub}</span>}
            </div>
            <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={onClose}>Fechar</button>
          </div>
        </div>
        <div className={d.drawerBody}>{children}</div>
        <div className={d.drawerFoot}>{foot}</div>
      </aside>
    </>
  );
}

export interface TaskDraft {
  title: string;
  projectId: string;
  date: string;
  note: string;
}

export function TaskDrawer({
  task,
  initial,
  projects,
  today,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  task: WorkTask | null; // null = nova
  initial: TaskDraft;
  projects: WorkProject[];
  today: Date;
  saving: boolean;
  error: string | null;
  onSave: (draft: TaskDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [tried, setTried] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => titleRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  const iso = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const toMonday = ((8 - today.getDay()) % 7) || 7;
  const quick: [string, string][] = [
    ['Hoje', iso(0)],
    ['Amanhã', iso(1)],
    ['Próx. segunda', iso(toMonday)],
    ['Sem data', ''],
  ];

  const save = () => {
    setTried(true);
    if (draft.title.trim()) onSave(draft);
  };

  return (
    <Drawer
      title={task ? 'Tarefa' : 'Nova tarefa'}
      sub={task?.completed ? 'concluída' : undefined}
      onClose={onClose}
      foot={
        <>
          {onDelete ? <DeleteButton onConfirm={onDelete} /> : <span />}
          <button type="button" className={d.btnFill} onClick={save} disabled={saving}>
            {saving ? 'A guardar…' : task ? 'Guardar' : 'Criar tarefa'}
          </button>
        </>
      }
    >
      <Field label="TÍTULO">
        <input
          ref={titleRef}
          className={`${d.input} ${tried && !draft.title.trim() ? d.inputInvalid : ''}`}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder="Ex.: Rever proposta do cliente"
        />
      </Field>
      <Field label="PROJETO">
        <select className={d.inputSelect} value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
          <option value="">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <Field label="PRAZO">
        <div className={d.segPick} role="group" aria-label="Prazo rápido" style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {quick.map(([label, value]) => (
            <button key={label} type="button" aria-pressed={draft.date === value} onClick={() => setDraft({ ...draft, date: value })} style={{ padding: 0 }}>
              {label}
            </button>
          ))}
        </div>
        <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.date} onChange={(date) => setDraft({ ...draft, date })} style={{ colorScheme: 'dark' }} />
      </Field>
      <Field label="NOTAS" hint="Ficam guardadas só neste dispositivo (ainda não há coluna para notas no Supabase).">
        <textarea
          className={d.input}
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          rows={5}
          placeholder="Contexto, links, próximos passos…"
          style={{ height: 'auto', padding: '8px 10px', resize: 'vertical', lineHeight: 1.45 }}
        />
      </Field>
      {tried && !draft.title.trim() && <span className={d.errorText}>Indica um título.</span>}
      {error && <span className={d.errorText}>Erro: {error}</span>}
    </Drawer>
  );
}

export function ProjectDrawer({
  project,
  taskCount,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  project: WorkProject | null;
  taskCount: number;
  saving: boolean;
  error: string | null;
  onSave: (name: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [tried, setTried] = useState(false);
  const colors = PROJECT_COLORS.includes(color) ? PROJECT_COLORS : [color, ...PROJECT_COLORS];
  const save = () => {
    setTried(true);
    if (name.trim()) onSave(name.trim(), color);
  };
  return (
    <Drawer
      title={project ? 'Projeto' : 'Novo projeto'}
      sub={project?.name}
      onClose={onClose}
      foot={
        <>
          {onDelete ? <DeleteButton onConfirm={onDelete} label={taskCount ? `Apagar (e ${taskCount} ${taskCount === 1 ? 'tarefa' : 'tarefas'})` : 'Apagar'} /> : <span />}
          <button type="button" className={d.btnFill} onClick={save} disabled={saving}>
            {saving ? 'A guardar…' : project ? 'Guardar' : 'Criar projeto'}
          </button>
        </>
      }
    >
      <Field label="NOME">
        <input
          autoFocus
          className={`${d.input} ${tried && !name.trim() ? d.inputInvalid : ''}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder="Ex.: Implementação FI/CO"
        />
      </Field>
      <Field label="COR">
        <div role="radiogroup" aria-label="Cor" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              style={{ width: 36, height: 36, background: c, border: color === c ? '2px solid var(--ink)' : '1px solid var(--box)', outline: color === c ? '2px solid var(--bg)' : undefined, outlineOffset: -4 }}
            />
          ))}
        </div>
      </Field>
      {tried && !name.trim() && <span className={d.errorText}>Indica um nome.</span>}
      {error && <span className={d.errorText}>Erro: {error}</span>}
    </Drawer>
  );
}
