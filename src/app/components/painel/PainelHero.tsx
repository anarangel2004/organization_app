'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import { Tip } from './ui';
import { useNow } from './useLocalState';
import { parseMinutes } from '../homeAgenda';
import type { ViewMode } from './PainelTop';

export interface HeroClass {
  subjectId: string;
  title: string;
  typeLabel: string;
  start: string;
  end: string;
  room: string;
}

export interface HeroNextClass {
  subjectId: string;
  title: string;
  dayLabel: string;
  start: string;
  end: string;
  room: string;
}

export interface HeroTile {
  subjectId: string;
  vol: string;
  name: string;
  sub: string;
  tipTitle: string;
  tipBody: string;
  href: string;
}

interface HeroProps {
  weekdayLabel: string;
  dayNumber: number;
  monthLine: string;
  mode: ViewMode;
  todayClasses: HeroClass[];
  nextClass: HeroNextClass | null;
  tiles: HeroTile[];
  subjectsCount: number;
  focusRunning: boolean;
  onToggleFocus: () => void;
  onCapture: (text: string) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function clock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

function roomLabel(room: string): string {
  return room ? `Sala ${room}` : 'Sala a definir';
}

export function PainelHero({
  weekdayLabel,
  dayNumber,
  monthLine,
  mode,
  todayClasses,
  nextClass,
  tiles,
  subjectsCount,
  focusRunning,
  onToggleFocus,
  onCapture,
}: HeroProps) {
  const now = useNow(1000);
  const patternId = useId().replace(/:/g, '');
  const [capture, setCapture] = useState('');
  const [saved, setSaved] = useState(false);

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const current = todayClasses.find((c) => {
    const start = parseMinutes(c.start) * 60;
    const end = (c.end ? parseMinutes(c.end) : parseMinutes(c.start) + 90) * 60;
    return nowSec >= start && nowSec < end;
  });
  const laterToday = todayClasses.find((c) => parseMinutes(c.start) * 60 > nowSec);

  let head = 'Sem aulas';
  let status = '';
  let title = 'Nenhuma aula no horário';
  let subtitle = 'Adiciona os horários das disciplinas em Faculdade.';
  let big = '—';
  let bigNote = '';
  let progress: number | null = null;
  let notebookHref: string | null = null;

  if (current) {
    const start = parseMinutes(current.start) * 60;
    const end = (current.end ? parseMinutes(current.end) : parseMinutes(current.start) + 90) * 60;
    head = 'Sessão em curso';
    status = 'a decorrer';
    title = `${current.title}: ${current.typeLabel}`;
    subtitle = `${current.start} às ${current.end || '—'}, ${roomLabel(current.room)}`;
    big = clock(end - nowSec);
    progress = (nowSec - start) / (end - start);
    bigNote = `${Math.round(progress * 100)}% concluída`;
    notebookHref = `/faculdade/${current.subjectId}/notebook`;
  } else if (laterToday) {
    head = 'Próxima sessão';
    status = 'hoje';
    title = `${laterToday.title}: ${laterToday.typeLabel}`;
    subtitle = `${laterToday.start} às ${laterToday.end || '—'}, ${roomLabel(laterToday.room)}`;
    big = clock(parseMinutes(laterToday.start) * 60 - nowSec);
    bigNote = 'até começar';
    notebookHref = `/faculdade/${laterToday.subjectId}/notebook`;
  } else if (nextClass) {
    head = 'Próxima sessão';
    status = nextClass.dayLabel;
    title = nextClass.title;
    subtitle = `${nextClass.start} às ${nextClass.end || '—'}, ${roomLabel(nextClass.room)}`;
    big = nextClass.start;
    bigNote = 'sem mais aulas hoje';
    notebookHref = `/faculdade/${nextClass.subjectId}/notebook`;
  }

  const saveCapture = () => {
    const text = capture.trim();
    if (!text) return;
    onCapture(text);
    setCapture('');
    setSaved(true);
  };

  const isRevue = mode === 'revue';

  return (
    <section
      className={s.inner}
      style={{ marginTop: 32 }}
    >
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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32, flex: '1 1 420px', minWidth: 0 }}>
          <h1
            className={s.display}
            style={{ fontSize: 'clamp(84px, 10.5vw, 152px)', lineHeight: 0.88, letterSpacing: '-.04em' }}
          >
            <span style={{ display: 'block' }}>{weekdayLabel}</span>
            <span style={{ display: 'block' }}>{dayNumber}</span>
          </h1>
          <p
            className={s.serif}
            style={{ margin: 0, fontWeight: 600, fontSize: 'clamp(26px, 2.5vw, 36px)', lineHeight: 1.1, letterSpacing: '-.01em' }}
          >
            {monthLine}
          </p>
        </div>

        <div style={{ width: 'min(620px, 100%)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isRevue ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)',
              minHeight: 320,
              background: 'var(--bone)',
              color: 'var(--inkdark)',
            }}
          >
            <div style={{ padding: '26px 28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20, minWidth: 0 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{head}</span>
                  <span style={{ fontSize: 14, color: 'var(--subdark)' }}>{status}</span>
                </div>
                <h2
                  className={s.serif}
                  style={{ margin: '14px 0 0', fontWeight: 600, fontSize: 'clamp(28px, 2.5vw, 36px)', lineHeight: 1.05, letterSpacing: '-.01em' }}
                >
                  {title}
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--subdark)' }}>{subtitle}</p>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                  <span
                    className={s.serif}
                    style={{ fontWeight: 600, fontSize: 'clamp(52px, 4.7vw, 68px)', lineHeight: 0.9, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {big}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--subdark)' }}>{bigNote}</span>
                </div>
                {progress !== null && (
                  <div style={{ height: 6, background: 'rgba(12,12,12,.18)', marginTop: 14 }}>
                    <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: 'var(--petro)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  {notebookHref ? (
                    <Link href={notebookHref} className={s.btnDark}>Notebook</Link>
                  ) : (
                    <Link href="/faculdade" className={s.btnDark}>Faculdade</Link>
                  )}
                  <button type="button" onClick={onToggleFocus} className={s.btnOutlineDark} aria-pressed={focusRunning}>
                    {focusRunning ? 'Pausar foco' : 'Iniciar foco'}
                  </button>
                </div>
              </div>
            </div>
            {isRevue && (
              <div className={s.hideSm} style={{ width: 220, minHeight: 320 }}>
                <svg viewBox="300 0 220 320" width="220" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block', height: '100%' }}>
                  <defs>
                    <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse">
                      <circle cx="3.5" cy="3.5" r="1.3" style={{ fill: 'var(--bone)' }} />
                    </pattern>
                  </defs>
                  <rect x="-20" y="-20" width="660" height="360" style={{ fill: 'var(--bone)' }} />
                  <circle cx="420" cy="170" r="170" style={{ fill: 'var(--petro)' }} />
                  <circle cx="340" cy="170" r="130" style={{ fill: `url(#${patternId})` }} />
                  <circle cx="150" cy="66" r="20" style={{ fill: 'var(--bg)' }} />
                </svg>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 13,
              marginTop: 12,
            }}
          >
            {tiles.map((t, i) => (
              <div key={t.subjectId} className={s.hv} style={{ aspectRatio: '1 / 1' }}>
                <Link
                  href={t.href}
                  className={i === 0 ? s.tileP : s.tile}
                  style={{ width: '100%', height: '100%', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{t.vol}</span>
                  <span style={{ display: 'block', minWidth: 0 }}>
                    <span
                      className={s.serif}
                      style={{ display: 'block', fontWeight: 600, fontSize: 'clamp(28px, 2.8vw, 40px)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t.name}
                    </span>
                    <span className={i === 0 ? undefined : s.sub} style={{ display: 'block', fontSize: 14, marginTop: 6 }}>
                      {t.sub}
                    </span>
                  </span>
                </Link>
                <Tip tone={i === 0 ? 'v' : 'p'} title={t.tipTitle} style={{ left: 0, top: 'calc(100% - 20px)' }}>
                  {t.tipBody}
                </Tip>
              </div>
            ))}

            {tiles.length < 2 && (
              <Link
                href="/faculdade"
                style={{ aspectRatio: '1 / 1', border: '1px dashed var(--hair)', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 14 }} className={s.muted}>Vol. {String(tiles.length + 1).padStart(2, '0')}</span>
                <span className={s.serif} style={{ fontWeight: 600, fontSize: 24, lineHeight: 1.05 }}>Nova disciplina</span>
              </Link>
            )}

            <div
              className={s.hv}
              style={{ aspectRatio: '1 / 1', border: '1px solid var(--bone)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <span className={s.serif} style={{ fontWeight: 600, fontSize: 20, lineHeight: 1 }}>Captura rápida</span>
              <textarea
                aria-label="Captura rápida de apontamentos"
                placeholder="Citação ou referência"
                value={capture}
                onChange={(e) => {
                  setCapture(e.target.value);
                  setSaved(false);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    saveCapture();
                  }
                }}
                style={{ flex: 1, minHeight: 0, resize: 'none', background: 'transparent', border: '1px solid var(--hair)', padding: 8, fontSize: 14, lineHeight: 1.4 }}
              />
              <button
                type="button"
                onClick={saveCapture}
                style={{ background: 'var(--bone)', color: 'var(--inkdark)', padding: '9px 10px', fontSize: 14, fontWeight: 600, textAlign: 'center' }}
              >
                {saved ? 'Guardado' : 'Gravar nas notas'}
              </button>
              <Tip tone="m" title="Captura rápida" style={{ right: 0, top: 'calc(100% - 12px)', width: 280 }}>
                Guarda citações e referências nas Notas efémeras, mais abaixo. Atalho: Ctrl+S.
              </Tip>
            </div>
          </div>
          <Link href="/faculdade" className={`${s.lnk} ${s.muted}`} style={{ display: 'inline-block', marginTop: 14, fontSize: 14 }}>
            Ver todas as cadeiras ({subjectsCount}) →
          </Link>
        </div>
      </div>
    </section>
  );
}
