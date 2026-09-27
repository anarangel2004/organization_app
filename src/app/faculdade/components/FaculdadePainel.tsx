'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import s from '@/app/components/painel/painel.module.css';
import { SectionHead, Tip } from '@/app/components/painel/ui';
import { useNow } from '@/app/components/painel/useLocalState';
import { WEEKDAY_SHORT_PT, addDays, isoKey, shortDate } from '@/app/components/painel/painelData';
import { parseMinutes } from '@/app/components/homeAgenda';

// Tons por disciplina (ordem fixa por código), como no design.
export interface SubjectTone {
  bg: string;
  fg: string;
  tc: string;
  border?: string;
}

export const SUBJECT_TONES: SubjectTone[] = [
  { bg: 'var(--navy)', fg: 'var(--onfill)', tc: 'var(--petro)' },
  { bg: 'var(--petro)', fg: 'var(--onfill)', tc: 'var(--petro2)' },
  { bg: 'var(--petro2)', fg: 'var(--onfill)', tc: 'var(--petro2)' },
  { bg: 'var(--midblue)', fg: 'var(--inkdark)', tc: 'var(--midblue)' },
  { bg: 'var(--gelo)', fg: 'var(--inkdark)', tc: 'var(--gelo)' },
  { bg: 'var(--bone)', fg: 'var(--inkdark)', tc: 'var(--bone)' },
];
export const OVERFLOW_TONE: SubjectTone = {
  bg: 'transparent',
  fg: 'var(--ink)',
  tc: 'var(--mut)',
  border: '1px solid var(--ink)',
};
export const WORK_TONE: SubjectTone = { bg: 'var(--hair2)', fg: 'var(--ink)', tc: 'var(--mut)' };

function tcStyle(tc: string): CSSProperties {
  return { ['--tc' as string]: tc } as CSSProperties;
}

function Dot({ tone, size }: { tone: SubjectTone; size: number }) {
  return (
    <span
      aria-hidden="true"
      className={s.round}
      style={{ flex: 'none', display: 'inline-block', width: size, height: size, background: tone.bg, border: tone.border }}
    />
  );
}

// ==========================================
// ABERTURA: título, números e próxima aula
// ==========================================
export interface ClassSlot {
  subjectId: string;
  subjectName: string;
  typeLabel: string;
  dayNum: number;
  start: string;
  end: string;
  room: string;
}

export interface FacStat {
  value: string;
  label: string;
}

function nextSlot(slots: ClassSlot[], now: Date) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: { slot: ClassSlot; offset: number; start: number; end: number } | null = null;
  for (const slot of slots) {
    const start = parseMinutes(slot.start);
    const end = slot.end ? parseMinutes(slot.end) : start + 90;
    let offset = (slot.dayNum - now.getDay() + 7) % 7;
    if (offset === 0 && nowMin >= end) offset = 7;
    if (!best || offset < best.offset || (offset === best.offset && start < best.start)) {
      best = { slot, offset, start, end };
    }
  }
  return best;
}

export function FacHero({ stats, slots }: { stats: FacStat[]; slots: ClassSlot[] }) {
  const now = useNow(30_000);
  const next = nextSlot(slots, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let head = 'Próxima aula';
  let status = '';
  let progress: number | null = null;
  if (next) {
    if (next.offset === 0 && nowMin >= next.start) {
      head = 'Aula em curso';
      status = `termina em ${next.end - nowMin} min`;
      progress = (nowMin - next.start) / (next.end - next.start);
    } else if (next.offset === 0) {
      const diff = next.start - nowMin;
      status = diff < 60 ? `em ${diff} min` : `hoje, em ${Math.floor(diff / 60)} h ${String(diff % 60).padStart(2, '0')}`;
    } else if (next.offset === 1) {
      status = 'amanhã';
    } else {
      status = `${WEEKDAY_SHORT_PT[next.slot.dayNum].toLowerCase()}, daqui a ${next.offset} dias`;
    }
  }

  return (
    <section className={s.inner} style={{ marginTop: 32 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 40,
          borderTop: '1px solid var(--hair)',
          paddingTop: 28,
        }}
      >
        <div style={{ flex: '1 1 480px', maxWidth: 640, minWidth: 0 }}>
          <h1 className={s.display} style={{ fontSize: 'clamp(56px, 10.5vw, 152px)', lineHeight: 0.86, letterSpacing: '-.04em' }}>
            FACULDADE
          </h1>
          <div style={{ display: 'flex', gap: '24px 40px', flexWrap: 'wrap', marginTop: 32 }}>
            {stats.map((st) => (
              <div key={st.label}>
                <span className={s.serif} style={{ display: 'block', fontWeight: 600, fontSize: 38, lineHeight: 1, color: 'var(--acc)' }}>
                  {st.value}
                </span>
                <span className={s.muted} style={{ display: 'block', marginTop: 6, fontSize: 13 }}>{st.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 'min(620px, 100%)', background: 'var(--bone)', color: 'var(--inkdark)', padding: 'clamp(22px, 2.2vw, 32px)' }}>
          {next ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{head}</span>
                <span style={{ fontSize: 14, color: 'var(--subdark)' }}>{status}</span>
              </div>
              <h2 className={s.serif} style={{ margin: '16px 0 0', fontWeight: 600, fontSize: 'clamp(30px, 2.9vw, 42px)', lineHeight: 1.05 }}>
                {next.slot.subjectName}
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 16, color: 'var(--subdark)' }}>
                {next.slot.typeLabel} · {next.slot.start}
                {next.slot.end ? ` às ${next.slot.end}` : ''} · {next.slot.room ? `Sala ${next.slot.room}` : 'Sala a definir'}
              </p>
              {progress !== null && (
                <div style={{ height: 6, background: 'rgba(12,12,12,.16)', marginTop: 24 }}>
                  <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: 'var(--navy)' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, marginTop: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href={`/faculdade/${next.slot.subjectId}/notebook`} className={s.btnDark} style={{ padding: '11px 20px' }}>
                  Notebook
                </Link>
                <Link href={`/faculdade/${next.slot.subjectId}`} className={s.lnk} style={{ fontSize: 14 }}>
                  Ver disciplina →
                </Link>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Próxima aula</span>
              <h2 className={s.serif} style={{ margin: '16px 0 0', fontWeight: 600, fontSize: 34, lineHeight: 1.05 }}>
                Sem horário definido
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 16, color: 'var(--subdark)' }}>
                Acrescenta os horários ao criar ou editar uma disciplina.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ==========================================
// PRÓXIMOS 7 DIAS
// ==========================================
export interface UpcomingItem {
  id: string;
  date: Date;
  title: string;
  subtitle: string;
  desc: string;
  tone: SubjectTone;
  href: string;
}

export function Upcoming({ items, today }: { items: UpcomingItem[]; today: Date }) {
  return (
    <section className={s.inner} style={{ paddingTop: 56 }}>
      <SectionHead title="PRÓXIMOS 7 DIAS" aside="faculdade e trabalho" />
      {items.length === 0 ? (
        <p className={s.muted} style={{ margin: '20px 0 0', fontSize: 16 }}>Sem prazos nos próximos 7 dias.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '32px 24px', marginTop: 20 }}>
          {items.map((it) => {
            const days = Math.round((it.date.getTime() - today.getTime()) / 86400000);
            const when = days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
            return (
              <div key={it.id} className={s.hv} style={{ borderTop: '1px solid var(--hair)', paddingTop: 18 }}>
                <Link href={it.href} style={{ display: 'block', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Dot tone={it.tone} size={9} />
                    <span style={{ fontSize: 13, color: 'var(--acc)', fontWeight: 600 }}>{when}</span>
                    <span className={s.muted} style={{ fontSize: 13 }}>· {shortDate(it.date)}</span>
                  </span>
                  <span className={`${s.serif} ${s.tm}`} style={{ display: 'block', marginTop: 10, fontWeight: 600, fontSize: 26, lineHeight: 1.25 }}>
                    {it.title}
                  </span>
                  <span className={s.muted} style={{ display: 'block', marginTop: 8, fontSize: 14 }}>{it.subtitle}</span>
                </Link>
                <Tip tone="m" title={it.subtitle} titleSize={24} style={{ left: 0, top: 'calc(100% - 10px)', ...tcStyle(it.tone.tc) }}>
                  {it.desc}
                </Tip>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ==========================================
// SEMANA (horário Seg–Dom)
// ==========================================
export interface TimetableBlock {
  id: string;
  date: Date;
  start: string;
  end: string;
  label: string;
  title: string;
  desc: string;
  tone: SubjectTone;
  href: string;
}

const PX_PER_HOUR = 27;
const FIRST_HOUR = 8;
const LAST_HOUR = 24;

export function WeekTimetable({
  monday,
  today,
  weekNumber,
  blocks,
  legend,
}: {
  monday: Date;
  today: Date;
  weekNumber: number;
  blocks: TimetableBlock[];
  legend: { label: string; tone: SubjectTone }[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const todayKey = isoKey(today);
  const height = (LAST_HOUR - FIRST_HOUR) * PX_PER_HOUR;

  return (
    <section className={s.inner} style={{ paddingTop: 64 }}>
      <SectionHead title={`SEMANA ${weekNumber}`} aside="segunda a domingo" />
      <div style={{ overflowX: 'auto', margin: '0 calc(var(--gutter) * -1)', padding: '0 var(--gutter)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))', columnGap: 10, marginTop: 18, minWidth: 720 }}>
          <div>
            <div style={{ height: 64 }} />
            <div style={{ position: 'relative', height }}>
              {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                <span
                  key={i}
                  className={`${s.serif} ${s.muted}`}
                  style={{ position: 'absolute', left: 0, top: i * PX_PER_HOUR - 9, fontSize: 13 }}
                >
                  {String(FIRST_HOUR + i).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>

          {days.map((day, di) => {
            const isToday = isoKey(day) === todayKey;
            const dayBlocks = blocks.filter((b) => isoKey(b.date) === isoKey(day));
            const tipSide = di < 5 ? { left: 'calc(100% + 8px)' } : { right: 'calc(100% + 8px)' };
            return (
              <div key={isoKey(day)} style={{ minWidth: 0 }}>
                <div
                  style={{
                    height: 64,
                    borderBottom: '1px solid var(--hair)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    paddingBottom: 8,
                  }}
                >
                  <span className={s.muted} style={{ fontSize: 13 }}>{WEEKDAY_SHORT_PT[day.getDay()]}</span>
                  <span className={s.serif} style={{ fontWeight: 600, fontSize: 26, lineHeight: 1, color: isToday ? 'var(--acc)' : 'var(--ink)' }}>
                    {day.getDate()}
                  </span>
                </div>
                <div
                  style={{
                    position: 'relative',
                    height,
                    backgroundImage: 'linear-gradient(to bottom, var(--hair2) 1px, transparent 1px)',
                    backgroundSize: `100% ${PX_PER_HOUR}px`,
                  }}
                >
                  {dayBlocks.map((b) => {
                    const start = Math.max(parseMinutes(b.start), FIRST_HOUR * 60);
                    const end = Math.min(b.end ? parseMinutes(b.end) : start + 90, LAST_HOUR * 60);
                    const top = ((start - FIRST_HOUR * 60) / 60) * PX_PER_HOUR + 1;
                    const h = Math.max(((end - start) / 60) * PX_PER_HOUR - 2, 12);
                    return (
                      <div key={b.id} className={s.hv} style={{ position: 'absolute', left: 0, right: 2, top, height: h }}>
                        <Link
                          href={b.href}
                          aria-label={`${b.title}, ${b.start}${b.end ? ` às ${b.end}` : ''}`}
                          style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            padding: h < 20 ? '0 6px' : '4px 6px',
                            background: b.tone.bg,
                            border: b.tone.border,
                            color: b.tone.fg,
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1.2,
                          }}
                        >
                          {b.label}
                        </Link>
                        <Tip tone="m" title={b.title} titleSize={24} style={{ ...tipSide, top: 0, width: 240, ...tcStyle(b.tone.tc) }}>
                          {b.desc}
                        </Tip>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={s.muted} style={{ marginTop: 20, fontSize: 14, display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
        {legend.map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Dot tone={l.tone} size={12} />
            {l.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ==========================================
// DISCIPLINAS
// ==========================================
export interface SubjectCardView {
  id: string;
  initials: string;
  name: string;
  meta: string;
  summary: string;
  nextLabel: string;
  tone: SubjectTone;
}

const NOTEBOOK_TABS: [string, string][] = [
  ['TEORICAS', 'Teóricas'],
  ['PRATICAS', 'Práticas'],
  ['TESTES', 'Testes'],
];

export function SubjectGrid({ subjects }: { subjects: SubjectCardView[] }) {
  return (
    <section className={s.inner} style={{ paddingTop: 64 }}>
      <SectionHead title="DISCIPLINAS" aside={`${subjects.length} em curso`} />
      {subjects.length === 0 && (
        <p className={s.muted} style={{ margin: '20px 0 0', fontSize: 16 }}>Ainda não há disciplinas. Adiciona a primeira abaixo.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 480px), 1fr))', gap: 24, marginTop: 20 }}>
        {subjects.map((sub) => (
          <div key={sub.id} style={{ border: '1px solid var(--hair)', padding: 'clamp(18px, 1.8vw, 26px)' }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <span
                aria-hidden="true"
                className={s.round}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  flex: 'none',
                  background: sub.tone.bg,
                  border: sub.tone.border,
                  color: sub.tone.fg,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {sub.initials}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/faculdade/${sub.id}`} className={s.serif} style={{ display: 'block', fontWeight: 600, fontSize: 24, lineHeight: 1.2 }}>
                  {sub.name}
                </Link>
                <span className={s.muted} style={{ display: 'block', marginTop: 4, fontSize: 13 }}>{sub.meta}</span>
                <span className={s.muted} style={{ display: 'block', marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{sub.summary}</span>
                <span style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, flexWrap: 'wrap' }}>
                  {NOTEBOOK_TABS.map(([tab, label]) => (
                    <Link key={tab} href={`/faculdade/${sub.id}/notebook?tab=${tab}`} className={s.nl}>
                      {label}
                    </Link>
                  ))}
                </span>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: '1px solid var(--hair2)',
                  }}
                >
                  <span className={s.muted} style={{ fontSize: 13 }}>
                    Próx.: <span style={{ color: 'var(--acc)' }}>{sub.nextLabel}</span>
                  </span>
                  <Link href={`/faculdade/${sub.id}`} className={s.lnk} style={{ fontSize: 14 }}>
                    Ver dossiê →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EnterAgenda() {
  return (
    <section className={s.inner} style={{ paddingBottom: 64 }}>
      <div style={{ marginTop: 72, padding: '36px 0', borderTop: '1px solid var(--hair)', textAlign: 'center' }}>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: 'var(--bone)',
            color: 'var(--inkdark)',
            padding: '16px 38px',
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '-.01em',
          }}
        >
          Entrar na Agenda →
        </Link>
      </div>
    </section>
  );
}
