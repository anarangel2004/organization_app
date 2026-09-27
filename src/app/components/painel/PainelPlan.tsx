'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import { daysBetween, shortDate } from './painelData';
import type { WorkProject, WorkTask } from '@/lib/workData';
import { parseDueDate } from '../homeAgenda';

// As tarefas não têm prioridade guardada: deriva-se do prazo.
type Priority = 'Alta' | 'Média' | 'Baixa';

const PRI_COLOR: Record<Priority, string> = {
  Alta: 'var(--acc)',
  Média: 'var(--ink)',
  Baixa: 'var(--mut)',
};

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

const VISIBLE = 5;

// ==========================================
// PLANO DE AÇÃO (compacto, na abertura)
// ==========================================
export function CompactPlan({
  tasks,
  projects,
  today,
  pendingIds,
  onToggle,
  onAdd,
}: {
  tasks: WorkTask[];
  projects: WorkProject[];
  today: Date;
  pendingIds: Set<string>;
  onToggle: (task: WorkTask) => void;
  onAdd: (title: string, projectId: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = parseDueDate(a.due_date)?.getTime() ?? Infinity;
    const db = parseDueDate(b.due_date)?.getTime() ?? Infinity;
    return da - db;
  });
  const shown = sorted.slice(0, VISIBLE);
  const doneCount = tasks.filter((t) => t.completed).length;

  const submit = async () => {
    let text = draft.trim();
    if (!text || adding) return;
    // "[NOME DO PROJETO] título" associa a tarefa a esse projeto.
    let projectId: string | null = null;
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

  return (
    <div style={{ marginTop: 37, borderTop: '1px solid var(--hair)', paddingTop: 17 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span className={s.muted} style={{ fontSize: 12 }}>Plano de ação</span>
        <span className={s.muted} style={{ fontSize: 11 }}>
          {doneCount}/{tasks.length}
        </span>
      </div>
      <div style={{ marginTop: 7 }}>
        {shown.length === 0 && (
          <p className={s.muted} style={{ margin: 0, padding: '7px 0', borderTop: '1px solid var(--hair2)', fontSize: 12 }}>
            Sem tarefas pendentes.
          </p>
        )}
        {shown.map((t) => {
          const pri = priorityOf(t, today);
          const project = t.project_id ? projectById.get(t.project_id) : undefined;
          const detail = `${project?.name || 'Sem projeto'} · ${dueLabel(t, today)} · prioridade ${pri.toLowerCase()}`;
          return (
            <label
              key={t.id}
              title={detail}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--hair2)', cursor: 'pointer' }}
            >
              <input
                className={s.chk}
                type="checkbox"
                checked={t.completed}
                disabled={pendingIds.has(t.id)}
                onChange={() => onToggle(t)}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: t.completed ? 'var(--mut)' : 'var(--ink)',
                  textDecoration: t.completed ? 'line-through' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.title}
              </span>
              <span className={s.muted} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{dueLabel(t, today)}</span>
              <span
                aria-label={`Prioridade ${pri.toLowerCase()}`}
                className={s.round}
                style={{ width: 7, height: 7, flex: 'none', background: PRI_COLOR[pri] }}
              />
            </label>
          );
        })}
      </div>
      <label style={{ display: 'block', marginTop: 8 }}>
        <span className={s.sr}>Nova tarefa</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          disabled={adding}
          placeholder="+ nova tarefa para hoje…"
          className={s.lineInput}
        />
      </label>
      <div className={s.muted} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 7, fontSize: 11, flexWrap: 'wrap' }}>
        <span>Prefixo [PROJETO] para associar. Enter adiciona.</span>
        {sorted.length > VISIBLE ? (
          <Link href="/trabalho" className={s.lnk}>+{sorted.length - VISIBLE} em Projetos →</Link>
        ) : (
          <Link href="/trabalho" className={s.lnk}>Projetos →</Link>
        )}
      </div>
    </div>
  );
}

// ==========================================
// NOTAS EFÉMERAS (etiquetas, por baixo dos volumes)
// ==========================================
export function NotesChips({
  notes,
  onAdd,
  onClear,
}: {
  notes: string[];
  onAdd: (text: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div style={{ marginTop: 17, borderTop: '1px solid var(--hair)', paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className={s.serif} style={{ fontWeight: 600, fontSize: 16 }}>Notas efémeras</span>
        {notes.length > 0 && (
          <button type="button" className={s.lnk} onClick={onClear} style={{ fontSize: 10 }}>
            Limpar todas
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
        {notes.map((n, i) => (
          <span key={`${i}-${n}`} className={s.chip}>{n}</span>
        ))}
        {notes.length === 0 && <span className={s.muted} style={{ fontSize: 11 }}>Sem notas.</span>}
      </div>
      <label style={{ display: 'block', marginTop: 8 }}>
        <span className={s.sr}>Nova nota</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const v = draft.trim();
            if (!v) return;
            onAdd(v);
            setDraft('');
          }}
          placeholder="Lembrete rápido, Enter para guardar"
          className={s.lineInput}
        />
      </label>
      <p className={s.muted} style={{ margin: '6px 0 0', fontSize: 10 }}>Guardadas só neste browser.</p>
    </div>
  );
}
