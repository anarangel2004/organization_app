// Percurso de estudo até ao próximo teste, a partir das aulas dadas:
//   Teórica 1 → Prática 1 → Teórica 2 → Prática 2 → … → treinar testes anteriores.
// O total de horas continua a vir dos ECTS (studyPlan.ts); aqui decide-se a
// ordem, o que falta e o que fazer a seguir. É dinâmico: cada capítulo
// concluído sai da lista e o que já estudaste em cada um desconta.
//
// Também aqui: as horas das aulas de cada disciplina (o contador não conta
// durante a aula da própria disciplina) e o juntar de sessões seguidas.

import { parseMinutes, parseSchedulesRaw, normalizeDayNum } from '@/app/components/homeAgenda';

const DAY_MS = 86400000;

// Parte do estudo para um teste que vai para treinar testes anteriores.
export const TEST_TRAINING_SHARE = 0.25;
// Sessões da mesma disciplina e capítulo com esta pausa ou menos são uma só.
export const MERGE_GAP_MIN = 15;

// ==========================================
// AULAS
// ==========================================
export type ClassKind = 'T' | 'P' | 'TP';

export interface ClassSlot {
  day: number; // 0 = domingo
  start: number; // minutos
  end: number;
  kind: ClassKind;
}

function fold(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function classKind(type?: string | null): ClassKind {
  const t = fold(type || '');
  if (t === 'TP' || t.startsWith('TEORICO-PRAT') || t.startsWith('TEORICO PRAT')) return 'TP';
  if (t === 'P' || t.startsWith('PRAT') || t === 'PL' || t.startsWith('LAB')) return 'P';
  return 'T';
}

export function classSlots(schedules: unknown): ClassSlot[] {
  const out: ClassSlot[] = [];
  for (const e of parseSchedulesRaw(schedules)) {
    const day = normalizeDayNum(e.day ?? e.dayOfWeek);
    const startRaw = e.startTime || e.start_time;
    if (day === null || !startRaw) continue;
    const start = parseMinutes(startRaw);
    const endRaw = e.endTime || e.end_time;
    out.push({ day, start, end: endRaw ? parseMinutes(endRaw) : start + 90, kind: classKind(e.type || e.tipo) });
  }
  return out;
}

// Período em que há aulas (fora dele, o horário não conta).
export interface ClassRange {
  start: Date | null;
  end: Date | null;
}

const inRange = (d: Date, range?: ClassRange) => (!range?.start || d >= range.start) && (!range?.end || d < new Date(range.end.getTime() + DAY_MS));

// A aula da disciplina está a decorrer neste instante?
export function isInClass(slots: ClassSlot[], at: Date, range?: ClassRange): boolean {
  if (!slots.length || !inRange(at, range)) return false;
  const min = at.getHours() * 60 + at.getMinutes();
  return slots.some((s) => s.day === at.getDay() && min >= s.start && min < s.end);
}

// Milissegundos de aula entre a e b.
export function classOverlapMs(slots: ClassSlot[], a: Date, b: Date, range?: ClassRange): number {
  if (!slots.length || b <= a) return 0;
  let total = 0;
  const day = new Date(a);
  day.setHours(0, 0, 0, 0);
  for (; day < b; day.setDate(day.getDate() + 1)) {
    if (!inRange(day, range)) continue;
    for (const s of slots) {
      if (s.day !== day.getDay()) continue;
      const cs = day.getTime() + s.start * 60000;
      const ce = day.getTime() + s.end * 60000;
      total += Math.max(0, Math.min(ce, b.getTime()) - Math.max(cs, a.getTime()));
    }
  }
  return total;
}

// ==========================================
// SESSÕES: sem o tempo de aula, e juntar as seguidas
// ==========================================
interface SessionLike {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
}

// Tira a cada sessão a parte que coincide com uma aula da própria disciplina
// (proporcional ao tempo ativo). Não muda nada no servidor.
export function withoutClassTime<T extends SessionLike>(sessions: T[], slotsBySubject: Map<string, ClassSlot[]>, range?: ClassRange): T[] {
  const out: T[] = [];
  for (const s of sessions) {
    const slots = slotsBySubject.get(String(s.subject_id));
    const a = new Date(s.started_at);
    const b = new Date(s.ended_at);
    const span = b.getTime() - a.getTime();
    const overlap = slots ? classOverlapMs(slots, a, b, range) : 0;
    if (overlap <= 0 || span <= 0) {
      out.push(s);
      continue;
    }
    const left = Math.round(s.duration_seconds * Math.max(0, 1 - overlap / span));
    if (left >= 60) out.push({ ...s, duration_seconds: left });
  }
  return out;
}

// Grupos de sessões a juntar: mesma disciplina e capítulo, com ≤ 15 min entre elas.
export function mergeGroups<T extends SessionLike>(sessions: T[], gapMin = MERGE_GAP_MIN): T[][] {
  const sorted = [...sessions].sort((x, y) => x.started_at.localeCompare(y.started_at));
  const open = new Map<string, T[]>();
  const groups: T[][] = [];
  for (const s of sorted) {
    const key = `${s.subject_id}|${s.chapter_id ?? ''}`;
    const g = open.get(key);
    const last = g?.[g.length - 1];
    if (g && last && new Date(s.started_at).getTime() - new Date(last.ended_at).getTime() <= gapMin * 60000) g.push(s);
    else {
      const ng = [s];
      open.set(key, ng);
      groups.push(ng);
    }
  }
  return groups;
}

// ==========================================
// PERCURSO ATÉ AO TESTE
// ==========================================
export interface PathChapter {
  id: string;
  subject_id: string;
  number: string | number | null;
  title: string | null;
  category: string | null;
  is_completed?: boolean | null;
  created_at?: string | null;
}

export type StepKind = 'T' | 'P' | 'TESTES';

export interface PathStep {
  key: string;
  kind: StepKind;
  index: number; // Teórica 3 → 3
  label: string; // "Teórica 3", "Prática 3", "Testes anteriores"
  chapterId: string | null;
  chapterTitle: string;
  category: 'TEORICAS' | 'PRATICAS' | 'TESTES';
  given: boolean; // a aula já foi dada
  done: boolean; // capítulo marcado como concluído
  budget: number; // horas previstas
  studied: number; // horas já estudadas neste capítulo (desde o teste anterior)
  left: number;
}

export interface TestPath {
  title: string;
  due: Date;
  scopeStart: Date;
  steps: PathStep[]; // aulas (T/P), por ordem
  training: PathStep; // treinar testes anteriores
  next: PathStep | null; // o próximo passo por fazer
  budget: number;
  left: number;
}

export const chapterTab = (category: string | null | undefined): 'TEORICAS' | 'PRATICAS' | 'TESTES' | null => {
  const c = fold(category || '');
  if (c.startsWith('TEOR')) return 'TEORICAS';
  if (c.startsWith('PRAT')) return 'PRATICAS';
  if (c.startsWith('TEST')) return 'TESTES';
  return null;
};

export const chapterHref = (subjectId: string, step: { chapterId: string | null; category: string }) =>
  step.chapterId ? `/faculdade/${subjectId}/notebook?tab=${step.category}&chapter=${step.chapterId}` : `/faculdade/${subjectId}/notebook?tab=${step.category}`;

// Uma aula de cada tipo por semana: a 1.ª ocorrência de cada semana conta.
function weeklyOccurrences(slots: ClassSlot[], kind: 'T' | 'P', from: Date, to: Date): Date[] {
  const mine = slots.filter((s) => s.kind === kind || s.kind === 'TP');
  if (!mine.length) return [];
  const out: Date[] = [];
  let weekKey = '';
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (; day < to; day.setDate(day.getDate() + 1)) {
    const today = mine.filter((s) => s.day === day.getDay()).sort((a, b) => a.start - b.start)[0];
    if (!today) continue;
    const at = new Date(day.getTime() + today.start * 60000);
    if (at < from || at >= to) continue;
    const monday = new Date(day);
    monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const key = monday.toDateString();
    if (key === weekKey) continue;
    weekKey = key;
    out.push(at);
  }
  return out;
}

const chapterNumber = (n: string | number | null) => {
  const v = parseInt(String(n ?? ''), 10);
  return Number.isFinite(v) ? v : null;
};

export function buildTestPath({
  subjectId,
  schedules,
  chapters,
  sessions,
  title,
  due,
  previousDue,
  semester,
  budget,
  now,
}: {
  subjectId: string;
  schedules: unknown;
  chapters: PathChapter[];
  sessions: { subject_id: string; chapter_id: string | null; started_at: string; duration_seconds: number }[];
  title: string;
  due: Date;
  previousDue: Date | null;
  semester: ClassRange;
  budget: number;
  now: Date;
}): TestPath {
  const mine = chapters.filter((c) => String(c.subject_id) === subjectId);
  const byTab = (tab: 'TEORICAS' | 'PRATICAS' | 'TESTES') => mine.filter((c) => chapterTab(c.category) === tab);
  const theory = byTab('TEORICAS');
  const practice = byTab('PRATICAS');
  const tests = byTab('TESTES');
  // Matéria deste teste: as aulas desde o dia a seguir ao teste anterior.
  const scopeStart = previousDue ? new Date(previousDue.getTime() + DAY_MS) : semester.start ?? new Date(due.getTime() - 8 * 7 * DAY_MS);

  const studiedOn = (chapterId: string) =>
    sessions
      .filter((s) => String(s.subject_id) === subjectId && String(s.chapter_id ?? '') === chapterId && new Date(s.started_at) >= scopeStart)
      .reduce((n, s) => n + s.duration_seconds / 3600, 0);

  type Raw = Omit<PathStep, 'budget' | 'studied' | 'left'>;
  const raw: Raw[] = [];
  const slots = classSlots(schedules);
  const makeStep = (kind: 'T' | 'P', index: number, given: boolean): Raw => {
    const list = kind === 'T' ? theory : practice;
    const ch = list.find((c) => chapterNumber(c.number) === index) ?? null;
    return {
      key: `${kind}${index}`,
      kind,
      index,
      label: `${kind === 'T' ? 'Teórica' : 'Prática'} ${index}`,
      chapterId: ch ? String(ch.id) : null,
      chapterTitle: ch?.title || '',
      category: kind === 'T' ? 'TEORICAS' : 'PRATICAS',
      given,
      done: !!ch?.is_completed,
    };
  };

  if (semester.start && slots.length) {
    // Pelo horário: conta as aulas desde o início do semestre; entram as deste teste.
    const end = semester.end && semester.end < due ? new Date(semester.end.getTime() + DAY_MS) : due;
    const tAll = weeklyOccurrences(slots, 'T', semester.start, end);
    const pAll = weeklyOccurrences(slots, 'P', semester.start, end);
    const n = Math.max(tAll.length, pAll.length);
    for (let i = 0; i < n; i++) {
      for (const [kind, list] of [['T', tAll], ['P', pAll]] as const) {
        const at = list[i];
        if (!at || at < scopeStart) continue;
        raw.push(makeStep(kind, i + 1, at <= now));
      }
    }
  } else {
    // Sem datas do semestre: os capítulos criados desde o teste anterior são as aulas dadas.
    const recent = (c: PathChapter) => !previousDue || !c.created_at || new Date(c.created_at) >= scopeStart;
    const nums = new Set<number>();
    for (const c of [...theory, ...practice]) {
      const n = chapterNumber(c.number);
      if (n !== null && recent(c)) nums.add(n);
    }
    for (const n of Array.from(nums).sort((a, b) => a - b)) {
      if (theory.some((c) => chapterNumber(c.number) === n)) raw.push(makeStep('T', n, true));
      if (practice.some((c) => chapterNumber(c.number) === n)) raw.push(makeStep('P', n, true));
    }
  }

  // Horas: 25% para treinar testes; o resto por igual pelas aulas.
  const trainingBudget = budget * TEST_TRAINING_SHARE;
  const per = raw.length ? (budget - trainingBudget) / raw.length : 0;
  const steps: PathStep[] = raw.map((r) => {
    const studied = r.chapterId ? studiedOn(r.chapterId) : 0;
    return { ...r, budget: per, studied, left: r.done ? 0 : Math.max(0, per - studied) };
  });
  const trainingStudied = tests.reduce((n, c) => n + studiedOn(String(c.id)), 0);
  const nextTest = [...tests].sort((a, b) => (chapterNumber(a.number) ?? 0) - (chapterNumber(b.number) ?? 0)).find((c) => !c.is_completed) ?? null;
  const training: PathStep = {
    key: 'TESTES',
    kind: 'TESTES',
    index: 0,
    label: 'Testes anteriores',
    chapterId: nextTest ? String(nextTest.id) : null,
    chapterTitle: nextTest?.title || '',
    category: 'TESTES',
    given: true,
    done: tests.length > 0 && tests.every((c) => c.is_completed),
    budget: raw.length ? trainingBudget : budget,
    studied: trainingStudied,
    left: Math.max(0, (raw.length ? trainingBudget : budget) - trainingStudied),
  };

  // Estudo sem capítulo (sessões manuais) também desconta, no total.
  const loose = sessions
    .filter((s) => String(s.subject_id) === subjectId && !s.chapter_id && new Date(s.started_at) >= scopeStart)
    .reduce((n, s) => n + s.duration_seconds / 3600, 0);
  const left = Math.max(0, steps.reduce((n, s) => n + s.left, 0) + training.left - loose);

  const next = steps.find((s) => s.given && !s.done) ?? (training.done ? null : training);
  return { title, due, scopeStart, steps, training, next, budget, left };
}

// O que fazer num bloco: o próximo passo com horas por fazer; nos últimos
// dias antes do teste, treinar testes anteriores.
export function stepQueue(path: TestPath): PathStep[] {
  return [...path.steps.filter((s) => s.given && !s.done), path.training];
}

export const stepTitle = (s: PathStep) => (s.chapterTitle ? `${s.label} · ${s.chapterTitle}` : s.label);
