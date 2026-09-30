// Modelo de dados do painel da página principal: normaliza aulas
// (recorrentes, a partir de `subjects.schedules`), prazos (`assessments`),
// tarefas (`work_tasks`) e eventos locais (localStorage) num único tipo
// de evento, usado pelo índice do dia, grelha semanal e calendário mensal.

import type { WorkProject, WorkTask } from '@/lib/workData';
import { addMinutes, fmtDuration, normTime } from '@/app/faculdade/[id]/components/disciplinaData';
import {
  AssessmentLite,
  ClassOccurrence,
  SubjectLite,
  parseDueDate,
  parseMinutes,
} from '../homeAgenda';

// fac = aula (petróleo) · trab = trabalho (osso) · prazo = avaliação (gelo)
// pessoal = evento local (contorno)
export type PainelCat = 'fac' | 'trab' | 'prazo' | 'pessoal';

export interface PainelEvent {
  id: string;
  cat: PainelCat;
  time: string | null;
  until: string | null;
  title: string;
  place: string;
  desc: string;
  href?: string;
  subjectId?: string;
  isDeadline: boolean;
}

export interface AssessmentFull extends AssessmentLite {
  weight_percent?: number | null;
  category?: string | null;
  grade?: number | null;
  due_time?: string | null;
  duration_minutes?: number | null;
}

export interface ChapterLite {
  id: string;
  subject_id: string;
  category: string | null;
  title: string | null;
  updated_at: string | null;
}

// Eventos criados no calendário mensal. Não há tabela de eventos no
// Supabase, por isso ficam guardados só neste browser (localStorage).
export interface LocalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  cat: PainelCat;
}

export const CAT_LABEL: Record<PainelCat, string> = {
  fac: 'Faculdade',
  trab: 'Trabalho',
  prazo: 'Prazo',
  pessoal: 'Pessoal',
};

export const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const MONTHS_SHORT_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];
// Convenção Date.getDay(): 0 = Domingo.
export const WEEKDAY_LONG_PT = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
];
export const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_HERO_PT = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];

const CLASS_TYPE_LABEL: Record<string, string> = {
  T: 'Teórica',
  'TEÓRICA': 'Teórica',
  TEORICA: 'Teórica',
  P: 'Prática',
  'PRÁTICA': 'Prática',
  PRATICA: 'Prática',
  TP: 'Teórico-prática',
  'TEÓRICO-PRÁTICA': 'Teórico-prática',
};

const NOTEBOOK_LABEL: Record<string, string> = {
  TEORICAS: 'Teóricas',
  PRATICAS: 'Práticas',
  TESTES: 'Testes',
};

export function classTypeLabel(type: string): string {
  if (!type) return 'Aula';
  return CLASS_TYPE_LABEL[type.toUpperCase()] || type.charAt(0) + type.slice(1).toLowerCase();
}

export function notebookLabel(category: string | null): string {
  return (category && NOTEBOOK_LABEL[category]) || 'Teóricas';
}

export function isoKey(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

// Semana ISO 8601 (segunda-feira como primeiro dia).
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const js = x.getDay();
  return addDays(x, js === 0 ? -6 : 1 - js);
}

export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT_PT[d.getMonth()]}`;
}

export function fmtNum(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

export function fmtEuro(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

export function relativeTime(iso: string | null, now: Date): string {
  if (!iso) return 'sem edições';
  const diffMin = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem.`;
  return `há ${Math.floor(days / 30)} meses`;
}

export function subjectShortName(s: SubjectLite | undefined): string {
  if (!s) return 'Disciplina';
  return s.code || s.name || 'Disciplina';
}

export function subjectLongName(s: SubjectLite | undefined): string {
  if (!s) return 'Disciplina';
  return s.name || s.code || 'Disciplina';
}

export interface EventSources {
  classes: ClassOccurrence[];
  assessments: AssessmentFull[];
  tasks: WorkTask[];
  localEvents: LocalEvent[];
  subjectLookup: Map<string, SubjectLite>;
  projectLookup: Map<string, WorkProject>;
}

// Eventos de UM dia (`date` à meia-noite local), ordenados por hora;
// os sem hora (prazos, tarefas) vão para o fim.
export function buildEventsForDate(date: Date, src: EventSources): PainelEvent[] {
  const key = isoKey(date);
  const dayMs = startOfDay(date).getTime();
  const out: PainelEvent[] = [];

  src.classes
    .filter((c) => c.dayNum === date.getDay())
    .forEach((c) => {
      const subject = src.subjectLookup.get(c.subjectId);
      const typeLabel = classTypeLabel(c.type);
      const place = c.room ? `Sala ${c.room}` : 'Sala a definir';
      const range = c.endTime ? `${c.startTime} às ${c.endTime}` : `Às ${c.startTime}`;
      out.push({
        id: `aula-${c.subjectId}-${c.startTime}-${key}`,
        cat: 'fac',
        time: c.startTime,
        until: c.endTime || null,
        title: subjectLongName(subject),
        place,
        desc: `${range}. ${typeLabel}, ${place}.`,
        href: `/faculdade/${c.subjectId}`,
        subjectId: c.subjectId,
        isDeadline: false,
      });
    });

  src.assessments.forEach((a) => {
    const due = parseDueDate(a.due_date);
    if (!due || due.getTime() !== dayMs) return;
    const subject = src.subjectLookup.get(a.subject_id);
    const weight = typeof a.weight_percent === 'number' ? ` Peso: ${a.weight_percent}%.` : '';
    // Testes com hora entram na grelha no sítio certo, com a duração.
    const start = normTime(a.due_time);
    const until = start && a.duration_minutes ? addMinutes(start, a.duration_minutes) : null;
    const when = start ? (until ? ` Das ${start} às ${until} (${fmtDuration(a.duration_minutes)}).` : ` Às ${start}.`) : '';
    out.push({
      id: `prazo-${a.id}`,
      cat: 'prazo',
      time: start,
      until,
      title: a.title || 'Avaliação',
      place: subjectShortName(subject),
      desc: `Avaliação de ${subjectLongName(subject)}.${when}${weight}`,
      href: `/faculdade/${a.subject_id}`,
      subjectId: a.subject_id,
      isDeadline: true,
    });
  });

  src.tasks
    .filter((t) => !t.completed)
    .forEach((t) => {
      const due = parseDueDate(t.due_date);
      if (!due || due.getTime() !== dayMs) return;
      const project = t.project_id ? src.projectLookup.get(t.project_id) : undefined;
      out.push({
        id: `tarefa-${t.id}`,
        cat: 'trab',
        time: null,
        until: null,
        title: t.title,
        place: project?.name || 'Sem projeto',
        desc: `Tarefa de ${project?.name || 'trabalho'}, com prazo neste dia.`,
        href: '/trabalho',
        isDeadline: false,
      });
    });

  src.localEvents
    .filter((e) => e.date === key)
    .forEach((e) => {
      out.push({
        id: `local-${e.id}`,
        cat: e.cat,
        time: e.time || null,
        until: null,
        title: e.title,
        place: 'Evento local',
        desc: 'Adicionado manualmente no calendário (guardado neste browser).',
        isDeadline: false,
      });
    });

  out.sort((a, b) => {
    if (a.time && b.time) return parseMinutes(a.time) - parseMinutes(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  return out;
}
