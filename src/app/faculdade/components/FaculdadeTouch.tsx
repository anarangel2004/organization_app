'use client';

// Página Faculdade em ecrãs táteis (designs "Faculdade — iPhone / iPad
// vertical / iPad horizontal"). A versão de computador está em FaculdadeDenso.

import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import d from '@/app/components/denso/denso.module.css';
import { BottomSheet, SheetLine, type DensoLayout } from '@/app/components/denso/DensoTouch';
import { useNow } from '@/app/components/painel/useLocalState';
import { parseMinutes } from '@/app/components/homeAgenda';
import { ClassSlot, SubjectRowView, WeekBlock, WeekMarker, findNext } from './FaculdadeDenso';

const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAY_CAP = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEK_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// ==========================================
// CABEÇALHO
// ==========================================
export function FacTouchHeading({
  layout,
  periodLabel,
  meta,
  avatar,
  onAddDeadline,
}: {
  layout: DensoLayout;
  periodLabel: string;
  meta: string;
  avatar?: ReactNode;
  onAddDeadline: () => void;
}) {
  if (layout === 'phone') {
    return (
      <section className={d.inner} style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em' }}>Faculdade</h1>
          {avatar}
        </div>
        <div className={d.serif} style={{ fontStyle: 'italic', fontSize: 19, color: 'var(--sky)' }}>{periodLabel}</div>
        <div className={d.muted} style={{ fontSize: 13, paddingTop: 2 }}>{meta}</div>
      </section>
    );
  }
  return (
    <section className={d.inner} style={{ minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>Faculdade</h1>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 21, color: 'var(--sky)' }}>{periodLabel}</span>
        <span className={`${d.muted} ${d.ellipsis}`} style={{ fontSize: 13, minWidth: 0 }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button type="button" className={d.btnLine} onClick={onAddDeadline}>+ Prazo</button>
        <Link href="/" className={d.btnFill}>Agenda →</Link>
      </div>
    </section>
  );
}

// ==========================================
// AGORA: próxima aula + nota média + hoje
// ==========================================
function NextClassCard({ slots, span2 }: { slots: ClassSlot[]; span2: boolean }) {
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
    <div
      style={{
        gridColumn: span2 ? 'span 2' : undefined,
        background: 'var(--bone)',
        color: 'var(--bg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 120,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <span>{head}</span>
        <span>{when}</span>
      </div>
      {next ? (
        <>
          <div className={d.serif} style={{ fontSize: 26, lineHeight: 1.05 }}>{next.slot.subjectName}</div>
          <div style={{ fontSize: 13 }}>
            {next.slot.typeLabel} · {next.slot.start}
            {next.slot.end ? `–${next.slot.end}` : ''}
            {next.slot.room ? ` · Sala ${next.slot.room}` : ''}
          </div>
          {progress > 0 && (
            <div style={{ display: 'flex', height: 3, background: 'rgba(13,13,13,0.15)' }}>
              <div style={{ width: `${Math.round(progress * 100)}%`, background: '#1e3a4c' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
            <Link
              href={`/faculdade/${next.slot.subjectId}/notebook`}
              style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
            >
              Notebook
            </Link>
            <Link
              href={`/faculdade/${next.slot.subjectId}`}
              style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', border: '1px solid rgba(13,13,13,0.4)', color: 'var(--bg)', fontSize: 13 }}
            >
              Ver disciplina →
            </Link>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13 }}>Sem horário definido. Acrescenta horários às disciplinas.</div>
      )}
    </div>
  );
}

function StatCard({ label, children, onTap }: { label: string; children: ReactNode; onTap?: () => void }) {
  return (
    <div
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={(e) => {
        if (onTap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
      style={{ borderTop: '2px solid var(--accent)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 110, minWidth: 0, cursor: onTap ? 'pointer' : undefined }}
    >
      <div className={d.label}>{label}</div>
      {children}
    </div>
  );
}

export function FacTouchAgora({
  layout,
  slots,
  average,
  todaySlots,
}: {
  layout: DensoLayout;
  slots: ClassSlot[];
  average: string;
  todaySlots: ClassSlot[];
}) {
  const phone = layout === 'phone';
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  // As duas primeiras aulas de hoje na linha principal; o resto por baixo.
  const firstTwo = todaySlots.slice(0, 2).map((s) => `${s.code} ${s.start}`).join(' · ');
  const rest = todaySlots.slice(2).map((s) => `${s.code} ${s.start}`).join(' · ');

  const stats = (
    <>
      <StatCard label="NOTA MÉDIA">
        <div className={d.serif} style={{ fontSize: 32, lineHeight: 1, color: 'var(--sky)', whiteSpace: 'nowrap' }}>{average}</div>
        <div style={{ fontSize: 13, whiteSpace: 'nowrap' }}>todas as disciplinas</div>
      </StatCard>
      <StatCard label="HOJE" onTap={phone ? () => setSheet(true) : undefined}>
        <div className={d.serif} style={{ fontSize: 32, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {todaySlots.length} <span style={{ fontSize: 16, color: 'var(--mut)' }}>{todaySlots.length === 1 ? 'bloco' : 'blocos'}</span>
        </div>
        <div className={d.ellipsis} style={{ fontSize: 13 }}>{todaySlots.length ? firstTwo : 'Sem aulas hoje'}</div>
        {rest && <div className={`${d.muted} ${d.ellipsis}`} style={{ fontSize: 12 }}>{rest}</div>}
        {phone && todaySlots.length > 0 && <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--sky)' }}>Ver tudo ›</div>}
      </StatCard>
    </>
  );

  const todaySheet = sheet && (
    <BottomSheet title={`Hoje · ${todaySlots.length} ${todaySlots.length === 1 ? 'bloco' : 'blocos'}`} onClose={closeSheet}>
      {todaySlots.length === 0 && <p style={{ margin: 0 }}>Sem aulas hoje.</p>}
      {todaySlots.map((s) => (
        <SheetLine key={`${s.subjectId}-${s.start}`} label={`${s.start}${s.end ? `–${s.end}` : ''}`}>
          <Link href={`/faculdade/${s.subjectId}`}>
            {s.subjectName} · {s.typeLabel}
            {s.room ? ` · Sala ${s.room}` : ''}
          </Link>
        </SheetLine>
      ))}
    </BottomSheet>
  );

  if (phone) {
    return (
      <section id="agora" style={{ display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 64 }}>
        {todaySheet}
        <div
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 150,
            gap: 10,
            overflowX: 'auto',
            margin: '0 calc(var(--gutter) * -1)',
            padding: '0 var(--gutter)',
            scrollbarWidth: 'none',
          }}
        >
          {stats}
        </div>
        <NextClassCard slots={slots} span2={false} />
      </section>
    );
  }

  return (
    <section id="agora" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, scrollMarginTop: 64 }}>
      <NextClassCard slots={slots} span2 />
      {stats}
    </section>
  );
}

// ==========================================
// SEMANA NO IPHONE: escolhe um dia, vê a lista
// ==========================================
export function FacPhoneWeek({
  weekNumber,
  days,
  todayIndex,
  blocks,
  markers,
}: {
  weekNumber: number;
  days: Date[];
  todayIndex: number;
  blocks: WeekBlock[];
  markers: WeekMarker[];
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked ?? (todayIndex >= 0 ? todayIndex : 0);
  const day = days[sel];
  const dayBlocks = blocks.filter((b) => b.dayIndex === sel).sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));
  const dayMarkers = markers.filter((m) => m.dayIndex === sel);

  return (
    <section id="semana" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>SEMANA {weekNumber}</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>toca num dia</span>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '10px 0' }}>
        {days.map((dt, i) => {
          const on = i === sel;
          const hasDeadline = markers.some((m) => m.dayIndex === i);
          const hasClass = blocks.some((b) => b.dayIndex === i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPicked(i)}
              aria-pressed={on}
              aria-label={`${WEEKDAY_CAP[dt.getDay()]}, ${dt.getDate()}`}
              style={{
                flex: 1,
                minWidth: 0,
                height: 58,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: on ? 'var(--bone)' : 'transparent',
                color: on ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${on ? 'var(--bone)' : i === todayIndex ? 'var(--sky)' : 'var(--line)'}`,
                padding: 0,
              }}
            >
              <span style={{ fontSize: 11 }}>{WEEK_SHORT[i]}</span>
              <span className={d.serif} style={{ fontSize: 19, lineHeight: 1 }}>{dt.getDate()}</span>
              <span
                className={d.round}
                style={{ width: 5, height: 5, background: hasDeadline ? 'var(--amber)' : hasClass ? 'var(--faint)' : 'transparent' }}
              />
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--sky)', padding: '6px 0 2px' }}>
        {WEEKDAY_CAP[day.getDay()].toUpperCase()}, {day.getDate()}
        {sel === todayIndex ? ' · HOJE' : ''}
      </div>
      {dayBlocks.length === 0 && dayMarkers.length === 0 && (
        <p className={d.muted} style={{ margin: '8px 0 0', fontSize: 14 }}>Sem aulas neste dia.</p>
      )}
      {dayMarkers.map((m) => (
        <Link
          key={m.id}
          href={m.href}
          style={{ display: 'grid', gridTemplateColumns: '58px 6px minmax(0, 1fr)', gap: 12, alignItems: 'stretch', minHeight: 56, borderBottom: '1px solid var(--line2)', padding: '8px 0' }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, alignSelf: 'center' }}>Prazo</span>
          <span style={{ background: 'var(--amber)' }} />
          <span className={d.wrapPhone} style={{ fontSize: 15, alignSelf: 'center' }}>{m.title}</span>
        </Link>
      ))}
      {dayBlocks.map((b) => (
        <Link
          key={b.id}
          href={b.href}
          style={{ display: 'grid', gridTemplateColumns: '58px 6px minmax(0, 1fr)', gap: 12, alignItems: 'stretch', minHeight: 56, borderBottom: '1px solid var(--line2)', padding: '8px 0' }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{b.start}</span>
            <span style={{ color: 'var(--mut2)' }}>{b.end}</span>
          </span>
          <span style={{ background: b.tone.bg, border: `1px solid ${b.tone.bd}` }} />
          <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 15 }}>{b.label}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

// ==========================================
// DISCIPLINAS EM CARTÕES (iPhone: 1 coluna, iPad vertical: 2)
// ==========================================
export function FacSubjectCards({ rows, columns }: { rows: SubjectRowView[]; columns: 1 | 2 }) {
  return (
    <section id="disciplinas" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 64 }}>
      <div className={d.sectionHead}>
        <h2 className={d.h2}>DISCIPLINAS</h2>
        <span className={d.muted} style={{ fontSize: 12 }}>{rows.length} em curso</span>
      </div>
      {rows.length === 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 14 }}>Ainda não há disciplinas.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 10, paddingTop: 10 }}>
        {rows.map((s) => (
          <Link key={s.id} href={`/faculdade/${s.id}`} style={{ border: '1px solid #262626', background: 'var(--panel2)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                className={d.round}
                style={{ width: 34, height: 34, flexShrink: 0, background: s.tone.bg, border: `1px solid ${s.tone.bd}`, color: s.tone.fg, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {s.code.slice(0, 3)}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className={d.serif} style={{ fontSize: 18, lineHeight: 1.2 }}>{s.name}</span>
                <span style={{ fontSize: 12, color: 'var(--mut2)' }}>{[s.teacher !== '—' ? s.teacher : null, s.ref].filter(Boolean).join(' · ')}</span>
              </span>
            </span>
            <span style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
              <span style={{ color: 'var(--mut)', flexShrink: 0 }}>Próx. aula</span>
              <span style={{ color: s.nextToday ? 'var(--sky)' : 'var(--ink)', textAlign: 'right' }}>
                {s.next}
                {s.nextWhere ? ` · ${s.nextWhere}` : ''}
              </span>
            </span>
            <span style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--mut)', flexShrink: 0 }}>Prazo</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', textAlign: 'right' }}>
                {s.dueTag && <span className={d.tag} style={{ padding: '2px 6px' }}>{s.dueTag}</span>}
                {s.dueWhen}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
