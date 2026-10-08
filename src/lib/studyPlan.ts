// Quanto estudar: sugestão semanal por disciplina, com o motivo.
//
// Camadas:
//  1. Base pelos ECTS: ECTS × horas/ECTS − horas de aula do semestre = estudo
//     autónomo. 65% espalha-se por igual pelas semanas (aulas + exames).
//  2. Avaliações: os outros 35% ficam para preparar testes e entregas, na
//     proporção do peso de cada uma na nota final. As horas de cada uma
//     espalham-se pelos 14 dias anteriores, com mais peso no fim; o que já
//     estudaste nessa janela (acima da base) desconta.
//  3. Notas (só com notas lançadas): média < 10 → +30%, 10–12 → +15%,
//     ≥ 16 → −10%.

import type { AssessmentItem } from '@/types';
import { getItemEffectiveGrade } from '@/lib/utils';
import { parseDueDate, parseMinutes, parseSchedulesRaw, normalizeDayNum } from '@/app/components/homeAgenda';
import { currentAverage, effectiveWeight, fmtGrade } from '@/app/faculdade/[id]/components/disciplinaData';
import { TEST_TRAINING_SHARE, buildTestPath, chapterHref, stepQueue, stepTitle, type PathChapter, type TestPath } from '@/lib/studyPath';

export const PREP_SHARE = 0.35;
export const PREP_DAYS = 14;
// Sem datas nas definições: 14 semanas de aulas + 4 de exames.
const DEFAULT_CLASS_WEEKS = 14;
const DEFAULT_TOTAL_WEEKS = 18;
const DAY_MS = 86400000;

// Período "indisponível" solto: semanal (weekday) ou num dia (date).
export interface Unavailable {
  weekday: number | null; // 0 = domingo
  date: string | null; // AAAA-MM-DD
  start: string; // HH:MM
  end: string;
  label: string;
}

export interface StudySettings {
  hoursPerEcts: number;
  semesterStart: string | null; // AAAA-MM-DD
  semesterEnd: string | null;
  examsEnd: string | null;
  // Plano de blocos (fase 3)
  weekdayStart: string; // HH:MM
  weekdayEnd: string;
  weekendStart: string;
  weekendEnd: string;
  maxHoursDay: number;
  blockMin: number; // minutos
  blockMax: number;
  classMargin: number; // minutos antes e depois de cada aula
  unavailable: Unavailable[];
  // Fase 5
  breakMinutes: number; // pausa entre blocos seguidos
  shortBlocks: 'allow' | 'round'; // resto < bloco mínimo: bloco curto ou arredonda ao mínimo
  reminders: boolean;
  reminderMinutes: number; // aviso X minutos antes de cada bloco
}

export const DEFAULT_SETTINGS: StudySettings = {
  hoursPerEcts: 28,
  semesterStart: null,
  semesterEnd: null,
  examsEnd: null,
  weekdayStart: '09:00',
  weekdayEnd: '22:00',
  weekendStart: '10:00',
  weekendEnd: '19:00',
  maxHoursDay: 5, // dá para duas sessões de 2–2h30
  blockMin: 120,
  blockMax: 150,
  classMargin: 15,
  unavailable: [],
  breakMinutes: 10,
  shortBlocks: 'allow',
  reminders: false,
  reminderMinutes: 10,
};

export interface PlanSubject {
  id: string;
  code: string | null;
  name: string | null;
  ects?: number | null;
  schedules?: unknown;
  theoretical_weight?: number | null;
  practical_weight?: number | null;
}

export interface PlanSession {
  id?: string;
  subject_id: string;
  chapter_id?: string | null;
  started_at: string;
  duration_seconds: number;
}

export interface Reason {
  kind: 'base' | 'prep' | 'grade' | 'info' | 'step';
  text: string;
  hours?: number; // contributo para esta semana
}

export interface SubjectPlan {
  subjectId: string;
  code: string;
  name: string;
  ects: number;
  classHoursWeek: number;
  baseWeek: number;
  prepWeek: number;
  factor: number;
  suggestedWeek: number;
  doneWeek: number;
  doneToday: number;
  lastStudied: Date | null;
  next: { title: string; due: Date; days: number; weight: number } | null;
  reasons: Reason[];
  main: string; // o motivo mais importante, numa linha
  // Percurso até ao próximo teste (só quando há capítulos).
  path: TestPath | null;
}

export interface PlanPeriod {
  start: Date | null;
  classesEnd: Date | null;
  examsEnd: Date | null;
  classWeeks: number;
  totalWeeks: number;
  weekNumber: number | null; // semana do semestre (1, 2, …)
  inSemester: boolean;
  usingDefaults: boolean;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  return new Date(x.getTime() - ((x.getDay() + 6) % 7) * DAY_MS);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function parseDay(s: string | null): Date | null {
  return s ? parseDueDate(s) : null;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
// Arredonda a sugestão a meia hora.
const roundHalf = (n: number) => Math.round(n * 2) / 2;

export function fmtHours(h: number): string {
  if (h > 0 && h < 1) return `${Math.round(h * 60)} min`;
  return `${round1(h).toString().replace('.', ',')} h`;
}

export function weeklyClassHours(schedules: unknown): number {
  let total = 0;
  for (const e of parseSchedulesRaw(schedules)) {
    if (normalizeDayNum(e.day ?? e.dayOfWeek) === null) continue;
    const start = e.startTime || e.start_time;
    if (!start) continue;
    const s = parseMinutes(start);
    const end = e.endTime || e.end_time;
    total += Math.max(0, (end ? parseMinutes(end) : s + 90) - s) / 60;
  }
  return total;
}

export function planPeriod(settings: StudySettings, today: Date): PlanPeriod {
  const start = parseDay(settings.semesterStart);
  const classesEnd = parseDay(settings.semesterEnd);
  const examsEnd = parseDay(settings.examsEnd) ?? classesEnd;
  if (!start || !classesEnd || !examsEnd || classesEnd < start || examsEnd < classesEnd) {
    return { start: null, classesEnd: null, examsEnd: null, classWeeks: DEFAULT_CLASS_WEEKS, totalWeeks: DEFAULT_TOTAL_WEEKS, weekNumber: null, inSemester: true, usingDefaults: true };
  }
  const weeks = (a: Date, b: Date) => Math.max(1, Math.round(((b.getTime() - a.getTime()) / DAY_MS + 1) / 7));
  const t = startOfDay(today);
  return {
    start,
    classesEnd,
    examsEnd,
    classWeeks: weeks(start, classesEnd),
    totalWeeks: weeks(start, examsEnd),
    weekNumber: t >= start && t <= examsEnd ? Math.floor((t.getTime() - mondayOf(start).getTime()) / (7 * DAY_MS)) + 1 : null,
    inSemester: t >= start && t <= examsEnd,
    usingDefaults: false,
  };
}

function hoursIn(sessions: PlanSession[], from: Date, to: Date): number {
  const a = from.getTime();
  const b = to.getTime();
  return sessions.reduce((n, s) => {
    const t = new Date(s.started_at).getTime();
    return t >= a && t < b ? n + s.duration_seconds / 3600 : n;
  }, 0);
}

export function computePlan({
  subjects,
  assessments,
  sessions,
  settings,
  today,
  chapters,
  now,
}: {
  subjects: PlanSubject[];
  assessments: AssessmentItem[];
  sessions: PlanSession[];
  settings: StudySettings;
  today: Date;
  // Com os capítulos, o próximo teste tem percurso (T1 → P1 → … → testes) e as
  // horas passam a ser o que falta estudar, não um valor fixo.
  chapters?: PathChapter[];
  now?: Date;
}): { rows: SubjectPlan[]; period: PlanPeriod } {
  const period = planPeriod(settings, today);
  const t0 = startOfDay(today);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 7);
  const semester = { start: period.start, end: period.classesEnd };

  const rows = subjects.map<SubjectPlan>((s) => {
    const code = s.code || (s.name || '?').slice(0, 3).toUpperCase();
    const name = s.name || s.code || 'Disciplina';
    const ects = Number(s.ects) || 0;
    const theory = typeof s.theoretical_weight === 'number' ? s.theoretical_weight : 50;
    const practice = typeof s.practical_weight === 'number' ? s.practical_weight : 50;
    const mine = sessions.filter((x) => x.subject_id === s.id);
    const items = assessments.filter((a) => a.subject_id === s.id);
    const reasons: Reason[] = [];

    // 1. Base
    const classHoursWeek = weeklyClassHours(s.schedules);
    const selfStudy = Math.max(0, ects * settings.hoursPerEcts - classHoursWeek * period.classWeeks);
    let baseWeek = 0;
    if (!ects) reasons.push({ kind: 'info', text: 'Sem ECTS definidos: só conta o que houver de avaliações.' });
    else if (!period.inSemester) reasons.push({ kind: 'info', text: 'Fora do semestre (vê as datas nas definições).' });
    else {
      baseWeek = (selfStudy * (1 - PREP_SHARE)) / period.totalWeeks;
      reasons.push({
        kind: 'base',
        hours: baseWeek,
        text: `${ects} ECTS × ${settings.hoursPerEcts} h − ${fmtHours(classHoursWeek)} de aula/semana → ${fmtHours(baseWeek)} por semana`,
      });
    }
    const baseDay = baseWeek / 7;

    // 2. Avaliações por fazer com a janela de preparação a tocar nesta semana
    let prepWeek = 0;
    let next: SubjectPlan['next'] = null;
    const pending = items
      .filter((a) => getItemEffectiveGrade(a) === null)
      .map((a) => ({ a, due: parseDueDate(a.due_date) }))
      .filter((r): r is { a: AssessmentItem; due: Date } => r.due !== null && r.due >= t0)
      .sort((x, y) => x.due.getTime() - y.due.getTime());
    if (pending[0]) {
      const p = pending[0];
      next = { title: p.a.title || 'Avaliação', due: p.due, days: Math.round((p.due.getTime() - t0.getTime()) / DAY_MS), weight: effectiveWeight(p.a, theory, practice) };
    }
    // Próximo teste com percurso: o que falta estudar, espalhado até ao teste.
    let path: TestPath | null = null;
    let pathWeek = 0;
    if (chapters && pending[0]) {
      const { a, due } = pending[0];
      const weight = effectiveWeight(a, theory, practice);
      const previousDue = items
        .map((x) => parseDueDate(x.due_date))
        .filter((d): d is Date => d !== null && d < due)
        .sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
      const scopeStart = previousDue ? addDays(previousDue, 1) : period.start ?? addDays(due, -56);
      const weeks = Math.max(1, (due.getTime() - scopeStart.getTime()) / (7 * DAY_MS));
      // Orçamento do teste: a base das semanas desta matéria + a preparação pelo peso.
      const budget = baseWeek * weeks + selfStudy * PREP_SHARE * (weight / 100);
      path = buildTestPath({
        chapterIds: a.chapter_ids,
        subjectId: s.id,
        schedules: s.schedules,
        chapters,
        sessions: mine.map((x) => ({ ...x, chapter_id: x.chapter_id ?? null })),
        title: a.title || 'Avaliação',
        due,
        previousDue,
        semester,
        budget,
        now: now ?? new Date(),
      });
      const daysLeft = Math.max(1, Math.round((due.getTime() - t0.getTime()) / DAY_MS));
      const daysThisWeek = Math.min(daysLeft, Math.round((weekEnd.getTime() - t0.getTime()) / DAY_MS));
      pathWeek = (path.left * daysThisWeek) / daysLeft;
      // Dias desta semana depois do teste: volta a base.
      const afterDue = Math.max(0, Math.round((weekEnd.getTime() - Math.max(due.getTime(), t0.getTime())) / DAY_MS) - 1);
      pathWeek += baseDay * afterDue;
      const open = path.steps.filter((x) => x.given && !x.done).length;
      const days = Math.round((due.getTime() - t0.getTime()) / DAY_MS);
      reasons.push({
        kind: 'prep',
        hours: pathWeek,
        text: `${path.title} ${days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `daqui a ${days} dias`}: faltam ${fmtHours(path.left)}${
          path.steps.length ? ` (${open} de ${path.steps.length} aulas por concluir)` : ''
        } → ${fmtHours(pathWeek)} esta semana`,
      });
      if (path.next) reasons.push({ kind: 'step', text: `Próximo: ${stepTitle(path.next)}` });
    }

    for (const { a, due } of pending) {
      if (path && a === pending[0].a) continue;
      const weight = effectiveWeight(a, theory, practice);
      const prepTotal = selfStudy * PREP_SHARE * (weight / 100);
      if (prepTotal <= 0) continue;
      const windowStart = addDays(due, -PREP_DAYS);
      if (windowStart >= weekEnd) continue; // a janela ainda não começou
      // Peso de cada dia: 14 no dia antes do teste, 13 no anterior, … 1.
      const w = (day: Date) => {
        const k = Math.round((due.getTime() - day.getTime()) / DAY_MS);
        return k >= 1 && k <= PREP_DAYS ? PREP_DAYS + 1 - k : 0;
      };
      let wWeek = 0;
      let wRest = 0;
      for (let dd = new Date(weekStart); dd < due; dd = addDays(dd, 1)) {
        const x = w(dd);
        wRest += x;
        if (dd < weekEnd) wWeek += x;
      }
      if (wRest <= 0) continue;
      // O que estudaste na janela antes desta semana, acima da base, já conta.
      const before = windowStart < weekStart ? Math.max(0, hoursIn(mine, windowStart, weekStart) - baseDay * Math.round((weekStart.getTime() - windowStart.getTime()) / DAY_MS)) : 0;
      const remaining = Math.max(0, prepTotal - before);
      const share = (remaining * wWeek) / wRest;
      if (share <= 0.05) continue;
      prepWeek += share;
      const days = Math.round((due.getTime() - t0.getTime()) / DAY_MS);
      reasons.push({
        kind: 'prep',
        hours: share,
        text: `${a.title || 'Avaliação'} ${days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `daqui a ${days} dias`} (${Math.round(weight)}% da nota) → +${fmtHours(share)}${before > 0 ? `, já descontadas ${fmtHours(Math.min(before, prepTotal))}` : ''}`,
      });
    }

    // 3. Notas
    let factor = 1;
    const graded = items.filter((a) => getItemEffectiveGrade(a) !== null).length;
    const avg = graded ? currentAverage(items, theory, practice) : null;
    if (avg !== null) {
      factor = avg < 10 ? 1.3 : avg < 12 ? 1.15 : avg >= 16 ? 0.9 : 1;
      if (factor !== 1) reasons.push({ kind: 'grade', text: `Média ${fmtGrade(avg)} → ${factor > 1 ? '+' : '−'}${Math.round(Math.abs(factor - 1) * 100)}%` });
    }

    const doneWeek = hoursIn(mine, weekStart, weekEnd);
    // Com percurso, a semana é o já feito mais o que falta (com o fator da nota).
    const suggestedWeek = path
      ? roundHalf(doneWeek + (pathWeek + prepWeek) * factor)
      : roundHalf((baseWeek + prepWeek) * factor);
    const doneToday = hoursIn(mine, t0, addDays(t0, 1));
    const last = mine.reduce<number>((m, x) => Math.max(m, new Date(x.started_at).getTime()), 0);

    const prepMain = reasons.filter((r) => r.kind === 'prep').sort((x, y) => (y.hours ?? 0) - (x.hours ?? 0))[0];
    const main = path?.next
      ? `Próximo: ${stepTitle(path.next)}`
      : prepMain
      ? prepMain.text.split(' → ')[0]
      : reasons.find((r) => r.kind === 'info')?.text ?? (baseWeek > 0 ? 'Ritmo base do semestre' : '—');

    return {
      subjectId: s.id,
      code,
      name,
      ects,
      classHoursWeek,
      baseWeek,
      prepWeek,
      factor,
      suggestedWeek,
      doneWeek,
      doneToday,
      lastStudied: last ? new Date(last) : null,
      next,
      reasons,
      main,
      path,
    };
  });

  return { rows, period };
}

// ==========================================
// RESUMO E HISTÓRICO
// ==========================================
export function weekTotals(sessions: PlanSession[], today: Date, weeks: number): { start: Date; hours: number; bySubject: Map<string, number> }[] {
  const monday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(monday, -7 * (weeks - 1 - i));
    const end = addDays(start, 7);
    const bySubject = new Map<string, number>();
    let hours = 0;
    for (const s of sessions) {
      const t = new Date(s.started_at).getTime();
      if (t < start.getTime() || t >= end.getTime()) continue;
      const h = s.duration_seconds / 3600;
      hours += h;
      bySubject.set(s.subject_id, (bySubject.get(s.subject_id) || 0) + h);
    }
    return { start, hours, bySubject };
  });
}

// ==========================================
// PLANO DA SEMANA: blocos de estudo nos espaços livres
// ==========================================
export interface BusyShift {
  weekday: number | null;
  date: string | null;
  start_time: string;
  end_time: string;
}

export interface PlanBlock {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  date: Date;
  start: string; // HH:MM
  end: string;
  minutes: number;
  reason: string;
  // Capítulo a estudar neste bloco (percurso até ao teste).
  href?: string;
  // Só nos blocos fixados (tabela study_blocks)
  status?: 'planned' | 'done';
  saved?: boolean;
}

export interface PlanDay {
  date: Date;
  blocks: PlanBlock[];
  freeMinutes: number; // livre na disponibilidade, antes dos blocos
  busy: { start: string; end: string; label: string }[];
}

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const onDay = (x: { weekday: number | null; date: string | null }, day: Date) =>
  x.date ? sameDay(parseDueDate(x.date) ?? new Date(0), day) : x.weekday === day.getDay();

// Tira [a, b) de uma lista de intervalos livres.
function subtract(free: [number, number][], a: number, b: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [s, e] of free) {
    if (b <= s || a >= e) out.push([s, e]);
    else {
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
  }
  return out;
}

export function buildWeekPlan({
  rows,
  subjects,
  assessments,
  shifts,
  settings,
  now,
}: {
  rows: SubjectPlan[];
  subjects: PlanSubject[];
  assessments: AssessmentItem[];
  shifts: BusyShift[];
  settings: StudySettings;
  now: Date;
}): { days: PlanDay[]; unplaced: { subjectId: string; code: string; minutes: number }[] } {
  const period = planPeriod(settings, now);
  const t0 = startOfDay(now);
  const weekEnd = addDays(mondayOf(now), 7);
  const dates: Date[] = [];
  for (let dd = new Date(t0); dd < weekEnd; dd = addDays(dd, 1)) dates.push(dd);

  // Espaços livres de cada dia.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const days: PlanDay[] = dates.map((date) => {
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    let from = parseMinutes(weekend ? settings.weekendStart : settings.weekdayStart);
    const to = parseMinutes(weekend ? settings.weekendEnd : settings.weekdayEnd);
    // Hoje só a partir do próximo quarto de hora.
    if (sameDay(date, now)) from = Math.max(from, Math.ceil((nowMin + 5) / 15) * 15);
    let free: [number, number][] = from < to ? [[from, to]] : [];
    const busy: PlanDay['busy'] = [];
    const block = (a: number, b: number, label: string, margin: number) => {
      free = subtract(free, a - margin, b + margin);
      busy.push({ start: hm(a), end: hm(b), label });
    };

    // Aulas (só durante o período de aulas, se houver datas).
    const classesOn = !period.classesEnd || !period.start || (date >= period.start && date <= period.classesEnd);
    if (classesOn) {
      for (const s of subjects) {
        for (const e of parseSchedulesRaw(s.schedules)) {
          if (normalizeDayNum(e.day ?? e.dayOfWeek) !== date.getDay()) continue;
          const st = e.startTime || e.start_time;
          if (!st) continue;
          const a = parseMinutes(st);
          const en = e.endTime || e.end_time;
          block(a, en ? parseMinutes(en) : a + 90, `Aula ${s.code || s.name || ''}`.trim(), settings.classMargin);
        }
      }
    }
    // Testes marcados com hora.
    for (const a of assessments) {
      const due = parseDueDate(a.due_date);
      if (!due || !sameDay(due, date) || !a.due_time) continue;
      const st = parseMinutes(a.due_time);
      block(st, st + (a.duration_minutes || 90), a.title || 'Avaliação', settings.classMargin);
    }
    for (const s of shifts) if (onDay(s, date)) block(parseMinutes(s.start_time), parseMinutes(s.end_time), 'Turno', 0);
    for (const u of settings.unavailable) if (onDay(u, date)) block(parseMinutes(u.start), parseMinutes(u.end), u.label || 'Indisponível', 0);

    busy.sort((x, y) => x.start.localeCompare(y.start));
    return { date, blocks: [], freeMinutes: free.reduce((n, [s, e]) => n + (e - s), 0), busy, free } as PlanDay & { free: [number, number][] };
  });

  // O que falta estudar esta semana, por disciplina (primeiro as com avaliação mais perto).
  const need = rows
    .map((r) => ({ r, left: Math.round(Math.max(0, r.suggestedWeek - r.doneWeek) * 60) }))
    .filter((x) => x.left >= settings.blockMin / 2)
    .sort((a, b) => (a.r.next?.days ?? 999) - (b.r.next?.days ?? 999) || b.left - a.left);

  const doneTodayMin = rows.reduce((n, r) => n + r.doneToday, 0) * 60;
  const BREAK = Math.max(0, settings.breakMinutes ?? 10);
  const roundShort = settings.shortBlocks === 'round';

  days.forEach((day, di) => {
    const free = (day as PlanDay & { free: [number, number][] }).free;
    let capacity = settings.maxHoursDay * 60 - (sameDay(day.date, now) ? doneTodayMin : 0);
    const perSubject = new Map<string, number>();

    let placed = true;
    while (placed && capacity >= settings.blockMin / 2) {
      placed = false;
      for (const item of need) {
        if (item.left <= 0) continue;
        // Preparação: só antes do dia da avaliação.
        const due = item.r.next?.due;
        if (due && item.r.next!.days <= 7 && day.date >= startOfDay(due)) continue;
        // Espalha pelos dias que sobram (até 2 blocos por dia e disciplina).
        const daysLeft = days.slice(di).filter((x) => !due || x.date < startOfDay(due)).length || 1;
        const quota = Math.max(settings.blockMin, Math.ceil(item.left / daysLeft));
        const already = perSubject.get(item.r.subjectId) || 0;
        if (already >= quota || already >= settings.blockMax * 2) continue;

        // Resto curto: bloco só com o que falta, ou arredondado ao mínimo.
        const rest = roundShort ? Math.max(item.left, settings.blockMin) : item.left;
        const want = Math.min(settings.blockMax, Math.max(settings.blockMin, Math.min(rest, quota - already)), capacity);
        const slotIdx = free.findIndex(([s, e]) => e - s >= Math.min(want, settings.blockMin));
        if (slotIdx < 0 || want < Math.min(settings.blockMin, rest)) continue;
        const [s, e] = free[slotIdx];
        const len = Math.min(want, e - s);
        free[slotIdx] = [s + len + BREAK, e];
        if (free[slotIdx][1] - free[slotIdx][0] <= 0) free.splice(slotIdx, 1);

        const reasonSrc = item.r.reasons.filter((x) => x.kind === 'prep').sort((x, y) => (y.hours ?? 0) - (x.hours ?? 0))[0];
        day.blocks.push({
          id: `${item.r.subjectId}-${di}-${s}`,
          subjectId: item.r.subjectId,
          code: item.r.code,
          name: item.r.name,
          date: day.date,
          start: hm(s),
          end: hm(s + len),
          minutes: len,
          reason: reasonSrc ? reasonSrc.text.split(' → ')[0] : 'Ritmo base do semestre',
        });
        item.left -= len;
        capacity -= len;
        perSubject.set(item.r.subjectId, already + len);
        placed = true;
        if (capacity < settings.blockMin / 2) break;
      }
    }
    day.blocks.sort((x, y) => x.start.localeCompare(y.start));
  });

  // Cada bloco recebe um passo do percurso, por ordem (T1 → P1 → …); nos últimos
  // dias antes do teste, treinar testes anteriores.
  for (const r of rows) {
    const path = r.path;
    if (!path) continue;
    const mine = days.flatMap((d) => d.blocks.filter((b) => b.subjectId === r.subjectId));
    if (!mine.length) continue;
    const queue = stepQueue(path).map((st) => ({ st, left: Math.max(st.left, 0.5) }));
    const totalDays = Math.max(1, Math.round((path.due.getTime() - path.scopeStart.getTime()) / DAY_MS));
    const trainingFrom = addDays(startOfDay(path.due), -Math.max(2, Math.round(totalDays * TEST_TRAINING_SHARE / 2)));
    let i = 0;
    const days2 = Math.round((path.due.getTime() - t0.getTime()) / DAY_MS);
    const when = days2 <= 0 ? 'hoje' : days2 === 1 ? 'amanhã' : `em ${days2} dias`;
    for (const b of mine) {
      const training = b.date >= trainingFrom;
      const item = training ? queue[queue.length - 1] : queue[Math.min(i, queue.length - 1)];
      b.reason = `${stepTitle(item.st)} · ${path.title} ${when}`;
      b.href = chapterHref(r.subjectId, item.st);
      if (!training) {
        item.left -= b.minutes / 60;
        if (item.left <= 0 && i < queue.length - 1) i++;
      }
    }
  }

  return {
    days: days.map(({ date, blocks, freeMinutes, busy }) => ({ date, blocks, freeMinutes, busy })),
    unplaced: need.filter((x) => x.left >= settings.blockMin / 2).map((x) => ({ subjectId: x.r.subjectId, code: x.r.code, minutes: x.left })),
  };
}

// ==========================================
// PLANO FIXADO (fase 5): blocos guardados em study_blocks
// ==========================================
export interface SavedBlock {
  id: string;
  subject_id: string;
  week_start: string; // AAAA-MM-DD
  date: string;
  start_time: string;
  end_time: string;
  status: 'planned' | 'done';
  reason: string | null;
}

export const isoDay = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

// Com blocos por fazer guardados para a semana, o plano é esse (não é refeito
// sozinho). Sem nenhum, é a sugestão calculada, mais os blocos já feitos.
export function resolveWeekPlan(
  generated: PlanDay[],
  saved: SavedBlock[],
  rows: SubjectPlan[]
): { days: PlanDay[]; fixed: boolean } {
  const fixed = saved.some((b) => b.status === 'planned');
  if (saved.length === 0) return { days: generated, fixed: false };
  const byId = new Map(rows.map((r) => [r.subjectId, r]));
  const days = generated.map((day) => {
    const key = isoDay(day.date);
    const kept = fixed ? [] : day.blocks;
    const blocks = saved
      .filter((b) => b.date.slice(0, 10) === key && (fixed || b.status === 'done'))
      .map<PlanBlock>((b) => {
        const r = byId.get(String(b.subject_id));
        const start = b.start_time.slice(0, 5);
        const end = b.end_time.slice(0, 5);
        return {
          id: b.id,
          subjectId: String(b.subject_id),
          code: r?.code ?? '?',
          name: r?.name ?? 'Disciplina',
          date: day.date,
          start,
          end,
          minutes: Math.max(0, parseMinutes(end) - parseMinutes(start)),
          reason: b.reason || 'Bloco fixado',
          status: b.status,
          saved: true,
        };
      })
      .concat(kept)
      .sort((x, y) => x.start.localeCompare(y.start));
    return { ...day, blocks };
  });
  return { days, fixed };
}

// Lembretes: blocos por fazer que ainda não começaram.
export function reminderItems(days: PlanDay[], now: Date): { id: string; startsAt: string; title: string; body: string; url: string }[] {
  const out: { id: string; startsAt: string; title: string; body: string; url: string }[] = [];
  for (const day of days) {
    for (const b of day.blocks) {
      if (b.status === 'done') continue;
      const [h, m] = b.start.split(':').map(Number);
      const at = new Date(day.date);
      at.setHours(h, m, 0, 0);
      if (at.getTime() + 5 * 60000 < now.getTime()) continue;
      out.push({
        // Mesmo id para o mesmo bloco (cadeira + dia + hora): não repete o aviso.
        id: `${b.subjectId}-${isoDay(day.date)}-${b.start}`,
        startsAt: at.toISOString(),
        title: `Estudo: ${b.code} às ${b.start}`,
        body: `${b.name} · ${fmtHours(b.minutes / 60)} · ${b.reason}`,
        url: b.href ?? `/faculdade/${b.subjectId}/notebook`,
      });
    }
  }
  return out;
}

// ==========================================
// EXTRAS (fase 4)
// ==========================================
export const STALE_DAYS = 7;

// Disciplinas há mais de 7 dias sem estudo (ou nunca estudadas desde que há registo).
export function staleSubjects(rows: SubjectPlan[], today: Date): { row: SubjectPlan; days: number | null }[] {
  return rows
    .filter((r) => r.ects > 0 || r.suggestedWeek > 0)
    .map((r) => ({ row: r, days: r.lastStudied ? Math.floor((startOfDay(today).getTime() - startOfDay(r.lastStudied).getTime()) / DAY_MS) : null }))
    .filter((x) => x.days === null || x.days > STALE_DAYS)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
}

export interface ReviewChapter {
  chapterId: string;
  subjectId: string;
  label: string;
  category: string;
  lastStudied: Date | null;
  daysSince: number | null;
  assessment: string;
  dueDays: number;
}

// Revisão espaçada: capítulos de disciplinas com avaliação nos próximos 14
// dias que não estudas há 7 dias ou mais (os nunca estudados primeiro).
export function chaptersToReview({
  chapters,
  sessions,
  assessments,
  today,
}: {
  chapters: { id: string; subject_id: string; number: string | number | null; title: string | null; category: string | null }[];
  sessions: PlanSession[];
  assessments: AssessmentItem[];
  today: Date;
}): ReviewChapter[] {
  const t0 = startOfDay(today);
  const nextBySubject = new Map<string, { title: string; days: number }>();
  for (const a of assessments) {
    if (getItemEffectiveGrade(a) !== null) continue;
    const due = parseDueDate(a.due_date);
    if (!due || due < t0) continue;
    const days = Math.round((due.getTime() - t0.getTime()) / DAY_MS);
    if (days > PREP_DAYS) continue;
    const cur = nextBySubject.get(a.subject_id);
    if (!cur || days < cur.days) nextBySubject.set(a.subject_id, { title: a.title || 'Avaliação', days });
  }
  const last = new Map<string, number>();
  for (const s of sessions) {
    if (!s.chapter_id) continue;
    const t = new Date(s.started_at).getTime();
    if (t > (last.get(String(s.chapter_id)) ?? 0)) last.set(String(s.chapter_id), t);
  }
  const out: ReviewChapter[] = [];
  for (const ch of chapters) {
    const next = nextBySubject.get(ch.subject_id);
    if (!next) continue;
    const cat = (ch.category || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (cat !== 'TEORICAS' && cat !== 'PRATICAS' && cat !== 'TESTES') continue;
    const lt = last.get(ch.id);
    const daysSince = lt ? Math.floor((t0.getTime() - startOfDay(new Date(lt)).getTime()) / DAY_MS) : null;
    if (daysSince !== null && daysSince < STALE_DAYS) continue;
    out.push({
      chapterId: ch.id,
      subjectId: ch.subject_id,
      label: `${String(ch.number ?? '').padStart(2, '0')} · ${ch.title || 'Sem título'}`,
      category: cat,
      lastStudied: lt ? new Date(lt) : null,
      daysSince,
      assessment: next.title,
      dueDays: next.days,
    });
  }
  return out.sort((a, b) => a.dueDays - b.dueDays || (b.daysSince ?? 999) - (a.daysSince ?? 999));
}

export interface HoursGradeRow {
  subjectId: string;
  code: string;
  name: string;
  hours: number;
  average: number | null;
  graded: number;
  total: number;
}

// Horas estudadas no semestre vs. média atual de cada disciplina.
export function hoursVsGrade(subjects: PlanSubject[], assessments: AssessmentItem[], sessions: PlanSession[], since: Date): HoursGradeRow[] {
  return subjects.map((s) => {
    const items = assessments.filter((a) => a.subject_id === s.id);
    const theory = typeof s.theoretical_weight === 'number' ? s.theoretical_weight : 50;
    const practice = typeof s.practical_weight === 'number' ? s.practical_weight : 50;
    const graded = items.filter((a) => getItemEffectiveGrade(a) !== null).length;
    return {
      subjectId: s.id,
      code: s.code || (s.name || '?').slice(0, 3).toUpperCase(),
      name: s.name || s.code || 'Disciplina',
      hours: hoursIn(sessions.filter((x) => x.subject_id === s.id), since, new Date(8640000000000000)),
      average: graded ? currentAverage(items, theory, practice) : null,
      graded,
      total: items.length,
    };
  });
}

// Dias seguidos com estudo, a contar de hoje (ou de ontem, se hoje ainda nada).
export function studyStreak(sessions: PlanSession[], today: Date): number {
  const days = new Set(sessions.map((s) => startOfDay(new Date(s.started_at)).getTime()));
  let d = startOfDay(today);
  if (!days.has(d.getTime())) d = addDays(d, -1);
  let n = 0;
  while (days.has(d.getTime())) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
