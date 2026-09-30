'use client';

// Turnos de trabalho: semanais (todas as segundas…) ou num dia concreto.
// Aparecem na grelha da Visão Geral e o plano de estudo não marca blocos por cima.

import { useState } from 'react';
import d from '@/app/components/denso/denso.module.css';
import { DeleteButton, Field, errorMessage } from '@/app/components/denso/DensoForm';
import { DateField, TimeField } from '@/components/ui/DateTimeFields';
import {
  createWorkShift,
  deleteWorkShift,
  updateWorkShift,
  type WorkProject,
  type WorkShift,
  type WorkShiftInput,
} from '@/lib/workData';

const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const hhmm = (t: string) => t.slice(0, 5);
const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function whenLabel(s: WorkShift): string {
  if (s.date) {
    const [y, m, dd] = s.date.split('T')[0].split('-').map(Number);
    const dt = new Date(y, m - 1, dd);
    return `${WD[dt.getDay()].slice(0, 3)}, ${dd} ${MONTHS[m - 1]}`;
  }
  const w = WD[s.weekday ?? 1].toLowerCase();
  return s.weekday === 0 || s.weekday === 6 ? `Todos os ${w}s` : `Todas as ${w}s`;
}

interface Draft {
  title: string;
  repeat: string; // '0'..'6' ou 'data'
  date: string;
  start: string;
  end: string;
  place: string;
  projectId: string;
}

const toDraft = (s: WorkShift | null): Draft => ({
  title: s?.title ?? 'Turno',
  repeat: s ? (s.date ? 'data' : String(s.weekday ?? 1)) : '1',
  date: s?.date ? s.date.split('T')[0] : '',
  start: s ? hhmm(s.start_time) : '09:00',
  end: s ? hhmm(s.end_time) : '13:00',
  place: s?.place ?? '',
  projectId: s?.project_id ?? '',
});

export function ShiftsPanel({
  shifts,
  projects,
  onChange,
  boxed,
}: {
  shifts: WorkShift[];
  projects: WorkProject[];
  onChange: (update: (prev: WorkShift[]) => WorkShift[]) => void;
  boxed: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null); // 'new' ou id
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekly = shifts.filter((s) => !s.date);
  const weekHours = weekly.reduce((n, s) => n + Math.max(0, minutes(s.end_time) - minutes(s.start_time)) / 60, 0);
  const sorted = [...shifts].sort(
    (a, b) =>
      Number(!!a.date) - Number(!!b.date) ||
      ((a.weekday ?? 0) + 6) % 7 - ((b.weekday ?? 0) + 6) % 7 ||
      (a.date || '').localeCompare(b.date || '') ||
      a.start_time.localeCompare(b.start_time)
  );
  const projectOf = (id: string | null) => projects.find((p) => p.id === id);

  const open = (s: WorkShift | null) => {
    setError(null);
    setOpenId(s ? s.id : 'new');
    setDraft(toDraft(s));
  };

  const invalid =
    !draft.start || !draft.end ? 'Indica o início e o fim.' : draft.end <= draft.start ? 'O fim tem de ser depois do início.' : draft.repeat === 'data' && !draft.date ? 'Escolhe o dia.' : null;

  const save = async () => {
    if (invalid) return;
    const input: WorkShiftInput = {
      title: draft.title.trim() || 'Turno',
      weekday: draft.repeat === 'data' ? null : Number(draft.repeat),
      date: draft.repeat === 'data' ? draft.date : null,
      start_time: draft.start,
      end_time: draft.end,
      place: draft.place.trim() || null,
      project_id: draft.projectId || null,
    };
    setSaving(true);
    setError(null);
    try {
      if (openId === 'new') {
        const created = await createWorkShift(input);
        onChange((prev) => [...prev, created]);
      } else if (openId) {
        await updateWorkShift(openId, input);
        onChange((prev) => prev.map((s) => (s.id === openId ? { ...s, ...input } : s)));
      }
      setOpenId(null);
    } catch (err) {
      const msg = errorMessage(err);
      const code = (err as { code?: string } | null)?.code ?? '';
      setError(
        code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(msg)
          ? 'Falta criar a tabela dos turnos: corre o supabase-study-plan.sql no Supabase.'
          : code === '42501' || /permission denied/i.test(msg)
            ? 'Sem permissão na tabela dos turnos: corre o supabase-grants.sql no Supabase.'
            : `Não foi possível guardar: ${msg}`
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      await deleteWorkShift(id);
      onChange((prev) => prev.filter((s) => s.id !== id));
      setOpenId(null);
    } catch (err) {
      setError(`Não foi possível apagar: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <div className={d.slot} style={{ borderColor: 'var(--box2)', margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="NOME">
          <input autoFocus className={d.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Turno" />
        </Field>
        <Field label="QUANDO">
          <select className={d.input} value={draft.repeat} onChange={(e) => setDraft({ ...draft, repeat: e.target.value })}>
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <option key={n} value={n}>
                {n === 0 || n === 6 ? `Todos os ${WD[n].toLowerCase()}s` : `Todas as ${WD[n].toLowerCase()}s`}
              </option>
            ))}
            <option value="data">Só num dia…</option>
          </select>
        </Field>
      </div>
      {draft.repeat === 'data' && (
        <Field label="DIA">
          <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} style={{ colorScheme: 'dark' }} />
        </Field>
      )}
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="INÍCIO">
          <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.start} onChange={(v) => setDraft({ ...draft, start: v })} />
        </Field>
        <Field label="FIM">
          <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.end} onChange={(v) => setDraft({ ...draft, end: v })} />
        </Field>
      </div>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="LOCAL">
          <input className={d.input} value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="Escritório, remoto…" />
        </Field>
        <Field label="PROJETO">
          <select className={d.input} value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      </div>
      {(invalid || error) && <span className={d.errorText}>{error || invalid}</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {openId && openId !== 'new' ? <DeleteButton onConfirm={() => remove(openId)} /> : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={() => setOpenId(null)}>Cancelar</button>
          <button type="button" className={`${d.btnFill} ${d.sm}`} disabled={!!invalid || saving} onClick={save}>
            {saving ? 'A guardar…' : openId === 'new' ? 'Adicionar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section id="turnos" className={boxed ? d.aside : undefined} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: boxed ? '14px 16px' : 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>TURNOS</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={d.muted} style={{ fontSize: 12 }}>{weekly.length ? `${weekHours.toString().replace('.', ',')} h por semana` : 'nenhum semanal'}</span>
          <button type="button" className={`${d.btnGhost} ${d.xs}`} onClick={() => open(null)}>+ Turno</button>
        </span>
      </div>
      {openId === 'new' && form}
      {shifts.length === 0 && openId !== 'new' && (
        <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Sem turnos. Os turnos entram na grelha da Visão Geral e o plano de estudo evita-os.</p>
      )}
      {sorted.map((s) =>
        openId === s.id ? (
          <div key={s.id}>{form}</div>
        ) : (
          <button
            key={s.id}
            type="button"
            onClick={() => open(s)}
            className={d.row}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) auto minmax(0, 1fr)', gap: 10, alignItems: 'center', width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line2)', padding: '6px 0', textAlign: 'left', color: 'var(--ink)' }}
          >
            <span className={d.ellipsis}>{whenLabel(s)}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>
            <span className={d.ellipsis} style={{ color: 'var(--mut)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              {projectOf(s.project_id) && (
                <span aria-hidden="true" className={d.round} style={{ width: 7, height: 7, background: projectOf(s.project_id)!.color, flex: 'none', display: 'inline-block' }} />
              )}
              {[s.title !== 'Turno' ? s.title : null, s.place].filter(Boolean).join(' · ') || 'Turno'}
            </span>
          </button>
        )
      )}
    </section>
  );
}
