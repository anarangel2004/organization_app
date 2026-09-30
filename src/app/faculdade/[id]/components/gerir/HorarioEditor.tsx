'use client';

import { useMemo, useState } from 'react';
import d from '@/app/components/denso/denso.module.css';
import { TimeField } from '@/components/ui/DateTimeFields';
import { normalizeDayNum, parseMinutes, parseSchedulesRaw } from '@/app/components/homeAgenda';
import { WEEKDAY_LONG, WEEKDAY_SHORT, branchOf, type Branch } from '../disciplinaData';
import { DeleteButton, Field, SaveStatus, errorMessage, updateSubject, type SaveState } from './shared';

// Editor do horário semanal: pré-visualização da semana + lista de sessões,
// cada uma editável no sítio. Grava a lista inteira em subjects.schedules,
// no mesmo formato do editor antigo ({ day, dayOfWeek, startTime, … }).

interface EditSlot {
  id: string;
  dayNum: number;
  start: string;
  end: string;
  room: string;
  type: string;
}

const DAY_KEY: Record<number, string> = {
  0: 'DOMINGO',
  1: 'SEGUNDA-FEIRA',
  2: 'TERÇA-FEIRA',
  3: 'QUARTA-FEIRA',
  4: 'QUINTA-FEIRA',
  5: 'SEXTA-FEIRA',
  6: 'SÁBADO',
};
const PICK_DAYS = [1, 2, 3, 4, 5, 6];
const TYPES: [string, string, Branch][] = [
  ['TEÓRICO', 'Teórica', 'T'],
  ['PRÁTICO', 'Prática', 'P'],
  ['TEÓRICO-PRÁTICO', 'Teórico-prática', 'TP'],
];
const BRANCH_COLOR: Record<Branch, string> = { T: 'var(--sky)', P: 'var(--bone)', TP: 'var(--ice)', O: 'var(--mut)' };
const BRANCH_LABEL: Record<Branch, string> = { T: 'Teórica', P: 'Prática', TP: 'Teórico-prática', O: 'Aula' };

const sortSlots = (list: EditSlot[]) =>
  [...list].sort((a, b) => ((a.dayNum + 6) % 7) - ((b.dayNum + 6) % 7) || parseMinutes(a.start) - parseMinutes(b.start));

// Lê o que está gravado. Entradas que não se percebem ficam guardadas à parte
// para não se perderem quando se grava.
function fromRaw(raw: unknown): { slots: EditSlot[]; unknown: unknown[] } {
  const slots: EditSlot[] = [];
  const unknown: unknown[] = [];
  parseSchedulesRaw(raw).forEach((e, i) => {
    const dayNum = normalizeDayNum(e.day ?? e.dayOfWeek);
    const start = e.startTime || e.start_time || '';
    if (dayNum === null || !start) {
      unknown.push(e);
      return;
    }
    slots.push({
      id: String((e as { id?: unknown }).id || `s${i}-${dayNum}-${start}`),
      dayNum,
      start,
      end: e.endTime || e.end_time || '',
      room: e.room || e.sala || '',
      type: e.type || e.tipo || 'TEÓRICO',
    });
  });
  return { slots: sortSlots(slots), unknown };
}

function toRaw(s: EditSlot) {
  return { id: s.id, day: DAY_KEY[s.dayNum], dayOfWeek: DAY_KEY[s.dayNum], startTime: s.start, endTime: s.end, room: s.room, type: s.type };
}

function addMinutes(t: string, min: number) {
  const total = Math.min(23 * 60 + 59, parseMinutes(t) + min);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function HorarioEditor({
  subjectId,
  schedules,
  onSaved,
}: {
  subjectId: string;
  schedules: unknown;
  // Novo valor da coluna schedules (a página atualiza-se sem recarregar).
  onSaved: (schedules: unknown[]) => void;
}) {
  const { slots, unknown } = useMemo(() => fromRaw(schedules), [schedules]);
  const [editing, setEditing] = useState<EditSlot | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [status, setStatus] = useState<SaveState>({ kind: 'idle' });

  const rooms = useMemo(() => Array.from(new Set(slots.map((s) => s.room).filter(Boolean))), [slots]);

  const persist = async (next: EditSlot[]) => {
    const value = [...sortSlots(next).map(toRaw), ...unknown];
    setStatus({ kind: 'saving' });
    try {
      const offline = await updateSubject(subjectId, { schedules: value });
      onSaved(value);
      setEditing(null);
      setIsNew(false);
      setStatus({ kind: 'saved', offline });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) });
    }
  };

  const startNew = () => {
    const last = slots[slots.length - 1];
    const hasT = slots.some((s) => branchOf(s.type) === 'T');
    setIsNew(true);
    setStatus({ kind: 'idle' });
    setEditing({
      id: `${Date.now()}`,
      dayNum: last ? last.dayNum : 1,
      start: '09:00',
      end: '11:00',
      room: last?.room ?? '',
      type: hasT ? 'PRÁTICO' : 'TEÓRICO',
    });
  };

  const edit = (s: EditSlot) => {
    setIsNew(false);
    setStatus({ kind: 'idle' });
    setEditing({ ...s });
  };

  // Validação e sobreposições da sessão em edição.
  const endError = editing && editing.end && parseMinutes(editing.end) <= parseMinutes(editing.start) ? 'A hora de fim tem de ser depois da de início.' : null;
  const overlap = editing
    ? slots.find(
        (s) =>
          s.id !== editing.id &&
          s.dayNum === editing.dayNum &&
          parseMinutes(s.start) < parseMinutes(editing.end || addMinutes(editing.start, 90)) &&
          parseMinutes(editing.start) < parseMinutes(s.end || addMinutes(s.start, 90))
      )
    : undefined;

  const save = () => {
    if (!editing || endError || !editing.start) return;
    persist(isNew ? [...slots, editing] : slots.map((s) => (s.id === editing.id ? editing : s)));
  };

  // ==========================================
  // PRÉ-VISUALIZAÇÃO DA SEMANA
  // ==========================================
  const preview = editing ? (isNew ? [...slots, editing] : slots.map((s) => (s.id === editing.id ? editing : s))) : slots;
  const days = preview.some((s) => s.dayNum === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const firstHour = Math.min(8, ...preview.map((s) => Math.floor(parseMinutes(s.start) / 60)));
  const lastHour = Math.max(19, ...preview.map((s) => Math.ceil(parseMinutes(s.end || addMinutes(s.start, 90)) / 60)));
  const span = (lastHour - firstHour) * 60;
  const pct = (t: string) => ((parseMinutes(t) - firstHour * 60) / span) * 100;

  const editor = editing && (
    <div className={d.slot} style={{ borderColor: 'var(--box2)' }}>
      <div className={d.segPick} role="group" aria-label="Tipo de aula">
        {TYPES.map(([id, label, branch]) => (
          <button key={id} type="button" aria-pressed={branchOf(editing.type) === branch} onClick={() => setEditing({ ...editing, type: id })}>
            {label}
          </button>
        ))}
      </div>
      <Field label="DIA">
        <div className={d.segPick} role="group" aria-label="Dia da semana" style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
          {PICK_DAYS.map((n) => (
            <button key={n} type="button" aria-pressed={editing.dayNum === n} onClick={() => setEditing({ ...editing, dayNum: n })} style={{ padding: 0 }}>
              {WEEKDAY_SHORT[n]}
            </button>
          ))}
        </div>
      </Field>
      <div className={`${d.fieldRow} ${d.fieldRow3}`}>
        <Field label="INÍCIO">
          <TimeField
            className={d.input}
            invalidClassName={d.inputInvalid}
            value={editing.start}
            onChange={(start) => {
              // Mantém a duração ao mudar a hora de início.
              const dur = editing.end && editing.start ? parseMinutes(editing.end) - parseMinutes(editing.start) : 120;
              setEditing({ ...editing, start, end: start ? addMinutes(start, Math.max(30, dur)) : editing.end });
            }}
          />
        </Field>
        <Field label="FIM">
          <TimeField
            className={`${d.input} ${endError ? d.inputInvalid : ''}`}
            invalidClassName={d.inputInvalid}
            value={editing.end}
            onChange={(end) => setEditing({ ...editing, end })}
          />
        </Field>
        <Field label="SALA">
          <input className={d.input} list="gerir-rooms" value={editing.room} onChange={(e) => setEditing({ ...editing, room: e.target.value })} placeholder="ED 2: LAB 128" />
        </Field>
      </div>
      <datalist id="gerir-rooms">
        {rooms.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {endError && <span className={d.errorText}>{endError}</span>}
      {!endError && overlap && (
        <span className={d.hint} style={{ color: 'var(--amber, #e3a857)' }}>
          Sobrepõe-se à {BRANCH_LABEL[branchOf(overlap.type)].toLowerCase()} de {WEEKDAY_LONG[overlap.dayNum].toLowerCase()}, {overlap.start}–{overlap.end}.
        </span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
        {isNew ? <span /> : <DeleteButton onConfirm={() => persist(slots.filter((s) => s.id !== editing.id))} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={() => setEditing(null)}>
            Cancelar
          </button>
          <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={save} disabled={!!endError || status.kind === 'saving'}>
            {isNew ? 'Adicionar sessão' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `28px repeat(${days.length}, minmax(0, 1fr))`, gap: 4 }}>
        <span />
        {days.map((n) => (
          <span key={n} style={{ fontSize: 11, color: 'var(--mut2)', textAlign: 'center' }}>{WEEKDAY_SHORT[n]}</span>
        ))}
        <div style={{ position: 'relative', height: 180 }}>
          {[firstHour, Math.round((firstHour + lastHour) / 2), lastHour].map((h) => (
            <span key={h} style={{ position: 'absolute', top: `${((h - firstHour) / (lastHour - firstHour)) * 100}%`, transform: 'translateY(-50%)', fontSize: 10, color: 'var(--faint)' }}>
              {h}h
            </span>
          ))}
        </div>
        {days.map((n) => (
          <div key={n} style={{ position: 'relative', height: 180, background: 'var(--bg)', border: '1px solid var(--line2)' }}>
            {preview
              .filter((s) => s.dayNum === n)
              .map((s) => {
                const on = editing?.id === s.id;
                const color = BRANCH_COLOR[branchOf(s.type)];
                return (
                  <span
                    key={s.id}
                    style={{
                      position: 'absolute',
                      left: 2,
                      right: 2,
                      top: `${pct(s.start)}%`,
                      height: `${Math.max(6, pct(s.end || addMinutes(s.start, 90)) - pct(s.start))}%`,
                      background: on ? color : 'transparent',
                      border: `1px solid ${color}`,
                      color: on ? 'var(--bg)' : color,
                      fontSize: 10,
                      padding: '1px 3px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.start}
                  </span>
                );
              })}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {slots.length === 0 && !isNew && <p className={d.muted} style={{ margin: 0, fontSize: 13 }}>Sem sessões. Acrescenta as aulas semanais desta disciplina.</p>}
        {slots.map((s) =>
          editing?.id === s.id && !isNew ? (
            <div key={s.id} style={{ padding: '6px 0' }}>{editor}</div>
          ) : (
            <button
              key={s.id}
              type="button"
              className={d.rowLink}
              onClick={() => edit(s)}
              style={{ display: 'grid', gridTemplateColumns: '110px 70px minmax(0, 1fr) auto', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 4px', background: 'none', border: 0, borderBottom: '1px solid var(--line2)', textAlign: 'left', fontSize: 13, color: 'var(--ink)' }}
            >
              <span style={{ color: BRANCH_COLOR[branchOf(s.type)] }}>{BRANCH_LABEL[branchOf(s.type)]}</span>
              <span>{WEEKDAY_LONG[s.dayNum]}</span>
              <span className={d.ellipsis}>
                {s.start}
                {s.end ? `–${s.end}` : ''}
                <span className={d.muted}>{s.room ? ` · ${s.room}` : ''}</span>
              </span>
              <span className={d.muted} style={{ fontSize: 12 }}>Editar</span>
            </button>
          )
        )}
        {isNew && <div style={{ padding: '6px 0' }}>{editor}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {!isNew && (
          <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={startNew}>
            + Sessão
          </button>
        )}
        <SaveStatus state={status} />
      </div>
    </>
  );
}
