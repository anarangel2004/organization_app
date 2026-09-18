// Agregação de dados da página principal: normalização de horários,
// datas de prazos e a lista de ocorrências de aulas usada para calcular
// a próxima aula e o Ritmo Semanal.

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
  room: string;
  type: string;
}

export const DAY_NAME_TO_NUM: Record<string, number> = {
  'SEGUNDA-FEIRA': 1, SEGUNDA: 1, SEG: 1,
  'TERÇA-FEIRA': 2, 'TERCA-FEIRA': 2, TERÇA: 2, TERCA: 2, TER: 2,
  'QUARTA-FEIRA': 3, QUARTA: 3, QUA: 3,
  'QUINTA-FEIRA': 4, QUINTA: 4, QUI: 4,
  'SEXTA-FEIRA': 5, SEXTA: 5, SEX: 5,
};

export const DAY_NUM_TO_LABEL: Record<number, string> = {
  1: 'SEG', 2: 'TER', 3: 'QUA', 4: 'QUI', 5: 'SEX',
};

export const PT_WEEKDAY_LABEL = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function normalizeDayNum(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw >= 1 && raw <= 5 ? raw : null;
  const clean = String(raw).trim().toUpperCase();
  if (DAY_NAME_TO_NUM[clean]) return DAY_NAME_TO_NUM[clean];
  const numeric = Number(clean);
  if (!Number.isNaN(numeric)) return numeric >= 1 && numeric <= 5 ? numeric : null;
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

export function collectClasses(subjects: SubjectLite[]): ClassOccurrence[] {
  const out: ClassOccurrence[] = [];
  for (const s of subjects) {
    for (const e of parseSchedulesRaw(s.schedules)) {
      const dayNum = normalizeDayNum(e.day ?? e.dayOfWeek);
      const startTime = e.startTime || e.start_time || '';
      if (!dayNum || !startTime) continue;
      out.push({
        subjectId: s.id,
        subjectCode: s.code || s.name || '???',
        dayNum,
        startTime,
        room: e.room || e.sala || '',
        type: (e.type || e.tipo || '').toUpperCase(),
      });
    }
  }
  return out;
}
