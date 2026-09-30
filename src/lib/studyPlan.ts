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

export const PREP_SHARE = 0.35;
export const PREP_DAYS = 14;
// Sem datas nas definições: 14 semanas de aulas + 4 de exames.
const DEFAULT_CLASS_WEEKS = 14;
const DEFAULT_TOTAL_WEEKS = 18;
const DAY_MS = 86400000;

export interface StudySettings {
  hoursPerEcts: number;
  semesterStart: string | null; // AAAA-MM-DD
  semesterEnd: string | null;
  examsEnd: string | null;
}

export const DEFAULT_SETTINGS: StudySettings = { hoursPerEcts: 28, semesterStart: null, semesterEnd: null, examsEnd: null };

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
  kind: 'base' | 'prep' | 'grade' | 'info';
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
}: {
  subjects: PlanSubject[];
  assessments: AssessmentItem[];
  sessions: PlanSession[];
  settings: StudySettings;
  today: Date;
}): { rows: SubjectPlan[]; period: PlanPeriod } {
  const period = planPeriod(settings, today);
  const t0 = startOfDay(today);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 7);

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
    for (const { a, due } of pending) {
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

    const suggestedWeek = roundHalf((baseWeek + prepWeek) * factor);
    const doneWeek = hoursIn(mine, weekStart, weekEnd);
    const doneToday = hoursIn(mine, t0, addDays(t0, 1));
    const last = mine.reduce<number>((m, x) => Math.max(m, new Date(x.started_at).getTime()), 0);

    const prepMain = reasons.filter((r) => r.kind === 'prep').sort((x, y) => (y.hours ?? 0) - (x.hours ?? 0))[0];
    const main = prepMain
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
