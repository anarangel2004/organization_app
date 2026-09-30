'use client';

import { useRef, useState } from 'react';
import type { AssessmentItem } from '@/types';
import { supabase } from '@/lib/supabase';
import { deleteMirror, generateLocalId, putMirror } from '@/lib/offline/db';
import { queueMutation, isNetworkError } from '@/lib/offline/sync';
import { getItemEffectiveGrade } from '@/lib/utils';
import d from '@/app/components/denso/denso.module.css';
import { DateField, TimeField } from '@/components/ui/DateTimeFields';
import { assessmentTimeRange, branchAverage, currentAverage, fmtDuration, fmtGrade, normTime } from '../disciplinaData';

// Durações propostas no seletor (de 15 em 15 minutos até 4 horas).
const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

// Hora/duração só vão para a base de dados quando têm valor ou mudaram:
// assim o editor continua a funcionar antes de correr o SQL das colunas novas.
function timeFields(dr: Draft, before?: AssessmentItem): Partial<AssessmentItem> {
  const out: Partial<AssessmentItem> = {};
  const time = dr.time || null;
  const duration = dr.duration ? Number(dr.duration) : null;
  if (time !== (normTime(before?.due_time) ?? null)) out.due_time = time;
  if (duration !== (before?.duration_minutes ?? null)) out.duration_minutes = duration;
  return out;
}
import { DeleteButton, Field, SaveStatus, errorMessage, updateSubject, type SaveState } from './shared';

// Editor da avaliação: pesos dos ramos, notas (escritas direto na linha) e
// componentes de cada ramo (testes, trabalhos), editáveis no sítio.

type Cat = 'TEORICA' | 'PRATICA';

interface Draft {
  title: string;
  weight: string;
  date: string;
  time: string; // "HH:MM" ou ''
  duration: string; // minutos ou ''
  notes: string;
  hasDefense: boolean;
  defenseDate: string;
  defenseGrade: string;
}

const toDraft = (a: AssessmentItem): Draft => ({
  title: a.title || '',
  weight: String(a.weight_percent ?? ''),
  date: a.due_date ? a.due_date.split('T')[0] : '',
  time: normTime(a.due_time) || '',
  duration: a.duration_minutes ? String(a.duration_minutes) : '',
  notes: a.volume_ref || '',
  hasDefense: !!a.has_defense,
  defenseDate: a.defense_date ? a.defense_date.split('T')[0] : '',
  defenseGrade: a.defense_grade !== null && a.defense_grade !== undefined ? String(a.defense_grade).replace('.', ',') : '',
});

// "14,5" → 14.5; vazio → null; fora de 0–20 → undefined (inválido).
function parseGrade(v: string): number | null | undefined {
  const s = v.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) || n < 0 || n > 20 ? undefined : n;
}

function GradeInput({ item, onCommit }: { item: AssessmentItem; onCommit: (value: number | null) => void }) {
  const initial = item.grade !== null && item.grade !== undefined ? String(item.grade).replace('.', ',') : '';
  const [value, setValue] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setValue(initial);
  }
  const parsed = parseGrade(value);
  const commit = () => {
    if (parsed === undefined) return;
    if (parsed !== (item.grade ?? null)) onCommit(parsed);
  };
  return (
    <input
      aria-label={`Nota de ${item.title}`}
      className={`${d.input} ${parsed === undefined ? d.inputInvalid : ''}`}
      inputMode="decimal"
      placeholder="—"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      style={{ width: 64, height: 32, textAlign: 'center', padding: 0 }}
    />
  );
}

export function AvaliacaoEditor({
  subjectId,
  items,
  theory,
  practice,
  onItemsChange,
  onWeightsSaved,
}: {
  subjectId: string;
  items: AssessmentItem[];
  theory: number;
  practice: number;
  onItemsChange: (update: (prev: AssessmentItem[]) => AssessmentItem[]) => void;
  onWeightsSaved: (theory: number, practice: number) => void;
}) {
  const [status, setStatus] = useState<SaveState>({ kind: 'idle' });
  const [weightT, setWeightT] = useState(String(theory));
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adding, setAdding] = useState<Cat | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // ==========================================
  // GRAVAR
  // ==========================================
  const patchItem = async (id: string, patch: Partial<AssessmentItem>) => {
    const before = items.find((a) => a.id === id);
    onItemsChange((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setStatus({ kind: 'saving' });
    try {
      const { data, error } = await supabase.from('assessments').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      await putMirror('assessments', data as AssessmentItem);
      setStatus({ kind: 'saved' });
    } catch (err) {
      if (isNetworkError(err)) {
        if (before) await putMirror('assessments', { ...before, ...patch });
        await queueMutation({ table: 'assessments', op: 'update', targetId: id, payload: patch });
        setStatus({ kind: 'saved', offline: true });
      } else {
        if (before) onItemsChange((prev) => prev.map((a) => (a.id === id ? before : a)));
        setStatus({ kind: 'error', message: errorMessage(err) });
      }
    }
  };

  const removeItem = async (id: string) => {
    const before = items;
    onItemsChange((prev) => prev.filter((a) => a.id !== id));
    setOpenId(null);
    try {
      const { error } = await supabase.from('assessments').delete().eq('id', id);
      if (error) throw error;
      await deleteMirror('assessments', id);
      setStatus({ kind: 'saved' });
    } catch (err) {
      if (isNetworkError(err)) {
        await deleteMirror('assessments', id);
        await queueMutation({ table: 'assessments', op: 'delete', targetId: id, payload: {} });
        setStatus({ kind: 'saved', offline: true });
      } else {
        onItemsChange(() => before);
        setStatus({ kind: 'error', message: errorMessage(err) });
      }
    }
  };

  const addItem = async (cat: Cat, dr: Draft) => {
    const payload = {
      subject_id: subjectId,
      title: dr.title.trim(),
      category: cat,
      weight_percent: Number(dr.weight) || 0,
      due_date: dr.date || null,
      ...timeFields(dr),
      volume_ref: dr.notes.trim() || null,
      file_name: null,
      file_url: null,
      has_defense: false,
      grade: null,
      defense_grade: null,
      defense_date: null,
    };
    setStatus({ kind: 'saving' });
    try {
      const { data, error } = await supabase.from('assessments').insert([payload]).select().single();
      if (error) throw error;
      await putMirror('assessments', data as AssessmentItem);
      onItemsChange((prev) => [...prev, data as AssessmentItem]);
      setStatus({ kind: 'saved' });
    } catch (err) {
      if (!isNetworkError(err)) {
        setStatus({ kind: 'error', message: errorMessage(err) });
        return;
      }
      const optimistic = { id: generateLocalId(), ...payload } as AssessmentItem;
      await putMirror('assessments', optimistic);
      await queueMutation({ table: 'assessments', op: 'insert', tempId: optimistic.id, payload });
      onItemsChange((prev) => [...prev, optimistic]);
      setStatus({ kind: 'saved', offline: true });
    }
    setAdding(null);
    setDraft(null);
  };

  const saveWeights = async () => {
    const t = Number(weightT);
    const p = 100 - t;
    setStatus({ kind: 'saving' });
    try {
      const offline = await updateSubject(subjectId, { theoretical_weight: t, practical_weight: p });
      onWeightsSaved(t, p);
      setStatus({ kind: 'saved', offline });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) });
    }
  };

  const uploadFile = async (id: string, file: File) => {
    setUploadingId(id);
    try {
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop() : '';
      const base = parts.join('.').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = `${subjectId || 'geral'}/${Date.now()}_${base}${ext ? `.${ext}` : ''}`;
      const { error } = await supabase.storage.from('assessments-files').upload(path, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('assessments-files').getPublicUrl(path);
      await patchItem(id, { file_name: file.name, file_url: data.publicUrl });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: isNetworkError(err) ? 'sem ligação — os ficheiros só se enviam com rede.' : errorMessage(err),
      });
    } finally {
      setUploadingId(null);
    }
  };

  // ==========================================
  // EDIÇÃO DE UM COMPONENTE
  // ==========================================
  const open = (a: AssessmentItem) => {
    setAdding(null);
    setOpenId(a.id);
    setDraft(toDraft(a));
    setStatus({ kind: 'idle' });
  };

  const startAdd = (cat: Cat) => {
    const inCat = items.filter((a) => a.category === cat);
    const used = inCat.reduce((n, a) => n + (a.weight_percent || 0), 0);
    setOpenId(null);
    setAdding(cat);
    setStatus({ kind: 'idle' });
    setDraft({
      title: `${cat === 'TEORICA' ? 'Teste' : 'Trabalho'} ${inCat.length + 1}`,
      weight: String(Math.max(0, 100 - used)),
      date: '',
      time: '',
      duration: '',
      notes: '',
      hasDefense: false,
      defenseDate: '',
      defenseGrade: '',
    });
  };

  const draftWeight = draft ? Number(draft.weight) : 0;
  const draftErrors = draft
    ? {
        title: !draft.title.trim() ? 'Indica um nome.' : null,
        weight: draft.weight === '' || Number.isNaN(draftWeight) || draftWeight < 0 || draftWeight > 100 ? 'O peso vai de 0 a 100.' : null,
        defense: draft.hasDefense && parseGrade(draft.defenseGrade) === undefined ? 'A nota da defesa vai de 0 a 20.' : null,
      }
    : { title: null, weight: null, defense: null };
  const draftValid = !draftErrors.title && !draftErrors.weight && !draftErrors.defense;

  const saveDraft = (a: AssessmentItem) => {
    if (!draft || !draftValid) return;
    const defenseGrade = parseGrade(draft.defenseGrade);
    patchItem(a.id, {
      title: draft.title.trim(),
      weight_percent: draftWeight,
      due_date: draft.date || null,
      ...timeFields(draft, a),
      volume_ref: draft.notes.trim() || null,
      has_defense: draft.hasDefense,
      defense_date: draft.hasDefense ? draft.defenseDate || null : null,
      defense_grade: draft.hasDefense ? (defenseGrade ?? null) : null,
    });
    setOpenId(null);
  };

  const draftForm = (cat: Cat, a?: AssessmentItem) =>
    draft && (
      <div className={d.slot} style={{ borderColor: 'var(--box2)', margin: '6px 0' }}>
        <div className={d.fieldRow} style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
          <Field label="NOME">
            <input autoFocus className={`${d.input} ${draftErrors.title ? d.inputInvalid : ''}`} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label="PESO NO RAMO (%)">
            <input
              className={`${d.input} ${draftErrors.weight ? d.inputInvalid : ''}`}
              inputMode="decimal"
              value={draft.weight}
              onChange={(e) => setDraft({ ...draft, weight: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) })}
            />
          </Field>
        </div>
        <div className={`${d.fieldRow} ${d.fieldRow2}`}>
          <Field label={cat === 'TEORICA' ? 'DATA' : 'ENTREGA'}>
            <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.date} onChange={(date) => setDraft({ ...draft, date })} style={{ colorScheme: 'dark' }} />
          </Field>
          <Field label={cat === 'TEORICA' ? 'MATÉRIA' : 'REQUISITOS / NOTAS'}>
            <input className={d.input} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={cat === 'TEORICA' ? 'Capítulos 1 a 4' : 'opcional'} />
          </Field>
        </div>
        <div className={`${d.fieldRow} ${d.fieldRow2}`}>
          <Field label={cat === 'TEORICA' ? 'HORA DE INÍCIO' : 'HORA LIMITE'}>
            <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.time} onChange={(time) => setDraft({ ...draft, time })} />
          </Field>
          {cat === 'TEORICA' ? (
            <Field label="DURAÇÃO">
              <select className={d.input} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })}>
                <option value="">—</option>
                {/* Mantém uma duração antiga que não esteja na lista. */}
                {draft.duration && !DURATIONS.includes(Number(draft.duration)) && (
                  <option value={draft.duration}>{fmtDuration(Number(draft.duration))}</option>
                )}
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>{fmtDuration(m)}</option>
                ))}
              </select>
            </Field>
          ) : (
            <span />
          )}
        </div>
        {draft.time && draft.duration && (
          <span className={d.muted} style={{ fontSize: 12 }}>
            Das {assessmentTimeRange({ due_time: draft.time, duration_minutes: Number(draft.duration) })?.replace('–', ' às ')}
          </span>
        )}
        {cat === 'PRATICA' && a && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" className={d.chk} checked={draft.hasDefense} onChange={(e) => setDraft({ ...draft, hasDefense: e.target.checked })} />
              Tem defesa (conta a mais baixa entre a nota do trabalho e a da defesa)
            </label>
            {draft.hasDefense && (
              <div className={`${d.fieldRow} ${d.fieldRow2}`}>
                <Field label="DATA DA DEFESA">
                  <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.defenseDate} onChange={(defenseDate) => setDraft({ ...draft, defenseDate })} style={{ colorScheme: 'dark' }} />
                </Field>
                <Field label="NOTA DA DEFESA">
                  <input
                    className={`${d.input} ${draftErrors.defense ? d.inputInvalid : ''}`}
                    inputMode="decimal"
                    placeholder="—"
                    value={draft.defenseGrade}
                    onChange={(e) => setDraft({ ...draft, defenseGrade: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) })}
                  />
                </Field>
              </div>
            )}
          </>
        )}
        {a && (
          <Field label="ENUNCIADO / FICHEIRO">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {a.file_url ? (
                <a href={a.file_url} target="_blank" rel="noreferrer" className={d.ellipsis} style={{ fontSize: 13, color: 'var(--sky)', minWidth: 0 }}>
                  {a.file_name || 'Ficheiro'} ↗
                </a>
              ) : (
                <span className={d.muted} style={{ fontSize: 13 }}>Sem ficheiro</span>
              )}
              <button type="button" className={`${d.btnLine} ${d.xs}`} onClick={() => fileInput.current?.click()} disabled={uploadingId === a.id} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                {uploadingId === a.id ? 'A enviar…' : a.file_url ? 'Substituir' : 'Anexar'}
              </button>
              {a.file_url && (
                <button type="button" className={`${d.btnGhost} ${d.xs}`} onClick={() => patchItem(a.id, { file_name: null, file_url: null })} style={{ flexShrink: 0 }}>
                  Remover
                </button>
              )}
            </div>
          </Field>
        )}
        {(draftErrors.title || draftErrors.weight || draftErrors.defense) && (
          <span className={d.errorText}>{draftErrors.title || draftErrors.weight || draftErrors.defense}</span>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
          {a ? <DeleteButton onConfirm={() => removeItem(a.id)} /> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`${d.btnGhost} ${d.sm}`}
              onClick={() => {
                setOpenId(null);
                setAdding(null);
              }}
            >
              Cancelar
            </button>
            <button type="button" className={`${d.btnFill} ${d.sm}`} disabled={!draftValid} onClick={() => (a ? saveDraft(a) : addItem(cat, draft))}>
              {a ? 'Guardar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    );

  // ==========================================
  // PESOS DOS RAMOS
  // ==========================================
  const t = weightT === '' ? NaN : Number(weightT);
  const weightsValid = !Number.isNaN(t) && t >= 0 && t <= 100;
  const weightsDirty = weightsValid && t !== theory;
  const average = currentAverage(items, theory, practice);
  const openItem = items.find((a) => a.id === openId);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className={d.groupTitle} style={{ border: 0, padding: 0 }}>PESO DE CADA RAMO NA NOTA FINAL</span>
          <span className={d.muted} style={{ fontSize: 12 }}>
            Média atual <span className={d.serif} style={{ fontSize: 18, color: 'var(--ink)' }}>{average !== null ? fmtGrade(average) : '—'}</span>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--sky)', whiteSpace: 'nowrap' }}>Teórica {weightsValid ? t : '—'}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={weightsValid ? t : theory}
            onChange={(e) => setWeightT(e.target.value)}
            aria-label="Peso do ramo teórico"
            style={{ width: '100%', accentColor: 'var(--sky)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--bone)', whiteSpace: 'nowrap' }}>Prática {weightsValid ? 100 - t : '—'}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            aria-label="Peso teórico exato"
            className={`${d.input} ${weightsValid ? '' : d.inputInvalid}`}
            inputMode="numeric"
            value={weightT}
            onChange={(e) => setWeightT(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            style={{ width: 64, height: 30, textAlign: 'center', padding: 0 }}
          />
          <span className={d.muted} style={{ fontSize: 12 }}>% teórica · a prática fica com o resto</span>
          {weightsDirty && (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={() => setWeightT(String(theory))}>Repor</button>
              <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={saveWeights}>Guardar pesos</button>
            </span>
          )}
        </div>
      </div>

      {(['TEORICA', 'PRATICA'] as Cat[]).map((cat) => {
        const list = items.filter((a) => a.category === cat).sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'));
        const sum = list.reduce((n, a) => n + (a.weight_percent || 0), 0);
        const avg = branchAverage(items, cat);
        const color = cat === 'TEORICA' ? 'var(--sky)' : 'var(--bone)';
        return (
          <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color }}>
                {cat === 'TEORICA' ? 'RAMO TEÓRICO' : 'RAMO PRÁTICO'}{' '}
                <span className={d.muted} style={{ fontWeight: 400 }}>· {cat === 'TEORICA' ? theory : practice}% da nota</span>
              </span>
              <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: list.length && sum !== 100 ? 'var(--amber, #e3a857)' : 'var(--mut)' }}>
                {list.length ? (sum === 100 ? 'pesos 100%' : `pesos somam ${sum}%`) : ''}
                {avg !== null ? <span className={d.muted}> · média {fmtGrade(avg)}</span> : null}
              </span>
            </div>
            {list.length === 0 && adding !== cat && (
              <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>{cat === 'TEORICA' ? 'Sem testes.' : 'Sem trabalhos.'}</p>
            )}
            {list.map((a) =>
              openId === a.id && openItem ? (
                <div key={a.id}>{draftForm(cat, openItem)}</div>
              ) : (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, minHeight: 46, borderBottom: '1px solid var(--line2)' }}>
                  <button
                    type="button"
                    className={d.rowLink}
                    onClick={() => open(a)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, background: 'none', border: 0, padding: '6px 4px', textAlign: 'left', minWidth: 0, color: 'var(--ink)' }}
                  >
                    <span className={d.ellipsis} style={{ fontSize: 14, maxWidth: '100%' }}>{a.title || 'Sem nome'}</span>
                    <span style={{ fontSize: 11, color: 'var(--mut2)' }}>
                      {a.weight_percent || 0}% do ramo
                      {a.due_date ? ` · ${a.due_date.split('T')[0].split('-').reverse().slice(0, 2).join('/')}` : ' · sem data'}
                      {assessmentTimeRange(a) ? ` ${assessmentTimeRange(a)}` : ''}
                      {a.duration_minutes ? ` (${fmtDuration(a.duration_minutes)})` : ''}
                      {a.has_defense ? ` · defesa${a.defense_grade !== null ? ` ${fmtGrade(a.defense_grade)}` : ''}` : ''}
                      {a.file_url ? ' · ficheiro' : ''}
                    </span>
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.has_defense && getItemEffectiveGrade(a) !== a.grade && (
                      <span className={d.muted} style={{ fontSize: 11 }} title="Com defesa conta a nota mais baixa">conta {fmtGrade(getItemEffectiveGrade(a) ?? 0)}</span>
                    )}
                    <GradeInput item={a} onCommit={(grade) => patchItem(a.id, { grade })} />
                    <span className={d.muted} style={{ fontSize: 11 }}>/20</span>
                  </span>
                </div>
              )
            )}
            {adding === cat ? (
              draftForm(cat)
            ) : (
              <button type="button" className={`${d.btnGhost} ${d.xs}`} onClick={() => startAdd(cat)} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                {cat === 'TEORICA' ? '+ Teste' : '+ Trabalho'}
              </button>
            )}
          </div>
        );
      })}

      <SaveStatus state={status} />
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && openId) uploadFile(openId, file);
          e.target.value = '';
        }}
      />
    </>
  );
}
