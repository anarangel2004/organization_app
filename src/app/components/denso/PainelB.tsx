'use client';

import { useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import d from './denso.module.css';
import { HoverBind, HoverPop, PopData, useFitInViewport } from './DensoChrome';
import { BottomSheet } from './DensoTouch';
import { useNow } from '../painel/useLocalState';
import { parseMinutes, parseDueDate } from '../homeAgenda';
import { CAT_LABEL, MONTHS_PT, PainelCat, PainelEvent, WEEKDAY_SHORT_PT, addDays, daysBetween, fmtEuro, fmtNum, isoKey, shortDate } from '../painel/painelData';
import type { HeroClass, HeroNextClass, HeroTile } from '../painel/PainelHero';
import type { WorkProject, WorkTask } from '@/lib/workData';

type Bind = (key: string, canPin?: boolean) => HoverBind;

// Cores das categorias neste design.
export const CAT_STYLE: Record<PainelCat, { bg: string; fg: string; bd: string }> = {
  fac: { bg: '#2f5f78', fg: '#efe9df', bd: '#2f5f78' },
  trab: { bg: '#d9d3c8', fg: '#0d0d0d', bd: '#d9d3c8' },
  pessoal: { bg: '#0d0d0d', fg: '#efe9df', bd: '#8a857d' },
  prazo: { bg: '#e3a857', fg: '#0d0d0d', bd: '#e3a857' },
};

export function deadlineKind(title: string): 'TESTE' | 'ENTREGA' {
  return /(teste|exame|mini|frequ|quiz)/i.test(title) ? 'TESTE' : 'ENTREGA';
}

// Cartão do dia do mês, ajustado para caber no ecrã.
function MonthPop({ style, children }: { style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitInViewport(ref);
  return (
    <div ref={ref} className={d.pop} data-hoverpin role="tooltip" onClick={(e) => e.stopPropagation()} style={style}>
      {children}
    </div>
  );
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// ==========================================
// FAIXA SUPERIOR
// ==========================================
export function TopStripB({ nextLabel, quote }: { nextLabel: string; quote: string }) {
  return (
    <div className={d.topStrip}>
      <div
        className={d.inner}
        style={{ minHeight: 36, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, paddingTop: 4, paddingBottom: 4 }}
      >
        <span>{nextLabel}</span>
        <span className={`${d.serif} ${d.hideSm}`} style={{ fontStyle: 'italic', fontSize: 15 }}>{quote}</span>
        <span />
      </div>
    </div>
  );
}

// ==========================================
// TÍTULO DO DIA
// ==========================================
export function DayTitle({
  title,
  monthLine,
  subjectsCount,
  onAddTask,
  onAddEvent,
  size = 'desktop',
  trailing,
}: {
  title: string;
  monthLine: string;
  subjectsCount: number;
  onAddTask: () => void;
  onAddEvent: () => void;
  // tablet: título de 40px e "Cadeiras (N) →"; phone: título empilhado, sem ações.
  size?: 'desktop' | 'tablet' | 'phone';
  // iPhone: avatar ao lado do título.
  trailing?: ReactNode;
}) {
  if (size === 'phone') {
    return (
      <section className={d.inner} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingTop: 10, paddingBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em' }}>{title}</h1>
          <div className={d.serif} style={{ fontStyle: 'italic', fontSize: 19, color: 'var(--sky)' }}>{monthLine}</div>
        </div>
        {trailing}
      </section>
    );
  }
  const tablet = size === 'tablet';
  return (
    <section
      className={d.inner}
      style={{ minHeight: tablet ? 76 : 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px 24px', flexWrap: 'wrap', paddingTop: 12, paddingBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: tablet ? '6px 14px' : '6px 18px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: tablet ? 40 : 52, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.04em' }}>{title}</h1>
        <span className={d.serif} style={{ fontStyle: 'italic', fontSize: tablet ? 21 : 26, color: 'var(--sky)' }}>{monthLine}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={d.btnLine} onClick={onAddTask}>+ Tarefa</button>
        <button type="button" className={d.btnLine} onClick={onAddEvent}>+ Evento</button>
        <Link href="/faculdade" className={d.btnFill}>
          {tablet ? `Cadeiras (${subjectsCount}) →` : `Ver todas as cadeiras (${subjectsCount}) →`}
        </Link>
      </div>
    </section>
  );
}

// ==========================================
// COLUNA "A PÁGINA DE HOJE"
// ==========================================
function roomLabel(room: string) {
  return room ? `Sala ${room}` : 'Sala a definir';
}

function clock(totalSeconds: number) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

export function SessionCard({
  todayClasses,
  nextClass,
}: {
  todayClasses: HeroClass[];
  nextClass: HeroNextClass | null;
}) {
  const now = useNow(1000);
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const range = (c: { start: string; end: string }) => ({
    start: parseMinutes(c.start) * 60,
    end: (c.end ? parseMinutes(c.end) : parseMinutes(c.start) + 90) * 60,
  });
  const current = todayClasses.find((c) => {
    const r = range(c);
    return nowSec >= r.start && nowSec < r.end;
  });
  const later = todayClasses.find((c) => range(c).start > nowSec);

  let head = 'SEM AULAS';
  let status = '';
  let title = 'Nenhuma aula no horário';
  let where = 'Adiciona os horários em Faculdade.';
  let big = '—';
  let note = '';
  let progress: number | null = null;
  let subjectId: string | null = null;

  if (current) {
    const r = range(current);
    head = 'SESSÃO EM CURSO';
    status = 'A DECORRER';
    title = `${current.title}: ${current.typeLabel}`;
    where = `${current.start} às ${current.end || '—'} · ${roomLabel(current.room)}`;
    big = clock(r.end - nowSec);
    progress = (nowSec - r.start) / (r.end - r.start);
    note = `${Math.round(progress * 100)}% concluída`;
    subjectId = current.subjectId;
  } else if (later) {
    head = 'PRÓXIMA SESSÃO';
    status = 'HOJE';
    title = `${later.title}: ${later.typeLabel}`;
    where = `${later.start} às ${later.end || '—'} · ${roomLabel(later.room)}`;
    big = clock(range(later).start - nowSec);
    note = 'até começar';
    subjectId = later.subjectId;
  } else if (nextClass) {
    head = 'PRÓXIMA SESSÃO';
    status = nextClass.dayLabel.toUpperCase();
    title = nextClass.title;
    where = `${nextClass.start} às ${nextClass.end || '—'} · ${roomLabel(nextClass.room)}`;
    big = nextClass.start;
    note = 'sem mais aulas hoje';
    subjectId = nextClass.subjectId;
  }

  return (
    <div id="sessao" style={{ minHeight: 250, background: 'var(--bone)', color: 'var(--bg)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap', gap: 10 }}>
        <span>{head}</span>
        <span>{status}</span>
      </div>
      <div className={d.serif} style={{ fontSize: 28, lineHeight: 1.1 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{where}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', gap: 16 }}>
        <span className={d.serif} style={{ fontSize: 52, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{big}</span>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{note}</span>
      </div>
      <div style={{ display: 'flex', height: 3, background: 'rgba(13,13,13,0.15)' }}>
        <div style={{ width: `${Math.round((progress ?? 0) * 100)}%`, background: '#2f5f78' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          href={subjectId ? `/faculdade/${subjectId}/notebook` : '/faculdade'}
          style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 14px', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
        >
          {subjectId ? 'Notebook' : 'Faculdade'}
        </Link>
      </div>
    </div>
  );
}

function SectionHeadB({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: 10, whiteSpace: 'nowrap', gap: 12 }}>
      <h2 className={d.h2lg}>{title}</h2>
      {aside !== undefined && <span className={d.muted} style={{ fontSize: 12 }}>{aside}</span>}
    </div>
  );
}

export function DayIndexB({
  events,
  nowMinutes,
  today,
  bind,
}: {
  events: PainelEvent[];
  nowMinutes: number;
  today: Date;
  bind: Bind;
}) {
  return (
    <section id="hoje" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <SectionHeadB title="ÍNDICE DO DIA" aside={`${events.length} ${events.length === 1 ? 'bloco' : 'blocos'}`} />
      {events.length === 0 && <p className={d.muted} style={{ margin: '12px 0 0', fontSize: 13 }}>Nada agendado para hoje.</p>}
      {events.map((ev) => {
        const start = ev.time ? parseMinutes(ev.time) : null;
        const end = ev.until ? parseMinutes(ev.until) : start !== null ? start + 60 : null;
        const on = ev.cat === 'fac' && start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
        const past = ev.cat === 'fac' && end !== null && nowMinutes >= end;
        const status = ev.cat === 'prazo' ? 'Entrega hoje' : ev.cat === 'trab' ? 'Por fazer' : on ? 'Em progresso' : past ? 'Concluída' : 'Programado';
        const b = bind(`i-${ev.id}`);
        const pop: PopData = {
          title: ev.title,
          tag: ev.cat === 'prazo' ? deadlineKind(ev.title) : undefined,
          lines: [
            ['Quando', `Hoje · ${ev.time ? `${ev.time}${ev.until ? `–${ev.until}` : ''}` : 'dia inteiro'}`],
            ['Onde', ev.place],
            ['Tipo', CAT_LABEL[ev.cat]],
            ['Estado', status],
          ],
          action: ev.href ? { label: 'Abrir →', href: ev.href } : undefined,
        };
        const sub = on ? '#d3e3eb' : 'var(--mut2)';
        return (
          <div key={ev.id} className={d.hoverable} data-hoverpin style={{ zIndex: b.open ? 50 : 'auto' }}>
            <button
              type="button"
              {...b.handlers}
              style={{ width: 'calc(100% + 24px)', display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr) auto', gap: 14, alignItems: 'center', minHeight: 56, border: 0, borderBottom: '1px solid var(--line2)', background: on ? '#2f5f78' : 'transparent', padding: '0 12px', margin: '0 -12px', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span className={d.serif} style={{ fontSize: 22 }}>{ev.time || '—'}</span>
                <span style={{ fontSize: 11, color: sub }}>{ev.until ? `até ${ev.until}` : ev.cat === 'prazo' ? 'prazo' : 'sem hora'}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, whiteSpace: 'nowrap' }}>
                <span className={d.ellipsis} style={{ fontSize: 14 }}>{ev.title}</span>
                <span style={{ fontSize: 12, color: sub }}>{CAT_LABEL[ev.cat]} · {ev.place}</span>
              </span>
              <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: on ? 'var(--ink)' : ev.cat === 'prazo' ? 'var(--amber)' : 'var(--mut)' }}>{status}</span>
            </button>
            {b.open && <HoverPop data={pop} hint={b.hint} style={{ width: 330, left: 'calc(100% + 40px)', top: -8 }} />}
          </div>
        );
      })}
      <span className={d.sr}>{shortDate(today)}</span>
    </section>
  );
}

export function PlanB({
  tasks,
  projects,
  today,
  pendingIds,
  onToggle,
  onAdd,
  inputRef,
  bind,
}: {
  tasks: WorkTask[];
  projects: WorkProject[];
  today: Date;
  pendingIds: Set<string>;
  onToggle: (t: WorkTask) => void;
  onAdd: (title: string, projectId: string | null) => Promise<void>;
  inputRef: RefObject<HTMLInputElement | null>;
  bind: Bind;
}) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (parseDueDate(a.due_date)?.getTime() ?? Infinity) - (parseDueDate(b.due_date)?.getTime() ?? Infinity);
  });
  const shown = sorted.slice(0, 6);

  const submit = async () => {
    let text = draft.trim();
    if (!text || adding) return;
    let projectId: string | null = null;
    const m = text.match(/^\[([^\]]+)\]\s*/);
    if (m) {
      const found = projects.find((p) => p.name.trim().toLowerCase() === m[1].trim().toLowerCase());
      if (found) {
        projectId = found.id;
        text = text.slice(m[0].length);
      }
    }
    if (!text) return;
    setAdding(true);
    try {
      await onAdd(text, projectId);
      setDraft('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section id="tarefas" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <SectionHeadB title="PLANO DE AÇÃO" aside={`${tasks.filter((t) => t.completed).length}/${tasks.length}`} />
      {shown.length === 0 && <p className={d.muted} style={{ margin: '12px 0 0', fontSize: 13 }}>Sem tarefas pendentes.</p>}
      {shown.map((t) => {
        const project = t.project_id ? projectById.get(t.project_id) : undefined;
        const due = parseDueDate(t.due_date);
        const days = due ? daysBetween(today, due) : null;
        const b = bind(`t-${t.id}`, false);
        const pop: PopData = {
          title: t.title,
          tag: days !== null && days <= 0 && !t.completed ? (days < 0 ? 'ATRASADA' : 'HOJE') : undefined,
          lines: [
            ['Área', 'Trabalho'],
            ['Projeto', project?.name || 'Sem projeto'],
            ['Prazo', due ? `${shortDate(due)}${days !== null ? ` · ${days === 0 ? 'hoje' : days < 0 ? `há ${-days} dias` : `em ${days} dias`}` : ''}` : 'Sem data'],
            ['Estado', t.completed ? 'Concluída' : 'Por fazer'],
          ],
          action: { label: 'Projetos →', href: '/trabalho' },
        };
        return (
          <div key={t.id} className={d.hoverable} data-hoverpin style={{ zIndex: b.open ? 50 : 'auto' }} {...b.handlers}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 42, borderBottom: '1px solid var(--line2)', fontSize: 14, whiteSpace: 'nowrap', color: t.completed ? 'var(--faint)' : 'var(--ink)', textDecoration: t.completed ? 'line-through' : 'none', cursor: 'pointer' }}>
              <input type="checkbox" className={d.chk} style={{ width: 16, height: 16 }} checked={t.completed} disabled={pendingIds.has(t.id)} onChange={() => onToggle(t)} />
              <span className={d.ellipsis} style={{ flexGrow: 1 }}>{t.title}</span>
              <span style={{ fontSize: 11, color: 'var(--mut2)' }}>{project?.name || ''}</span>
            </label>
            {b.open && <HoverPop data={pop} hint={b.hint} style={{ width: 320, left: 'calc(100% + 40px)', top: -8 }} />}
          </div>
        );
      })}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42, borderBottom: '1px solid var(--line)' }}>
        <span className={d.sr}>Nova tarefa</span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={adding}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="+ nova tarefa ([PROJETO] opcional)"
          style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 14 }}
        />
        <kbd className={d.kbd}>N</kbd>
      </label>
      {sorted.length > shown.length && (
        <Link href="/trabalho" style={{ marginTop: 8, fontSize: 12, color: 'var(--sky)' }}>+{sorted.length - shown.length} em Projetos →</Link>
      )}
    </section>
  );
}

export function NotesB({ notes, onAdd, onClear }: { notes: string[]; onAdd: (t: string) => void; onClear: () => void }) {
  const [draft, setDraft] = useState('');
  return (
    <section id="notas" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <SectionHeadB
        title="NOTAS EFÉMERAS"
        aside={
          notes.length > 0 ? (
            <button type="button" onClick={onClear} style={{ background: 'transparent', border: 0, color: 'var(--mut)', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
              Limpar todas
            </button>
          ) : undefined
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        {notes.map((n, i) => (
          <span key={`${i}-${n}`} style={{ fontSize: 13, border: '1px solid var(--box)', padding: '6px 10px', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{n}</span>
        ))}
        {notes.length === 0 && <span className={d.muted} style={{ fontSize: 13 }}>Sem notas.</span>}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', minHeight: 40, borderBottom: '1px solid var(--line)' }}>
        <span className={d.sr}>Lembrete rápido</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !draft.trim()) return;
            onAdd(draft.trim());
            setDraft('');
          }}
          placeholder="Lembrete rápido, Enter para guardar"
          style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 13 }}
        />
      </label>
      <span style={{ fontSize: 11, color: 'var(--mut2)' }}>Guardadas só neste browser.</span>
    </section>
  );
}

// ==========================================
// CAPTURA + VOLUMES
// ==========================================
export function CaptureBox({
  onCapture,
  captureRef,
  kbd = true,
}: {
  onCapture: (t: string) => void;
  captureRef: RefObject<HTMLTextAreaElement | null>;
  kbd?: boolean;
}) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (!text.trim()) return;
    onCapture(text.trim());
    setText('');
    setSaved(true);
  };
  return (
    <div id="captura" style={{ border: '1px solid var(--box)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flexGrow: 1 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className={d.serif} style={{ fontSize: 20 }}>Captura rápida</span>
          {kbd && <kbd className={d.kbd}>C</kbd>}
        </span>
        <textarea
          ref={captureRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Citação ou referência…"
          style={{ flexGrow: 1, minHeight: 60, resize: 'none', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 14, padding: 8 }}
        />
      </label>
      <button type="button" onClick={save} className={d.btnFill} style={{ width: '100%' }}>
        {saved ? 'Guardado nas notas' : 'Gravar nas notas'}
      </button>
    </div>
  );
}

const VOL_STYLE = [
  { background: '#386a86', color: '#f3efe7' },
  { background: '#d9d3c8', color: '#0d0d0d' },
];

// Os dois volumes (cadernos editados mais recentemente). Devolve os cartões soltos:
// quem usa decide a grelha (lado a lado, em coluna ou a deslizar no iPhone).
// linkOnly (iPhone): o cartão abre logo o caderno, sem detalhe (a faixa a deslizar cortava-o).
export function VolumeTiles({ tiles, bind, minHeight = 150, linkOnly = false }: { tiles: HeroTile[]; bind: Bind; minHeight?: number; linkOnly?: boolean }) {
  return (
    <>
      {tiles.map((t, i) => {
        if (linkOnly) {
          return (
            <Link
              key={t.subjectId}
              href={t.href}
              style={{ ...VOL_STYLE[i % 2], padding: 14, display: 'flex', flexDirection: 'column', minHeight, minWidth: 0 }}
            >
              <span style={{ fontSize: 12 }}>{t.vol}</span>
              <span className={`${d.serif} ${d.ellipsis}`} style={{ marginTop: 'auto', fontSize: 28, lineHeight: 1, maxWidth: '100%' }}>{t.name}</span>
              <span style={{ fontSize: 12, paddingTop: 6, whiteSpace: 'nowrap' }}>{t.sub}</span>
            </Link>
          );
        }
        const b = bind(`v-${t.subjectId}`);
        const [section, ...rest] = t.sub.split(' · ');
        const pop: PopData = {
          title: `${t.vol} · ${t.name}`,
          lines: [
            ['Secção', section],
            ['Editado', rest.join(' · ') || '—'],
            ['Resumo', t.tipBody],
          ],
          action: { label: 'Abrir caderno →', href: t.href },
        };
        return (
          <div key={t.subjectId} className={d.hoverable} data-hoverpin style={{ zIndex: b.open ? 50 : 'auto', minWidth: 0 }}>
            <button
              type="button"
              {...b.handlers}
              style={{ ...VOL_STYLE[i % 2], width: '100%', height: '100%', padding: minHeight < 150 ? 14 : 18, display: 'flex', flexDirection: 'column', minHeight, border: 0, textAlign: 'left' }}
            >
              <span style={{ fontSize: 12 }}>{t.vol}</span>
              <span className={`${d.serif} ${d.ellipsis}`} style={{ marginTop: 'auto', fontSize: minHeight < 150 ? 28 : 30, lineHeight: 1, maxWidth: '100%' }}>{t.name}</span>
              <span style={{ fontSize: 12, paddingTop: 6, whiteSpace: 'nowrap' }}>{t.sub}</span>
            </button>
            {b.open && <HoverPop data={pop} hint={b.hint} style={{ width: 300, top: 'calc(100% + 8px)', left: 0 }} />}
          </div>
        );
      })}
      {tiles.length < 2 && (
        <Link href="/faculdade#nova-disciplina" style={{ border: '1px dashed var(--box)', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight }}>
          <span className={d.muted} style={{ fontSize: 12 }}>Vol. {pad(tiles.length + 1)}</span>
          <span className={d.serif} style={{ fontSize: 22 }}>Nova disciplina</span>
        </Link>
      )}
    </>
  );
}

// Computador: captura (2 colunas) + os dois volumes na mesma linha.
export function CaptureAndVolumes({
  tiles,
  onCapture,
  captureRef,
  bind,
  columns = 'repeat(auto-fit, minmax(150px, 1fr))',
}: {
  tiles: HeroTile[];
  onCapture: (t: string) => void;
  captureRef: RefObject<HTMLTextAreaElement | null>;
  bind: Bind;
  columns?: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 20, alignItems: 'stretch' }}>
      <div style={{ gridColumn: columns.startsWith('repeat') ? 'span 2' : undefined, display: 'flex', minWidth: 0 }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <CaptureBox onCapture={onCapture} captureRef={captureRef} />
        </div>
      </div>
      <VolumeTiles tiles={tiles} bind={bind} />
    </div>
  );
}

// ==========================================
// SEMANA (com detalhes)
// ==========================================
export interface WeekCol {
  date: Date;
  events: PainelEvent[];
}

// Navegação entre semanas (0 = semana atual).
export interface WeekNav {
  offset: number;
  label: string; // "22 set – 28 set"
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function WeekNavButtons({ nav, big = false }: { nav: WeekNav; big?: boolean }) {
  const size = big ? 36 : 28;
  const btn = { height: size, background: 'transparent', border: '1px solid var(--box)', color: 'var(--ink)', flexShrink: 0 } as const;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button type="button" aria-label="Semana anterior" onClick={nav.onPrev} style={{ ...btn, width: size }}>‹</button>
      <button
        type="button"
        onClick={nav.onToday}
        disabled={nav.offset === 0}
        style={{ ...btn, padding: '0 10px', fontSize: 12, opacity: nav.offset === 0 ? 0.5 : 1 }}
      >
        Esta semana
      </button>
      <button type="button" aria-label="Semana seguinte" onClick={nav.onNext} style={{ ...btn, width: size }}>›</button>
    </span>
  );
}

// "29 set – 5 out · próxima": vai depois dos botões, para a largura variável
// não os empurrar ao mudar de semana.
function weekRange(nav: WeekNav) {
  const rel = nav.offset === -1 ? ' · passada' : nav.offset === 1 ? ' · próxima' : '';
  return `${nav.label}${rel}`;
}

const PX = 18;

export function WeekB({ columns, today, weekNumber, bind, nav }: { columns: WeekCol[]; today: Date; weekNumber: number; bind: Bind; nav?: WeekNav }) {
  const now = useNow(60_000);
  const timed = columns.flatMap((c) => c.events.filter((e) => e.time));
  let h0 = 9;
  let h1 = 21;
  timed.forEach((e) => {
    h0 = Math.min(h0, Math.floor(parseMinutes(e.time) / 60));
    h1 = Math.max(h1, Math.ceil((e.until ? parseMinutes(e.until) : parseMinutes(e.time) + 60) / 60));
  });
  h1 = Math.min(h1, 24);
  const height = (h1 - h0) * PX;
  const n = columns.length;
  const cols = `28px repeat(${n}, minmax(0, 1fr))`;
  const todayKey = isoKey(today);
  const nowTop = ((now.getHours() * 60 + now.getMinutes() - h0 * 60) / 60) * PX;
  const legend: [PainelCat, string][] = [
    ['fac', 'Faculdade'],
    ['trab', 'Trabalho'],
    ['pessoal', 'Pessoal'],
    ['prazo', 'Teste / entrega'],
  ];

  return (
    <section id="semana" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Título com algarismos de largura fixa: os botões não mexem ao trocar de semana. */}
          <h2 className={d.h2lg} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: '6.6em' }}>SEMANA {weekNumber}</h2>
          {nav && <WeekNavButtons nav={nav} />}
          {nav && <span className={d.muted} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{weekRange(nav)}</span>}
        </span>
        <span className={d.muted} style={{ display: 'inline-flex', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
          {legend.map(([cat, label]) => (
            <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, background: cat === 'pessoal' ? 'transparent' : CAT_STYLE[cat].bg, border: `1px solid ${cat === 'pessoal' ? 'var(--ink)' : CAT_STYLE[cat].bd}` }} />
              {label}
            </span>
          ))}
          {columns.some((c) => c.events.some((e) => e.planned)) && (
            <Link href="/estudo" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'inherit' }}>
              <span style={{ width: 9, height: 9, border: '1px dashed var(--sky)' }} />
              Estudo sugerido
            </Link>
          )}
        </span>
      </div>
      {/* Sem contentor com overflow: um overflow-x auto torna também o eixo
          vertical rolável e cortava a grelha e os cartões de detalhe. */}
      <div>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, paddingTop: 10 }}>
            <span />
            {columns.map((c) => {
              const isToday = isoKey(c.date) === todayKey;
              return (
                <div key={isoKey(c.date)} style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingBottom: 4, borderBottom: `1px solid ${isToday ? 'var(--sky)' : 'var(--line)'}`, whiteSpace: 'nowrap' }}>
                  <span className={d.muted} style={{ fontSize: 11 }}>{WEEKDAY_SHORT_PT[c.date.getDay()]}</span>
                  <span className={d.serif} style={{ fontSize: 18, color: isToday ? 'var(--sky)' : 'var(--ink)' }}>{c.date.getDate()}</span>
                </div>
              );
            })}
          </div>
          {/* Prazos e tarefas sem hora: faixa por cima da grelha */}
          <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, marginTop: 4 }}>
            <span />
            {columns.map((c, ci) => (
              <div key={isoKey(c.date)} style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 4 }}>
                {c.events
                  .filter((e) => !e.time)
                  .map((ev) => {
                    const b = bind(`wu-${ev.id}`);
                    const st = CAT_STYLE[ev.cat];
                    return (
                      <div key={ev.id} className={d.hoverable} data-hoverpin style={{ zIndex: b.open ? 50 : 'auto' }}>
                        <button type="button" {...b.handlers} style={{ width: '100%', height: 18, background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, padding: '0 5px', fontSize: 10, fontWeight: 600, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {ev.title}
                        </button>
                        {b.open && (
                          <HoverPop
                            data={{
                              title: ev.title,
                              tag: ev.cat === 'prazo' ? deadlineKind(ev.title) : undefined,
                              lines: [
                                ['Quando', `${WEEKDAY_SHORT_PT[c.date.getDay()]} ${c.date.getDate()} · dia inteiro`],
                                ['Onde', ev.place],
                                ['Tipo', CAT_LABEL[ev.cat]],
                              ],
                              action: ev.href ? { label: 'Abrir →', href: ev.href } : undefined,
                            }}
                            hint={b.hint}
                            style={{ width: 290, top: 0, ...(ci >= Math.ceil(n / 2) ? { right: 'calc(100% + 8px)' } : { left: 'calc(100% + 8px)' }) }}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 4, height, marginTop: 4 }}>
            <div style={{ position: 'relative' }}>
              {Array.from({ length: Math.floor((h1 - h0) / 2) + 1 }, (_, i) => (
                <span key={i} style={{ position: 'absolute', top: i * 2 * PX, left: 0, fontSize: 10, color: 'var(--faint)', transform: 'translateY(-5px)' }}>
                  {pad(h0 + i * 2)}
                </span>
              ))}
            </div>
            {columns.map((c, ci) => {
              const isToday = isoKey(c.date) === todayKey;
              return (
                <div key={isoKey(c.date)} style={{ position: 'relative', background: isToday ? '#141414' : 'transparent', borderBottom: '1px solid var(--line2)' }}>
                  {c.events
                    .filter((e) => e.time)
                    .map((ev) => {
                      const start = parseMinutes(ev.time);
                      const end = ev.until ? parseMinutes(ev.until) : start + 60;
                      // Blocos sugeridos pelo plano de estudo: tracejado, sem fundo cheio.
                      const st = ev.planned
                        ? { bg: 'repeating-linear-gradient(135deg, rgba(127,176,203,0.16) 0 4px, transparent 4px 8px)', fg: 'var(--ink)', bd: 'var(--sky)' }
                        : CAT_STYLE[ev.cat];
                      const b = bind(`w-${ev.id}`);
                      const pop: PopData = ev.planned
                        ? {
                            title: ev.title,
                            tag: 'SUGESTÃO',
                            lines: [
                              ['Quando', `${WEEKDAY_SHORT_PT[c.date.getDay()]} ${c.date.getDate()} · ${ev.time}${ev.until ? `–${ev.until}` : ''}`],
                              ['Porquê', ev.place],
                            ],
                            action: ev.href ? { label: 'Começar →', href: ev.href } : undefined,
                          }
                        : {
                            title: ev.title,
                            tag: ev.cat === 'prazo' ? deadlineKind(ev.title) : undefined,
                            lines: [
                              ['Quando', `${WEEKDAY_SHORT_PT[c.date.getDay()]} ${c.date.getDate()} · ${ev.time}${ev.until ? `–${ev.until}` : ''}`],
                              ['Onde', ev.place],
                              ['Tipo', CAT_LABEL[ev.cat]],
                            ],
                            action: ev.href ? { label: 'Abrir →', href: ev.href } : undefined,
                          };
                      return (
                        <div key={ev.id} className={d.hoverable} data-hoverpin style={{ position: 'absolute', left: 0, right: 0, top: Math.round(((start - h0 * 60) / 60) * PX), height: Math.max(Math.round(((end - start) / 60) * PX) - 2, 16), zIndex: b.open ? 50 : 'auto' }}>
                          <button
                            type="button"
                            {...b.handlers}
                            style={{ width: '100%', height: '100%', background: st.bg, color: st.fg, border: `1px ${ev.planned ? 'dashed' : 'solid'} ${st.bd}`, padding: '3px 6px', fontSize: 11, lineHeight: 1.25, overflow: 'hidden', textAlign: 'left', display: 'block' }}
                          >
                            <span style={{ display: 'block', fontWeight: 600 }}>{ev.time}</span>
                            <span className={d.ellipsis} style={{ display: 'block' }}>{ev.title}</span>
                          </button>
                          {b.open && (
                            <HoverPop data={pop} hint={b.hint} style={{ width: 290, top: 0, ...(ci >= Math.ceil(n / 2) ? { right: 'calc(100% + 8px)' } : { left: 'calc(100% + 8px)' }) }} />
                          )}
                        </div>
                      );
                    })}
                  {isToday && nowTop >= 0 && nowTop <= height && (
                    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 2, background: 'var(--ink)', pointerEvents: 'none' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PhoneWeekB({ columns, today, weekNumber, nav }: { columns: WeekCol[]; today: Date; weekNumber: number; nav?: WeekNav }) {
  const todayKey = isoKey(today);
  const [chosen, setSel] = useState<string | null>(null);
  // Ao mudar de semana o dia escolhido pode já não estar nela: fica hoje, ou a segunda-feira.
  const inWeek = (key: string | null) => !!key && columns.some((c) => isoKey(c.date) === key);
  const sel = inWeek(chosen) ? chosen! : inWeek(todayKey) ? todayKey : isoKey(columns[0]?.date ?? today);
  const picked = columns.find((c) => isoKey(c.date) === sel) ?? columns[0];
  const total = columns.reduce((n, c) => n + c.events.length, 0);

  return (
    <section id="semana" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 16 }}>
      <SectionHeadB title={`SEMANA ${weekNumber}`} aside={nav ? weekRange(nav) : `${total} ${total === 1 ? 'bloco' : 'blocos'}`} />
      {nav && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, gap: 8 }}>
          <WeekNavButtons nav={nav} big />
          <span className={d.muted} style={{ fontSize: 12 }}>{total} {total === 1 ? 'bloco' : 'blocos'}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, paddingTop: 10 }} role="tablist" aria-label="Dias da semana">
        {columns.map((c) => {
          const key = isoKey(c.date);
          const on = key === sel;
          const hasDue = c.events.some((e) => e.isDeadline);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSel(key)}
              style={{
                flex: 1,
                height: 54,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: on ? 'var(--bone)' : 'transparent',
                color: on ? 'var(--bg)' : key === todayKey ? 'var(--sky)' : 'var(--ink)',
                border: `1px solid ${on ? 'var(--bone)' : 'var(--line)'}`,
              }}
            >
              <span style={{ fontSize: 11 }}>{WEEKDAY_SHORT_PT[c.date.getDay()]}</span>
              <span className={d.serif} style={{ fontSize: 18 }}>{c.date.getDate()}</span>
              <span className={d.round} style={{ width: 5, height: 5, background: hasDue ? 'var(--amber)' : c.events.length ? '#6b675f' : 'transparent' }} />
            </button>
          );
        })}
      </div>
      {picked && picked.events.length === 0 && <p className={d.muted} style={{ margin: '12px 0 0', fontSize: 13 }}>Nada marcado neste dia.</p>}
      {[...(picked?.events ?? [])]
        .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
        .map((ev) => {
        const st = CAT_STYLE[ev.cat];
        const row = (
          <>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', color: ev.planned ? 'var(--sky)' : undefined }}>
              {ev.time ? `${ev.time}${ev.until ? `–${ev.until}` : ''}` : 'dia inteiro'}
            </span>
            <span
              style={{
                width: 10,
                height: 10,
                background: ev.planned ? 'transparent' : st.bg,
                border: `1px ${ev.planned ? 'dashed var(--sky)' : `solid ${st.bd}`}`,
                alignSelf: 'center',
              }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className={`${d.ellipsis} ${d.wrapPhone}`} style={{ fontSize: 14 }}>{ev.title}</span>
              <span className={d.wrapPhone} style={{ fontSize: 12, color: 'var(--mut2)' }}>
                {ev.planned ? `Sugestão · ${ev.place} · toca para começar` : `${CAT_LABEL[ev.cat]} · ${ev.place}`}
              </span>
            </span>
          </>
        );
        const style = { display: 'grid', gridTemplateColumns: '92px 10px minmax(0, 1fr)', gap: 10, alignItems: 'baseline', minHeight: 48, padding: '8px 0', borderBottom: '1px solid var(--line2)' } as const;
        return ev.href ? (
          <Link key={ev.id} href={ev.href} style={style}>{row}</Link>
        ) : (
          <div key={ev.id} style={style}>{row}</div>
        );
      })}
    </section>
  );
}

// ==========================================
// PRAZOS (com detalhes)
// ==========================================
export interface DeadlineB {
  id: string;
  date: Date;
  kind: 'TESTE' | 'ENTREGA';
  title: string;
  meta: string;
  area: string;
  status: string;
  pct: number;
  href: string;
}

export function DeadlinesB({ items, today, bind }: { items: DeadlineB[]; today: Date; bind: Bind }) {
  return (
    <section id="prazos" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 16 }}>
      <SectionHeadB title="PRAZOS" aside="os mais próximos" />
      {items.length === 0 && <p className={d.muted} style={{ margin: '12px 0 0', fontSize: 13 }}>Sem prazos marcados.</p>}
      {items.map((p) => {
        const days = daysBetween(today, p.date);
        const b = bind(`p-${p.id}`);
        const pop: PopData = {
          title: p.title,
          tag: p.kind,
          lines: [
            ['Quando', `${WEEKDAY_SHORT_PT[p.date.getDay()]}, ${shortDate(p.date)}`],
            ['Área', p.area],
            ['Estado', `${p.status}*`],
          ],
          pct: p.pct,
          pctLabel: `${p.pct}% preparado*`,
          action: { label: 'Abrir →', href: p.href },
        };
        return (
          <div key={p.id} className={d.hoverable} data-hoverpin style={{ zIndex: b.open ? 50 : 'auto' }}>
            <button
              type="button"
              {...b.handlers}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: 14, alignItems: 'center', padding: '14px 0', border: 0, borderBottom: '1px solid var(--line2)', background: 'transparent', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                <span className={d.serif} style={{ fontSize: 40, color: 'var(--amber)' }}>{days}</span>
                <span className={d.muted} style={{ fontSize: 11 }}>{days === 1 ? 'dia' : 'dias'}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className={d.tag} style={{ padding: '2px 6px' }}>{p.kind}</span>
                  <span className={d.ellipsis} style={{ fontSize: 14 }}>{p.title}</span>
                </span>
                <span className={d.muted} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, whiteSpace: 'nowrap', gap: 10 }}>
                  <span className={d.ellipsis}>{p.meta}</span>
                  <span>{p.status}*</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flexGrow: 1, display: 'flex', height: 3, background: '#262626' }}>
                    <span style={{ width: `${p.pct}%`, background: 'var(--amber)' }} />
                  </span>
                  <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{p.pct}% preparado*</span>
                </span>
              </span>
            </button>
            {b.open && <HoverPop data={pop} hint={b.hint} style={{ width: 360, top: 'calc(100% - 4px)', left: 56 }} />}
          </div>
        );
      })}
      {items.length > 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 11 }}>* Preparação e estado são valores de exemplo.</p>}
    </section>
  );
}

// Conteúdo do detalhe de um dia (fundo papel): prazo em destaque e eventos.
function DayDetail({
  date,
  today,
  events,
  hint,
  showHeader = true,
  onRemoveEvent,
  onAddHere,
}: {
  date: Date;
  today: Date;
  events: PainelEvent[];
  hint?: string;
  showHeader?: boolean;
  onRemoveEvent: (localId: string) => void;
  onAddHere: () => void;
}) {
  // Todos os testes/entregas do dia (podem ser vários), com hora quando existe.
  const dues = events.filter((e) => e.isDeadline);
  const others = events.filter((e) => !e.isDeadline);
  const rel = daysBetween(today, date);
  const relLabel = rel === 0 ? 'Hoje' : rel === 1 ? 'Amanhã' : rel === -1 ? 'Ontem' : rel > 0 ? `Daqui a ${rel} dias` : `Há ${-rel} dias`;
  return (
    <>
      {showHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span className={d.serif} style={{ fontSize: 28, lineHeight: 1.05 }}>
            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()]}, {date.getDate()} de {MONTHS_PT[date.getMonth()]}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: '#2f5f78' }}>{relLabel}</span>
        </div>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 600, color: '#2f5f78' }}>{relLabel}</span>
      )}
      {dues.map((due) => (
        <div key={due.id} style={{ background: 'var(--amber)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>{deadlineKind(due.title)}</span>
            <span className={d.serif} style={{ fontSize: 18, lineHeight: 1.15 }}>{due.title}</span>
          </div>
          <span style={{ fontSize: 12 }}>
            {due.time ? <strong style={{ fontWeight: 600 }}>{due.time}{due.until ? `–${due.until}` : ''} · </strong> : null}
            {due.place}
          </span>
        </div>
      ))}
      {others.map((x) => {
        const st = CAT_STYLE[x.cat];
        const localId = x.id.startsWith('local-') ? x.id.slice(6) : null;
        return (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '96px 10px minmax(0, 1fr) auto', gap: 10, alignItems: 'baseline', borderTop: '1px solid rgba(13,13,13,0.12)', paddingTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.time ? `${x.time}${x.until ? `–${x.until}` : ''}` : '—'}</span>
            <span style={{ width: 10, height: 10, background: st.bg, border: `1px solid ${st.bd}`, alignSelf: 'center' }} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 14 }}>{x.title}</span>
              <span style={{ fontSize: 12, color: 'var(--papermut)' }}>{CAT_LABEL[x.cat]} · {x.place}</span>
            </span>
            {localId && (
              <button type="button" onClick={() => onRemoveEvent(localId)} aria-label={`Remover ${x.title}`} style={{ background: 'none', border: 0, color: 'var(--papermut)', minWidth: 32, minHeight: 32 }}>×</button>
            )}
          </div>
        );
      })}
      {dues.length === 0 && others.length === 0 && (
        <div style={{ borderTop: '1px solid rgba(13,13,13,0.12)', paddingTop: 8, color: 'var(--papermut)' }}>Sem registos neste dia.</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 6 }}>
        {hint ? <span style={{ fontSize: 11, color: 'var(--papermut)' }}>{hint}</span> : <span />}
        <button
          type="button"
          onClick={onAddHere}
          style={{ height: 36, padding: '0 14px', background: 'var(--bg)', color: 'var(--ink)', border: 0, fontSize: 13, whiteSpace: 'nowrap' }}
        >
          + Evento neste dia
        </button>
      </div>
    </>
  );
}

// ==========================================
// MÊS (com detalhes do dia)
// ==========================================
const NEW_CATS: [PainelCat, string][] = [
  ['pessoal', 'Pessoal'],
  ['trab', 'Trabalho'],
  ['fac', 'Faculdade'],
];

export function MonthB({
  today,
  getEvents,
  onAddEvent,
  onRemoveEvent,
  titleRef,
  bind,
  sheet = false,
}: {
  today: Date;
  getEvents: (date: Date) => PainelEvent[];
  onAddEvent: (dateKey: string, title: string, time: string, cat: PainelCat) => void;
  onRemoveEvent: (localId: string) => void;
  titleRef: RefObject<HTMLInputElement | null>;
  bind: Bind;
  // iPhone: tocar num dia abre o detalhe num painel que sobe do fundo.
  sheet?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [selKey, setSelKey] = useState(() => isoKey(today));
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('14:00');
  const [cat, setCat] = useState<PainelCat>('pessoal');

  const todayKey = isoKey(today);
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const gridStart = addDays(shown, -((shown.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, key: isoKey(date), inMonth: date.getMonth() === shown.getMonth(), col: i % 7, row: Math.floor(i / 7) };
  });
  const [sy, sm, sd] = selKey.split('-').map(Number);
  const selDate = new Date(sy, sm - 1, sd);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const tm = time.trim();
    onAddEvent(selKey, t, /^\d{1,2}:\d{2}$/.test(tm) ? tm.padStart(5, '0') : '', cat);
    setTitle('');
  };

  return (
    <section id="mes" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: 10, gap: 12 }}>
        <h2 className={d.h2lg}>{MONTHS_PT[shown.getMonth()].toUpperCase()} {shown.getFullYear()}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" aria-label="Mês anterior" onClick={() => setOffset((o) => o - 1)} style={{ width: 28, height: 28, background: 'transparent', border: '1px solid var(--box)' }}>‹</button>
          <button type="button" onClick={() => { setOffset(0); setSelKey(todayKey); }} style={{ height: 28, padding: '0 10px', background: 'transparent', border: '1px solid var(--box)', fontSize: 12 }}>Hoje</button>
          <button type="button" aria-label="Mês seguinte" onClick={() => setOffset((o) => o + 1)} style={{ width: 28, height: 28, background: 'transparent', border: '1px solid var(--box)' }}>›</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mut2)', padding: '8px 0 4px' }}>
        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((x) => <span key={x}>{x}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {cells.map((c) => {
          const events = getEvents(c.date);
          const due = events.find((e) => e.isDeadline);
          const others = events.filter((e) => !e.isDeadline);
          const isToday = c.key === todayKey;
          const b = bind(`m-${c.key}`);
          const handlers = sheet
            ? {
                onClick: () => {
                  setSelKey(c.key);
                  setSheetKey(c.key);
                },
              }
            : {
                ...b.handlers,
                onClick: () => {
                  setSelKey(c.key);
                  b.handlers.onClick?.();
                },
              };
          return (
            <div key={c.key} className={d.hoverable} data-hoverpin style={{ zIndex: b.open ? 50 : 'auto' }}>
              <button
                type="button"
                {...handlers}
                aria-label={`${c.date.getDate()} de ${MONTHS_PT[c.date.getMonth()]}, ${events.length} eventos`}
                style={{ width: '100%', height: sheet ? 44 : 34, border: 0, borderTop: '1px solid #1f1f1f', background: (b.open && !sheet) || selKey === c.key ? '#1a1a1a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: sheet ? 'center' : undefined, gap: 4, padding: sheet ? 0 : '0 0 0 2px' }}
              >
                <span
                  className={`${d.serif} ${d.round}`}
                  style={{
                    width: sheet ? 32 : 26,
                    height: sheet ? 32 : 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isToday ? 'var(--sky)' : due ? 'var(--amber)' : 'transparent',
                    color: isToday || due ? 'var(--bg)' : c.inMonth ? 'var(--ink)' : '#4a4741',
                    border: `2px solid ${(b.open && !sheet) || (sheet && sheetKey === c.key) ? 'var(--ink)' : 'transparent'}`,
                    fontSize: sheet ? 16 : 15,
                  }}
                >
                  {c.date.getDate()}
                </span>
                <span className={d.round} style={{ width: 5, height: 5, background: others.length ? '#6b675f' : 'transparent' }} />
              </button>
              {b.open && !sheet && (
                <MonthPop
                  style={{
                    width: 400,
                    padding: '20px 22px',
                    gap: 10,
                    // Seg/Ter abrem para a direita, Sáb/Dom para a esquerda, o meio fica centrado no dia.
                    ...(c.col <= 1 ? { left: 0 } : c.col >= 5 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
                    ...(c.row >= 3 ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
                  }}
                >
                  <DayDetail
                    date={c.date}
                    today={today}
                    events={events}
                    hint={b.hint}
                    onRemoveEvent={onRemoveEvent}
                    onAddHere={() => {
                      setSelKey(c.key);
                      titleRef.current?.focus();
                    }}
                  />
                </MonthPop>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 60px', gap: 10, paddingTop: 14 }}>
        <label style={{ display: 'flex', borderBottom: '1px solid var(--box)', height: 34 }}>
          <span className={d.sr}>Título do evento</span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
            placeholder={`Título do evento · ${selDate.getDate()} ${MONTHS_PT[selDate.getMonth()].slice(0, 3)}`}
            style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 13 }}
          />
        </label>
        <label style={{ display: 'flex', borderBottom: '1px solid var(--box)', height: 34 }}>
          <span className={d.sr}>Hora</span>
          <input type="text" value={time} onChange={(e) => setTime(e.target.value)} inputMode="numeric" style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', fontSize: 13 }} />
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          {NEW_CATS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCat(id)}
              aria-pressed={cat === id}
              style={{ height: 28, padding: '0 9px', fontSize: 12, whiteSpace: 'nowrap', background: cat === id ? 'var(--bone)' : 'transparent', color: cat === id ? 'var(--bg)' : 'var(--ink)', border: '1px solid var(--box2)', marginRight: -1 }}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={add}>+ Adicionar</button>
      </div>
      <span style={{ fontSize: 11, color: 'var(--mut2)', paddingTop: 6 }}>{sheet ? 'Toca num dia para ver o detalhe.' : 'Clica num dia para o escolher.'} Eventos guardados só neste browser.</span>
      {sheet && sheetKey && (() => {
        const [ky, km, kd] = sheetKey.split('-').map(Number);
        const date = new Date(ky, km - 1, kd);
        return (
          <BottomSheet
            title={`${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()]}, ${date.getDate()} de ${MONTHS_PT[date.getMonth()]}`}
            onClose={() => setSheetKey(null)}
          >
            <DayDetail
              date={date}
              today={today}
              events={getEvents(date)}
              showHeader={false}
              onRemoveEvent={onRemoveEvent}
              onAddHere={() => {
                setSelKey(sheetKey);
                setSheetKey(null);
                window.setTimeout(() => titleRef.current?.focus(), 50);
              }}
            />
          </BottomSheet>
        );
      })()}
    </section>
  );
}

// ==========================================
// BALANÇO + DESPESAS (valores de exemplo)
// ==========================================
export function BalanceB({
  billable,
  study,
  expenses,
  monthName,
}: {
  billable: { done: number; target: number };
  study: { done: number; target: number };
  expenses: { label: string; amount: number }[];
  monthName: string;
}) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const meter = (label: string, m: { done: number; target: number }, color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, whiteSpace: 'nowrap' }}>
        <span>{label}</span>
        <span>
          <span className={d.serif} style={{ fontSize: 22 }}>{fmtNum(m.done)}</span> <span style={{ color: 'var(--mut2)' }}>de {fmtNum(m.target)} h</span>
        </span>
      </div>
      <div style={{ display: 'flex', height: 4, background: '#262626' }}>
        <div style={{ width: `${m.target > 0 ? Math.min(100, (m.done / m.target) * 100) : m.done > 0 ? 100 : 0}%`, background: color }} />
      </div>
    </div>
  );
  return (
    <div className={d.two} style={{ alignItems: 'stretch' }}>
      <section id="balanco" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, scrollMarginTop: 16 }}>
        <SectionHeadB title="BALANÇO" aside="esta semana" />
        {meter('Horas faturáveis', billable, 'var(--bone)')}
        <Link href="/estudo" style={{ display: 'block' }} title="Ver o estudo por disciplina">
          {meter('Horas de estudo →', study, 'var(--accent)')}
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto', paddingTop: 16, whiteSpace: 'nowrap' }}>
          <span className={d.muted} style={{ fontSize: 12 }}>Total acumulado</span>
          <span className={d.serif} style={{ fontSize: 34, color: 'var(--sky)' }}>{fmtNum(billable.done + study.done)} h</span>
        </div>
      </section>
      <section id="despesas" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <SectionHeadB title="DESPESAS DO MÊS" aside={monthName} />
        {expenses.map((e) => (
          <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, borderBottom: '1px solid var(--line2)', fontSize: 14, whiteSpace: 'nowrap' }}>
            <span>{e.label}</span>
            <span>{fmtEuro(e.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto', paddingTop: 16, whiteSpace: 'nowrap' }}>
          <span className={d.muted} style={{ fontSize: 12 }}>Total do mês</span>
          <span className={d.serif} style={{ fontSize: 34 }}>{fmtEuro(total)}</span>
        </div>
      </section>
      <p className={d.muted} style={{ gridColumn: '1 / -1', margin: 0, fontSize: 11 }}>
        As horas de estudo são reais (contadas no caderno) e a meta é a sugestão do Estudo. Horas faturáveis e despesas ainda são valores de exemplo.
      </p>
    </div>
  );
}

export function FooterB() {
  return (
    <footer className={d.inner}>
      <div style={{ padding: '18px 0', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', fontSize: 12, color: 'var(--mut2)' }}>
        <span className={d.serif} style={{ fontSize: 14, maxWidth: 520 }}>
          Composto em Instrument Sans e Newsreader, sobre preto. Feito para uma pessoa só, que divide os dias entre a sala de aula e o trabalho.
        </span>
        <span style={{ display: 'flex', gap: 18, whiteSpace: 'nowrap' }}>
          <Link href="/faculdade" style={{ color: 'var(--mut)' }}>Disciplinas</Link>
          <Link href="/trabalho" style={{ color: 'var(--mut)' }}>Projetos e tarefas</Link>
        </span>
      </div>
    </footer>
  );
}
