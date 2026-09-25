'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import { SectionHead, Tip } from './ui';
import { daysBetween, fmtEuro, fmtNum, shortDate } from './painelData';
import {
  MOCK_BILLABLE_HOURS,
  MOCK_DEADLINE_PREP,
  MOCK_EXPENSES,
  MOCK_STUDY_HOURS,
} from './mockData';
import type { WorkProject, WorkTask } from '@/lib/workData';
import { parseDueDate } from '../homeAgenda';
import type { CtxFilter } from './PainelTop';

// ==========================================
// PRAZOS (próximos 14 dias)
// ==========================================
export interface DeadlineItem {
  id: string;
  cat: 'prazo' | 'trab';
  date: Date;
  title: string;
  typeLabel: string;
  desc: string;
  href: string;
}

const HORIZON = 14;

export function Deadlines({ items, today, ctx }: { items: DeadlineItem[]; today: Date; ctx: CtxFilter }) {
  const visible = items.filter((d) => ctx === 'all' || d.cat === 'trab');
  const cards = visible.slice(0, 3);

  return (
    <section className={s.inner} style={{ paddingTop: 80 }}>
      <SectionHead title="PRAZOS" aside={`próximos ${HORIZON} dias`} />

      <div style={{ position: 'relative', height: 88, marginTop: 22, marginRight: 8 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 1, background: 'var(--ink)' }} />
        {Array.from({ length: HORIZON + 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{ position: 'absolute', left: `${(i / HORIZON) * 100}%`, top: 38, width: 1, height: 8, background: 'var(--mut)' }}
          />
        ))}
        {visible.map((d, i) => {
          const pct = (Math.min(daysBetween(today, d.date), HORIZON) / HORIZON) * 100;
          const align = pct > 92 ? 'translateX(-100%)' : pct < 6 ? 'none' : 'translateX(-50%)';
          // Rótulos só para os três primeiros, para não se sobreporem.
          return (
            <div key={d.id}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: 40,
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  background: d.cat === 'prazo' ? 'var(--gelo)' : 'var(--bone)',
                }}
              />
              {i < 3 && (
                <span style={{ position: 'absolute', left: `${pct}%`, top: 8, transform: align, fontSize: 15, color: 'var(--acc)', whiteSpace: 'nowrap' }}>
                  {shortDate(d.date)}
                </span>
              )}
            </div>
          );
        })}
        <span className={s.muted} style={{ position: 'absolute', left: 0, top: 62, fontSize: 14 }}>
          hoje, {shortDate(today)}
        </span>
      </div>

      {cards.length === 0 ? (
        <p className={s.muted} style={{ margin: '30px 0 0', fontSize: 16 }}>
          Sem prazos nos próximos {HORIZON} dias.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '48px 24px', marginTop: 30 }}>
          {cards.map((d, i) => {
            const days = daysBetween(today, d.date);
            const prep = MOCK_DEADLINE_PREP[i] ?? MOCK_DEADLINE_PREP[0];
            return (
              <div key={d.id} className={s.hv}>
                <Link href={d.href} style={{ display: 'block', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                    <span
                      className={`${s.serif} ${s.tm}`}
                      style={{ fontWeight: 600, fontSize: 'clamp(80px, 7.6vw, 110px)', lineHeight: 0.85, letterSpacing: '-.03em', color: 'var(--acc)' }}
                    >
                      {days}
                    </span>
                    <span className={s.muted} style={{ fontSize: 15, paddingBottom: 6 }}>
                      {days === 1 ? 'dia' : 'dias'}
                    </span>
                  </span>
                  <span style={{ display: 'block', marginTop: 20, fontSize: 22, fontWeight: 500, lineHeight: 1.25 }}>{d.title}</span>
                  <span className={s.muted} style={{ display: 'block', marginTop: 4, fontSize: 15 }}>
                    {d.typeLabel}, {shortDate(d.date)}
                  </span>
                  <span style={{ display: 'block', marginTop: 22, height: 8, background: 'var(--hair2)' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${prep.prep}%`,
                        background: d.cat === 'prazo' ? 'var(--petro2)' : 'var(--bone)',
                      }}
                    />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
                    <span>{prep.prep}% preparado*</span>
                    <span className={s.muted}>{prep.state}</span>
                  </span>
                </Link>
                <Tip
                  tone={d.cat === 'prazo' ? 'v' : 'p'}
                  title={d.title}
                  style={{ ...(i === cards.length - 1 && i > 0 ? { right: 0 } : { left: 0 }), top: 'calc(100% - 44px)', width: 320 }}
                >
                  {d.desc}
                </Tip>
              </div>
            );
          })}
        </div>
      )}
      {cards.length > 0 && (
        <p className={s.muted} style={{ margin: '22px 0 0', fontSize: 13 }}>
          * A preparação é um valor de exemplo: as avaliações ainda não guardam progresso.
        </p>
      )}
    </section>
  );
}

// ==========================================
// PLANO DE AÇÃO (tarefas reais de work_tasks)
// ==========================================
type Priority = 'Alta' | 'Média' | 'Baixa';

const PRI_STYLE: Record<Priority, { color: string; weight: number }> = {
  Alta: { color: 'var(--acc)', weight: 600 },
  Média: { color: 'var(--ink)', weight: 400 },
  Baixa: { color: 'var(--mut)', weight: 400 },
};

// As tarefas não têm prioridade guardada: deriva-se do prazo.
function priorityOf(task: WorkTask, today: Date): Priority {
  const due = parseDueDate(task.due_date);
  if (!due) return 'Baixa';
  const d = daysBetween(today, due);
  if (d <= 0) return 'Alta';
  if (d <= 3) return 'Média';
  return 'Baixa';
}

function dueLabel(task: WorkTask, today: Date): string {
  const due = parseDueDate(task.due_date);
  if (!due) return 'sem data';
  const d = daysBetween(today, due);
  if (d < 0) return 'atrasada';
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  return shortDate(due);
}

export function ActionPlan({
  tasks,
  projects,
  classHours,
  taskHours,
  today,
  pendingIds,
  onToggle,
  onAdd,
}: {
  tasks: WorkTask[];
  projects: WorkProject[];
  classHours: number;
  taskHours: number;
  today: Date;
  pendingIds: Set<string>;
  onToggle: (task: WorkTask) => void;
  onAdd: (title: string, projectId: string | null) => Promise<void>;
}) {
  const [filter, setFilter] = useState<string>('todas');
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const visible = filter === 'todas' ? tasks : tasks.filter((t) => (t.project_id || 'none') === filter);
  const sorted = [...visible].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = parseDueDate(a.due_date)?.getTime() ?? Infinity;
    const db = parseDueDate(b.due_date)?.getTime() ?? Infinity;
    return da - db;
  });

  const total = classHours + taskHours;
  const pFac = total ? Math.round((classHours / total) * 100) : 0;
  const pTrab = total ? 100 - pFac : 0;

  const filters: [string, string][] = [['todas', 'Todas'], ...projects.slice(0, 4).map((p) => [p.id, p.name] as [string, string])];
  if (tasks.some((t) => !t.project_id)) filters.push(['none', 'Sem projeto']);

  const submit = async () => {
    let text = draft.trim();
    if (!text || adding) return;
    let projectId: string | null = filter !== 'todas' && filter !== 'none' ? filter : null;
    const m = text.match(/^\[([^\]]+)\]\s*/);
    if (m) {
      const wanted = m[1].trim().toLowerCase();
      const found = projects.find((p) => p.name.trim().toLowerCase() === wanted);
      if (found) {
        projectId = found.id;
        text = text.slice(m[0].length);
      }
    }
    if (!text) return;
    setAdding(true);
    try {
      await onAdd(text, projectId);
      setDraft('');
    } finally {
      setAdding(false);
    }
  };

  const example = projects[0]?.name ? `[${projects[0].name.toUpperCase()}] ` : '';

  return (
    <section>
      <SectionHead title="PLANO DE AÇÃO" aside="tarefas" />
      <div role="group" aria-label="Filtrar tarefas" className={s.segGroup} style={{ marginTop: 14, rowGap: 8 }}>
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${s.seg} ${filter === id ? s.segOn : ''}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>Balanceador de carga, esta semana</span>
          <span className={s.serif} style={{ fontWeight: 600, fontSize: 28, lineHeight: 1 }}>
            {fmtNum(total)} h planeadas
          </span>
        </div>
        <div style={{ display: 'flex', height: 26, marginTop: 12, background: 'var(--hair2)' }}>
          <div style={{ width: `${pFac}%`, background: 'var(--petro)', border: pFac ? '1px solid var(--petro2)' : undefined }} />
          <div style={{ width: `${pTrab}%`, background: 'var(--bone)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: 14, flexWrap: 'wrap' }}>
          <span>Aulas {pFac}%, {fmtNum(classHours)} h</span>
          <span>Trabalho {pTrab}%, {fmtNum(taskHours)} h*</span>
        </div>
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid var(--hair)' }}>
        {sorted.length === 0 && (
          <p className={s.muted} style={{ margin: '18px 0', fontSize: 16 }}>Sem tarefas. Escreve uma abaixo.</p>
        )}
        {sorted.map((t) => {
          const pri = priorityOf(t, today);
          const project = t.project_id ? projectById.get(t.project_id) : undefined;
          const hasProject = Boolean(project);
          return (
            <div key={t.id} className={s.hv} style={{ borderBottom: '1px solid var(--hair)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px minmax(0, 1fr) auto auto',
                  columnGap: 16,
                  alignItems: 'center',
                  padding: '18px 0',
                }}
              >
                <input
                  className={s.chk}
                  type="checkbox"
                  checked={t.completed}
                  disabled={pendingIds.has(t.id)}
                  onChange={() => onToggle(t)}
                  aria-label={t.title}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: 18,
                    lineHeight: 1.3,
                    color: t.completed ? 'var(--mut)' : 'var(--ink)',
                    textDecoration: t.completed ? 'line-through' : 'none',
                  }}
                >
                  {t.title}
                </span>
                <span style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 14 }}>
                  <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>{dueLabel(t, today)}</span>
                  <span style={{ color: PRI_STYLE[pri].color, fontWeight: PRI_STYLE[pri].weight }}>{pri}</span>
                </span>
                <span
                  style={{
                    justifySelf: 'end',
                    fontSize: 14,
                    padding: '3px 8px',
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: hasProject ? 'var(--bone)' : 'transparent',
                    color: hasProject ? 'var(--inkdark)' : 'var(--mut)',
                    border: hasProject ? '1px solid var(--bone)' : '1px dashed var(--mut)',
                  }}
                >
                  {project?.name || 'Sem projeto'}
                </span>
              </div>
              <Tip tone="m" title={t.title} titleSize={20} style={{ right: 0, top: 'calc(100% - 12px)', width: 260 }}>
                {`${project ? `Projeto ${project.name}.` : 'Sem projeto.'} ${
                  t.due_date ? `Prazo: ${shortDate(parseDueDate(t.due_date) as Date)}.` : 'Sem prazo definido.'
                } Prioridade calculada a partir do prazo.`}
              </Tip>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 22 }}>
        <label style={{ display: 'block' }}>
          <span className={s.sr}>Nova tarefa</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            disabled={adding}
            placeholder={`${example}Nova tarefa para hoje…`}
            className={s.lineInput}
            style={{ padding: '14px 0', fontSize: 18 }}
          />
        </label>
        <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 14 }}>
          Prefixo [NOME DO PROJETO] para associar a um projeto. Enter adiciona com prazo hoje.
        </p>
        <p className={s.muted} style={{ margin: '6px 0 0', fontSize: 13 }}>
          * As tarefas não têm duração: cada tarefa pendente conta como estimativa.
        </p>
      </div>
    </section>
  );
}

// ==========================================
// BALANÇO + NOTAS EFÉMERAS
// ==========================================
function Meter({ label, done, target, color }: { label: string; done: number; target: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15 }}>{label}</span>
        <span className={s.serif} style={{ fontWeight: 600, fontSize: 26, lineHeight: 1 }}>
          {fmtNum(done)}
          <span className={s.muted} style={{ fontFamily: 'var(--font-hanken), sans-serif', fontWeight: 400, fontSize: 14, marginLeft: 6 }}>
            de {target} h
          </span>
        </span>
      </div>
      <div style={{ height: 10, background: 'var(--hair2)', marginTop: 10 }}>
        <div style={{ height: '100%', width: `${Math.min(100, (done / target) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function Balance({
  notes,
  onAddNote,
  onClearNotes,
}: {
  notes: string[];
  onAddNote: (text: string) => void;
  onClearNotes: () => void;
}) {
  const [draft, setDraft] = useState('');
  const addNote = () => {
    const v = draft.trim();
    if (!v) return;
    onAddNote(v);
    setDraft('');
  };
  const expensesTotal = MOCK_EXPENSES.reduce((sum, e) => sum + e.amount, 0);

  return (
    <section>
      <SectionHead title="BALANÇO" aside="esta semana" />
      <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>
        Valores de exemplo: ainda não há registo de horas nem de despesas.
      </p>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Meter label="Horas faturáveis" done={MOCK_BILLABLE_HOURS.done} target={MOCK_BILLABLE_HOURS.target} color="var(--bone)" />
        <Meter label="Horas de estudo" done={MOCK_STUDY_HOURS.done} target={MOCK_STUDY_HOURS.target} color="var(--petro2)" />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginTop: 24,
          paddingTop: 14,
          borderTop: '1px solid var(--hair)',
        }}
      >
        <span className={s.muted} style={{ fontSize: 15 }}>Total acumulado</span>
        <span className={s.serif} style={{ fontWeight: 600, fontSize: 48, lineHeight: 1, color: 'var(--acc)' }}>
          {fmtNum(MOCK_BILLABLE_HOURS.done + MOCK_STUDY_HOURS.done)} h
        </span>
      </div>

      <h3 className={s.serif} style={{ margin: '56px 0 0', fontWeight: 600, fontSize: 28, lineHeight: 1, letterSpacing: '-.01em' }}>
        Despesas do mês
      </h3>
      <div style={{ marginTop: 12, borderTop: '1px solid var(--hair)' }}>
        {MOCK_EXPENSES.map((e) => (
          <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid var(--hair)', fontSize: 16 }}>
            <span>{e.label}</span>
            <span>{fmtEuro(e.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14 }}>
          <span className={s.muted} style={{ fontSize: 15 }}>Total do mês</span>
          <span className={s.serif} style={{ fontWeight: 600, fontSize: 32, lineHeight: 1 }}>{fmtEuro(expensesTotal)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 56 }}>
        <h3 className={s.serif} style={{ margin: 0, fontWeight: 600, fontSize: 28, lineHeight: 1, letterSpacing: '-.01em' }}>
          Notas efémeras
        </h3>
        {notes.length > 0 && (
          <button type="button" className={s.lnk} onClick={onClearNotes} style={{ fontSize: 14 }}>
            Limpar todas
          </button>
        )}
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid var(--hair)' }}>
        {notes.map((n, i) => (
          <div key={`${i}-${n}`} style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--hair)', fontSize: 16, lineHeight: 1.4 }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 8, height: 8, marginTop: 7, background: 'var(--gelo)' }} />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{n}</span>
          </div>
        ))}
        {notes.length === 0 && (
          <p className={s.muted} style={{ margin: '14px 0 0', fontSize: 15 }}>Sem notas. Escreve uma abaixo.</p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <label style={{ display: 'block', flex: 1 }}>
          <span className={s.sr}>Nova nota</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNote();
            }}
            placeholder="Lembrete rápido"
            className={s.lineInput}
            style={{ padding: '10px 0', fontSize: 16 }}
          />
        </label>
        <button type="button" className={s.lnk} onClick={addNote} style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
          + Nova nota
        </button>
      </div>
      <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 12 }}>As notas ficam guardadas só neste browser.</p>
    </section>
  );
}

export function PainelFooter() {
  return (
    <footer className={s.inner} style={{ marginTop: 96, paddingBottom: 48 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 28,
          borderTop: '1px solid var(--hair)',
          paddingTop: 28,
        }}
      >
        <p
          className={`${s.serif} ${s.muted}`}
          style={{ margin: 0, fontWeight: 500, fontSize: 19, lineHeight: 1.5, maxWidth: 560 }}
        >
          Composto em Hanken Grotesk e Newsreader, sobre preto, com grão. Feito para uma pessoa só, que divide os dias
          entre a sala de aula e o trabalho.
        </p>
        <nav
          aria-label="Ligações úteis"
          style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15, alignItems: 'flex-start' }}
        >
          <Link className={s.nl} href="/faculdade">Disciplinas</Link>
          <Link className={s.nl} href="/trabalho">Projetos e tarefas</Link>
        </nav>
      </div>
    </footer>
  );
}
