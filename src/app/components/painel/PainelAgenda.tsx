'use client';

import Link from 'next/link';
import s from './painel.module.css';
import { CAT_SWATCH, CAT_TONE, SectionHead, Swatch, Tip } from './ui';
import { CAT_LABEL, PainelCat, PainelEvent, WEEKDAY_SHORT_PT, isoKey } from './painelData';
import { parseMinutes } from '../homeAgenda';
import type { CtxFilter } from './PainelTop';

export function matchesCtx(ctx: CtxFilter, cat: PainelCat): boolean {
  return ctx === 'all' || cat === 'trab';
}

function eventEnd(ev: PainelEvent): number {
  if (!ev.time) return 24 * 60;
  return ev.until ? parseMinutes(ev.until) : parseMinutes(ev.time) + 60;
}

// ==========================================
// ÍNDICE DO DIA
// ==========================================
export function DayIndex({
  events,
  nowMinutes,
  ctx,
  dayLabel,
}: {
  events: PainelEvent[];
  nowMinutes: number;
  ctx: CtxFilter;
  dayLabel: string;
}) {
  const rows = events.filter((e) => matchesCtx(ctx, e.cat));

  return (
    <section>
      <SectionHead title="ÍNDICE DO DIA" aside={dayLabel} />
      {rows.length === 0 && (
        <p className={s.muted} style={{ margin: '22px 0 0', fontSize: 16 }}>
          {ctx === 'trab' ? 'Sem tarefas de trabalho com prazo hoje.' : 'Nada agendado para hoje.'}
        </p>
      )}
      {rows.map((ev) => {
        const start = ev.time ? parseMinutes(ev.time) : null;
        const end = eventEnd(ev);
        const active = ev.cat === 'fac' && start !== null && nowMinutes >= start && nowMinutes < end;
        const past = ev.cat === 'fac' && nowMinutes >= end;

        let status = 'Programado';
        let statusStrong = false;
        if (ev.cat === 'prazo') {
          status = 'Entrega hoje';
          statusStrong = true;
        } else if (ev.cat === 'trab') {
          status = 'Por fazer';
        } else if (active) {
          status = 'Em progresso';
          statusStrong = true;
        } else if (past) {
          status = 'Concluída';
        }

        const sub = active ? 'var(--bone)' : 'var(--mut)';
        const content = (
          <>
            <span style={{ display: 'block' }}>
              <span
                className={`${s.serif} ${s.tm}`}
                style={{ display: 'block', fontWeight: 600, fontSize: 'clamp(30px, 3vw, 44px)', lineHeight: 1, letterSpacing: '-.01em' }}
              >
                {ev.time || '—'}
              </span>
              <span style={{ display: 'block', fontSize: 14, color: sub, marginTop: 4 }}>
                {ev.time ? `até ${ev.until || '—'}` : ev.cat === 'prazo' ? 'prazo do dia' : 'sem hora'}
              </span>
            </span>
            <span style={{ display: 'block', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'clamp(18px, 1.6vw, 22px)', fontWeight: 500, lineHeight: 1.2 }}>{ev.title}</span>
              <span style={{ display: 'block', fontSize: 15, color: sub, marginTop: 4 }}>
                {CAT_LABEL[ev.cat]}, {ev.place}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: statusStrong ? 600 : 400,
                  color: active ? 'var(--ink)' : ev.cat === 'prazo' ? 'var(--acc)' : 'var(--mut)',
                  whiteSpace: 'nowrap',
                }}
              >
                {status}
              </span>
              <Swatch cat={ev.cat} />
            </span>
          </>
        );

        const rowStyle = {
          display: 'grid',
          gridTemplateColumns: 'minmax(88px, 150px) minmax(0, 1fr) auto',
          columnGap: 24,
          alignItems: 'center',
          width: 'calc(100% + 32px)',
          margin: '0 -16px',
          padding: '22px 16px',
          background: active ? 'var(--petro)' : 'transparent',
        } as const;

        return (
          <div key={ev.id} className={s.hv} style={{ borderBottom: '1px solid var(--hair)' }}>
            {ev.href ? (
              <Link href={ev.href} style={rowStyle}>{content}</Link>
            ) : (
              <div style={rowStyle}>{content}</div>
            )}
            {active && ev.subjectId && (
              <Link
                href={`/faculdade/${ev.subjectId}/notebook`}
                className={s.lnk}
                style={{ position: 'absolute', right: 0, bottom: 12, fontSize: 14 }}
              >
                Abrir notas
              </Link>
            )}
            <Tip tone={CAT_TONE[ev.cat]} title={ev.title} style={{ right: 0, top: 'calc(100% - 18px)', width: 340 }}>
              {ev.desc}
            </Tip>
          </div>
        );
      })}
    </section>
  );
}

// ==========================================
// GRELHA SEMANAL
// ==========================================
export interface WeekColumn {
  date: Date;
  events: PainelEvent[];
}

const PX_PER_HOUR = 22;

export function WeekGrid({
  columns,
  today,
  weekNumber,
  ctx,
}: {
  columns: WeekColumn[];
  today: Date;
  weekNumber: number;
  ctx: CtxFilter;
}) {
  const todayKey = isoKey(today);
  const timed = columns.flatMap((c) => c.events.filter((e) => e.time));
  const blockCount = columns.reduce((n, c) => n + c.events.length, 0);

  // Janela visível: 08:00–22:00 por omissão, alargada se houver aulas fora dela.
  let startHour = 8;
  let endHour = 22;
  timed.forEach((e) => {
    startHour = Math.min(startHour, Math.floor(parseMinutes(e.time) / 60));
    endHour = Math.max(endHour, Math.ceil(eventEnd(e) / 60));
  });
  endHour = Math.min(endHour, 24);
  const height = (endHour - startHour) * PX_PER_HOUR;
  const n = columns.length;

  return (
    <section>
      <SectionHead title={`SEMANA ${weekNumber}`} aside={`${blockCount} ${blockCount === 1 ? 'bloco' : 'blocos'}`} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: 8, marginTop: 14 }}>
        {columns.map((col, ci) => {
          const isToday = isoKey(col.date) === todayKey;
          const tint = isToday ? 'rgba(240,236,228,.045)' : undefined;
          const untimed = col.events.filter((e) => !e.time);
          const tipSide = ci < Math.ceil(n / 2) ? { left: 'calc(100% + 10px)' } : { right: 'calc(100% + 10px)' };

          return (
            <div key={isoKey(col.date)} style={{ minWidth: 0 }}>
              <div
                style={{
                  height: 64,
                  borderBottom: '1px solid var(--hair)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  paddingBottom: 8,
                  paddingLeft: 2,
                  background: tint,
                }}
              >
                <span className={s.muted} style={{ fontSize: 14 }}>{WEEKDAY_SHORT_PT[col.date.getDay()]}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    className={s.serif}
                    style={{ fontWeight: 600, fontSize: 28, lineHeight: 1, color: isToday ? 'var(--acc)' : undefined }}
                  >
                    {col.date.getDate()}
                  </span>
                  {untimed.map((ev) => (
                    <span
                      key={ev.id}
                      className={`${s.hv} ${s.dimmable} ${matchesCtx(ctx, ev.cat) ? '' : s.dimmed}`}
                      tabIndex={0}
                      aria-label={`${CAT_LABEL[ev.cat]}: ${ev.title}`}
                      style={{ display: 'inline-flex' }}
                    >
                      <Swatch cat={ev.cat} size={9} />
                      <Tip tone={CAT_TONE[ev.cat]} title={ev.title} style={{ ...tipSide, top: 0, width: 250 }}>
                        {ev.desc}
                      </Tip>
                    </span>
                  ))}
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  height,
                  backgroundImage: 'linear-gradient(to bottom, var(--hair2) 1px, transparent 1px)',
                  backgroundSize: `100% ${PX_PER_HOUR * 2}px`,
                  backgroundColor: tint,
                }}
              >
                {col.events
                  .filter((e) => e.time)
                  .map((ev) => {
                    const startMin = parseMinutes(ev.time);
                    const top = ((startMin - startHour * 60) / 60) * PX_PER_HOUR + 1;
                    const h = Math.max(((eventEnd(ev) - startMin) / 60) * PX_PER_HOUR - 3, 22);
                    const sw = CAT_SWATCH[ev.cat];
                    const outline = ev.cat === 'pessoal';
                    return (
                      <div
                        key={ev.id}
                        className={`${s.hv} ${s.dimmable} ${matchesCtx(ctx, ev.cat) ? '' : s.dimmed}`}
                        style={{ position: 'absolute', left: 0, right: 0, top, height: h }}
                      >
                        {(() => {
                          const blockStyle = {
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            background: outline ? 'transparent' : sw.bg,
                            border: outline ? '1px solid var(--bone)' : undefined,
                            color: sw.fg,
                            padding: outline ? '2px 6px' : '3px 7px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            gap: 1,
                          } as const;
                          const inner = (
                            <>
                              <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{ev.time}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  lineHeight: 1.1,
                                  opacity: 0.82,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                }}
                              >
                                {ev.title}
                              </span>
                            </>
                          );
                          const label = `${ev.title}, ${ev.time}${ev.until ? ` às ${ev.until}` : ''}`;
                          return ev.href ? (
                            <Link href={ev.href} aria-label={label} style={blockStyle}>{inner}</Link>
                          ) : (
                            <div aria-label={label} tabIndex={0} style={blockStyle}>{inner}</div>
                          );
                        })()}
                        <Tip tone={CAT_TONE[ev.cat]} title={ev.title} style={{ ...tipSide, top: 0, width: 250 }}>
                          {ev.desc}
                        </Tip>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
      <ul style={{ margin: '22px 0 0', padding: 0, listStyle: 'none', fontSize: 15, display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
        {(['fac', 'trab', 'prazo', 'pessoal'] as PainelCat[]).map((cat) => (
          <li key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Swatch cat={cat} />
            {CAT_LABEL[cat]}
          </li>
        ))}
      </ul>
      <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>
        {`${String(startHour).padStart(2, '0')}:00–${String(endHour).padStart(2, '0')}:00. Prazos e tarefas sem hora aparecem junto ao dia.`}
      </p>
    </section>
  );
}
