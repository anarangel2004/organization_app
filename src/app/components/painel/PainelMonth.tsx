'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import { CAT_SWATCH, CAT_TONE, SectionHead, Tip } from './ui';
import {
  MONTHS_PT,
  PainelCat,
  PainelEvent,
  WEEKDAY_LONG_PT,
  addDays,
  isoKey,
} from './painelData';

const CIRCLE_COLOR: Record<PainelCat, string> = {
  fac: 'var(--petro2)',
  trab: 'var(--bone)',
  prazo: 'var(--gelo)',
  pessoal: 'var(--mut)',
};
const CIRCLE_TEXT: Record<PainelCat, string> = {
  fac: 'var(--onfill)',
  trab: 'var(--inkdark)',
  prazo: 'var(--inkdark)',
  pessoal: 'var(--inkdark)',
};

const NEW_EVENT_CATS: [PainelCat, string][] = [
  ['pessoal', 'Pessoal'],
  ['trab', 'Trabalho'],
  ['fac', 'Faculdade'],
];

function truncate(text: string, n: number): string {
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

export function PainelMonth({
  today,
  getEvents,
  onAddEvent,
  onRemoveEvent,
}: {
  today: Date;
  getEvents: (date: Date) => PainelEvent[];
  onAddEvent: (dateKey: string, title: string, time: string, cat: PainelCat) => void;
  onRemoveEvent: (localId: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [selKey, setSelKey] = useState(() => isoKey(today));
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [cat, setCat] = useState<PainelCat>('pessoal');

  const todayKey = isoKey(today);
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const firstDow = (shown.getDay() + 6) % 7; // 0 = segunda
  const gridStart = addDays(shown, -firstDow);

  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    const key = isoKey(date);
    const events = getEvents(date);
    return { date, key, events, inMonth: date.getMonth() === shown.getMonth(), col: i % 7 };
  });

  const [sy, sm, sd] = selKey.split('-').map(Number);
  const selDate = new Date(sy, sm - 1, sd);
  const selEvents = getEvents(selDate);

  const addEvent = () => {
    const t = title.trim();
    if (!t) return;
    const tm = time.trim();
    onAddEvent(selKey, t, /^\d{1,2}:\d{2}$/.test(tm) ? tm.padStart(5, '0') : '', cat);
    setTitle('');
    setTime('');
  };

  const monthName = MONTHS_PT[shown.getMonth()];

  return (
    <section className={s.inner} style={{ paddingTop: 80 }}>
      <SectionHead
        title="CALENDÁRIO MENSAL"
        aside={
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 18, color: 'var(--ink)' }}>
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Mês anterior"
              className={s.serif}
              style={{ fontStyle: 'italic', fontSize: 26, lineHeight: 1, color: 'var(--mut)' }}
            >
              ‹
            </button>
            <span
              className={s.serif}
              style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 28, lineHeight: 1, minWidth: 170, textAlign: 'center' }}
            >
              {monthName.charAt(0).toUpperCase() + monthName.slice(1)} {shown.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Mês seguinte"
              className={s.serif}
              style={{ fontStyle: 'italic', fontSize: 26, lineHeight: 1, color: 'var(--mut)' }}
            >
              ›
            </button>
            <button
              type="button"
              className={s.lnk}
              onClick={() => {
                setOffset(0);
                setSelKey(todayKey);
              }}
              style={{ fontSize: 14, marginLeft: 6 }}
            >
              Hoje
            </button>
          </span>
        }
      />

      <div className={s.grid12} style={{ marginTop: 18, rowGap: 40 }}>
        <div className={s.colMain}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className={`${s.serif} ${s.muted}`} style={{ fontStyle: 'italic', fontSize: 15, paddingBottom: 8 }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {cells.map((c) => {
              const deadline = c.events.find((e) => e.isDeadline);
              const cats = Array.from(new Set(c.events.filter((e) => !e.isDeadline).map((e) => e.cat)));
              const isToday = c.key === todayKey;
              const isSel = c.key === selKey;

              let circleBg = '';
              let textColor = c.inMonth ? 'var(--ink)' : 'var(--mut)';
              let weight = 500;
              let italic = true;
              if (deadline) {
                circleBg = CIRCLE_COLOR.prazo;
                textColor = CIRCLE_TEXT.prazo;
                weight = 700;
                italic = false;
              } else if (cats.length === 1) {
                circleBg = CIRCLE_COLOR[cats[0]];
                textColor = CIRCLE_TEXT[cats[0]];
                weight = 600;
                italic = false;
              } else if (cats.length >= 2) {
                const step = 360 / cats.length;
                circleBg = `conic-gradient(${cats
                  .map((k, i) => `${CIRCLE_COLOR[k]} ${i * step}deg, ${CIRCLE_COLOR[k]} ${(i + 1) * step}deg`)
                  .join(', ')})`;
                textColor = 'var(--inkdark)';
                weight = 600;
                italic = false;
              }

              const ring = isToday ? '0 0 0 2px var(--acc)' : isSel ? '0 0 0 1px var(--ink)' : 'none';
              const hasCircle = Boolean(circleBg) || isToday || isSel;

              const label = deadline ? truncate(deadline.title, 20) : c.events[0] ? truncate(c.events[0].title, 18) : '';
              const preview = c.events.length
                ? c.events
                    .slice(0, 4)
                    .map((e) => (e.time ? `${e.time}  ` : '') + e.title)
                    .join('\n') + (c.events.length > 4 ? `\n+ ${c.events.length - 4}` : '')
                : 'Sem eventos registados.';

              return (
                <div key={c.key} className={s.hv} style={{ borderBottom: '1px solid var(--hair2)', minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => setSelKey(c.key)}
                    aria-pressed={isSel}
                    aria-label={`${c.date.getDate()} de ${MONTHS_PT[c.date.getMonth()]}, ${c.events.length} eventos`}
                    style={{
                      width: '100%',
                      padding: '11px 8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      opacity: c.inMonth ? 1 : 0.35,
                      background: isSel && !isToday ? 'var(--hair2)' : 'transparent',
                      minWidth: 0,
                    }}
                  >
                    {hasCircle ? (
                      <span
                        className={`${s.serif} ${s.round}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          background: circleBg || 'transparent',
                          boxShadow: ring,
                          fontStyle: italic && !isToday ? 'italic' : 'normal',
                          fontWeight: isToday ? 700 : weight,
                          fontSize: 16,
                          color: circleBg ? textColor : isToday ? 'var(--acc)' : 'var(--ink)',
                        }}
                      >
                        {c.date.getDate()}
                      </span>
                    ) : (
                      <span className={s.serif} style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 21, lineHeight: '28px', color: textColor }}>
                        {c.date.getDate()}
                      </span>
                    )}
                    <span
                      className={s.hideSm}
                      style={{
                        fontSize: deadline ? 12 : 11,
                        fontWeight: deadline ? 700 : 400,
                        lineHeight: 1.25,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        minHeight: 14,
                        color: deadline ? 'var(--acc)' : 'var(--mut)',
                      }}
                    >
                      {label}
                    </span>
                  </button>
                  <Tip
                    tone={deadline ? 'm' : c.events[0] ? CAT_TONE[c.events[0].cat] : 'e'}
                    title={`${c.date.getDate()} de ${MONTHS_PT[c.date.getMonth()]}`}
                    titleSize={24}
                    style={{ ...(c.col <= 3 ? { left: 8 } : { right: 8 }), top: '100%', width: 240 }}
                  >
                    {preview}
                  </Tip>
                </div>
              );
            })}
          </div>
          <p className={s.muted} style={{ margin: '16px 0 0', fontSize: 13 }}>
            As aulas repetem-se todas as semanas a partir do horário de cada disciplina.
          </p>
        </div>

        <div className={`${s.colSide} ${s.ruleLeft}`}>
          <h3 className={s.serif} style={{ margin: 0, fontStyle: 'italic', fontWeight: 600, fontSize: 30, lineHeight: 1.1 }}>
            {WEEKDAY_LONG_PT[selDate.getDay()].replace('-feira', '')}, {selDate.getDate()} de {MONTHS_PT[selDate.getMonth()]}
          </h3>
          <span className={s.muted} style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
            {selEvents.length} {selEvents.length === 1 ? 'evento' : 'eventos'}
          </span>

          <div style={{ marginTop: 16 }}>
            {selEvents.map((ev) => {
              const sw = CAT_SWATCH[ev.cat];
              const localId = ev.id.startsWith('local-') ? ev.id.slice(6) : null;
              return (
                <div
                  key={ev.id}
                  className={s.hv}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '64px minmax(0, 1fr) auto',
                    columnGap: 12,
                    alignItems: 'baseline',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--hair2)',
                  }}
                >
                  <span className={s.serif} style={{ fontWeight: 600, fontSize: 16, lineHeight: 1 }}>{ev.time || '—'}</span>
                  {ev.href ? (
                    <Link href={ev.href} style={{ fontSize: 15, lineHeight: 1.3 }}>{ev.title}</Link>
                  ) : (
                    <span style={{ fontSize: 15, lineHeight: 1.3 }}>{ev.title}</span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {localId && (
                      <button
                        type="button"
                        onClick={() => onRemoveEvent(localId)}
                        aria-label={`Remover ${ev.title}`}
                        className={s.muted}
                        style={{ fontSize: 14, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    )}
                    <span aria-hidden="true" className={s.round} style={{ width: 8, height: 8, background: sw.bg, border: sw.border }} />
                  </span>
                  <Tip tone={CAT_TONE[ev.cat]} title={ev.title} titleSize={22} style={{ right: 0, top: 'calc(100% - 10px)', width: 260 }}>
                    {ev.desc}
                  </Tip>
                </div>
              );
            })}
            {selEvents.length === 0 && (
              <p className={s.muted} style={{ margin: '14px 0 0', fontSize: 14 }}>
                Sem eventos registados. Adiciona um abaixo.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            <label style={{ display: 'block' }}>
              <span className={s.sr}>Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addEvent();
                }}
                placeholder="Título do evento"
                className={s.lineInput}
              />
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'block', width: 76 }}>
                <span className={s.sr}>Hora</span>
                <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="14:00" inputMode="numeric" className={s.lineInput} />
              </label>
              <div role="group" aria-label="Categoria do evento" className={s.segGroup}>
                {NEW_EVENT_CATS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`${s.seg} ${s.segSm} ${cat === id ? s.segOn : ''}`}
                    aria-pressed={cat === id}
                    onClick={() => setCat(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className={s.lnk} onClick={addEvent} style={{ fontSize: 14, alignSelf: 'flex-start' }}>
              + Adicionar
            </button>
            <p className={s.muted} style={{ margin: 0, fontSize: 12 }}>
              Os eventos adicionados aqui ficam guardados só neste browser.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
