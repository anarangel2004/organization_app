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
import { DEFAULT_SETTINGS, type SavedBlock, type StudySettings } from '@/lib/studyPlan';
import { MERGE_GAP_MIN, mergeGroups } from '@/lib/studyPath';

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

export type StudyState = 'counting' | 'idle' | 'paused' | 'class';

// Última sessão fechada: se o estudo recomeça em ≤ 15 min no mesmo capítulo,
// continua a mesma sessão em vez de abrir outra.
const LAST_KEY = 'estudo:ultima';

export function useStudyTimer(subjectId: string, chapterId: string | null, inClass?: () => boolean) {
  // Lido a cada segundo pelo relógio (a função muda quando muda o horário).
  const inClassRef = useRef(inClass);
  useEffect(() => {
    inClassRef.current = inClass;
  });
  const segRef = useRef<Segment | null>(null);
  const lastActivity = useRef(0);
  const lastTick = useRef(0); // 0 = ainda sem tique (o primeiro não conta)
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
      writeJson(LAST_KEY, seg);
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
      const delta = lastTick.current ? Math.min(now - lastTick.current, 5000) / 1000 : 0;
      lastTick.current = now;
      const visible = document.visibilityState === 'visible';
      const recent = now - lastActivity.current <= IDLE_MS;
      // Durante a aula desta disciplina (pelo horário) não conta como estudo.
      const inClassNow = !!inClassRef.current?.();
      const counting = visible && recent && !pausedRef.current && lastActivity.current > 0 && !inClassNow;

      if (counting) {
        if (!segRef.current) {
          const last = readJson<Segment | null>(LAST_KEY, null);
          if (last && last.subjectId === subjectId && last.chapterId === chapterRef.current && now - last.lastAt <= MERGE_GAP_MIN * 60000) {
            // Pausa curta: continua a sessão anterior (o total de hoje já a contava).
            segRef.current = { ...last, lastAt: now };
            setBaseSec((s) => Math.max(0, s - Math.round(last.activeSec)));
          } else {
            segRef.current = { id: newId(), subjectId, chapterId: chapterRef.current, startedAt: now, lastAt: now, activeSec: 0 };
          }
        }
        const seg = segRef.current;
        seg.activeSec += delta;
        seg.lastAt = now;
        writeJson(CURRENT_KEY, seg);
        setLiveSec(Math.round(seg.activeSec));
      } else if (segRef.current && (!recent || pausedRef.current || inClassNow)) {
        close();
      }
      setState(pausedRef.current ? 'paused' : inClassNow ? 'class' : counting ? 'counting' : 'idle');
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
      return { settings: { ...DEFAULT_SETTINGS, ...(cached ?? {}) }, missingTable: missing };
    }
    const t = (v: unknown, fb: string) => (typeof v === 'string' && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : fb);
    const n = (v: unknown, fb: number) => (v === null || v === undefined || Number.isNaN(Number(v)) ? fb : Number(v));
    // Colunas da fase 3 podem não existir ainda: ficam os valores por omissão (ou os deste browser).
    const base: StudySettings = { ...DEFAULT_SETTINGS, ...(cached ?? {}) };
    const settings: StudySettings = data
      ? {
          hoursPerEcts: n(data.hours_per_ects, DEFAULT_SETTINGS.hoursPerEcts),
          semesterStart: data.semester_start,
          semesterEnd: data.semester_end,
          examsEnd: data.exams_end,
          weekdayStart: t(data.weekday_start, base.weekdayStart ?? DEFAULT_SETTINGS.weekdayStart),
          weekdayEnd: t(data.weekday_end, base.weekdayEnd ?? DEFAULT_SETTINGS.weekdayEnd),
          weekendStart: t(data.weekend_start, base.weekendStart ?? DEFAULT_SETTINGS.weekendStart),
          weekendEnd: t(data.weekend_end, base.weekendEnd ?? DEFAULT_SETTINGS.weekendEnd),
          maxHoursDay: n(data.max_hours_day, base.maxHoursDay ?? DEFAULT_SETTINGS.maxHoursDay),
          blockMin: n(data.block_min, base.blockMin ?? DEFAULT_SETTINGS.blockMin),
          blockMax: n(data.block_max, base.blockMax ?? DEFAULT_SETTINGS.blockMax),
          classMargin: n(data.class_margin, base.classMargin ?? DEFAULT_SETTINGS.classMargin),
          unavailable: Array.isArray(data.unavailable) ? data.unavailable : base.unavailable ?? [],
          breakMinutes: n(data.break_minutes, base.breakMinutes),
          shortBlocks: data.short_blocks === 'round' || data.short_blocks === 'allow' ? data.short_blocks : base.shortBlocks,
          reminders: typeof data.reminders === 'boolean' ? data.reminders : base.reminders,
          reminderMinutes: n(data.reminder_minutes, base.reminderMinutes),
        }
      : DEFAULT_SETTINGS;
    writeJson(SETTINGS_KEY, settings);
    return { settings, missingTable: false };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS, ...(cached ?? {}) }, missingTable: false };
  }
}

export async function saveStudySettings(s: StudySettings): Promise<void> {
  writeJson(SETTINGS_KEY, s);
  const base = {
    id: 'default',
    hours_per_ects: s.hoursPerEcts,
    semester_start: s.semesterStart,
    semester_end: s.semesterEnd,
    exams_end: s.examsEnd,
    updated_at: new Date().toISOString(),
  };
  const phase3 = {
    ...base,
    weekday_start: s.weekdayStart,
    weekday_end: s.weekdayEnd,
    weekend_start: s.weekendStart,
    weekend_end: s.weekendEnd,
    max_hours_day: s.maxHoursDay,
    block_min: s.blockMin,
    block_max: s.blockMax,
    class_margin: s.classMargin,
    unavailable: s.unavailable,
  };
  const full = {
    ...phase3,
    break_minutes: s.breakMinutes,
    short_blocks: s.shortBlocks,
    reminders: s.reminders,
    reminder_minutes: s.reminderMinutes,
  };
  // Se faltarem colunas (SQL de uma fase por correr), grava o que der e avisa.
  const attempts: [Record<string, unknown>, string | null][] = [
    [full, null],
    [phase3, 'pausa, blocos curtos e lembretes só ficam neste browser até correres o supabase-study-phase5.sql'],
    [base, 'horas/ECTS e datas guardadas; o resto só fica neste browser até correres o supabase-study-plan.sql e o supabase-study-phase5.sql'],
  ];
  for (const [row, warning] of attempts) {
    const { error } = await supabase.from('study_settings').upsert(row);
    if (!error) {
      if (warning) throw new Error(warning);
      return;
    }
    const missingColumn = error.code === 'PGRST204' || error.code === '42703' || /column/i.test(error.message || '');
    if (!missingColumn) throw error;
  }
  throw new Error('Não foi possível guardar as definições.');
}

// ==========================================
// CORRIGIR SESSÕES (fase 5)
// ==========================================
// Junta no servidor as sessões seguidas (mesma disciplina e capítulo, pausa
// ≤ 15 min): a primeira fica com o fim da última e a soma do tempo; as outras
// apagam-se. Devolve a lista já junta (as que ainda não foram enviadas ficam).
export async function mergeCloseSessions(rows: StudySessionRow[]): Promise<StudySessionRow[]> {
  const pendingIds = new Set(getPending().map((r) => r.id));
  const groups = mergeGroups(rows.filter((r) => !pendingIds.has(r.id)));
  const out = rows.filter((r) => pendingIds.has(r.id));
  for (const g of groups) {
    if (g.length === 1) {
      out.push(g[0]);
      continue;
    }
    const first = g[0];
    const merged: StudySessionRow = {
      ...first,
      ended_at: g.reduce((m, r) => (r.ended_at > m ? r.ended_at : m), first.ended_at),
      duration_seconds: g.reduce((n, r) => n + r.duration_seconds, 0),
      source: g.some((r) => r.source === 'auto') ? 'auto' : first.source,
    };
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({ ended_at: merged.ended_at, duration_seconds: merged.duration_seconds })
        .eq('id', first.id);
      if (error) throw error;
      const { error: delErr } = await supabase.from('study_sessions').delete().in('id', g.slice(1).map((r) => r.id));
      if (delErr) throw delErr;
      out.push(merged);
    } catch (err) {
      // Sem rede ou sem permissão: fica como estava (tenta-se na próxima vez).
      console.warn('Não foi possível juntar sessões:', err);
      out.push(...g);
    }
  }
  return out.sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export async function deleteSession(id: string): Promise<void> {
  // Pode ainda estar só no dispositivo.
  writeJson(PENDING_KEY, getPending().filter((r) => r.id !== id));
  const { error } = await supabase.from('study_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function updateSession(id: string, patch: Partial<Pick<StudySessionRow, 'chapter_id' | 'duration_seconds' | 'subject_id'>>): Promise<void> {
  const pending = getPending();
  if (pending.some((r) => r.id === id)) {
    writeJson(PENDING_KEY, pending.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    void flushSessions();
    return;
  }
  const row: Record<string, unknown> = { ...patch };
  if (patch.duration_seconds) {
    // Mantém o início e acerta o fim à nova duração.
    const { data } = await supabase.from('study_sessions').select('started_at').eq('id', id).maybeSingle();
    if (data?.started_at) row.ended_at = new Date(new Date(data.started_at).getTime() + patch.duration_seconds * 1000).toISOString();
  }
  const { error } = await supabase.from('study_sessions').update(row).eq('id', id);
  if (error) throw error;
}

// ==========================================
// PLANO FIXADO (tabela study_blocks)
// ==========================================
export async function loadSavedBlocks(weekStart: string): Promise<SavedBlock[]> {
  try {
    const { data, error } = await supabase.from('study_blocks').select('*').eq('week_start', weekStart).order('date').order('start_time');
    if (error) return [];
    return (data ?? []) as SavedBlock[];
  } catch {
    return [];
  }
}

export async function saveBlocks(rows: SavedBlock[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('study_blocks').upsert(rows);
  if (error) throw error;
}

export async function updateBlock(id: string, patch: Partial<Pick<SavedBlock, 'date' | 'start_time' | 'end_time' | 'status'>>): Promise<void> {
  const { error } = await supabase.from('study_blocks').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteBlocks(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('study_blocks').delete().in('id', ids);
  if (error) throw error;
}

// ==========================================
// LEMBRETES (notificações antes dos blocos)
// ==========================================
// As páginas que calculam o plano (/estudo, Visão Geral) publicam aqui os
// próximos blocos; o StudyReminders (no layout) avisa à hora certa.
export type NotifState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationState(): NotifState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifState;
}

export async function askNotificationPermission(): Promise<NotifState> {
  if (notificationState() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifState;
  } catch {
    return notificationState();
  }
}

export interface ReminderItem {
  id: string;
  startsAt: string; // ISO
  title: string;
  body: string;
  url: string;
}

export interface ReminderSchedule {
  enabled: boolean;
  minutesBefore: number;
  items: ReminderItem[];
}

export const REMINDERS_KEY = 'estudo:lembretes';

export function publishReminders(schedule: ReminderSchedule) {
  writeJson(REMINDERS_KEY, schedule);
}

export function readReminders(): ReminderSchedule | null {
  return readJson<ReminderSchedule | null>(REMINDERS_KEY, null);
}

// Mensagem legível para erros das tabelas do estudo.
export function studyErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message || String(err ?? '');
  if (e?.code === '42P01' || e?.code === 'PGRST205' || /could not find the table|does not exist/i.test(msg)) return 'Falta a tabela: corre o supabase-study-phase5.sql no Supabase.';
  if (e?.code === '42501' || /permission denied/i.test(msg)) return 'Sem permissão: corre o supabase-grants.sql e o supabase-study-phase5.sql no Supabase.';
  return msg;
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
