'use client';

import { useEffect, useState } from 'react';
import c from './caderno.module.css';
import { DateField, TimeField } from '@/components/ui/DateTimeFields';
import { fmtDuration } from '@/app/faculdade/[id]/components/disciplinaData';
import { chapterOrNull, type StudySessionRow } from '@/lib/study';

// O mínimo de um capítulo que o painel precisa (serve o do caderno e o do /estudo).
export interface DialogChapter {
  id: string;
  subjectId: string;
  number: string;
  title: string;
}

// "+ sessão": estudo feito fora da app (livro, papel), registado à mão.

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ManualSessionDialog({
  subjectId,
  subjectLabel,
  chapters,
  currentChapterId,
  onSave,
  onClose,
  subjects,
}: {
  subjectId: string;
  subjectLabel: string;
  chapters: DialogChapter[];
  currentChapterId: string | null;
  onSave: (row: Omit<StudySessionRow, 'id' | 'source'>) => void;
  onClose: () => void;
  // No /estudo: escolher a disciplina (no caderno é a do caderno).
  subjects?: { id: string; label: string }[];
}) {
  // Por omissão: 1 hora que acabou agora.
  const [duration, setDuration] = useState(60);
  const [date, setDate] = useState(() => isoDay(new Date()));
  const [start, setStart] = useState(() => hhmm(new Date(Date.now() - 60 * 60 * 1000)));
  const [chapter, setChapter] = useState(chapterOrNull(currentChapterId) ?? '');
  const [subj, setSubj] = useState(subjectId);
  const subjectChapters = chapters.filter((ch) => ch.subjectId === subj);
  const shownLabel = subjects ? subjects.find((s) => s.id === subj)?.label ?? subjectLabel : subjectLabel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startDate = date && start ? new Date(`${date}T${start}:00`) : null;
  const valid = !!startDate && !Number.isNaN(startDate.getTime()) && duration > 0;
  // Hora de abertura do painel (+1 min de folga): o render não pode ler o relógio.
  const [openedAt] = useState(() => Date.now() + 60_000);
  const inFuture = !!startDate && startDate.getTime() > openedAt;

  const save = () => {
    if (!valid || !startDate || inFuture) return;
    const end = new Date(startDate.getTime() + duration * 60 * 1000);
    onSave({
      subject_id: subj,
      chapter_id: chapter || null,
      started_at: startDate.toISOString(),
      ended_at: end.toISOString(),
      duration_seconds: duration * 60,
    });
    onClose();
  };

  const label = { fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)' } as const;
  const field = { display: 'flex', flexDirection: 'column', gap: 6 } as const;
  const input = { height: 36, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--box)', padding: '0 10px', fontSize: 14, width: '100%' } as const;

  return (
    <div
      role="presentation"
      onClick={onClose}
      data-study-ignore
      style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registar sessão de estudo"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 100%)', background: 'var(--panel)', border: '1px solid var(--box)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Registar sessão de estudo</div>
          <div style={{ fontSize: 12, color: 'var(--mut)' }}>{shownLabel} · estudo fora da app (livro, papel…)</div>
        </div>

        {subjects && (
          <label style={field}>
            <span style={label}>DISCIPLINA</span>
            <select
              value={subj}
              onChange={(e) => {
                setSubj(e.target.value);
                setChapter('');
              }}
              style={input}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <label style={field}>
            <span style={label}>DIA</span>
            <DateField value={date} onChange={setDate} style={{ colorScheme: 'dark' }} className={c.manualInput} aria-label="Dia da sessão" />
          </label>
          <label style={field}>
            <span style={label}>INÍCIO</span>
            <TimeField value={start} onChange={setStart} style={input} aria-label="Hora de início" />
          </label>
        </div>

        <label style={field}>
          <span style={label}>DURAÇÃO</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={input}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>{fmtDuration(m)}</option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={label}>CAPÍTULO (OPCIONAL)</span>
          <select value={chapter} onChange={(e) => setChapter(e.target.value)} style={input}>
            <option value="">Sem capítulo</option>
            {subjectChapters
              .filter((ch) => chapterOrNull(ch.id))
              .map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.number} · {ch.title || 'Sem título'}
                </option>
              ))}
          </select>
        </label>

        {inFuture && <span style={{ fontSize: 12, color: '#e38b7a' }}>A sessão não pode começar no futuro.</span>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className={c.btn} style={{ height: 36, padding: '0 14px' }} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={c.fill} style={{ height: 36, padding: '0 14px' }} disabled={!valid || inFuture} onClick={save}>
            Guardar {valid ? fmtDuration(duration) : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
