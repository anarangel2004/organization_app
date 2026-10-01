'use client';

// /estudo: o destaque "a seguir", o plano da semana em grelha (computador e
// iPad horizontal) e em lista (iPhone e iPad vertical), e as ações dos blocos.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import d from '@/app/components/denso/denso.module.css';
import { TimeField } from '@/components/ui/DateTimeFields';
import { fmtHours, isoDay, type PlanBlock, type PlanDay, type SubjectPlan } from '@/lib/studyPlan';
import type { StudySessionRow } from '@/lib/study';
import { MONTHS, Meter, WD, edgeOf, inkOn } from './EstudoView';

export type BlockAction =
  | { kind: 'done'; block: PlanBlock }
  | { kind: 'undone'; block: PlanBlock }
  | { kind: 'delete'; block: PlanBlock }
  | { kind: 'move'; block: PlanBlock; date: Date; start: string; end: string };

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const at = (date: Date, hhmm: string) => {
  const x = new Date(date);
  x.setHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)), 0, 0);
  return x;
};
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const hatch = (tone: string) => `repeating-linear-gradient(135deg, color-mix(in srgb, ${tone} 34%, transparent) 0 4px, transparent 4px 8px)`;

function dayLabel(date: Date, today: Date) {
  if (sameDay(date, today)) return 'hoje';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, tomorrow)) return 'amanhã';
  return `${WD[date.getDay()].slice(0, 3).toLowerCase()} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// ==========================================
// A SEGUIR: o bloco a decorrer ou o próximo, e o progresso
// ==========================================
export function EstudoNow({
  days,
  now,
  today,
  toneOf,
  rows,
  busy,
  onAction,
  todayDone,
  weekDone,
  weekTarget,
  streak,
  stale,
  compact,
}: {
  days: PlanDay[];
  now: Date;
  today: Date;
  toneOf: (id: string) => string;
  rows: SubjectPlan[];
  busy: boolean;
  onAction: (a: BlockAction) => void;
  todayDone: number;
  weekDone: number;
  weekTarget: number;
  streak: number;
  stale: { row: SubjectPlan; days: number | null }[];
  compact: boolean;
}) {
  const open = days
    .flatMap((day) => day.blocks.filter((b) => b.status !== 'done'))
    .map((b) => ({ b, start: at(b.date, b.start), end: at(b.date, b.end) }))
    .filter((x) => x.end > now)
    .sort((x, y) => x.start.getTime() - y.start.getTime());
  const next = open[0];
  const running = !!next && next.start <= now;
  const leftToday = open
    .filter((x) => sameDay(x.start, today))
    .reduce((n, x) => n + (x.end.getTime() - Math.max(x.start.getTime(), now.getTime())) / 3600000, 0);
  const soon = next && !running ? Math.round((next.start.getTime() - now.getTime()) / 60000) : null;
  const row = next ? rows.find((r) => r.subjectId === next.b.subjectId) : undefined;
  const tone = next ? toneOf(next.b.subjectId) : 'var(--box)';
  const prep = next && !next.b.reason.startsWith('Ritmo');

  const metric = (label: string, value: string, note: string, extra?: ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span className={d.label}>{label}</span>
      <span className={d.serif} style={{ fontSize: compact ? 24 : 28, lineHeight: 1, whiteSpace: 'nowrap' }}>{value}</span>
      {extra}
      <span className={d.ellipsis} style={{ fontSize: 12, color: 'var(--mut)' }}>{note}</span>
    </div>
  );

  return (
    <section
      aria-label="A seguir"
      style={{ border: '1px solid var(--box)', background: 'var(--panel)', display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(0, 1fr)' }}
    >
      <div style={{ display: 'flex', gap: 14, padding: compact ? 14 : '18px 20px', minWidth: 0, borderLeft: `4px solid ${next ? edgeOf(tone) : 'var(--box)'}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.08em', color: running ? 'var(--sky)' : 'var(--mut)', fontWeight: 600 }}>
            {!next
              ? 'PLANO DA SEMANA'
              : running
                ? `A DECORRER · ATÉ ÀS ${next.b.end}`
                : `A SEGUIR · ${dayLabel(next.start, today).toUpperCase()} ${next.b.start}–${next.b.end}${soon !== null && soon < 180 ? ` · DAQUI A ${soon < 60 ? `${soon} MIN` : fmtHours(soon / 60).toUpperCase()}` : ''}`}
          </span>
          {next ? (
            <>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: compact ? 15 : 16 }}>{next.b.code}</span>
                <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: compact ? 24 : 30, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{next.b.name}</span>
              </span>
              <span style={{ fontSize: 13, color: 'var(--mut)', lineHeight: 1.4 }}>
                {fmtHours(next.b.minutes / 60)} · <span style={{ color: prep ? 'var(--amber)' : undefined }}>{next.b.reason}</span>
                {row?.next && !prep ? ` · ${row.next.title} em ${row.next.days} dias` : ''}
              </span>
              <span style={{ display: 'flex', gap: 8, paddingTop: 6, flexWrap: 'wrap' }}>
                <Link href={next.b.href ?? `/faculdade/${next.b.subjectId}/notebook`} className={d.btnFill}>
                  {running ? 'Continuar no caderno →' : 'Começar →'}
                </Link>
                {running && (
                  <button type="button" className={d.btnLine} disabled={busy} onClick={() => onAction({ kind: 'done', block: next.b })}>
                    Feito ✓
                  </button>
                )}
              </span>
            </>
          ) : (
            <>
              <span className={d.serif} style={{ fontSize: compact ? 22 : 26, lineHeight: 1.15 }}>Sem blocos por fazer esta semana.</span>
              <span style={{ fontSize: 13, color: 'var(--mut)' }}>Quando quiseres estudar, abre o caderno: o tempo conta sozinho.</span>
              <span style={{ paddingTop: 6 }}>
                <Link href="/faculdade" className={d.btnLine}>Abrir um caderno →</Link>
              </span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          padding: compact ? '12px 14px 14px' : '18px 20px',
          alignContent: 'center',
          borderTop: compact ? '1px solid var(--line)' : undefined,
          borderLeft: compact ? undefined : '1px solid var(--line)',
        }}
      >
        {metric('HOJE', fmtHours(todayDone), leftToday > 0.05 ? `faltam ${fmtHours(leftToday)}` : todayDone > 0 ? 'plano cumprido' : 'nada planeado')}
        {metric(
          'SEMANA',
          fmtHours(weekDone),
          `de ${fmtHours(weekTarget)}`,
          <span style={{ paddingTop: 2 }}>
            <Meter done={weekDone} target={weekTarget} />
          </span>
        )}
        {metric('SEGUIDOS', `${streak} ${streak === 1 ? 'dia' : 'dias'}`, streak ? 'a estudar' : 'começa hoje')}
      </div>

      {stale.length > 0 && (
        <div
          role="status"
          style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', padding: compact ? '8px 14px' : '8px 20px', display: 'flex', gap: '4px 14px', flexWrap: 'wrap', fontSize: 12 }}
        >
          <span style={{ color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.04em' }}>+7 DIAS SEM ESTUDO</span>
          {stale.map(({ row: r, days: n }) => (
            <Link key={r.subjectId} href={`/faculdade/${r.subjectId}/notebook`} style={{ whiteSpace: 'nowrap' }}>
              <strong style={{ fontWeight: 600 }}>{r.code}</strong> <span className={d.muted}>{n === null ? 'nunca' : `${n} dias`}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ==========================================
// AÇÕES DE UM BLOCO (grelha e lista)
// ==========================================
function MoveForm({ block, days, onSave, onCancel }: { block: PlanBlock; days: PlanDay[]; onSave: (date: Date, start: string, end: string) => void; onCancel: () => void }) {
  const [dayKey, setDayKey] = useState(block.date.toDateString());
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end);
  const invalid = !start || !end || end <= start;
  return (
    <div className={d.slot} style={{ borderColor: 'var(--box2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <select className={d.input} aria-label="Dia" value={dayKey} onChange={(e) => setDayKey(e.target.value)}>
          {days.map((dd) => (
            <option key={dd.date.toDateString()} value={dd.date.toDateString()}>
              {WD[dd.date.getDay()]}, {dd.date.getDate()} {MONTHS[dd.date.getMonth()]}
            </option>
          ))}
        </select>
        <TimeField className={d.input} invalidClassName={d.inputInvalid} value={start} onChange={setStart} aria-label="Início" />
        <TimeField className={d.input} invalidClassName={d.inputInvalid} value={end} onChange={setEnd} aria-label="Fim" />
      </div>
      {invalid && <span className={d.errorText}>O fim tem de ser depois do início.</span>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={onCancel}>Cancelar</button>
        <button
          type="button"
          className={`${d.btnFill} ${d.sm}`}
          disabled={invalid}
          onClick={() => onSave(days.find((dd) => dd.date.toDateString() === dayKey)?.date ?? block.date, start, end)}
        >
          Mover
        </button>
      </div>
    </div>
  );
}

function BlockActions({
  block,
  started,
  busy,
  onMove,
  onAction,
}: {
  block: PlanBlock;
  started: boolean;
  busy: boolean;
  onMove: () => void;
  onAction: (a: BlockAction) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const done = block.status === 'done';
  return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {!done && (
        <Link href={block.href ?? `/faculdade/${block.subjectId}/notebook`} className={`${d.btnFill} ${d.sm}`}>
          Começar →
        </Link>
      )}
      {started && (
        <button
          type="button"
          className={`${d.btnLine} ${d.sm}`}
          disabled={busy}
          onClick={() => onAction({ kind: done ? 'undone' : 'done', block })}
          title={done ? 'Voltar a marcar por fazer' : 'Se o caderno não contou este tempo, fica registado como sessão manual'}
        >
          {done ? 'Desfazer ✓' : 'Feito ✓'}
        </button>
      )}
      {!done && (
        <button type="button" className={`${d.btnGhost} ${d.sm}`} disabled={busy} onClick={onMove}>
          Mover
        </button>
      )}
      {!done && (
        <button
          type="button"
          className={`${d.btnGhost} ${d.sm}`}
          disabled={busy}
          onClick={() => {
            if (confirm) {
              setConfirm(false);
              onAction({ kind: 'delete', block });
            } else setConfirm(true);
          }}
          onBlur={() => setConfirm(false)}
          style={confirm ? { color: '#e38b7a', borderColor: '#e38b7a' } : undefined}
        >
          {confirm ? 'Apagar?' : 'Apagar'}
        </button>
      )}
    </span>
  );
}

// Cabeçalho comum: totais, legenda, refazer, avisos.
function PlanHead({
  days,
  fixed,
  busy,
  error,
  unplaced,
  onRedo,
  legend,
}: {
  days: PlanDay[];
  fixed: boolean;
  busy: boolean;
  error: string | null;
  unplaced: { subjectId: string; code: string; minutes: number }[];
  onRedo: () => void;
  legend: boolean;
}) {
  const open = days.flatMap((dd) => dd.blocks.filter((b) => b.status !== 'done'));
  const total = open.reduce((n, b) => n + b.minutes, 0);
  return (
    <>
      <div className={d.sectionHead} style={{ flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 className={d.h2}>PLANO DA SEMANA</h2>
          <span className={d.muted} style={{ fontSize: 12 }}>
            {total ? `${fmtHours(total / 60)} por fazer em ${open.length} ${open.length === 1 ? 'bloco' : 'blocos'}` : 'nada por fazer'}
            {fixed ? ' · fixado' : ' · sugestão'}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {legend && (
            <span className={d.muted} style={{ display: 'inline-flex', gap: 12, fontSize: 11 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, border: '1px dashed var(--sky)', background: hatch('#7fb0cb') }} />
                planeado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, background: 'var(--sky)' }} />
                estudado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, background: hatch('#8a857d'), border: '1px solid #333' }} />
                ocupado
              </span>
            </span>
          )}
          {fixed && (
            <button
              type="button"
              className={`${d.btnGhost} ${d.xs}`}
              onClick={onRedo}
              disabled={busy}
              title="Apaga as mudanças por fazer e volta à sugestão calculada (os blocos feitos ficam)"
            >
              Refazer plano
            </button>
          )}
        </span>
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#e38b7a' }}>{error}</p>}
      {unplaced.length > 0 && !fixed && (
        <p role="status" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>
          Sem espaço para {unplaced.map((u) => `${fmtHours(u.minutes / 60)} de ${u.code}`).join(', ')}. Alarga a disponibilidade ou o máximo por dia nas definições.
        </p>
      )}
    </>
  );
}

const PLAN_NOTE_FIXED = 'Plano fixado: as tuas mudanças ficam guardadas. Avaliações novas só entram com “Refazer plano”.';
const PLAN_NOTE_FREE =
  'Sugestão: encaixada nos espaços livres (sem aulas, testes, turnos e períodos indisponíveis), primeiro as disciplinas com avaliação mais perto. Ao mexer num bloco, o plano fica fixado.';

// ==========================================
// GRELHA SEMANAL (computador e iPad horizontal)
// ==========================================
const PX = 34; // altura de uma hora

type GridItem =
  | { kind: 'busy'; start: number; end: number; label: string }
  | { kind: 'session'; start: number; end: number; subjectId: string }
  | { kind: 'block'; start: number; end: number; block: PlanBlock };

export function EstudoWeekGrid({
  days,
  sessions,
  monday,
  today,
  now,
  toneOf,
  codeOf,
  fixed,
  busy,
  error,
  unplaced,
  onAction,
  onRedo,
}: {
  days: PlanDay[];
  sessions: StudySessionRow[];
  monday: Date;
  today: Date;
  now: Date;
  toneOf: (id: string) => string;
  codeOf: (id: string) => string;
  fixed: boolean;
  busy: boolean;
  error: string | null;
  unplaced: { subjectId: string; code: string; minutes: number }[];
  onAction: (a: BlockAction) => void;
  onRedo: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  // Segunda a domingo: dias passados só com o estudo feito; de hoje em
  // diante, os ocupados e os blocos do plano.
  const columns = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const plan = days.find((dd) => sameDay(dd.date, date));
    const blocks = plan?.blocks ?? [];
    const items: GridItem[] = [];
    for (const x of plan?.busy ?? []) items.push({ kind: 'busy', start: toMin(x.start), end: toMin(x.end), label: x.label });
    for (const s of sessions) {
      const st = new Date(s.started_at);
      if (!sameDay(st, date)) continue;
      const en = new Date(s.ended_at);
      const a = st.getHours() * 60 + st.getMinutes();
      const b = sameDay(en, date) ? en.getHours() * 60 + en.getMinutes() : 24 * 60;
      // O "Feito" já desenha o bloco cheio; não repetir a sessão por baixo.
      const covered = blocks.some((bl) => bl.status === 'done' && bl.subjectId === String(s.subject_id) && toMin(bl.start) < b && toMin(bl.end) > a);
      if (!covered && b > a) items.push({ kind: 'session', start: a, end: b, subjectId: String(s.subject_id) });
    }
    for (const bl of blocks) items.push({ kind: 'block', start: toMin(bl.start), end: toMin(bl.end), block: bl });
    const planned = blocks.filter((b) => b.status !== 'done').reduce((n, b) => n + b.minutes, 0);
    const studied = items.reduce((n, it) => n + (it.kind === 'session' || (it.kind === 'block' && it.block.status === 'done') ? it.end - it.start : 0), 0);
    return { date, items, planned, studied };
  });

  const all = columns.flatMap((c) => c.items.filter((it) => it.kind !== 'busy'));
  let h0 = 9;
  let h1 = 21;
  for (const it of all) {
    h0 = Math.min(h0, Math.floor(it.start / 60));
    h1 = Math.max(h1, Math.ceil(it.end / 60));
  }
  h1 = Math.min(24, h1);
  const height = (h1 - h0) * PX;
  const top = (min: number) => ((Math.max(min, h0 * 60) - h0 * 60) / 60) * PX;
  const cols = `34px repeat(7, minmax(0, 1fr))`;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const sel = selected ? days.flatMap((dd) => dd.blocks).find((b) => b.id === selected) ?? null : null;
  const started = (b: PlanBlock) => at(b.date, b.start) <= now;

  return (
    <section id="plano" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <PlanHead days={days} fixed={fixed} busy={busy} error={error} unplaced={unplaced} onRedo={onRedo} legend />

      <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, paddingTop: 12 }}>
        <span />
        {columns.map((c) => {
          const isToday = sameDay(c.date, today);
          const past = c.date < today;
          return (
            <div key={c.date.toISOString()} style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingBottom: 6, borderBottom: `1px solid ${isToday ? 'var(--sky)' : 'var(--line)'}`, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 11, color: isToday ? 'var(--sky)' : 'var(--mut)' }}>{WD[c.date.getDay()].slice(0, 3)}</span>
                <span className={d.serif} style={{ fontSize: 19, color: isToday ? 'var(--sky)' : past ? 'var(--mut)' : 'var(--ink)' }}>{c.date.getDate()}</span>
              </span>
              <span className={d.ellipsis} style={{ fontSize: 10, color: 'var(--mut2)' }}>
                {c.studied ? `${fmtHours(c.studied / 60)} feitas` : ''}
                {c.studied && c.planned ? ' · ' : ''}
                {c.planned ? `${fmtHours(c.planned / 60)} plano` : !c.studied ? (past ? '—' : 'livre') : ''}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, height, marginTop: 6 }}>
        <div style={{ position: 'relative' }}>
          {Array.from({ length: h1 - h0 + 1 }, (_, i) => (
            <span key={i} style={{ position: 'absolute', top: i * PX, right: 6, fontSize: 10, color: 'var(--faint)', transform: 'translateY(-6px)', fontVariantNumeric: 'tabular-nums' }}>
              {String(h0 + i).padStart(2, '0')}
            </span>
          ))}
        </div>
        {columns.map((c) => {
          const isToday = sameDay(c.date, today);
          return (
            <div
              key={c.date.toISOString()}
              style={{
                position: 'relative',
                background: isToday ? '#141414' : 'transparent',
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${PX - 1}px, #1c1c1c ${PX - 1}px ${PX}px)`,
                borderBottom: '1px solid var(--line2)',
              }}
            >
              {c.items.map((it, i) => {
                const y = top(it.start);
                const h = Math.max(14, top(it.end) - y - 2);
                if (it.kind === 'busy') {
                  return (
                    <div
                      key={`b${i}`}
                      title={`${it.label} · ${String(Math.floor(it.start / 60)).padStart(2, '0')}:${String(it.start % 60).padStart(2, '0')}`}
                      style={{ position: 'absolute', top: y, height: h, left: 0, right: 0, background: hatch('#8a857d'), borderLeft: '2px solid #3a3a3a', overflow: 'hidden', padding: '2px 4px', fontSize: 10, color: 'var(--mut2)', lineHeight: 1.2 }}
                    >
                      {h >= 22 ? it.label : ''}
                    </div>
                  );
                }
                if (it.kind === 'session') {
                  const tone = toneOf(it.subjectId);
                  return (
                    <div
                      key={`s${i}`}
                      title={`${codeOf(it.subjectId)} · estudado ${fmtHours((it.end - it.start) / 60)}`}
                      style={{ position: 'absolute', top: y, height: h, left: 0, right: 0, background: tone, color: inkOn(tone), overflow: 'hidden', padding: '2px 5px', fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}
                    >
                      {codeOf(it.subjectId)}
                    </div>
                  );
                }
                const b = it.block;
                const tone = toneOf(b.subjectId);
                const done = b.status === 'done';
                const missed = !done && at(b.date, b.end) < now;
                const isSel = selected === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setMoving(false);
                      setSelected(isSel ? null : b.id);
                    }}
                    aria-pressed={isSel}
                    aria-label={`${b.code} ${b.start}–${b.end}${done ? ', feito' : ''}`}
                    style={{
                      position: 'absolute',
                      top: y,
                      height: h,
                      left: 0,
                      right: 0,
                      zIndex: isSel ? 3 : 2,
                      background: done ? tone : hatch(edgeOf(tone)),
                      color: done ? inkOn(tone) : 'var(--ink)',
                      border: done ? 0 : `1px dashed ${edgeOf(tone)}`,
                      outline: isSel ? '2px solid var(--ink)' : undefined,
                      outlineOffset: 1,
                      opacity: missed ? 0.45 : 1,
                      padding: '3px 5px',
                      textAlign: 'left',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      fontSize: 11,
                      lineHeight: 1.2,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {b.code}
                      {done ? ' ✓' : ''}
                    </span>
                    {h >= 34 && <span style={{ fontSize: 10, opacity: 0.8, whiteSpace: 'nowrap' }}>{b.start}–{b.end}</span>}
                  </button>
                );
              })}
              {isToday && nowMin >= h0 * 60 && nowMin <= h1 * 60 && (
                <span aria-hidden="true" style={{ position: 'absolute', left: -3, right: 0, top: top(nowMin), height: 0, borderTop: '2px solid var(--sky)', zIndex: 4 }}>
                  <span style={{ position: 'absolute', left: 0, top: -4, width: 6, height: 6, borderRadius: '50%', background: 'var(--sky)' }} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detalhe do bloco escolhido: as ações ficam aqui, não em cima da grelha. */}
      <div style={{ marginTop: 12, minHeight: 52 }}>
        {sel ? (
          <div style={{ border: '1px solid var(--box)', borderLeft: `4px solid ${edgeOf(toneOf(sel.subjectId))}`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <strong style={{ fontWeight: 700 }}>{sel.code}</strong>
                  <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 17 }}>{sel.name}</span>
                  {sel.status === 'done' && <span style={{ fontSize: 11, color: 'var(--sky)' }}>feito</span>}
                </span>
                <span style={{ fontSize: 12, color: 'var(--mut)' }}>
                  {dayLabel(sel.date, today)} · {sel.start}–{sel.end} · {fmtHours(sel.minutes / 60)} ·{' '}
                  <span style={{ color: sel.reason.startsWith('Ritmo') || sel.status === 'done' ? undefined : 'var(--amber)' }}>{sel.reason}</span>
                </span>
              </span>
              <BlockActions block={sel} started={started(sel)} busy={busy} onMove={() => setMoving((v) => !v)} onAction={(a) => {
                if (a.kind === 'delete') setSelected(null);
                onAction(a);
              }} />
            </div>
            {moving && (
              <MoveForm
                block={sel}
                days={days}
                onCancel={() => setMoving(false)}
                onSave={(date, start, end) => {
                  setMoving(false);
                  setSelected(null);
                  onAction({ kind: 'move', block: sel, date, start, end });
                }}
              />
            )}
          </div>
        ) : (
          <p className={d.muted} style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>
            Clica num bloco para começar, mover, apagar ou marcar como feito. {fixed ? PLAN_NOTE_FIXED : PLAN_NOTE_FREE}
          </p>
        )}
      </div>
    </section>
  );
}

// ==========================================
// LISTA (iPhone e iPad vertical)
// ==========================================
export function EstudoPlanList({
  days,
  today,
  now,
  toneOf,
  fixed,
  busy,
  error,
  unplaced,
  onAction,
  onRedo,
}: {
  days: PlanDay[];
  today: Date;
  now: Date;
  toneOf: (id: string) => string;
  fixed: boolean;
  busy: boolean;
  error: string | null;
  unplaced: { subjectId: string; code: string; minutes: number }[];
  onAction: (a: BlockAction) => void;
  onRedo: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const started = (b: PlanBlock) => at(b.date, b.start) <= now;

  return (
    <section id="plano" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <PlanHead days={days} fixed={fixed} busy={busy} error={error} unplaced={unplaced} onRedo={onRedo} legend={false} />

      {days.map((day) => {
        const isToday = sameDay(day.date, today);
        const mins = day.blocks.filter((b) => b.status !== 'done').reduce((n, b) => n + b.minutes, 0);
        return (
          <div key={isoDay(day.date)} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, color: isToday ? 'var(--sky)' : 'var(--mut)' }}>
                  {isToday ? 'HOJE' : WD[day.date.getDay()].toUpperCase()}
                </span>
                <span className={d.muted} style={{ fontSize: 12 }}>{day.date.getDate()} {MONTHS[day.date.getMonth()]}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--mut2)' }}>
                {mins ? `${fmtHours(mins / 60)} de estudo` : day.freeMinutes < 30 ? 'dia cheio' : 'livre'}
              </span>
            </div>
            {day.blocks.map((b) => {
              const tone = toneOf(b.subjectId);
              const done = b.status === 'done';
              const isOpen = open === b.id;
              const running = !done && started(b) && at(b.date, b.end) > now;
              return (
                <div key={b.id} style={{ border: `1px solid ${running ? 'var(--sky)' : 'var(--box)'}`, borderLeft: `4px solid ${edgeOf(tone)}`, background: done ? 'transparent' : 'var(--panel)', opacity: done ? 0.65 : 1 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMoving(null);
                      setOpen(isOpen ? null : b.id);
                    }}
                    aria-expanded={isOpen}
                    style={{ width: '100%', display: 'grid', gridTemplateColumns: '54px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'none', border: 0, color: 'var(--ink)', textAlign: 'left' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 600 }}>{b.start}</span>
                      <span style={{ color: 'var(--mut2)' }}>{b.end}</span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                        <span style={{ fontWeight: 700 }}>{b.code}</span>
                        <span className={`${d.serif} ${d.ellipsis}`} style={{ fontSize: 16, textDecoration: done ? 'line-through' : undefined }}>{b.name}</span>
                      </span>
                      <span className={d.ellipsis} style={{ fontSize: 12, color: done || running ? 'var(--sky)' : b.reason.startsWith('Ritmo') ? 'var(--mut)' : 'var(--amber)' }}>
                        {done ? 'feito' : running ? 'a decorrer' : b.reason}
                      </span>
                    </span>
                    <span className={d.muted} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtHours(b.minutes / 60)}</span>
                  </button>
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
                      {!done && <span style={{ fontSize: 12, color: 'var(--mut)' }}>{b.reason}</span>}
                      <BlockActions block={b} started={started(b)} busy={busy} onMove={() => setMoving(moving === b.id ? null : b.id)} onAction={onAction} />
                      {moving === b.id && (
                        <MoveForm
                          block={b}
                          days={days}
                          onCancel={() => setMoving(null)}
                          onSave={(date, start, end) => {
                            setMoving(null);
                            setOpen(null);
                            onAction({ kind: 'move', block: b, date, start, end });
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <p className={d.muted} style={{ margin: '12px 0 0', fontSize: 11, lineHeight: 1.5 }}>
        Toca num bloco para começar, mover, apagar ou marcar como feito. {fixed ? PLAN_NOTE_FIXED : ''}
      </p>
    </section>
  );
}

