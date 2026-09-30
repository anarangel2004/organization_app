'use client';

// Página /estudo: resumo, sugestão por disciplina (com o motivo), histórico
// e definições. Estilo "denso", com variantes para iPad e iPhone.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import d from '@/app/components/denso/denso.module.css';
import type { DensoLayout } from '@/app/components/denso/DensoTouch';
import { Field, SaveStatus, errorMessage, type SaveState } from '@/app/components/denso/DensoForm';
import { DateField } from '@/components/ui/DateTimeFields';
import { fmtHours, type PlanPeriod, type StudySettings, type SubjectPlan } from '@/lib/studyPlan';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const short = (dt: Date) => `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className={d.round} style={{ width: size, height: size, flex: 'none', background: color, display: 'inline-block' }} />;
}

// Barra feito / sugerido. Passar da sugestão fica a azul-claro até ao fim.
function Meter({ done, target, color = 'var(--accent)' }: { done: number; target: number; color?: string }) {
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : done > 0 ? 100 : 0;
  return (
    <span style={{ display: 'flex', height: 5, background: '#262626', minWidth: 0 }}>
      <span style={{ width: `${pct}%`, background: done >= target && target > 0 ? 'var(--sky)' : color }} />
    </span>
  );
}

// ==========================================
// CABEÇALHO
// ==========================================
export function EstudoHeading({
  layout,
  subtitle,
  meta,
  trailing,
  onSettings,
}: {
  layout: DensoLayout;
  subtitle: string;
  meta: string;
  trailing?: ReactNode;
  onSettings: () => void;
}) {
  if (layout === 'phone') {
    return (
      <section className={d.inner} style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em' }}>Estudo</h1>
          {trailing}
        </div>
        <div className={d.serif} style={{ fontStyle: 'italic', fontSize: 19, color: 'var(--sky)' }}>{subtitle}</div>
        <div className={d.muted} style={{ fontSize: 13, paddingTop: 2 }}>{meta}</div>
      </section>
    );
  }
  return (
    <section
      className={d.inner}
      style={{ minHeight: layout === 'desktop' ? 84 : 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px 24px', flexWrap: 'wrap', paddingTop: 12, paddingBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 18px', flexWrap: 'wrap', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: layout === 'desktop' ? 48 : 40, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>Estudo</h1>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: layout === 'desktop' ? 24 : 21, color: 'var(--sky)' }}>{subtitle}</span>
        <span className={d.muted} style={{ fontSize: 13 }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={d.btnLine} onClick={onSettings}>Definições</button>
        <Link href="/faculdade" className={d.btnFill}>Abrir um caderno →</Link>
      </div>
    </section>
  );
}

// ==========================================
// RESUMO
// ==========================================
export interface StatTile {
  label: string;
  value: string;
  unit?: string;
  note: string;
  pct?: number | null;
  accent?: boolean;
}

export function EstudoStats({ tiles, columns }: { tiles: StatTile[]; columns: 2 | 4 }) {
  return (
    <section id="resumo" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: columns === 2 ? 10 : 12, scrollMarginTop: 64 }}>
      {tiles.map((t) => (
        <div
          key={t.label}
          style={
            t.accent
              ? { background: 'var(--bone)', color: 'var(--bg)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 104, minWidth: 0 }
              : { borderTop: '2px solid var(--accent)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 104, minWidth: 0 }
          }
        >
          <div className={d.label} style={t.accent ? { color: 'var(--bg)', fontWeight: 600 } : undefined}>{t.label}</div>
          <div className={d.serif} style={{ fontSize: 32, lineHeight: 1, whiteSpace: 'nowrap', color: t.accent ? 'var(--bg)' : 'var(--ink)' }}>
            {t.value}
            {t.unit && <span style={{ fontSize: 16, color: t.accent ? 'rgba(13,13,13,0.65)' : 'var(--mut)' }}> {t.unit}</span>}
          </div>
          {typeof t.pct === 'number' && (
            <span style={{ display: 'flex', height: 4, background: t.accent ? 'rgba(13,13,13,0.15)' : '#262626' }}>
              <span style={{ width: `${Math.min(100, t.pct)}%`, background: t.accent ? 'var(--bg)' : 'var(--accent)' }} />
            </span>
          )}
          <div className={d.ellipsis} style={{ fontSize: 12, color: t.accent ? 'rgba(13,13,13,0.75)' : 'var(--mut)' }}>{t.note}</div>
        </div>
      ))}
    </section>
  );
}

// ==========================================
// POR DISCIPLINA
// ==========================================
function Reasons({ row }: { row: SubjectPlan }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 12px 20px', fontSize: 12, color: 'var(--mut)' }}>
      {row.reasons.map((r, i) => (
        <span key={i} style={{ color: r.kind === 'prep' ? 'var(--amber)' : r.kind === 'grade' ? 'var(--sky)' : undefined }}>
          · {r.text}
        </span>
      ))}
      <span>
        · Sugestão desta semana: <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtHours(row.suggestedWeek)}</strong>
        {row.lastStudied ? ` · última sessão a ${short(row.lastStudied)}` : ' · ainda sem sessões registadas'}
      </span>
      <Link href={`/faculdade/${row.subjectId}/notebook`} style={{ color: 'var(--sky)', alignSelf: 'flex-start' }}>
        Abrir o caderno →
      </Link>
    </div>
  );
}

const COLS = 'minmax(0, 1.4fr) minmax(0, 1.5fr) minmax(0, 1.1fr) minmax(0, 1.6fr)';

export function EstudoSubjects({ rows, toneOf, cards }: { rows: SubjectPlan[]; toneOf: (id: string) => string; cards: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const done = rows.reduce((n, r) => n + r.doneWeek, 0);
  const target = rows.reduce((n, r) => n + r.suggestedWeek, 0);

  return (
    <section id="disciplinas" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>POR DISCIPLINA</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>
          esta semana · {fmtHours(done)} de {fmtHours(target)}
        </span>
      </div>
      {rows.length === 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Ainda não há disciplinas.</p>}

      {!cards && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 14, fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)', padding: '8px 0 4px' }}>
          <span>DISCIPLINA</span>
          <span>FEITO / SUGERIDO</span>
          <span>PRÓXIMA AVALIAÇÃO</span>
          <span>MOTIVO</span>
        </div>
      )}

      {rows.map((r) => {
        const isOpen = open === r.subjectId;
        const toggle = () => setOpen(isOpen ? null : r.subjectId);
        const nextLabel = r.next ? `${r.next.title} · ${r.next.days === 0 ? 'hoje' : r.next.days === 1 ? 'amanhã' : `${r.next.days} dias`}` : 'sem avaliações';
        const stale = r.lastStudied ? (Date.now() - r.lastStudied.getTime()) / 86400000 > 7 : false;

        if (cards) {
          return (
            <div key={r.subjectId} style={{ borderBottom: '1px solid var(--line2)' }}>
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                style={{ width: '100%', background: 'none', border: 0, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', color: 'var(--ink)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Dot color={toneOf(r.subjectId)} />
                    <span style={{ fontWeight: 600 }}>{r.code}</span>
                    <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 16 }}>{r.name}</span>
                  </span>
                  <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                    {fmtHours(r.doneWeek)} <span className={d.muted}>/ {fmtHours(r.suggestedWeek)}</span>
                  </span>
                </span>
                <Meter done={r.doneWeek} target={r.suggestedWeek} />
                <span style={{ fontSize: 13, color: 'var(--mut)' }}>{r.main}</span>
                <span style={{ fontSize: 12, color: 'var(--mut2)' }}>
                  Próxima: {nextLabel}
                  {stale ? ' · há mais de 7 dias sem estudo' : ''}
                </span>
              </button>
              {isOpen && <Reasons row={r} />}
            </div>
          );
        }

        return (
          <div key={r.subjectId} style={{ borderTop: '1px solid var(--line2)' }}>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isOpen}
              title="Ver o cálculo"
              style={{ width: '100%', display: 'grid', gridTemplateColumns: COLS, gap: 14, alignItems: 'center', minHeight: 54, background: isOpen ? '#141414' : 'none', border: 0, padding: '6px 0', textAlign: 'left', color: 'var(--ink)', fontSize: 13 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Dot color={toneOf(r.subjectId)} size={10} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 16 }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: stale ? 'var(--amber)' : 'var(--mut2)' }}>
                    {r.code} · {r.ects || '—'} ECTS{stale ? ' · +7 dias sem estudo' : ''}
                  </span>
                </span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ whiteSpace: 'nowrap' }}>
                  {fmtHours(r.doneWeek)} <span className={d.muted}>de {fmtHours(r.suggestedWeek)}</span>
                </span>
                <Meter done={r.doneWeek} target={r.suggestedWeek} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'nowrap' }}>
                <span className={d.ellipsis}>{r.next ? r.next.title : '—'}</span>
                <span style={{ fontSize: 11, color: r.next && r.next.days <= 7 ? 'var(--amber)' : 'var(--mut2)' }}>
                  {r.next ? `${short(r.next.due)} · ${r.next.days === 0 ? 'hoje' : `em ${r.next.days} ${r.next.days === 1 ? 'dia' : 'dias'}`}` : 'sem avaliações'}
                </span>
              </span>
              <span className={d.ellipsis} style={{ color: 'var(--mut)' }}>{r.main}</span>
            </button>
            {isOpen && <Reasons row={r} />}
          </div>
        );
      })}
      <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 11 }}>Toca numa disciplina para ver como a sugestão foi calculada.</p>
    </section>
  );
}

// ==========================================
// HISTÓRICO: últimas 8 semanas + horas por capítulo
// ==========================================
export interface WeekBar {
  start: Date;
  hours: number;
  parts: { color: string; hours: number; label: string }[];
}

export function EstudoHistory({ weeks, chapters }: { weeks: WeekBar[]; chapters: { label: string; sub: string; hours: number; href?: string }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.hours));
  const H = 120;
  return (
    <section id="historico" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>HISTÓRICO</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>últimas {weeks.length} semanas</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: H + 34 }}>
        {weeks.map((w, i) => {
          const current = i === weeks.length - 1;
          return (
            <div key={w.start.toISOString()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, minWidth: 0 }} title={`Semana de ${short(w.start)}: ${fmtHours(w.hours)}`}>
              <span style={{ fontSize: 11, textAlign: 'center', color: current ? 'var(--sky)' : 'var(--mut)' }}>{w.hours ? fmtHours(w.hours) : ''}</span>
              <div style={{ height: Math.max(2, (w.hours / max) * H), display: 'flex', flexDirection: 'column-reverse', background: w.hours ? undefined : '#262626' }}>
                {w.parts.map((p) => (
                  <span key={p.label} title={`${p.label}: ${fmtHours(p.hours)}`} style={{ flex: `${p.hours} 0 0`, background: p.color, minHeight: 1 }} />
                ))}
              </div>
              <span style={{ fontSize: 10, textAlign: 'center', color: current ? 'var(--ink)' : 'var(--mut2)', whiteSpace: 'nowrap' }}>{short(w.start)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)', padding: '6px 0' }}>HORAS POR CAPÍTULO</div>
        {chapters.length === 0 && <p className={d.muted} style={{ margin: 0, fontSize: 13 }}>Ainda sem sessões ligadas a capítulos.</p>}
        {chapters.map((ch) => {
          const content = (
            <>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className={`${d.ellipsis} ${d.wrapPhone}`}>{ch.label}</span>
                <span style={{ fontSize: 11, color: 'var(--mut2)' }}>{ch.sub}</span>
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{fmtHours(ch.hours)}</span>
            </>
          );
          const style = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', minHeight: 42, borderBottom: '1px solid var(--line2)', fontSize: 13 } as const;
          return ch.href ? (
            <Link key={ch.label + ch.sub} href={ch.href} style={style}>{content}</Link>
          ) : (
            <div key={ch.label + ch.sub} style={style}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}

// ==========================================
// DEFINIÇÕES
// ==========================================
export function EstudoSettings({
  settings,
  period,
  missingTable,
  onSave,
}: {
  settings: StudySettings;
  period: PlanPeriod;
  missingTable: boolean;
  onSave: (s: StudySettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [prev, setPrev] = useState(settings);
  const [status, setStatus] = useState<SaveState>({ kind: 'idle' });
  if (settings !== prev) {
    setPrev(settings);
    setDraft(settings);
  }

  const hpe = Number(draft.hoursPerEcts);
  const errors = [
    !(hpe >= 20 && hpe <= 40) ? 'As horas por ECTS vão de 20 a 40.' : null,
    draft.semesterStart && draft.semesterEnd && draft.semesterEnd < draft.semesterStart ? 'O fim das aulas é antes do início.' : null,
    draft.semesterEnd && draft.examsEnd && draft.examsEnd < draft.semesterEnd ? 'O fim dos exames é antes do fim das aulas.' : null,
  ].filter(Boolean) as string[];
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async () => {
    if (errors.length) return;
    setStatus({ kind: 'saving' });
    try {
      await onSave({ ...draft, hoursPerEcts: hpe });
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) });
    }
  };

  return (
    <section id="definicoes" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>DEFINIÇÕES</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>
          {period.usingDefaults ? 'sem datas: 14 semanas de aulas + 4 de exames' : `semana ${period.weekNumber ?? '—'} de ${period.totalWeeks}`}
        </span>
      </div>
      {missingTable && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--amber)' }}>
          A tabela das definições ainda não existe. Corre o ficheiro supabase-study-settings.sql no Supabase; até lá as definições ficam só neste browser.
        </p>
      )}
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="HORAS POR ECTS" hint="Em Portugal, 25 a 30 h">
          <input
            className={`${d.input} ${errors[0] && !(hpe >= 20 && hpe <= 40) ? d.inputInvalid : ''}`}
            inputMode="decimal"
            value={String(draft.hoursPerEcts)}
            onChange={(e) => setDraft({ ...draft, hoursPerEcts: Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0 })}
          />
        </Field>
        <Field label="INÍCIO DAS AULAS">
          <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.semesterStart ?? ''} onChange={(v) => setDraft({ ...draft, semesterStart: v || null })} style={{ colorScheme: 'dark' }} />
        </Field>
      </div>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="FIM DAS AULAS">
          <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.semesterEnd ?? ''} onChange={(v) => setDraft({ ...draft, semesterEnd: v || null })} style={{ colorScheme: 'dark' }} />
        </Field>
        <Field label="FIM DA ÉPOCA DE EXAMES">
          <DateField className={d.input} invalidClassName={d.inputInvalid} value={draft.examsEnd ?? ''} onChange={(v) => setDraft({ ...draft, examsEnd: v || null })} style={{ colorScheme: 'dark' }} />
        </Field>
      </div>
      {errors.length > 0 && <span className={d.errorText}>{errors[0]}</span>}
      <p className={d.muted} style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
        Como se calcula: ECTS × horas por ECTS, menos as horas de aula do semestre, dá o estudo autónomo. 65% espalha-se pelas semanas; 35% vai para preparar
        testes e entregas, na proporção do peso de cada um, nos 14 dias antes. Com notas lançadas: média abaixo de 10 → +30%, de 10 a 12 → +15%, 16 ou mais → −10%.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
        <SaveStatus state={status} />
        <button type="button" className={`${d.btnGhost} ${d.sm}`} disabled={!dirty} onClick={() => setDraft(settings)}>Repor</button>
        <button type="button" className={`${d.btnFill} ${d.sm}`} disabled={!dirty || errors.length > 0} onClick={save}>Guardar</button>
      </div>
    </section>
  );
}
