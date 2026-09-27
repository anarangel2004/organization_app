'use client';

import { useState, type RefObject } from 'react';
import Link from 'next/link';
import d from '@/app/components/denso/denso.module.css';
import { useNow } from '@/app/components/painel/useLocalState';
import { parseMinutes } from '@/app/components/homeAgenda';

// Tons por disciplina (ordem fixa por código), como no design.
export interface Tone {
  bg: string;
  fg: string;
  bd: string;
}

export const FAC_TONES: Tone[] = [
  { bg: '#1e3a4c', fg: '#efe9df', bd: '#1e3a4c' },
  { bg: '#2f5f78', fg: '#efe9df', bd: '#2f5f78' },
  { bg: '#4f86a3', fg: '#0d0d0d', bd: '#4f86a3' },
  { bg: '#79acc6', fg: '#0d0d0d', bd: '#79acc6' },
  { bg: '#9dbccb', fg: '#0d0d0d', bd: '#9dbccb' },
  { bg: '#e4ded3', fg: '#0d0d0d', bd: '#e4ded3' },
];
export const OVERFLOW_TONE: Tone = { bg: 'transparent', fg: '#efe9df', bd: '#7fb0cb' };

function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className={d.round} style={{ width: size, height: size, flex: 'none', background: color, display: 'inline-block' }} />;
}

// ==========================================
// CABEÇALHO NUMA LINHA
// ==========================================
export function FacHeading({
  periodLabel,
  meta,
  onAddDeadline,
  onAddSubject,
}: {
  periodLabel: string;
  meta: string;
  onAddDeadline: () => void;
  onAddSubject: () => void;
}) {
  return (
    <section
      className={d.inner}
      style={{ minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px 24px', flexWrap: 'wrap', paddingTop: 12, paddingBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 18px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>Faculdade</h1>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 24, color: 'var(--sky)' }}>{periodLabel}</span>
        <span className={d.muted} style={{ fontSize: 13 }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={d.btnLine} onClick={onAddDeadline}>+ Prazo</button>
        <button type="button" className={d.btnLine} onClick={onAddSubject}>+ Disciplina</button>
        <Link href="/" className={d.btnFill}>Entrar na Agenda →</Link>
      </div>
    </section>
  );
}

// "Ir para" na barra de atalhos.
export function SubjectJumps({ subjects }: { subjects: { id: string; code: string; tone: Tone }[] }) {
  if (subjects.length === 0) return null;
  return (
    <>
      <span aria-hidden="true" style={{ width: 1, background: 'var(--line)', margin: '10px 0' }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--mut2)' }}>
        Ir para
        {subjects.map((s) => (
          <Link
            key={s.id}
            href={`/faculdade/${s.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 24, padding: '0 8px', border: '1px solid var(--box)', fontSize: 12 }}
          >
            <Dot color={s.tone.bg === 'transparent' ? s.tone.bd : s.tone.bg} />
            {s.code}
          </Link>
        ))}
      </span>
    </>
  );
}

// ==========================================
// AGORA
// ==========================================
export interface ClassSlot {
  subjectId: string;
  subjectName: string;
  code: string;
  typeLabel: string;
  typeShort: string;
  dayNum: number;
  start: string;
  end: string;
  room: string;
}

function findNext(slots: ClassSlot[], now: Date) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: { slot: ClassSlot; offset: number; start: number; end: number } | null = null;
  for (const slot of slots) {
    const start = parseMinutes(slot.start);
    const end = slot.end ? parseMinutes(slot.end) : start + 90;
    let offset = (slot.dayNum - now.getDay() + 7) % 7;
    if (offset === 0 && nowMin >= end) offset = 7;
    if (!best || offset < best.offset || (offset === best.offset && start < best.start)) best = { slot, offset, start, end };
  }
  return best;
}

const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function FacAgora({ slots, average, todaySlots }: { slots: ClassSlot[]; average: string; todaySlots: ClassSlot[] }) {
  const now = useNow(30_000);
  const next = findNext(slots, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let head = 'PRÓXIMA AULA';
  let when = '';
  let progress = 0;
  if (next) {
    if (next.offset === 0 && nowMin >= next.start) {
      head = 'AULA EM CURSO';
      when = `TERMINA EM ${next.end - nowMin} MIN`;
      progress = (nowMin - next.start) / (next.end - next.start);
    } else if (next.offset === 0) {
      const diff = next.start - nowMin;
      when = diff < 60 ? `EM ${diff} MIN` : `HOJE, EM ${Math.floor(diff / 60)} H`;
    } else {
      when = next.offset === 1 ? 'AMANHÃ' : WEEKDAY[next.slot.dayNum].toUpperCase();
    }
  }

  return (
    <section id="agora" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, scrollMarginTop: 16 }}>
      <div style={{ gridColumn: 'span 2', background: 'var(--bone)', color: 'var(--bg)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap', gap: 10 }}>
          <span>{head}</span>
          <span>{when}</span>
        </div>
        {next ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 12px', flexWrap: 'wrap' }}>
              <span className={d.serif} style={{ fontSize: 26, lineHeight: 1 }}>{next.slot.subjectName}</span>
              <span style={{ fontSize: 13 }}>
                {next.slot.typeLabel} · {next.slot.start}
                {next.slot.end ? `–${next.slot.end}` : ''}
                {next.slot.room ? ` · Sala ${next.slot.room}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', height: 3, background: 'rgba(13,13,13,0.15)' }}>
              <div style={{ width: `${Math.round(progress * 100)}%`, background: '#1e3a4c' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <Link
                href={`/faculdade/${next.slot.subjectId}/notebook`}
                style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12 }}
              >
                Notebook
              </Link>
              <Link
                href={`/faculdade/${next.slot.subjectId}`}
                style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', border: '1px solid rgba(13,13,13,0.4)', color: 'var(--bg)', fontSize: 12 }}
              >
                Ver disciplina →
              </Link>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13 }}>Sem horário definido. Acrescenta horários às disciplinas.</div>
        )}
      </div>
      <div style={{ borderTop: '2px solid var(--accent)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 100 }}>
        <div className={d.label}>NOTA MÉDIA</div>
        <div className={d.serif} style={{ fontSize: 32, lineHeight: 1, color: 'var(--sky)' }}>{average}</div>
        <div className={d.muted} style={{ fontSize: 12 }}>todas as disciplinas</div>
      </div>
      <div style={{ borderTop: '2px solid var(--accent)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 100, minWidth: 0 }}>
        <div className={d.label}>HOJE</div>
        <div className={d.serif} style={{ fontSize: 32, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {todaySlots.length} <span style={{ fontSize: 15, color: 'var(--mut)' }}>{todaySlots.length === 1 ? 'bloco' : 'blocos'}</span>
        </div>
        <div className={d.ellipsis} style={{ fontSize: 12 }}>
          {todaySlots.length ? todaySlots.map((s) => `${s.code} ${s.start}`).join(' · ') : 'Sem aulas hoje'}
        </div>
      </div>
    </section>
  );
}

// ==========================================
// SEMANA (Seg–Dom)
// ==========================================
export interface WeekBlock {
  id: string;
  dayIndex: number; // 0 = segunda
  start: string;
  end: string;
  label: string;
  title: string;
  tone: Tone;
  href: string;
}

export interface WeekMarker {
  id: string;
  dayIndex: number;
  title: string;
  href: string;
}

const PX = 18;
const WEEK_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function FacWeek({
  weekNumber,
  days,
  todayIndex,
  blocks,
  markers,
  legend,
}: {
  weekNumber: number;
  days: Date[];
  todayIndex: number;
  blocks: WeekBlock[];
  markers: WeekMarker[];
  legend: { label: string; tone: Tone }[];
}) {
  const now = useNow(60_000);
  let h0 = 8;
  let h1 = 20;
  blocks.forEach((b) => {
    h0 = Math.min(h0, Math.floor(parseMinutes(b.start) / 60));
    h1 = Math.max(h1, Math.ceil((b.end ? parseMinutes(b.end) : parseMinutes(b.start) + 90) / 60));
  });
  h1 = Math.min(h1, 24);
  const height = (h1 - h0) * PX;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - h0 * 60) / 60) * PX;
  const cols = '30px repeat(7, minmax(0, 1fr))';

  return (
    <section id="semana" style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead} style={{ flexWrap: 'wrap' }}>
        <h2 className={d.h2}>SEMANA {weekNumber}</h2>
        <div style={{ display: 'flex', gap: '4px 12px', fontSize: 11, color: 'var(--mut)', flexWrap: 'wrap' }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, background: l.tone.bg, border: `1px solid ${l.tone.bd}` }} />
              {l.label}
            </span>
          ))}
          {markers.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, background: 'var(--amber)' }} />
              Prazo
            </span>
          )}
        </div>
      </div>
      <div>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, paddingTop: 6 }}>
            <span />
            {days.map((day, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 5,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${i === todayIndex ? 'var(--sky)' : 'var(--line)'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span className={d.muted} style={{ fontSize: 11 }}>{WEEK_SHORT[i]}</span>
                <span className={d.serif} style={{ fontSize: 17, color: i === todayIndex ? 'var(--sky)' : 'var(--ink)' }}>{day.getDate()}</span>
                {markers
                  .filter((m) => m.dayIndex === i)
                  .map((m) => (
                    <Link key={m.id} href={m.href} title={`Prazo: ${m.title}`} aria-label={`Prazo: ${m.title}`} style={{ width: 7, height: 7, background: 'var(--amber)', alignSelf: 'center' }} />
                  ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, height, marginTop: 4 }}>
            <div style={{ position: 'relative' }}>
              {Array.from({ length: h1 - h0 + 1 }, (_, i) => (
                <span key={i} style={{ position: 'absolute', top: i * PX, left: 0, fontSize: 10, color: 'var(--faint)', transform: 'translateY(-5px)' }}>
                  {String(h0 + i).padStart(2, '0')}
                </span>
              ))}
            </div>
            {days.map((_, i) => (
              <div key={i} style={{ position: 'relative', background: i === todayIndex ? '#141414' : 'transparent', borderBottom: '1px solid var(--line2)' }}>
                {blocks
                  .filter((b) => b.dayIndex === i)
                  .map((b) => {
                    const start = parseMinutes(b.start);
                    const end = b.end ? parseMinutes(b.end) : start + 90;
                    return (
                      <Link
                        key={b.id}
                        href={b.href}
                        title={b.title}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: Math.round(((start - h0 * 60) / 60) * PX),
                          height: Math.max(Math.round(((end - start) / 60) * PX) - 2, 14),
                          background: b.tone.bg,
                          color: b.tone.fg,
                          border: `1px solid ${b.tone.bd}`,
                          padding: '2px 5px',
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {b.label}
                      </Link>
                    );
                  })}
                {i === todayIndex && nowTop >= 0 && nowTop <= height && (
                  <div aria-hidden="true" style={{ position: 'absolute', left: -2, right: 0, top: nowTop, height: 2, background: 'var(--ink)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// DISCIPLINAS (tabela)
// ==========================================
export interface SubjectRowView {
  id: string;
  code: string;
  name: string;
  ref: string;
  teacher: string;
  teacherRole: string;
  next: string;
  nextWhere: string;
  nextToday: boolean;
  due: string;
  dueWhen: string;
  tone: Tone;
}

const TABLE_COLS = 'minmax(0, 1.5fr) minmax(0, 1.3fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 56px';

export function FacSubjects({ rows }: { rows: SubjectRowView[] }) {
  return (
    <section id="disciplinas" style={{ display: 'flex', flexDirection: 'column', scrollMarginTop: 16, minWidth: 0 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>DISCIPLINAS</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>{rows.length} em curso</span>
      </div>
      {rows.length === 0 ? (
        <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Ainda não há disciplinas. Usa “+ Disciplina”.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: 14, fontSize: 10, letterSpacing: '0.08em', color: 'var(--mut2)', padding: '7px 0 4px' }}>
              <span>DISCIPLINA</span>
              <span>DOCENTE</span>
              <span>PRÓXIMA AULA</span>
              <span>PRÓXIMO PRAZO</span>
              <span />
            </div>
            {rows.map((s) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: 14, alignItems: 'center', minHeight: 46, borderTop: '1px solid var(--line2)', fontSize: 13 }}>
                <Link href={`/faculdade/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    className={d.round}
                    style={{ width: 28, height: 28, flexShrink: 0, background: s.tone.bg, border: `1px solid ${s.tone.bd}`, color: s.tone.fg, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {s.code.slice(0, 3)}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 16 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--mut2)', whiteSpace: 'nowrap' }}>{s.ref}</span>
                  </span>
                </Link>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'nowrap' }}>
                  <span className={d.ellipsis}>{s.teacher}</span>
                  <span style={{ fontSize: 11, color: 'var(--mut2)' }}>{s.teacherRole}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap', minWidth: 0 }}>
                  <span className={d.ellipsis} style={{ color: s.nextToday ? 'var(--sky)' : 'var(--ink)' }}>{s.next}</span>
                  <span style={{ fontSize: 11, color: 'var(--mut2)' }}>{s.nextWhere}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'nowrap' }}>
                  <span className={d.ellipsis}>{s.due}</span>
                  <span style={{ fontSize: 11, color: 'var(--mut2)' }}>{s.dueWhen}</span>
                </span>
                <Link href={`/faculdade/${s.id}`} style={{ fontSize: 12, color: 'var(--sky)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  Abrir →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ==========================================
// PAINEL LATERAL: PRAZOS + HOJE
// ==========================================
export interface DeadlineRow {
  id: string;
  kind: 'F' | 'T';
  days: number;
  title: string;
  source: string;
  date: string;
  dot: string;
  href: string;
}

type DFilter = 'todos' | 'F' | 'T';

export function FacDeadlines({
  rows,
  todaySlots,
  todayLabel,
  inputRef,
  onCreate,
  createError,
  creating,
}: {
  rows: DeadlineRow[];
  todaySlots: ClassSlot[];
  todayLabel: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCreate: (text: string) => Promise<boolean>;
  createError: string | null;
  creating: boolean;
}) {
  const [filter, setFilter] = useState<DFilter>('todos');
  const [draft, setDraft] = useState('');
  const visible = rows.filter((r) => filter === 'todos' || r.kind === filter);
  const chips: [DFilter, string][] = [
    ['todos', 'Todos'],
    ['F', 'Faculdade'],
    ['T', 'Trabalho'],
  ];
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <aside id="prazos" className={d.aside} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, padding: '14px 16px', scrollMarginTop: 16, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
        <h2 className={d.h2}>PRAZOS</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>próximos 14 dias</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map(([id, label]) => {
          const on = filter === id;
          const count = id === 'todos' ? rows.length : rows.filter((r) => r.kind === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={on}
              style={{ height: 26, padding: '0 10px', fontSize: 12, whiteSpace: 'nowrap', background: on ? 'var(--bone)' : 'transparent', color: on ? 'var(--bg)' : 'var(--ink)', border: `1px solid ${on ? 'var(--bone)' : 'var(--box2)'}` }}
            >
              {label} <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.length === 0 && <p className={d.muted} style={{ margin: '8px 0', fontSize: 13 }}>Sem prazos nos próximos 14 dias.</p>}
        {visible.map((p) => {
          const urgent = p.days <= 3;
          return (
            <Link
              key={p.id}
              href={p.href}
              style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 12, alignItems: 'center', minHeight: 58, borderBottom: '1px solid var(--line2)', background: urgent ? 'rgba(127,176,203,0.12)' : 'transparent', padding: '0 8px', margin: '0 -8px' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                <span className={d.serif} style={{ fontSize: 30, color: urgent ? 'var(--sky)' : 'var(--ink)' }}>{p.days}</span>
                <span className={d.muted} style={{ fontSize: 10 }}>{p.days === 1 ? 'dia' : 'dias'}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span className={d.ellipsis} style={{ fontSize: 13 }}>{p.title}</span>
                <span className={d.muted} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, whiteSpace: 'nowrap' }}>
                  <Dot color={p.dot} />
                  {p.source} · {p.date}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, borderBottom: '1px solid var(--line)' }}>
        <span className={d.sr}>Novo prazo</span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={creating}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== 'Enter' || !draft.trim()) return;
            if (await onCreate(draft.trim())) setDraft('');
          }}
          placeholder="+ novo prazo (ex.: TP3 SD 20 nov)"
          style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 13 }}
        />
        <kbd className={d.kbd}>P</kbd>
      </label>
      <p style={{ margin: 0, fontSize: 11, color: createError ? '#e38b7a' : 'var(--mut2)' }}>
        {createError ?? 'Título, código da disciplina e data. Fica como avaliação dessa disciplina.'}
      </p>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: 6, whiteSpace: 'nowrap' }}>
          <h2 className={d.h2}>HOJE</h2>
          <span className={d.muted} style={{ fontSize: 12 }}>{todayLabel}</span>
        </div>
        {todaySlots.length === 0 && <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 13 }}>Sem aulas hoje.</p>}
        {todaySlots.map((s) => {
          const current = nowMin >= parseMinutes(s.start) && nowMin < (s.end ? parseMinutes(s.end) : parseMinutes(s.start) + 90);
          return (
            <Link
              key={`${s.subjectId}-${s.start}`}
              href={`/faculdade/${s.subjectId}`}
              style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minHeight: 32, borderBottom: '1px solid #1f1f1f', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              <span style={{ color: current ? 'var(--sky)' : 'var(--mut)' }}>
                {s.start}
                {s.end ? `–${s.end}` : ''}
              </span>
              <span className={d.ellipsis}>{s.subjectName} · {s.typeLabel}</span>
              <span style={{ fontSize: 11, color: 'var(--mut2)' }}>{s.room ? `Sala ${s.room}` : ''}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
