'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import s from './painel.module.css';
import { Tip } from './ui';
import { useNow } from './useLocalState';
import { parseMinutes } from '../homeAgenda';

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
  todayClasses: HeroClass[];
  nextClass: HeroNextClass | null;
  tiles: HeroTile[];
  subjectsCount: number;
  onCapture: (text: string) => void;
  // Blocos encaixados na abertura: plano de ação (esquerda), notas (direita).
  leftExtra?: ReactNode;
  rightExtra?: ReactNode;
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
  todayClasses,
  nextClass,
  tiles,
  subjectsCount,
  onCapture,
  leftExtra,
  rightExtra,
}: HeroProps) {
  const now = useNow(1000);
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

  return (
    <section className={s.inner} style={{ marginTop: 27 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 40,
          borderTop: '1px solid var(--hair)',
          paddingTop: 23,
        }}
      >
        {/* ESQUERDA: data + plano de ação */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 360px', maxWidth: 531, minWidth: 0 }}>
          <h1
            className={s.display}
            style={{ fontSize: 'clamp(72px, 8.75vw, 126px)', lineHeight: 0.88, letterSpacing: '-.04em' }}
          >
            <span style={{ display: 'block' }}>{weekdayLabel}</span>
            <span style={{ display: 'block' }}>{dayNumber}</span>
          </h1>
          <p
            className={s.serif}
            style={{ margin: '17px 0 0', fontWeight: 600, fontSize: 'clamp(22px, 2.1vw, 30px)', lineHeight: 1.1, letterSpacing: '-.01em' }}
          >
            {monthLine}
          </p>
          {leftExtra}
        </div>

        {/* DIREITA: sessão, volumes, captura e notas */}
        <div style={{ width: 'min(515px, 100%)' }}>
          <div
            style={{
              minHeight: 266,
              background: 'var(--bone)',
              color: 'var(--inkdark)',
              padding: '22px 23px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 18,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{head}</span>
                <span style={{ fontSize: 12, color: 'var(--subdark)' }}>{status}</span>
              </div>
              <h2
                className={s.serif}
                style={{ margin: '12px 0 0', fontWeight: 600, fontSize: 'clamp(24px, 2.1vw, 30px)', lineHeight: 1.05, letterSpacing: '-.01em' }}
              >
                {title}
              </h2>
              <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--subdark)' }}>{subtitle}</p>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <span
                  className={s.serif}
                  style={{ fontWeight: 600, fontSize: 'clamp(44px, 3.9vw, 56px)', lineHeight: 0.9, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {big}
                </span>
                <span style={{ fontSize: 12, color: 'var(--subdark)' }}>{bigNote}</span>
              </div>
              {progress !== null && (
                <div style={{ height: 5, background: 'rgba(12,12,12,.18)', marginTop: 12 }}>
                  <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: 'var(--petro)' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
                <Link href={notebookHref ?? '/faculdade'} className={s.btnDark}>
                  {notebookHref ? 'Notebook' : 'Faculdade'}
                </Link>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 11, marginTop: 10 }}>
            {tiles.map((t, i) => (
              <div key={t.subjectId} className={s.hv} style={{ aspectRatio: '1 / 1' }}>
                <Link
                  href={t.href}
                  className={i === 0 ? s.tileP : s.tile}
                  style={{ width: '100%', height: '100%', padding: 15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{t.vol}</span>
                  <span style={{ display: 'block', minWidth: 0 }}>
                    <span
                      className={s.serif}
                      style={{ display: 'block', fontWeight: 600, fontSize: 'clamp(24px, 2.3vw, 33px)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t.name}
                    </span>
                    <span className={i === 0 ? undefined : s.sub} style={{ display: 'block', fontSize: 12, marginTop: 5 }}>
                      {t.sub}
                    </span>
                  </span>
                </Link>
                <Tip tone={i === 0 ? 'v' : 'p'} title={t.tipTitle} style={{ left: 0, top: 'calc(100% - 17px)' }}>
                  {t.tipBody}
                </Tip>
              </div>
            ))}

            {tiles.length < 2 && (
              <Link
                href="/faculdade#nova-disciplina"
                style={{ aspectRatio: '1 / 1', border: '1px dashed var(--hair)', padding: 15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <span className={s.muted} style={{ fontSize: 12 }}>Vol. {String(tiles.length + 1).padStart(2, '0')}</span>
                <span className={s.serif} style={{ fontWeight: 600, fontSize: 20, lineHeight: 1.05 }}>Nova disciplina</span>
              </Link>
            )}

            <div
              className={s.hv}
              style={{ aspectRatio: '1 / 1', border: '1px solid var(--bone)', padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}
            >
              <span className={s.serif} style={{ fontWeight: 600, fontSize: 17, lineHeight: 1 }}>Captura rápida</span>
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
                style={{ flex: 1, minHeight: 0, resize: 'none', background: 'transparent', border: '1px solid var(--hair)', padding: 7, fontSize: 12, lineHeight: 1.4 }}
              />
              <button
                type="button"
                onClick={saveCapture}
                style={{ background: 'var(--bone)', color: 'var(--inkdark)', padding: '7px 8px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}
              >
                {saved ? 'Guardado' : 'Gravar nas notas'}
              </button>
              <Tip tone="m" title="Captura rápida" style={{ right: 0, top: 'calc(100% - 10px)', width: 232 }}>
                Guarda citações e referências nas Notas efémeras, logo abaixo. Atalho: Ctrl+S.
              </Tip>
            </div>
          </div>

          {rightExtra}

          <Link href="/faculdade" className={`${s.lnk} ${s.muted}`} style={{ display: 'inline-block', marginTop: 13, fontSize: 12 }}>
            Ver todas as cadeiras ({subjectsCount}) →
          </Link>
        </div>
      </div>
    </section>
  );
}
