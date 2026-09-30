// Modelo de dados da página de cada disciplina (vista densa).

import type { AssessmentItem } from '@/types';
import { getItemEffectiveGrade } from '@/lib/utils';
import { normalizeDayNum, parseDueDate, parseMinutes, parseSchedulesRaw } from '@/app/components/homeAgenda';

export type Teacher = string | { name?: string | null; email?: string | null } | null | undefined;

export interface SubjectFull {
  id: string;
  code: string | null;
  name: string | null;
  ects?: number | null;
  semester?: number | null;
  degree_year?: number | null;
  academic_year?: string | null;
  teacher_teorica?: Teacher;
  teacher_pratica?: Teacher;
  regente?: Teacher;
  schedules?: unknown;
  theoretical_weight?: number | null;
  practical_weight?: number | null;
}

export interface ChapterRow {
  id: string;
  subject_id: string;
  category: string | null;
  title: string | null;
  is_completed?: boolean | null;
  updated_at?: string | null;
}

export interface FileRow {
  id: string;
  subject_id: string;
  title: string | null;
  file_name: string | null;
  file_url: string | null;
  category: string | null;
  created_at: string;
}

// Tarefas da disciplina: não há tabela no Supabase (as `work_tasks` são
// do Trabalho e não têm disciplina), por isso ficam neste browser.
export interface LocalTask {
  id: string;
  text: string;
  done: boolean;
}

export type LibCategory = 'TEÓRICAS' | 'PRÁTICAS' | 'EXAMES' | 'GERAL';
export type DocType = 'PDF' | 'ZIP' | 'LINK' | 'MD' | 'DOC' | 'IMG';

export interface LibDoc {
  id: string;
  title: string;
  url: string;
  type: DocType;
  category: LibCategory;
  createdAt: string;
}

export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function teacherName(t: Teacher): string | null {
  if (!t) return null;
  if (typeof t === 'string') return t.trim() || null;
  return t.name?.trim() || null;
}

export function initials(name: string): string {
  const words = name.replace(/^(prof\.?ª?|prof\.?|dr\.?ª?|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function fmtGrade(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

// ==========================================
// HORÁRIO
// ==========================================
export type Branch = 'T' | 'P' | 'TP' | 'O';

export interface Slot {
  key: string;
  dayNum: number;
  start: string;
  end: string;
  room: string;
  typeLabel: string;
  branch: Branch;
}

export function branchOf(type: string): Branch {
  const t = type.toUpperCase();
  if (t.startsWith('TEÓRICO-P') || t.startsWith('TEORICO-P') || t === 'TP') return 'TP';
  if (t.startsWith('P')) return 'P';
  if (t.startsWith('T')) return 'T';
  return 'O';
}

const BRANCH_LABEL: Record<Branch, string> = { T: 'Teórica', P: 'Prática', TP: 'Teórico-prática', O: 'Sessão' };

export function parseSlots(raw: unknown): Slot[] {
  return parseSchedulesRaw(raw)
    .map((e, i) => {
      const dayNum = normalizeDayNum(e.day ?? e.dayOfWeek);
      const start = e.startTime || e.start_time || '';
      if (dayNum === null || !start) return null;
      const type = e.type || e.tipo || '';
      const branch = branchOf(type);
      return {
        key: `${i}-${dayNum}-${start}`,
        dayNum,
        start,
        end: e.endTime || e.end_time || '',
        room: e.room || e.sala || '',
        typeLabel: type ? BRANCH_LABEL[branch] : 'Aula',
        branch,
      };
    })
    .filter((x): x is Slot => x !== null)
    .sort((a, b) => ((a.dayNum + 6) % 7) - ((b.dayNum + 6) % 7) || parseMinutes(a.start) - parseMinutes(b.start));
}

export interface NextSlot {
  slot: Slot;
  offset: number; // dias a partir de hoje
  inProgress: boolean;
}

export function nextSlot(slots: Slot[], now: Date): NextSlot | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: NextSlot | null = null;
  let bestStart = 0;
  for (const slot of slots) {
    const start = parseMinutes(slot.start);
    const end = slot.end ? parseMinutes(slot.end) : start + 90;
    let offset = (slot.dayNum - now.getDay() + 7) % 7;
    if (offset === 0 && nowMin >= end) offset = 7;
    if (!best || offset < best.offset || (offset === best.offset && start < bestStart)) {
      best = { slot, offset, inProgress: offset === 0 && nowMin >= start && nowMin < end };
      bestStart = start;
    }
  }
  return best;
}

export function dayWord(offset: number, dayNum: number): string {
  if (offset === 0) return 'Hoje';
  if (offset === 1) return 'Amanhã';
  return WEEKDAY_LONG[dayNum];
}

// ==========================================
// AVALIAÇÃO (mesma fórmula da secção de avaliação)
// ==========================================
export function branchAverage(items: AssessmentItem[], category: 'TEORICA' | 'PRATICA'): number | null {
  const graded = items.filter((i) => i.category === category && getItemEffectiveGrade(i) !== null);
  const weight = graded.reduce((acc, i) => acc + (i.weight_percent || 0), 0);
  if (weight === 0) return null;
  const sum = graded.reduce((acc, i) => acc + (getItemEffectiveGrade(i) ?? 0) * ((i.weight_percent || 0) / 100), 0);
  return sum / (weight / 100);
}

export function currentAverage(items: AssessmentItem[], theory: number, practice: number): number | null {
  const t = branchAverage(items, 'TEORICA');
  const p = branchAverage(items, 'PRATICA');
  if (t !== null && p !== null) {
    const total = theory + practice;
    return total === 0 ? null : (t * theory + p * practice) / total;
  }
  return t ?? p;
}

// Peso de um componente na nota final: peso no ramo × peso do ramo.
export function effectiveWeight(item: AssessmentItem, theory: number, practice: number): number {
  const branch = item.category === 'PRATICA' ? practice : theory;
  return ((item.weight_percent || 0) * branch) / 100;
}

// ==========================================
// HORA E DURAÇÃO DOS TESTES
// ==========================================
// "09:00:00" (coluna time) ou "9:00" → "09:00"; vazio → null.
export function normTime(t: string | null | undefined): string | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

// 90 → "1h30", 120 → "2h", 45 → "45 min".
export function fmtDuration(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// "09:00" + 90 → "10:30".
export function addMinutes(time: string, min: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + min) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// "09:00–10:30" (com duração), "09:00" (sem duração) ou null (sem hora).
export function assessmentTimeRange(a: { due_time?: string | null; duration_minutes?: number | null }): string | null {
  const start = normTime(a.due_time);
  if (!start) return null;
  return a.duration_minutes ? `${start}–${addMinutes(start, a.duration_minutes)}` : start;
}

// "5 nov" → "5 nov · 09:00–10:30" quando há hora.
export function dueLabel(a: { due_time?: string | null; duration_minutes?: number | null }, due: Date): string {
  const range = assessmentTimeRange(a);
  return range ? `${shortDate(due)} · ${range}` : shortDate(due);
}

export function fmtPercent(n: number): string {
  return `${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`;
}

// ==========================================
// BIBLIOTECA
// ==========================================
const CATEGORY_ALIASES: Record<string, LibCategory> = {
  'TEÓRICAS': 'TEÓRICAS',
  TEORICAS: 'TEÓRICAS',
  'PRÁTICAS': 'PRÁTICAS',
  PRATICAS: 'PRÁTICAS',
  EXAMES: 'EXAMES',
  GERAL: 'GERAL',
};

export function detectType(name: string, url: string): DocType {
  const s = `${name} ${url}`.toLowerCase();
  if (/\.pdf\b/.test(s)) return 'PDF';
  if (/\.(zip|rar|7z)\b/.test(s)) return 'ZIP';
  if (/\.(md|txt)\b/.test(s)) return 'MD';
  if (/\.(docx?|pptx?|xlsx?|odt)\b/.test(s)) return 'DOC';
  if (/\.(png|jpe?g|gif|webp|svg)\b/.test(s)) return 'IMG';
  return 'LINK';
}

export function toLibDoc(row: FileRow): LibDoc {
  // O título pode trazer o volume no fim, ex.: "Slides T03 (VOL. 03)".
  const rawTitle = row.title || row.file_name || 'Sem título';
  const title = rawTitle.replace(/\s*\((VOL\.\s*[^)]+)\)$/i, '').trim() || rawTitle;
  return {
    id: String(row.id),
    title,
    url: row.file_url || '',
    type: detectType(row.file_name || '', row.file_url || ''),
    category: CATEGORY_ALIASES[(row.category || '').toUpperCase()] || 'GERAL',
    createdAt: row.created_at,
  };
}

export const SECTION_SHORT: Record<LibCategory, string> = {
  'TEÓRICAS': 'Teór.',
  'PRÁTICAS': 'Prát.',
  EXAMES: 'Exames',
  GERAL: 'Geral',
};

export const TYPE_COLOR: Record<DocType, string> = {
  PDF: 'var(--sky)',
  LINK: 'var(--bone)',
  ZIP: '#c9a27a',
  MD: 'var(--mut)',
  DOC: 'var(--ice)',
  IMG: 'var(--ice)',
};

export function isPastDue(dueDate: string | null, today: Date): boolean {
  const d = parseDueDate(dueDate);
  return d !== null && d < today;
}
