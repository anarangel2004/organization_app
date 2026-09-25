// Agregação de dados da página principal: normalização de horários,
// datas de prazos, a lista de ocorrências de aulas e as linhas de agenda
// por dia — partilhadas entre o Ritmo Semanal (grelha) e o mini-calendário
// mensal.

import type { WorkProject, WorkTask } from '@/lib/workData';
import type { AgendaRow } from './types';

export interface SubjectLite {
  id: string;
  name: string | null;
  code: string | null;
  schedules: unknown;
}

export interface AssessmentLite {
  id: string;
  subject_id: string;
  title: string | null;
  due_date: string | null;
}

export interface RawScheduleEntry {
  day?: unknown;
  dayOfWeek?: unknown;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  room?: string;
  sala?: string;
  type?: string;
  tipo?: string;
}

export interface ClassOccurrence {
  subjectId: string;
  subjectCode: string;
  dayNum: number;
  startTime: string;
  endTime: string;
  room: string;
  type: string;
  color: string;
}

export interface SubjectHours {
  subjectId: string;
  code: string;
  color: string;
  hours: number;
}

// Convenção igual a Date.getDay(): 0 = Domingo ... 6 = Sábado.
export const DAY_NAME_TO_NUM: Record<string, number> = {
  DOMINGO: 0, DOM: 0,
  'SEGUNDA-FEIRA': 1, SEGUNDA: 1, SEG: 1,
  'TERÇA-FEIRA': 2, 'TERCA-FEIRA': 2, TERÇA: 2, TERCA: 2, TER: 2,
  'QUARTA-FEIRA': 3, QUARTA: 3, QUA: 3,
  'QUINTA-FEIRA': 4, QUINTA: 4, QUI: 4,
  'SEXTA-FEIRA': 5, SEXTA: 5, SEX: 5,
  'SÁBADO': 6, SABADO: 6, SAB: 6,
};

export const PT_WEEKDAY_LABEL = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const DAY_NUM_TO_LABEL: Record<number, string> = {
  0: 'DOM', 1: 'SEG', 2: 'TER', 3: 'QUA', 4: 'QUI', 5: 'SEX', 6: 'SÁB',
};

export function normalizeDayNum(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw >= 0 && raw <= 6 ? raw : null;
  const clean = String(raw).trim().toUpperCase();
  if (DAY_NAME_TO_NUM[clean] !== undefined) return DAY_NAME_TO_NUM[clean];
  const numeric = Number(clean);
  if (!Number.isNaN(numeric)) return numeric >= 0 && numeric <= 6 ? numeric : null;
  return null;
}

export function parseMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function parseSchedulesRaw(raw: unknown): RawScheduleEntry[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  return Array.isArray(value) ? (value as RawScheduleEntry[]) : [];
}

export function parseDueDate(dueDateStr: string | null): Date | null {
  if (!dueDateStr) return null;
  const cleanDateStr = dueDateStr.split('T')[0];
  const [year, month, day] = cleanDateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDaysLeftLabel(date: Date, now: Date): string {
  const todayMid = new Date(now);
  todayMid.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'HOJE';
  if (diffDays === 1) return 'AMANHÃ';
  return `${diffDays} DIAS`;
}

export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Paleta categórica validada (skill dataviz: OKLab CVD-safe, ordem fixa,
// nunca ciclada) — 7 tons, sem o vermelho (#e34948 seria o 8º), que fica
// reservado ao estado CRÍTICO / linha "agora" da grelha semanal.
const CATEGORICAL_PALETTE = [
  '#2a78d6', // azul
  '#eb6834', // laranja
  '#1baf7a', // água
  '#eda100', // amarelo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
];
const OVERFLOW_COLOR = '#57534E'; // cinza-tinta, além da 7ª disciplina em simultâneo

// Atribui cor por disciplina em ordem fixa (nunca por hash/ciclo aleatório),
// ordenando por código para que a atribuição seja estável entre renders.
export function buildSubjectColorMap(subjects: SubjectLite[]): Map<string, string> {
  const sorted = [...subjects].sort((a, b) =>
    (a.code || a.name || '').localeCompare(b.code || b.name || '')
  );
  const map = new Map<string, string>();
  sorted.forEach((s, idx) => {
    map.set(s.id, idx < CATEGORICAL_PALETTE.length ? CATEGORICAL_PALETTE[idx] : OVERFLOW_COLOR);
  });
  return map;
}

export function collectClasses(subjects: SubjectLite[]): ClassOccurrence[] {
  const colorMap = buildSubjectColorMap(subjects);
  const out: ClassOccurrence[] = [];
  for (const s of subjects) {
    const color = colorMap.get(s.id) || OVERFLOW_COLOR;
    for (const e of parseSchedulesRaw(s.schedules)) {
      const dayNum = normalizeDayNum(e.day ?? e.dayOfWeek);
      const startTime = e.startTime || e.start_time || '';
      if (dayNum === null || !startTime) continue;
      out.push({
        subjectId: s.id,
        subjectCode: s.code || s.name || '???',
        dayNum,
        startTime,
        endTime: e.endTime || e.end_time || '',
        room: e.room || e.sala || '',
        type: (e.type || e.tipo || '').toUpperCase(),
        color,
      });
    }
  }
  return out;
}

// Soma as horas semanais de aula por disciplina (as ocorrências em
// `classes` já são uma-por-semana, recorrentes) — alimenta o gráfico de
// carga semanal por disciplina.
export function computeSubjectHours(classes: ClassOccurrence[]): SubjectHours[] {
  const map = new Map<string, SubjectHours>();
  classes.forEach((c) => {
    const startMin = parseMinutes(c.startTime);
    const endMin = c.endTime ? parseMinutes(c.endTime) : startMin + 90;
    const duration = Math.max(endMin - startMin, 0) / 60;
    const existing = map.get(c.subjectId);
    if (existing) {
      existing.hours += duration;
    } else {
      map.set(c.subjectId, { subjectId: c.subjectId, code: c.subjectCode, color: c.color, hours: duration });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
}

// Constrói as linhas de agenda (aulas + prazos + tarefas) de UM dia
// específico — usado tanto pela grelha semanal (7 dias) como pelo
// mini-calendário mensal (até 42 dias). `date` deve estar à meia-noite local.
export function buildDayRows(
  date: Date,
  classes: ClassOccurrence[],
  assessments: AssessmentLite[],
  workTasks: WorkTask[],
  subjectLookup: Map<string, SubjectLite>,
  projectLookup: Map<string, WorkProject>
): AgendaRow[] {
  const jsDayOfCell = date.getDay();
  const dateKey = date.toISOString().slice(0, 10);
  const rows: AgendaRow[] = [];

  classes
    .filter((c) => c.dayNum === jsDayOfCell)
    .sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime))
    .forEach((c) => {
      rows.push({
        id: `aula-${c.subjectId}-${c.startTime}-${dateKey}`,
        kind: 'AULA',
        time: c.startTime,
        endTime: c.endTime || null,
        title: `${c.subjectCode}${c.type ? ` · ${c.type}` : ''}`,
        subtitle: c.room ? `SALA ${c.room}` : 'AULA',
        color: c.color,
      });
    });

  assessments.forEach((a) => {
    const due = parseDueDate(a.due_date);
    if (due && due.getTime() === date.getTime()) {
      const subject = subjectLookup.get(a.subject_id);
      rows.push({
        id: `prazo-${a.id}-${dateKey}`,
        kind: 'PRAZO',
        time: null,
        title: a.title || 'AVALIAÇÃO',
        subtitle: subject?.code || subject?.name || 'FACULDADE',
      });
    }
  });

  workTasks
    .filter((t) => !t.completed)
    .forEach((t) => {
      const due = parseDueDate(t.due_date);
      if (due && due.getTime() === date.getTime()) {
        const project = t.project_id ? projectLookup.get(t.project_id) : undefined;
        rows.push({
          id: `tarefa-${t.id}-${dateKey}`,
          kind: 'TAREFA',
          time: null,
          title: t.title,
          subtitle: project?.name || 'SEM PROJETO',
        });
      }
    });

  rows.sort((a, b) => {
    if (a.time && b.time) return parseMinutes(a.time) - parseMinutes(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  return rows;
}
