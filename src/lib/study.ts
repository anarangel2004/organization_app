'use client';

// Sessões de estudo: contador automático do caderno e sessões manuais.
//
// Regras do contador:
//  - Só conta com o caderno visível e com atividade (escrever, desenhar,
//    tocar, scroll, mudar de página no PDF) nos últimos 5 minutos.
//  - Uma sessão fecha ao ficar 5 minutos parada, ao mudar de capítulo,
//    ao carregar em pausa ou ao sair da página.
//  - Sessões com menos de 2 minutos são ignoradas.
//  - A pausa acaba sozinha à próxima atividade.
//
// Sem rede: as sessões fechadas ficam numa lista local (localStorage) e são
// enviadas quando houver ligação. O id é gerado aqui, e o envio usa upsert,
// por isso reenviar nunca cria duplicados.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SETTINGS, type StudySettings } from '@/lib/studyPlan';

export const IDLE_MS = 5 * 60 * 1000;
export const MIN_SESSION_SEC = 120;

const PENDING_KEY = 'estudo:pendentes';
const CURRENT_KEY = 'estudo:atual';

export interface StudySessionRow {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  source: 'auto' | 'manual';
}

// crypto.randomUUID só existe em https/localhost; no iPad pela rede local
// (http://192.168…) não, por isso há alternativa.
export function newId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Capítulos ainda a ser criados têm id temporário ("temp-…", "local-…"): fica sem capítulo.
export const chapterOrNull = (id: string | null | undefined) => (id && !/^(temp|local)-/.test(id) ? id : null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem storage: a sessão ainda tenta ir diretamente para o servidor
  }
}

export function getPending(): StudySessionRow[] {
  return readJson<StudySessionRow[]>(PENDING_KEY, []);
}

// Junta uma sessão à lista local e tenta enviar tudo.
export function queueSession(row: StudySessionRow) {
  writeJson(PENDING_KEY, [...getPending().filter((r) => r.id !== row.id), row]);
  void flushSessions();
}

let flushing = false;
export async function flushSessions(): Promise<void> {
  if (flushing || typeof window === 'undefined') return;
  flushing = true;
  try {
    for (const row of getPending()) {
      const { error } = await supabase.from('study_sessions').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        // Só descarta quando os dados são inválidos (22xxx/23xxx: ex. disciplina
        // apagada). Sem rede, tabela ainda por criar, etc.: fica para depois.
        const code = (error as { code?: string }).code || '';
        if (!/^2[23]/.test(code)) break;
        console.error('Sessão de estudo rejeitada, a descartar:', row, error);
      }
      writeJson(PENDING_KEY, getPending().filter((r) => r.id !== row.id));
    }
  } catch (err) {
    // erro de rede lançado pelo fetch: tenta-se mais tarde
    console.warn('Sessões de estudo por enviar:', err);
  } finally {
    flushing = false;
  }
}

// Segundos já guardados hoje nesta disciplina (servidor + os que faltam enviar).
export async function secondsToday(subjectId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const pending = getPending().filter((r) => r.subject_id === subjectId && new Date(r.started_at) >= start);
  let rows: { id: string; duration_seconds: number }[] = [];
  try {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('id, duration_seconds')
      .eq('subject_id', subjectId)
      .gte('started_at', start.toISOString());
    if (!error && data) rows = data;
  } catch {
    // sem rede: só as locais
  }
  const seen = new Set(rows.map((r) => r.id));
  return rows.reduce((n, r) => n + r.duration_seconds, 0) + pending.filter((r) => !seen.has(r.id)).reduce((n, r) => n + r.duration_seconds, 0);
}

// ==========================================
// CONTADOR DO CADERNO
// ==========================================
interface Segment {
  id: string;
  subjectId: string;
  chapterId: string | null;
  startedAt: number;
  lastAt: number; // último instante contado
  activeSec: number;
}

function toRow(seg: Segment): StudySessionRow {
  return {
    id: seg.id,
    subject_id: seg.subjectId,
    chapter_id: chapterOrNull(seg.chapterId),
    started_at: new Date(seg.startedAt).toISOString(),
    ended_at: new Date(seg.lastAt).toISOString(),
    duration_seconds: Math.round(seg.activeSec),
    source: 'auto',
  };
}

export type StudyState = 'counting' | 'idle' | 'paused';

export function useStudyTimer(subjectId: string, chapterId: string | null) {
  const segRef = useRef<Segment | null>(null);
  const lastActivity = useRef(0);
  const lastTick = useRef(Date.now());
  const pausedRef = useRef(false);
  const chapterRef = useRef(chapterId);
  const [state, setState] = useState<StudyState>('idle');
  const [baseSec, setBaseSec] = useState(0); // já guardado hoje
  const [liveSec, setLiveSec] = useState(0); // sessão aberta

  const close = useCallback(() => {
    const seg = segRef.current;
    segRef.current = null;
    writeJson(CURRENT_KEY, null);
    setLiveSec(0);
    if (seg && seg.activeSec >= MIN_SESSION_SEC) {
      queueSession(toRow(seg));
      setBaseSec((s) => s + Math.round(seg.activeSec));
    }
  }, []);

  // Ao abrir: fecha a sessão que ficou a meio (separador fechado de repente),
  // envia o que ficou por enviar e lê o total de hoje.
  useEffect(() => {
    const left = readJson<Segment | null>(CURRENT_KEY, null);
    writeJson(CURRENT_KEY, null);
    if (left && left.activeSec >= MIN_SESSION_SEC) queueSession(toRow(left));
    void flushSessions();
    let alive = true;
    secondsToday(subjectId).then((s) => alive && setBaseSec(s));
    const onOnline = () => void flushSessions();
    window.addEventListener('online', onOnline);
    const retry = window.setInterval(() => void flushSessions(), 60_000);
    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
      window.clearInterval(retry);
    };
  }, [subjectId]);

  // Mudar de capítulo fecha a sessão; a seguinte começa logo, se houver atividade.
  useEffect(() => {
    if (chapterRef.current !== chapterId) {
      chapterRef.current = chapterId;
      close();
    }
  }, [chapterId, close]);

  // Atividade: escrever, desenhar, tocar, scroll (inclui o PDF). Os próprios
  // botões do contador (data-study-ignore) não contam.
  useEffect(() => {
    const onActivity = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('[data-study-ignore]')) return;
      lastActivity.current = Date.now();
      if (pausedRef.current) pausedRef.current = false;
    };
    const opts = { capture: true, passive: true } as const;
    const events = ['keydown', 'input', 'pointerdown', 'wheel', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, opts));
    return () => events.forEach((ev) => window.removeEventListener(ev, onActivity, opts));
  }, []);

  // Relógio: a cada segundo decide se conta.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      // Timers em segundo plano atrasam; nunca conta mais de 5 s de uma vez.
      const delta = Math.min(now - lastTick.current, 5000) / 1000;
      lastTick.current = now;
      const visible = document.visibilityState === 'visible';
      const recent = now - lastActivity.current <= IDLE_MS;
      const counting = visible && recent && !pausedRef.current && lastActivity.current > 0;

      if (counting) {
        if (!segRef.current) {
          segRef.current = { id: newId(), subjectId, chapterId: chapterRef.current, startedAt: now, lastAt: now, activeSec: 0 };
        }
        const seg = segRef.current;
        seg.activeSec += delta;
        seg.lastAt = now;
        writeJson(CURRENT_KEY, seg);
        setLiveSec(Math.round(seg.activeSec));
      } else if (segRef.current && (!recent || pausedRef.current)) {
        close();
      }
      setState(pausedRef.current ? 'paused' : counting ? 'counting' : 'idle');
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [subjectId, close]);

  // Sair da página ou fechar o separador: fecha e tenta enviar.
  useEffect(() => {
    const onHide = () => close();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      close();
    };
  }, [close]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    close();
    setState('paused');
  }, [close]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    lastActivity.current = Date.now();
    setState('counting');
  }, []);

  const addManual = useCallback(
    (row: Omit<StudySessionRow, 'id' | 'source'>) => {
      queueSession({ ...row, id: newId(), source: 'manual' });
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (row.subject_id === subjectId && new Date(row.started_at) >= start) setBaseSec((s) => s + row.duration_seconds);
    },
    [subjectId]
  );

  return { state, todaySec: baseSec + liveSec, sessionSec: liveSec, pause, resume, addManual };
}

// ==========================================
// DEFINIÇÕES (tabela study_settings, uma linha 'default')
// ==========================================
const SETTINGS_KEY = 'estudo:definicoes';

export async function loadStudySettings(): Promise<{ settings: StudySettings; missingTable: boolean }> {
  const cached = readJson<StudySettings | null>(SETTINGS_KEY, null);
  try {
    const { data, error } = await supabase.from('study_settings').select('*').eq('id', 'default').maybeSingle();
    if (error) {
      const missing = (error as { code?: string }).code === '42P01' || /does not exist|schema cache/i.test(error.message || '');
      return { settings: cached ?? DEFAULT_SETTINGS, missingTable: missing };
    }
    const settings: StudySettings = data
      ? {
          hoursPerEcts: Number(data.hours_per_ects) || DEFAULT_SETTINGS.hoursPerEcts,
          semesterStart: data.semester_start,
          semesterEnd: data.semester_end,
          examsEnd: data.exams_end,
        }
      : DEFAULT_SETTINGS;
    writeJson(SETTINGS_KEY, settings);
    return { settings, missingTable: false };
  } catch {
    return { settings: cached ?? DEFAULT_SETTINGS, missingTable: false };
  }
}

export async function saveStudySettings(s: StudySettings): Promise<void> {
  writeJson(SETTINGS_KEY, s);
  const { error } = await supabase.from('study_settings').upsert({
    id: 'default',
    hours_per_ects: s.hoursPerEcts,
    semester_start: s.semesterStart,
    semester_end: s.semesterEnd,
    exams_end: s.examsEnd,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Sessões desde uma data (servidor + as que faltam enviar), para os cálculos.
export async function loadSessionsSince(since: Date): Promise<StudySessionRow[]> {
  const pending = getPending().filter((r) => new Date(r.started_at) >= since);
  let rows: StudySessionRow[] = [];
  try {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('id, subject_id, chapter_id, started_at, ended_at, duration_seconds, source')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: true });
    if (!error && data) rows = data as StudySessionRow[];
  } catch {
    // sem rede: só as locais
  }
  const seen = new Set(rows.map((r) => r.id));
  return [...rows, ...pending.filter((r) => !seen.has(r.id))];
}

// "34 min", "1 h 05"
export function fmtStudy(sec: number): string {
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
