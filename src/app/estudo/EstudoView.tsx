'use client';

// Página /estudo: resumo, sugestão por disciplina (com o motivo), histórico
// e definições. Estilo "denso", com variantes para iPad e iPhone.

import { useEffect, useState, type ReactNode } from 'react';
import { askNotificationPermission, loadStudySettings, notificationState, saveStudySettings, type NotifState, type StudySessionRow } from '@/lib/study';
import Link from 'next/link';
import d from '@/app/components/denso/denso.module.css';
import type { DensoLayout } from '@/app/components/denso/DensoTouch';
import { Field, SaveStatus, errorMessage, type SaveState } from '@/app/components/denso/DensoForm';
import { DateField, TimeField } from '@/components/ui/DateTimeFields';
import {
  fmtHours,
  planPeriod,
  type HoursGradeRow,
  type PlanPeriod,
  type ReviewChapter,
  type StudySettings,
  type SubjectPlan,
  type Unavailable,
} from '@/lib/studyPlan';
import { chapterHref, stepTitle } from '@/lib/studyPath';

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const short = (dt: Date) => `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className={d.round} style={{ width: size, height: size, flex: 'none', background: color, display: 'inline-block' }} />;
}

// Cor do texto por cima de uma cor de disciplina (os tons vão do azul-escuro ao osso).
function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
export const inkOn = (tone: string) => (luminance(tone) > 0.45 ? '#0d0d0d' : '#efe9df');
// Tons muito escuros quase não se veem como contorno no fundo preto: clareia-os.
export const edgeOf = (tone: string) => (luminance(tone) < 0.3 ? `color-mix(in srgb, ${tone} 60%, #ffffff)` : tone);

// Barra feito / sugerido. Passar da sugestão fica a azul-claro até ao fim.
export function Meter({ done, target, color = 'var(--accent)' }: { done: number; target: number; color?: string }) {
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
  trailing,
  onSettings,
  onAdd,
}: {
  layout: DensoLayout;
  subtitle: string;
  trailing?: ReactNode;
  onSettings: () => void;
  onAdd: () => void;
}) {
  if (layout === 'phone') {
    return (
      <section className={d.inner} style={{ paddingTop: 12, paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em' }}>Estudo</h1>
            <span className={`${d.serif} ${d.ellipsis}`} style={{ fontStyle: 'italic', fontSize: 17, color: 'var(--sky)' }}>{subtitle}</span>
          </span>
          {trailing}
        </div>
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
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={d.btnGhost} onClick={onSettings}>Definições</button>
        <button type="button" className={d.btnLine} onClick={onAdd} title="Registar estudo feito fora da app (N)">+ Sessão</button>
      </div>
    </section>
  );
}

// ==========================================
// POR DISCIPLINA
// ==========================================
// Percurso até ao teste: T1 → P1 → T2 → … → testes anteriores.
function PathSteps({ row, onToggle }: { row: SubjectPlan; onToggle?: (chapterId: string, done: boolean) => void }) {
  const path = row.path;
  if (!path) return null;
  const all = [...path.steps, path.training];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0 4px' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)' }}>
        PERCURSO ATÉ {path.title.toUpperCase()} · {short(path.due)} · FALTAM {fmtHours(path.left).toUpperCase()}
      </span>
      {all.length === 1 && <span style={{ fontSize: 12 }}>Sem aulas registadas para esta matéria (define as datas do semestre ou cria os capítulos).</span>}
      {all.map((st) => {
        const isNext = path.next?.key === st.key;
        const icon = st.done ? '✓' : isNext ? '→' : st.given ? '·' : '○';
        const color = st.done ? 'var(--sky)' : isNext ? 'var(--ink)' : st.given ? 'var(--mut)' : 'var(--faint)';
        return (
          <div key={st.key} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', gap: 8, alignItems: 'center', minHeight: 26, fontSize: 12, color }}>
            <span style={{ fontWeight: 700 }}>{icon}</span>
            <span className={d.ellipsis} style={{ fontWeight: isNext ? 600 : 400 }}>
              {st.chapterId ? (
                <Link href={chapterHref(row.subjectId, st)} style={{ color: 'inherit' }}>
                  {stepTitle(st)}
                </Link>
              ) : (
                stepTitle(st)
              )}
              {!st.given ? ' · aula ainda por dar' : !st.chapterId && st.kind !== 'TESTES' ? ' · sem capítulo no caderno' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {!st.done && st.given && <span>{st.left > 0.05 ? `~${fmtHours(st.left)}` : 'tempo feito'}</span>}
              {onToggle && st.chapterId && st.kind !== 'TESTES' && st.given && (
                <button
                  type="button"
                  className={`${d.btnGhost} ${d.xs}`}
                  onClick={() => onToggle(st.chapterId!, !st.done)}
                  title={st.done ? 'Voltar a marcar por concluir' : 'Marcar o capítulo como concluído (passa ao seguinte)'}
                >
                  {st.done ? 'Desmarcar' : 'Concluído ✓'}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Reasons({ row, onToggle }: { row: SubjectPlan; onToggle?: (chapterId: string, done: boolean) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 12px 20px', fontSize: 12, color: 'var(--mut)' }}>
      <PathSteps row={row} onToggle={onToggle} />
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

export function EstudoSubjects({
  rows,
  toneOf,
  cards,
  today,
  onToggleChapter,
}: {
  rows: SubjectPlan[];
  toneOf: (id: string) => string;
  cards: boolean;
  today: Date;
  onToggleChapter?: (chapterId: string, done: boolean) => void;
}) {
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
        const stale = r.lastStudied ? (today.getTime() - r.lastStudied.getTime()) / 86400000 > 7 : false;

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
              {isOpen && <Reasons row={r} onToggle={onToggleChapter} />}
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
            {isOpen && <Reasons row={r} onToggle={onToggleChapter} />}
          </div>
        );
      })}
      <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 11 }}>Toca numa disciplina para ver o percurso até ao teste e como a sugestão foi calculada.</p>
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

export function EstudoHistory({ weeks, avg }: { weeks: WeekBar[]; avg: number }) {
  const max = Math.max(1, ...weeks.map((w) => w.hours));
  const H = 140;
  return (
    <section id="historico" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>HISTÓRICO</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>
          últimas {weeks.length} semanas · média {fmtHours(avg)}/semana
        </span>
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
    </section>
  );
}

// Onde foi o tempo (sessões carregadas), capítulo a capítulo.
export function EstudoChapterHours({ chapters }: { chapters: { label: string; sub: string; hours: number; href?: string; color?: string }[] }) {
  const max = Math.max(0.01, ...chapters.map((c) => c.hours));
  return (
    <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>HORAS POR CAPÍTULO</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>top 10</span>
      </div>
      {chapters.length === 0 && <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Ainda sem sessões ligadas a capítulos.</p>}
      {chapters.map((ch) => {
        const content = (
          <>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className={d.ellipsis}>
                {ch.sub && <strong style={{ fontWeight: 600 }}>{ch.sub} </strong>}
                {ch.label}
              </span>
              <span style={{ display: 'flex', height: 3, background: '#222' }}>
                <span style={{ width: `${(ch.hours / max) * 100}%`, background: ch.color ?? 'var(--mut2)' }} />
              </span>
            </span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(ch.hours)}</span>
          </>
        );
        const style = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', minHeight: 44, borderBottom: '1px solid var(--line2)', fontSize: 13 } as const;
        return ch.href ? (
          <Link key={ch.label + ch.sub} href={ch.href} style={style}>{content}</Link>
        ) : (
          <div key={ch.label + ch.sub} style={style}>{content}</div>
        );
      })}
    </section>
  );
}

// ==========================================
// SESSÕES: ver e corrigir (fase 5)
// ==========================================
const SESSION_MINUTES = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

export function EstudoSessions({
  sessions,
  chapters,
  toneOf,
  codeOf,
  busy,
  error,
  onDelete,
  onUpdate,
  onAdd,
}: {
  sessions: StudySessionRow[];
  chapters: { id: string; subject_id: string; number: string | number | null; title: string | null }[];
  toneOf: (id: string) => string;
  codeOf: (id: string) => string;
  busy: boolean;
  error: string | null;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: { chapter_id?: string | null; duration_seconds?: number }) => void;
  onAdd: () => void;
}) {
  const [limit, setLimit] = useState(20);
  const [confirm, setConfirm] = useState<string | null>(null);
  const sorted = [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const shown = sorted.slice(0, limit);
  // Agrupadas por dia, com o total de cada dia.
  const groups: { key: string; date: Date; items: StudySessionRow[]; total: number }[] = [];
  for (const s of shown) {
    const dt = new Date(s.started_at);
    const key = dt.toDateString();
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, date: dt, items: [], total: 0 };
      groups.push(g);
    }
    g.items.push(s);
    g.total += s.duration_seconds / 3600;
  }
  const clock = (dt: Date) => `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

  return (
    <section id="sessoes" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>SESSÕES</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={d.muted} style={{ fontSize: 12 }}>{sessions.length} registadas</span>
          <button type="button" className={`${d.btnFill} ${d.xs}`} onClick={onAdd}>+ Sessão</button>
        </span>
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#e38b7a' }}>{error}</p>}
      {sessions.length === 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Ainda não há sessões. Abre um caderno e estuda, ou regista uma com “+ Sessão”.</p>}
      {groups.map((g) => (
        <div key={g.key} style={{ display: 'flex', flexDirection: 'column', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, color: 'var(--mut)' }}>
              {WD[g.date.getDay()].toUpperCase()}, {g.date.getDate()} {MONTHS[g.date.getMonth()].toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--mut2)' }}>{fmtHours(g.total)}</span>
          </div>
          {g.items.map((s) => {
            const start = new Date(s.started_at);
            const end = new Date(s.ended_at);
            const min = Math.round(s.duration_seconds / 60);
            const sid = String(s.subject_id);
            const subjectChapters = chapters.filter((c) => c.subject_id === sid);
            return (
              <div
                key={s.id}
                className={d.sessionRow}
                style={{ borderTop: '1px solid var(--line2)', borderLeft: `3px solid ${edgeOf(toneOf(sid))}`, padding: '8px 0 8px 10px', fontSize: 13 }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <strong style={{ fontWeight: 700 }}>{codeOf(sid)}</strong>
                  <span className={d.muted} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {clock(start)}–{clock(end)}
                  </span>
                  <span style={{ fontSize: 10, letterSpacing: '0.06em', color: s.source === 'manual' ? 'var(--amber)' : 'var(--mut2)' }}>
                    {s.source === 'manual' ? 'MANUAL' : 'CADERNO'}
                  </span>
                </span>
                <select
                  className={d.input}
                  aria-label="Duração"
                  value={min}
                  disabled={busy}
                  onChange={(e) => onUpdate(s.id, { duration_seconds: Number(e.target.value) * 60 })}
                  style={{ height: 30 }}
                >
                  {!SESSION_MINUTES.includes(min) && <option value={min}>{fmtHours(min / 60)}</option>}
                  {SESSION_MINUTES.map((m) => (
                    <option key={m} value={m}>{fmtHours(m / 60)}</option>
                  ))}
                </select>
                <select
                  className={d.input}
                  aria-label="Capítulo"
                  value={s.chapter_id ? String(s.chapter_id) : ''}
                  disabled={busy}
                  onChange={(e) => onUpdate(s.id, { chapter_id: e.target.value || null })}
                  style={{ height: 30 }}
                >
                  <option value="">Sem capítulo</option>
                  {s.chapter_id && !subjectChapters.some((c) => c.id === String(s.chapter_id)) && <option value={String(s.chapter_id)}>Capítulo apagado</option>}
                  {subjectChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {String(c.number ?? '').padStart(2, '0')} · {c.title || 'Sem título'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${d.btnGhost} ${d.xs}`}
                  disabled={busy}
                  onClick={() => {
                    if (confirm === s.id) {
                      setConfirm(null);
                      onDelete(s.id);
                    } else setConfirm(s.id);
                  }}
                  onBlur={() => setConfirm(null)}
                  aria-label="Apagar sessão"
                  style={confirm === s.id ? { color: '#e38b7a', borderColor: '#e38b7a' } : undefined}
                >
                  {confirm === s.id ? 'Apagar?' : '✕'}
                </button>
              </div>
            );
          })}
        </div>
      ))}
      {sorted.length > limit && (
        <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={() => setLimit((l) => l + 30)} style={{ alignSelf: 'flex-start', marginTop: 12 }}>
          Mostrar mais ({sorted.length - limit})
        </button>
      )}
    </section>
  );
}

// ==========================================
// RESUMO SEMANAL (fase 5): esta semana ou a passada
// ==========================================
export function EstudoWeekSummary({
  thisWeek,
  lastWeek,
  toneOf,
  defaultLast,
}: {
  thisWeek: SubjectPlan[];
  lastWeek: SubjectPlan[];
  toneOf: (id: string) => string;
  defaultLast: boolean;
}) {
  const [last, setLast] = useState(defaultLast);
  const rows = (last ? lastWeek : thisWeek).filter((r) => r.suggestedWeek > 0 || r.doneWeek > 0);
  const done = rows.reduce((n, r) => n + r.doneWeek, 0);
  const target = rows.reduce((n, r) => n + r.suggestedWeek, 0);
  const pct = target > 0 ? Math.round((done / target) * 100) : null;
  const worst = [...rows].sort((a, b) => b.suggestedWeek - b.doneWeek - (a.suggestedWeek - a.doneWeek))[0];
  const best = [...rows].sort((a, b) => b.doneWeek - b.suggestedWeek - (a.doneWeek - a.suggestedWeek))[0];

  return (
    <section id="resumo-semanal" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>RESUMO SEMANAL</h2>
        <span style={{ display: 'flex', border: '1px solid var(--box)' }}>
          {[
            [false, 'Esta semana'],
            [true, 'Passada'],
          ].map(([v, label]) => (
            <button
              key={String(label)}
              type="button"
              aria-pressed={last === v}
              onClick={() => setLast(v as boolean)}
              style={{ height: 26, padding: '0 10px', fontSize: 12, border: 0, background: last === v ? 'var(--bone)' : 'transparent', color: last === v ? 'var(--bg)' : 'var(--ink)' }}
            >
              {label as string}
            </button>
          ))}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className={d.muted} style={{ margin: 0, fontSize: 13 }}>Sem estudo sugerido nem feito {last ? 'na semana passada' : 'esta semana'}.</p>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {pct !== null ? (
              <>
                Cumpriste <strong style={{ fontWeight: 600, color: pct >= 100 ? 'var(--sky)' : pct >= 70 ? 'var(--ink)' : 'var(--amber)' }}>{pct}%</strong> ({fmtHours(done)} de {fmtHours(target)}).
              </>
            ) : (
              <>Estudaste {fmtHours(done)} sem sugestão para a semana.</>
            )}
            {worst && worst.suggestedWeek - worst.doneWeek >= 0.5 && <> Faltou mais em <strong style={{ fontWeight: 600 }}>{worst.code}</strong> (−{fmtHours(worst.suggestedWeek - worst.doneWeek)}).</>}
            {best && best.doneWeek - best.suggestedWeek >= 0.5 && <> Passaste a sugestão em <strong style={{ fontWeight: 600 }}>{best.code}</strong> (+{fmtHours(best.doneWeek - best.suggestedWeek)}).</>}
          </p>
          {rows.map((r) => (
            <div key={r.subjectId} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 96px', gap: 10, alignItems: 'center', fontSize: 13, minHeight: 30 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Dot color={toneOf(r.subjectId)} />
                {r.code}
              </span>
              <Meter done={r.doneWeek} target={r.suggestedWeek} color={toneOf(r.subjectId)} />
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fmtHours(r.doneWeek)} <span className={d.muted}>/ {fmtHours(r.suggestedWeek)}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// ==========================================
// CAPÍTULOS PARA REVER (antes dos testes)
// ==========================================
export function EstudoReview({ items, toneOf, codeOf }: { items: ReviewChapter[]; toneOf: (id: string) => string; codeOf: (id: string) => string }) {
  return (
    <section id="rever" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>PARA REVER</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>avaliações nos próximos 14 dias</span>
      </div>
      {items.length === 0 && (
        <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Nada para rever: não há avaliações perto, ou já estudaste os capítulos na última semana.</p>
      )}
      {items.slice(0, 12).map((it) => (
        <Link
          key={it.chapterId}
          href={`/faculdade/${it.subjectId}/notebook?tab=${it.category}&chapter=${it.chapterId}`}
          style={{ display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minHeight: 46, borderBottom: '1px solid var(--line2)', fontSize: 13 }}
        >
          <Dot color={toneOf(it.subjectId)} />
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className={`${d.ellipsis} ${d.wrapPhone}`}>
              <strong style={{ fontWeight: 600 }}>{codeOf(it.subjectId)}</strong> {it.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--mut2)' }}>
              {it.lastStudied ? `última vez há ${it.daysSince} dias` : 'nunca estudado com o contador'}
            </span>
          </span>
          <span style={{ fontSize: 12, color: it.dueDays <= 5 ? 'var(--amber)' : 'var(--mut)', whiteSpace: 'nowrap', textAlign: 'right' }}>
            {it.assessment}
            <span style={{ display: 'block', fontSize: 11 }}>{it.dueDays === 0 ? 'hoje' : it.dueDays === 1 ? 'amanhã' : `em ${it.dueDays} dias`}</span>
          </span>
        </Link>
      ))}
      {items.length > 12 && <p className={d.muted} style={{ margin: '6px 0 0', fontSize: 11 }}>+ {items.length - 12} capítulos</p>}
    </section>
  );
}

// ==========================================
// HORAS VS. NOTA (semestre)
// ==========================================
export function EstudoHoursGrade({ rows, toneOf, sinceLabel }: { rows: HoursGradeRow[]; toneOf: (id: string) => string; sinceLabel: string }) {
  const maxH = Math.max(1, ...rows.map((r) => r.hours));
  const withGrades = rows.filter((r) => r.average !== null);
  return (
    <section id="notas" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>HORAS VS. NOTA</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>{sinceLabel}</span>
      </div>
      {rows.map((r) => (
        <div key={r.subjectId} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) 58px 52px', gap: 10, alignItems: 'center', minHeight: 40, borderBottom: '1px solid var(--line2)', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <Dot color={toneOf(r.subjectId)} />
            {r.code}
          </span>
          <span style={{ display: 'flex', height: 5, background: '#262626' }} title={`${fmtHours(r.hours)} de estudo`}>
            <span style={{ width: `${(r.hours / maxH) * 100}%`, background: toneOf(r.subjectId) }} />
          </span>
          <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtHours(r.hours)}</span>
          <span className={d.serif} style={{ textAlign: 'right', fontSize: 17, color: r.average === null ? 'var(--faint)' : r.average < 10 ? '#e38b7a' : 'var(--sky)' }} title={`${r.graded} de ${r.total} componentes avaliados`}>
            {r.average === null ? '—' : r.average.toFixed(1).replace('.', ',')}
          </span>
        </div>
      ))}
      <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5 }}>
        {withGrades.length
          ? 'Nota = média atual com as avaliações já lançadas. No fim do semestre dá para ver onde o tempo rendeu mais.'
          : 'As notas aparecem aqui quando lançares as primeiras avaliações.'}
      </p>
    </section>
  );
}

// ==========================================
// DEFINIÇÕES (no perfil): carrega e grava sozinho
// ==========================================
export const SETTINGS_EVENT = 'estudo:definicoes-mudaram';

export function StudySettingsPanel() {
  const [state, setState] = useState<{ settings: StudySettings; missingTable: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    loadStudySettings().then((r) => alive && setState(r));
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <p className={d.muted} style={{ margin: 0, fontSize: 13 }}>A carregar as definições…</p>;

  return (
    <EstudoSettings
      title="ESTUDO"
      settings={state.settings}
      period={planPeriod(state.settings, new Date())}
      missingTable={state.missingTable}
      onSave={async (s) => {
        setState({ settings: s, missingTable: false });
        try {
          await saveStudySettings(s);
        } finally {
          // O /estudo e a Visão Geral voltam a calcular com as definições novas.
          window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: s }));
        }
      }}
    />
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
  title = 'DEFINIÇÕES',
}: {
  settings: StudySettings;
  period: PlanPeriod;
  missingTable: boolean;
  onSave: (s: StudySettings) => Promise<void>;
  title?: string;
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
    !draft.weekdayStart || !draft.weekdayEnd || draft.weekdayEnd <= draft.weekdayStart ? 'Nos dias úteis, o fim tem de ser depois do início.' : null,
    !draft.weekendStart || !draft.weekendEnd || draft.weekendEnd <= draft.weekendStart ? 'Ao fim de semana, o fim tem de ser depois do início.' : null,
    !(draft.maxHoursDay >= 0.5 && draft.maxHoursDay <= 12) ? 'O máximo por dia vai de 0,5 a 12 h.' : null,
    !(draft.blockMin >= 15 && draft.blockMax <= 240 && draft.blockMin <= draft.blockMax) ? 'Os blocos vão de 15 a 240 min, e o mínimo não passa o máximo.' : null,
    draft.unavailable.some((u) => !u.start || !u.end || u.end <= u.start || (u.weekday === null && !u.date)) ? 'Cada período indisponível precisa de dia e de fim depois do início.' : null,
    !(draft.breakMinutes >= 0 && draft.breakMinutes <= 60) ? 'A pausa entre blocos vai de 0 a 60 min.' : null,
    draft.reminders && !(draft.reminderMinutes >= 0 && draft.reminderMinutes <= 120) ? 'O lembrete vai de 0 a 120 min antes.' : null,
  ].filter(Boolean) as string[];

  const num = (v: string) => Number(v.replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  const [notifState, setNotifState] = useState<NotifState>(() => notificationState());
  const setU = (i: number, patch: Partial<Unavailable>) =>
    setDraft({ ...draft, unavailable: draft.unavailable.map((u, j) => (j === i ? { ...u, ...patch } : u)) });
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
        <h2 className={d.h2}>{title}</h2>
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

      <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)', paddingTop: 6, borderTop: '1px solid var(--line2)' }}>PLANO DE BLOCOS</div>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="DIAS ÚTEIS · DAS">
          <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.weekdayStart} onChange={(v) => setDraft({ ...draft, weekdayStart: v })} />
        </Field>
        <Field label="ÀS">
          <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.weekdayEnd} onChange={(v) => setDraft({ ...draft, weekdayEnd: v })} />
        </Field>
      </div>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="FIM DE SEMANA · DAS">
          <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.weekendStart} onChange={(v) => setDraft({ ...draft, weekendStart: v })} />
        </Field>
        <Field label="ÀS">
          <TimeField className={d.input} invalidClassName={d.inputInvalid} value={draft.weekendEnd} onChange={(v) => setDraft({ ...draft, weekendEnd: v })} />
        </Field>
      </div>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="MÁXIMO POR DIA (H)">
          <input className={d.input} inputMode="decimal" value={String(draft.maxHoursDay).replace('.', ',')} onChange={(e) => setDraft({ ...draft, maxHoursDay: num(e.target.value) })} />
        </Field>
        <Field label="MARGEM DAS AULAS (MIN)">
          <input className={d.input} inputMode="numeric" value={String(draft.classMargin)} onChange={(e) => setDraft({ ...draft, classMargin: Math.round(num(e.target.value)) })} />
        </Field>
      </div>
      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="BLOCO MÍNIMO (MIN)">
          <input className={d.input} inputMode="numeric" value={String(draft.blockMin)} onChange={(e) => setDraft({ ...draft, blockMin: Math.round(num(e.target.value)) })} />
        </Field>
        <Field label="BLOCO MÁXIMO (MIN)">
          <input className={d.input} inputMode="numeric" value={String(draft.blockMax)} onChange={(e) => setDraft({ ...draft, blockMax: Math.round(num(e.target.value)) })} />
        </Field>
      </div>

      <div className={`${d.fieldRow} ${d.fieldRow2}`}>
        <Field label="PAUSA ENTRE BLOCOS (MIN)">
          <input className={d.input} inputMode="numeric" value={String(draft.breakMinutes)} onChange={(e) => setDraft({ ...draft, breakMinutes: Math.round(num(e.target.value)) })} />
        </Field>
        <Field label="QUANDO FALTA POUCO">
          <select className={d.input} value={draft.shortBlocks} onChange={(e) => setDraft({ ...draft, shortBlocks: e.target.value as StudySettings['shortBlocks'] })}>
            <option value="allow">Bloco curto só com o que falta</option>
            <option value="round">Arredondar ao bloco mínimo</option>
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            className={d.chk}
            checked={draft.reminders}
            onChange={async (e) => {
              const on = e.target.checked;
              setDraft({ ...draft, reminders: on });
              if (on) setNotifState(await askNotificationPermission());
            }}
          />
          Lembrete antes de cada bloco de estudo
        </label>
        {draft.reminders && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
            <input
              className={d.input}
              inputMode="numeric"
              aria-label="Minutos antes"
              value={String(draft.reminderMinutes)}
              onChange={(e) => setDraft({ ...draft, reminderMinutes: Math.round(num(e.target.value)) })}
              style={{ width: 64 }}
            />
            <span className={d.muted}>minutos antes</span>
            <span style={{ fontSize: 12, color: notifState === 'granted' ? 'var(--sky)' : 'var(--amber)' }}>
              {notifState === 'granted'
                ? '· notificações autorizadas'
                : notifState === 'denied'
                  ? '· notificações bloqueadas no browser (muda nas definições do site)'
                  : notifState === 'unsupported'
                    ? '· este browser não mostra notificações (no iPhone/iPad: adiciona a app ao ecrã principal)'
                    : '· falta autorizar as notificações'}
            </span>
            {notifState === 'default' && (
              <button type="button" className={`${d.btnGhost} ${d.xs}`} onClick={async () => setNotifState(await askNotificationPermission())}>
                Autorizar
              </button>
            )}
          </div>
        )}
        <span className={d.muted} style={{ fontSize: 11, lineHeight: 1.5 }}>
          Os lembretes só aparecem com a app aberta (num separador ou no ecrã principal). Não há servidor a enviá-los com a app fechada.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)' }}>INDISPONÍVEL (GINÁSIO, VIAGENS…)</span>
          <button
            type="button"
            className={`${d.btnGhost} ${d.xs}`}
            onClick={() => setDraft({ ...draft, unavailable: [...draft.unavailable, { weekday: 1, date: null, start: '18:00', end: '20:00', label: '' }] })}
          >
            + Período
          </button>
        </div>
        {draft.unavailable.length === 0 && <span className={d.muted} style={{ fontSize: 12 }}>Nenhum. Os turnos de trabalho marcam-se no Trabalho.</span>}
        {draft.unavailable.map((u, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 6, alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid var(--line2)' }}>
            <select
              className={d.input}
              aria-label="Quando"
              value={u.date !== null ? 'data' : String(u.weekday)}
              onChange={(e) =>
                setU(i, e.target.value === 'data' ? { weekday: null, date: u.date ?? '' } : { weekday: Number(e.target.value), date: null })
              }
            >
              {WD.map((w, n) => (
                <option key={w} value={n}>{n === 0 || n === 6 ? `Todos os ${w.toLowerCase()}s` : `Todas as ${w.toLowerCase()}s`}</option>
              ))}
              <option value="data">Num dia…</option>
            </select>
            <TimeField className={d.input} invalidClassName={d.inputInvalid} value={u.start} onChange={(v) => setU(i, { start: v })} aria-label="Início" />
            <TimeField className={d.input} invalidClassName={d.inputInvalid} value={u.end} onChange={(v) => setU(i, { end: v })} aria-label="Fim" />
            {u.date !== null && (
              <DateField
                className={d.input}
                invalidClassName={d.inputInvalid}
                value={u.date}
                onChange={(v) => setU(i, { date: v })}
                style={{ gridColumn: '1 / 2', colorScheme: 'dark' }}
                aria-label="Dia"
              />
            )}
            <input
              className={d.input}
              placeholder="Nome (opcional)"
              value={u.label}
              onChange={(e) => setU(i, { label: e.target.value })}
              style={{ gridColumn: u.date !== null ? '2 / 3' : '1 / 3' }}
            />
            <button
              type="button"
              className={`${d.btnGhost} ${d.xs}`}
              onClick={() => setDraft({ ...draft, unavailable: draft.unavailable.filter((_, j) => j !== i) })}
              aria-label="Remover período"
            >
              Remover
            </button>
          </div>
        ))}
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
