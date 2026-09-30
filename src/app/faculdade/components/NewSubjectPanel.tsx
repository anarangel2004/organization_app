'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { putMirror, generateLocalId } from '@/lib/offline/db';
import { queueMutation, isNetworkError } from '@/lib/offline/sync';
import d from '@/app/components/denso/denso.module.css';
import { TimeField } from '@/components/ui/DateTimeFields';

// Painel lateral "Nova disciplina", em 4 passos + resumo.
// Grava o mesmo que o formulário antigo (AddSubjectForm), e os pesos também nas
// colunas theoretical_weight / practical_weight, que são as que a app lê.

type SlotType = 'TEÓRICO' | 'PRÁTICO' | 'TEÓRICO-PRÁTICO';

interface Slot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  type: SlotType;
}

const DAYS: [string, string][] = [
  ['SEGUNDA-FEIRA', 'Segunda'],
  ['TERÇA-FEIRA', 'Terça'],
  ['QUARTA-FEIRA', 'Quarta'],
  ['QUINTA-FEIRA', 'Quinta'],
  ['SEXTA-FEIRA', 'Sexta'],
  ['SÁBADO', 'Sábado'],
];
const SLOT_TYPES: [SlotType, string][] = [
  ['TEÓRICO', 'Teórica'],
  ['PRÁTICO', 'Prática'],
  ['TEÓRICO-PRÁTICO', 'Teórico-prática'],
];
const STEPS = ['Identificação', 'Docentes', 'Horário', 'Avaliação'];

// Ano letivo atual (setembro em diante conta como o ano que começa).
function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

function academicYears(): string[] {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => `${now - 2 + i}/${now - 1 + i}`);
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface Draft {
  code: string;
  name: string;
  ects: string;
  degreeYear: string;
  semester: string;
  academicYear: string;
  regenteName: string;
  regenteEmail: string;
  regenteIsTeorica: boolean;
  teoricaName: string;
  teoricaEmail: string;
  praticaName: string;
  praticaEmail: string;
  slots: Slot[];
  weightT: string;
  weightP: string;
}

const emptyDraft = (): Draft => ({
  code: '',
  name: '',
  ects: '6',
  degreeYear: '1',
  semester: '1',
  academicYear: currentAcademicYear(),
  regenteName: '',
  regenteEmail: '',
  regenteIsTeorica: true,
  teoricaName: '',
  teoricaEmail: '',
  praticaName: '',
  praticaEmail: '',
  slots: [],
  weightT: '',
  weightP: '',
});

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={d.field}>
      <span className={d.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={d.hint}>{hint}</span>}
    </label>
  );
}

export function NewSubjectPanel({
  open,
  onClose,
  onCreated,
  existingCodes,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingCodes: string[];
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  // Ao abrir: foco no primeiro campo do passo. Esc fecha (o rascunho fica guardado até gravar).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, step, onClose]);

  if (!open) return null;

  // ==========================================
  // VALIDAÇÃO POR PASSO
  // ==========================================
  const code = draft.code.trim().toUpperCase();
  const codeTaken = !!code && existingCodes.some((c) => c.toUpperCase() === code);
  const step0Errors = {
    code: !code ? 'Indica o código (ex.: SSC).' : codeTaken ? 'Já tens uma disciplina com este código.' : null,
    name: !draft.name.trim() ? 'Indica o nome da disciplina.' : null,
    ects: draft.ects && (Number.isNaN(Number(draft.ects)) || Number(draft.ects) <= 0) ? 'ECTS tem de ser um número positivo.' : null,
  };
  const slotErrors = draft.slots.map((s) => (s.startTime && s.endTime && toMin(s.endTime) <= toMin(s.startTime) ? 'A hora de fim tem de ser depois da de início.' : null));
  const wT = draft.weightT === '' ? null : Number(draft.weightT);
  const wP = draft.weightP === '' ? null : Number(draft.weightP);
  const weightError =
    wT === null && wP === null
      ? null
      : wT === null || wP === null || Number.isNaN(wT) || Number.isNaN(wP) || wT < 0 || wP < 0
        ? 'Preenche os dois pesos (0–100).'
        : wT + wP !== 100
          ? `A soma tem de dar 100% (agora dá ${wT + wP}%).`
          : null;

  const stepValid = [
    !step0Errors.code && !step0Errors.name && !step0Errors.ects,
    true,
    slotErrors.every((e) => !e),
    !weightError,
  ];
  const firstInvalid = stepValid.findIndex((v) => !v);

  const next = () => {
    setTried(true);
    if (step < 4 && !stepValid[step]) return;
    setTried(false);
    setStep((s) => Math.min(4, s + 1));
  };

  // ==========================================
  // GRAVAR
  // ==========================================
  const save = async () => {
    if (firstInvalid !== -1) {
      setStep(firstInvalid);
      setTried(true);
      return;
    }
    setSaving(true);
    setError(null);
    const person = (name: string, email: string) => (name.trim() ? { name: name.trim(), email: email.trim() || null } : null);
    const regente = person(draft.regenteName, draft.regenteEmail);
    const payload = {
      code,
      name: draft.name.trim(),
      ects: Number(draft.ects) || 6,
      semester: Number(draft.semester) || 1,
      degree_year: Number(draft.degreeYear) || 1,
      academic_year: draft.academicYear,
      regente,
      teacher_teorica: draft.regenteIsTeorica ? regente : person(draft.teoricaName, draft.teoricaEmail),
      teacher_pratica: person(draft.praticaName, draft.praticaEmail),
      evaluation: wT !== null || wP !== null ? { weight_teorica: wT, weight_pratica: wP } : null,
      theoretical_weight: wT,
      practical_weight: wP,
      schedules: draft.slots.length ? draft.slots : null,
    };

    try {
      try {
        const { error: insertErr } = await supabase.from('subjects').insert([payload]);
        if (insertErr) throw insertErr;
      } catch (insertErr) {
        if (!isNetworkError(insertErr)) throw insertErr;
        // Sem rede: guarda localmente e sincroniza quando a ligação voltar.
        const optimistic = { id: generateLocalId(), ...payload };
        await putMirror('subjects', optimistic);
        await queueMutation({ table: 'subjects', op: 'insert', tempId: optimistic.id, payload });
      }
      setDraft(emptyDraft());
      setStep(0);
      setTried(false);
      onCreated();
      onClose();
    } catch (err) {
      console.error('Erro ao adicionar disciplina:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível guardar a disciplina.');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // PASSOS
  // ==========================================
  const addSlot = () =>
    set('slots', [
      ...draft.slots,
      { id: `${Date.now()}`, day: 'SEGUNDA-FEIRA', startTime: '09:00', endTime: '11:00', room: '', type: draft.slots.length ? 'PRÁTICO' : 'TEÓRICO' },
    ]);
  const updateSlot = (id: string, patch: Partial<Slot>) => set('slots', draft.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const invalid = (msg: string | null) => (tried && msg ? d.inputInvalid : '');

  const body = [
    // 1. Identificação
    <>
      <div className={`${d.fieldRow} ${d.fieldRow2}`} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)' }}>
        <Field label="CÓDIGO *" hint="Como aparece nas listas (ex.: PRIVSIS).">
          <input
            ref={firstRef}
            className={`${d.input} ${invalid(step0Errors.code)}`}
            value={draft.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="SSC"
            autoCapitalize="characters"
            style={{ textTransform: 'uppercase' }}
          />
        </Field>
        <Field label="NOME *">
          <input className={`${d.input} ${invalid(step0Errors.name)}`} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Segurança de sistemas e computadores" />
        </Field>
      </div>
      {tried && (step0Errors.code || step0Errors.name) && <span className={d.errorText}>{step0Errors.code || step0Errors.name}</span>}
      <div className={`${d.fieldRow} ${d.fieldRow3}`}>
        <Field label="ECTS">
          <input className={`${d.input} ${invalid(step0Errors.ects)}`} inputMode="decimal" value={draft.ects} onChange={(e) => set('ects', e.target.value)} />
        </Field>
        <Field label="ANO">
          <select className={d.inputSelect} value={draft.degreeYear} onChange={(e) => set('degreeYear', e.target.value)}>
            {['1', '2', '3', '4', '5'].map((y) => (
              <option key={y} value={y}>{y}.º ano</option>
            ))}
          </select>
        </Field>
        <Field label="SEMESTRE">
          <select className={d.inputSelect} value={draft.semester} onChange={(e) => set('semester', e.target.value)}>
            <option value="1">1.º semestre</option>
            <option value="2">2.º semestre</option>
          </select>
        </Field>
      </div>
      {tried && step0Errors.ects && <span className={d.errorText}>{step0Errors.ects}</span>}
      <Field label="ANO LETIVO">
        <select className={d.inputSelect} value={draft.academicYear} onChange={(e) => set('academicYear', e.target.value)}>
          {academicYears().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </Field>
    </>,

    // 2. Docentes
    <>
      <span className={d.groupTitle}>REGENTE</span>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="NOME">
          <input ref={firstRef} className={d.input} value={draft.regenteName} onChange={(e) => set('regenteName', e.target.value)} placeholder="Henrique Domingos" />
        </Field>
        <Field label="EMAIL">
          <input className={d.input} type="email" value={draft.regenteEmail} onChange={(e) => set('regenteEmail', e.target.value)} placeholder="opcional" />
        </Field>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" className={d.chk} checked={draft.regenteIsTeorica} onChange={(e) => set('regenteIsTeorica', e.target.checked)} />
        O regente dá as aulas teóricas
      </label>
      {!draft.regenteIsTeorica && (
        <>
          <span className={d.groupTitle}>TEÓRICA</span>
          <div className={`${d.fieldRow} ${d.fieldRow2}`}>
            <Field label="NOME">
              <input className={d.input} value={draft.teoricaName} onChange={(e) => set('teoricaName', e.target.value)} />
            </Field>
            <Field label="EMAIL">
              <input className={d.input} type="email" value={draft.teoricaEmail} onChange={(e) => set('teoricaEmail', e.target.value)} placeholder="opcional" />
            </Field>
          </div>
        </>
      )}
      <span className={d.groupTitle}>PRÁTICA</span>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="NOME">
          <input className={d.input} value={draft.praticaName} onChange={(e) => set('praticaName', e.target.value)} />
        </Field>
        <Field label="EMAIL">
          <input className={d.input} type="email" value={draft.praticaEmail} onChange={(e) => set('praticaEmail', e.target.value)} placeholder="opcional" />
        </Field>
      </div>
      <span className={d.hint}>Tudo opcional: podes acrescentar docentes depois.</span>
    </>,

    // 3. Horário
    <>
      {draft.slots.length === 0 && <p className={d.muted} style={{ margin: 0, fontSize: 13 }}>Ainda sem sessões. Acrescenta as aulas semanais desta disciplina.</p>}
      {draft.slots.map((s, i) => (
        <div key={s.id} className={d.slot}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div className={d.segPick} role="group" aria-label="Tipo de aula">
              {SLOT_TYPES.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={s.type === id} onClick={() => updateSlot(s.id, { type: id })}>
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`${d.btnGhost} ${d.xs}`}
              aria-label={`Remover sessão ${i + 1}`}
              onClick={() => set('slots', draft.slots.filter((x) => x.id !== s.id))}
            >
              Remover
            </button>
          </div>
          <div className={`${d.fieldRow} ${d.fieldRow2}`}>
            <Field label="DIA">
              <select className={d.inputSelect} value={s.day} onChange={(e) => updateSlot(s.id, { day: e.target.value })}>
                {DAYS.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="SALA">
              <input className={d.input} value={s.room} onChange={(e) => updateSlot(s.id, { room: e.target.value })} placeholder="ED 2: LAB 128" />
            </Field>
          </div>
          <div className={`${d.fieldRow} ${d.fieldRow2}`}>
            <Field label="INÍCIO">
              <TimeField className={d.input} invalidClassName={d.inputInvalid} value={s.startTime} onChange={(startTime) => updateSlot(s.id, { startTime })} />
            </Field>
            <Field label="FIM">
              <TimeField className={`${d.input} ${invalid(slotErrors[i])}`} invalidClassName={d.inputInvalid} value={s.endTime} onChange={(endTime) => updateSlot(s.id, { endTime })} />
            </Field>
          </div>
          {tried && slotErrors[i] && <span className={d.errorText}>{slotErrors[i]}</span>}
        </div>
      ))}
      <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={addSlot} style={{ alignSelf: 'flex-start' }}>
        + Sessão
      </button>
    </>,

    // 4. Avaliação
    <>
      <p className={d.muted} style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        Quanto conta cada ramo na nota final. Os componentes (testes, trabalhos) acrescentam-se depois na página da disciplina. Se deixares em branco, fica 50 / 50.
      </p>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="TEÓRICA (%)">
          <input
            ref={firstRef}
            className={`${d.input} ${invalid(weightError)}`}
            inputMode="numeric"
            value={draft.weightT}
            placeholder="50"
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
              setDraft((prev) => ({ ...prev, weightT: v, weightP: v === '' ? prev.weightP : String(Math.max(0, 100 - Number(v))) }));
            }}
          />
        </Field>
        <Field label="PRÁTICA (%)">
          <input
            className={`${d.input} ${invalid(weightError)}`}
            inputMode="numeric"
            value={draft.weightP}
            placeholder="50"
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
              setDraft((prev) => ({ ...prev, weightP: v, weightT: v === '' ? prev.weightT : String(Math.max(0, 100 - Number(v))) }));
            }}
          />
        </Field>
      </div>
      {wT !== null && wP !== null && !weightError && (
        <div style={{ display: 'flex', height: 6 }} aria-hidden="true">
          <div style={{ width: `${wT}%`, background: 'var(--accent)' }} />
          <div style={{ width: `${wP}%`, background: 'var(--bone)' }} />
        </div>
      )}
      {tried && weightError && <span className={d.errorText}>{weightError}</span>}
    </>,
  ];

  const teoricaName = draft.regenteIsTeorica ? draft.regenteName : draft.teoricaName;
  const summary: [string, string][] = [
    ['DISCIPLINA', `${code || '—'} · ${draft.name.trim() || '—'}`],
    ['PLANO', `${draft.degreeYear}.º ano · ${draft.semester}.º semestre · ${draft.academicYear} · ${draft.ects || '6'} ECTS`],
    ['REGENTE', draft.regenteName.trim() || '—'],
    ['TEÓRICA', teoricaName.trim() || '—'],
    ['PRÁTICA', draft.praticaName.trim() || '—'],
    [
      'HORÁRIO',
      draft.slots.length
        ? draft.slots
            .map((s) => `${DAYS.find(([id]) => id === s.day)?.[1]} ${s.startTime}–${s.endTime} · ${SLOT_TYPES.find(([id]) => id === s.type)?.[1]}${s.room ? ` · ${s.room}` : ''}`)
            .join('\n')
        : 'Sem sessões',
    ],
    ['AVALIAÇÃO', wT !== null && wP !== null ? `Teórica ${wT}% · Prática ${wP}%` : '50 / 50 (por omissão)'],
  ];

  return (
    <>
      <button type="button" className={d.drawerScrim} aria-label="Fechar" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Nova disciplina" className={d.drawer}>
        <div className={d.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Nova disciplina</h2>
              <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--sky)' }}>
                {step < 4 ? `${step + 1} de 4 · ${STEPS[step].toLowerCase()}` : 'resumo'}
              </span>
            </div>
            <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={onClose} aria-label="Fechar">
              Fechar
            </button>
          </div>
          <div className={d.steps} role="tablist" aria-label="Passos">
            {STEPS.map((label, i) => {
              // Só se salta para um passo se os anteriores estiverem bem.
              const reachable = i <= step || stepValid.slice(0, i).every(Boolean);
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={step === i}
                  disabled={!reachable}
                  onClick={() => {
                    setTried(false);
                    setStep(i);
                  }}
                  className={`${d.step} ${step === i ? d.stepOn : i < step || step === 4 ? d.stepDone : ''}`}
                >
                  {i + 1} {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={d.drawerBody}>
          {step < 4 ? (
            body[step]
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {summary.map(([k, v]) => (
                <div key={k} className={d.summaryRow}>
                  <span className={d.summaryKey}>{k}</span>
                  <span style={{ whiteSpace: 'pre-line' }}>{v}</span>
                </div>
              ))}
              {error && <p className={d.errorText} style={{ margin: '12px 0 0' }}>Erro: {error}</p>}
            </div>
          )}
        </div>

        <div className={d.drawerFoot}>
          <button type="button" className={`${d.btnGhost} ${d.sm}`} style={{ height: 38 }} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            ← Anterior
          </button>
          {step < 4 ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && step < 3 && (
                <button type="button" className={`${d.btnGhost} ${d.sm}`} style={{ height: 38 }} onClick={() => setStep(4)} disabled={!stepValid[0]}>
                  Saltar para o resumo
                </button>
              )}
              <button type="button" className={d.btnFill} onClick={next}>
                {step === 3 ? 'Rever' : 'Seguinte →'}
              </button>
            </div>
          ) : (
            <button type="button" className={d.btnFill} onClick={save} disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar disciplina'}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
