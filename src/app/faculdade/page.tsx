'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getAllMirror, putMirror, generateLocalId, reconcileMirror } from '@/lib/offline/db';
import { isNetworkError, queueMutation } from '@/lib/offline/sync';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate, getItemEffectiveGrade } from '@/lib/utils';
import { getWorkProjects, getWorkTasks, WorkProject, WorkTask } from '@/lib/workData';
import type { AssessmentItem } from '@/types';
import ProfileModal from '@/components/ui/ProfileModal';
import d from '@/app/components/denso/denso.module.css';
import { DensoHeader, SearchHit, ShortcutBar, ShortcutItem, scrollToId, useShortcuts } from '@/app/components/denso/DensoChrome';
import { useNow } from '@/app/components/painel/useLocalState';
import { collectClasses, computeSubjectHours, parseDueDate, parseMinutes } from '@/app/components/homeAgenda';
import { MONTHS_PT, WEEKDAY_LONG_PT, addDays, classTypeLabel, daysBetween, fmtNum, isoKey, isoWeek, mondayOf, shortDate, startOfDay } from '@/app/components/painel/painelData';
import { currentAverage, teacherName, type Teacher } from './[id]/components/disciplinaData';
import { NewSubjectPanel } from './components/NewSubjectPanel';
import {
  ClassSlot,
  DeadlineRow,
  FAC_TONES,
  FacAgora,
  FacDeadlines,
  FacHeading,
  FacSubjects,
  FacTodayList,
  FacWeek,
  OVERFLOW_TONE,
  SubjectJumps,
  SubjectRowView,
  Tone,
  WeekBlock,
  WeekMarker,
} from './components/FaculdadeDenso';
import { FacPhoneWeek, FacSubjectCards, FacTouchAgora, FacTouchHeading } from './components/FaculdadeTouch';
import { AvatarMenu, PhoneTabBar, SectionChips, TabletHeader, layoutClasses, useDensoLayout } from '@/app/components/denso/DensoTouch';
import { assessmentTag } from './[id]/notebook/components/types';

interface FacSubject {
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
  schedules: unknown;
  theoretical_weight?: number | null;
  practical_weight?: number | null;
}

const HELP: [string, string][] = [
  ['1–3, P', 'Ir para a secção'],
  ['N', 'Novo prazo'],
  ['D', 'Nova disciplina'],
  ['Ctrl K', 'Pesquisa global'],
  ['?', 'Mostrar/esconder esta ajuda'],
  ['Esc', 'Fechar'],
];

const SECTION_KEYS: Record<string, string> = { '1': 'agora', '2': 'semana', '3': 'disciplinas', p: 'prazos' };

const MONTH_INDEX: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

// Lê uma data escrita à mão ("20 nov", "20/11", "20-11-2026"); sem ano, usa a próxima ocorrência.
function parseLooseDate(text: string, today: Date): { date: Date; match: string } | null {
  const named = text.match(/\b(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s+(\d{4}))?/i);
  const numeric = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  let day: number, month: number, year: number | null;
  let match: string;
  if (named) {
    day = Number(named[1]);
    month = MONTH_INDEX[named[2].toLowerCase()];
    year = named[3] ? Number(named[3]) : null;
    match = named[0];
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
    year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : null;
    match = numeric[0];
  } else return null;
  let date = new Date(year ?? today.getFullYear(), month, day);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== month) return null;
  if (year === null && date < today) date = new Date(today.getFullYear() + 1, month, day);
  return { date, match };
}

async function readTable<T extends { id: string }>(
  table: string,
  query: () => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (error) throw error;
    const rows = data ?? [];
    await reconcileMirror(table, rows);
    return rows;
  } catch (err) {
    if (isNetworkError(err)) return getAllMirror<T>(table);
    throw err;
  }
}

// As avaliações ficam gravadas em maiúsculas ("TESTE 1"): mostrar como "Teste 1".
function niceTitle(title: string): string {
  const t = title.trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

function typeShort(type: string): string {
  const t = type.toUpperCase();
  if (t.startsWith('TEÓRICO-P') || t.startsWith('TEORICO-P') || t === 'TP') return 'TP';
  if (t.startsWith('P')) return 'P';
  if (t.startsWith('T')) return 'T';
  return t.slice(0, 2);
}

export default function FaculdadePage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [supabase] = useState(() => createClient());

  const [subjects, setSubjects] = useState<FacSubject[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [workProjects, setWorkProjects] = useState<WorkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [active, setActive] = useState('agora');
  const [helpOpen, setHelpOpen] = useState(false);
  const [newSubjectOpen, setNewSubjectOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const layout = useDensoLayout();

  const searchRef = useRef<HTMLInputElement>(null);
  const deadlineInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      // O Supabase aplica a RLS e traz apenas as disciplinas do utilizador.
      const [subs, assess, tasks, projects] = await Promise.all([
        readTable<FacSubject>('subjects', () => supabase.from('subjects').select('*')),
        readTable<AssessmentItem>('assessments', () => supabase.from('assessments').select('*')),
        getWorkTasks().catch(() => []),
        getWorkProjects().catch(() => []),
      ]);
      setSubjects(subs);
      setAssessments(assess);
      setWorkTasks(tasks);
      setWorkProjects(projects);
    } catch (err) {
      console.error('Erro ao carregar a faculdade:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido inicial de dados
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- correr apenas uma vez ao montar
  }, []);

  const now = useNow(60_000);
  const todayKey = isoKey(now);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só muda quando muda o dia
  const today = useMemo(() => startOfDay(now), [todayKey]);
  const monday = useMemo(() => mondayOf(today), [today]);

  // Tom fixo por disciplina, pela ordem do código.
  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || '')),
    [subjects]
  );
  const toneOf = useMemo(() => {
    const map = new Map<string, Tone>();
    sortedSubjects.forEach((x, i) => map.set(x.id, FAC_TONES[i] ?? OVERFLOW_TONE));
    return map;
  }, [sortedSubjects]);
  const subjectById = useMemo(() => new Map(subjects.map((x) => [x.id, x])), [subjects]);
  const projectById = useMemo(() => new Map(workProjects.map((p) => [p.id, p])), [workProjects]);
  const codeOf = useCallback((id: string) => {
    const x = subjectById.get(id);
    return x?.code || (x?.name || '?').slice(0, 3).toUpperCase();
  }, [subjectById]);
  const nameOf = useCallback((id: string) => {
    const x = subjectById.get(id);
    return x?.name || x?.code || 'Disciplina';
  }, [subjectById]);

  const classes = useMemo(() => collectClasses(subjects), [subjects]);
  const slots = useMemo<ClassSlot[]>(
    () =>
      classes.map((c) => ({
        subjectId: c.subjectId,
        // Nesta página as disciplinas aparecem pelo código (ex.: PRIVSIS).
        subjectName: codeOf(c.subjectId),
        code: codeOf(c.subjectId),
        typeLabel: classTypeLabel(c.type),
        typeShort: c.type ? typeShort(c.type) : '',
        dayNum: c.dayNum,
        start: c.startTime,
        end: c.endTime,
        room: c.room,
      })),
    [classes, codeOf]
  );
  const todaySlots = useMemo(
    () => slots.filter((s) => s.dayNum === today.getDay()).sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start)),
    [slots, today]
  );

  // ==========================================
  // CABEÇALHO
  // ==========================================
  const ects = subjects.reduce((sum, x) => sum + (Number(x.ects) || 0), 0);
  const weekHours = computeSubjectHours(classes).reduce((sum, x) => sum + x.hours, 0);
  // Semestre mais comum entre as disciplinas (não há "semestre atual" guardado).
  const semester = useMemo(() => {
    const counts = new Map<number, number>();
    subjects.forEach((x) => {
      if (x.semester) counts.set(x.semester, (counts.get(x.semester) || 0) + 1);
    });
    let best: number | null = null;
    counts.forEach((n, sem) => {
      if (best === null || n > (counts.get(best) || 0)) best = sem;
    });
    return best;
  }, [subjects]);
  const periodLabel = `${semester ? `${semester}.º semestre, ` : ''}semana ${isoWeek(today)}`;
  const meta = `${subjects.length} ${subjects.length === 1 ? 'disciplina' : 'disciplinas'} · ${ects} ECTS · ${fmtNum(weekHours)} h de aula por semana`;

  // ==========================================
  // AGORA
  // ==========================================
  const averageLabel = useMemo(() => {
    const avgs = subjects
      .map((x) =>
        currentAverage(
          assessments.filter((a) => a.subject_id === x.id),
          typeof x.theoretical_weight === 'number' ? x.theoretical_weight : 50,
          typeof x.practical_weight === 'number' ? x.practical_weight : 50
        )
      )
      .filter((v): v is number => v !== null);
    return avgs.length ? fmtNum(avgs.reduce((a, b) => a + b, 0) / avgs.length) : '—';
  }, [subjects, assessments]);

  // ==========================================
  // SEMANA
  // ==========================================
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const todayIndex = weekDays.findIndex((x) => isoKey(x) === todayKey);
  const blocks = useMemo<WeekBlock[]>(
    () =>
      slots.map((sl, i) => ({
        id: `b-${sl.subjectId}-${sl.start}-${i}`,
        dayIndex: (sl.dayNum + 6) % 7,
        start: sl.start,
        end: sl.end,
        label: [sl.code, sl.typeShort || null, sl.room || null].filter(Boolean).join(' · '),
        title: `${nameOf(sl.subjectId)} · ${sl.typeLabel} · ${sl.start}${sl.end ? `–${sl.end}` : ''}${sl.room ? ` · Sala ${sl.room}` : ''}`,
        tone: toneOf.get(sl.subjectId) ?? OVERFLOW_TONE,
        href: `/faculdade/${sl.subjectId}`,
      })),
    [slots, toneOf, nameOf]
  );
  const markers = useMemo<WeekMarker[]>(() => {
    const out: WeekMarker[] = [];
    assessments.forEach((a) => {
      const due = parseDueDate(a.due_date);
      if (!due) return;
      const idx = daysBetween(monday, due);
      if (idx >= 0 && idx < 7) out.push({ id: `m-${a.id}`, dayIndex: idx, title: `${a.title} (${codeOf(a.subject_id)})`, href: `/faculdade/${a.subject_id}` });
    });
    return out;
  }, [assessments, monday, codeOf]);
  const legend = sortedSubjects.map((x) => ({ label: codeOf(x.id), tone: toneOf.get(x.id) ?? OVERFLOW_TONE }));

  // ==========================================
  // PRAZOS (todos os futuros ainda por classificar)
  // ==========================================
  const deadlineRows = useMemo<DeadlineRow[]>(() => {
    const rows: DeadlineRow[] = [];
    assessments.forEach((a) => {
      const due = parseDueDate(a.due_date);
      if (!due || due < today || getItemEffectiveGrade(a) !== null) return;
      const tone = toneOf.get(a.subject_id) ?? OVERFLOW_TONE;
      rows.push({
        id: `a-${a.id}`,
        kind: 'F',
        days: daysBetween(today, due),
        // "Teste 1 - Disciplina"; a disciplina já vai no título.
        title: `${niceTitle(a.title || 'Avaliação')} - ${codeOf(a.subject_id)}`,
        source: '',
        date: shortDate(due),
        dot: tone.bg === 'transparent' ? tone.bd : tone.bg,
        href: `/faculdade/${a.subject_id}#avaliacao`,
        tag: assessmentTag(a.title || ''),
      });
    });
    workTasks
      .filter((t) => !t.completed)
      .forEach((t) => {
        const due = parseDueDate(t.due_date);
        if (!due || due < today) return;
        const project = t.project_id ? projectById.get(t.project_id) : undefined;
        rows.push({
          id: `t-${t.id}`,
          kind: 'T',
          days: daysBetween(today, due),
          title: t.title,
          source: project?.name || 'Trabalho',
          date: shortDate(due),
          dot: '#8a857d',
          href: '/trabalho',
        });
      });
    return rows.sort((a, b) => a.days - b.days);
  }, [assessments, workTasks, today, toneOf, codeOf, projectById]);

  // "TP3 SD 20 nov" → avaliação "TP3" da disciplina SD a 20 de novembro.
  const createDeadline = useCallback(
    async (text: string): Promise<boolean> => {
      setCreateError(null);
      const parsed = parseLooseDate(text, today);
      if (!parsed) {
        setCreateError('Falta a data (ex.: 20 nov ou 20/11).');
        return false;
      }
      let rest = text.replace(parsed.match, ' ');
      const words = rest.split(/\s+/).filter(Boolean);
      const subject =
        subjects.find((x) => x.code && words.some((w) => w.toLowerCase() === x.code!.toLowerCase())) ||
        subjects.find((x) => x.name && rest.toLowerCase().includes(x.name.toLowerCase()));
      if (!subject) {
        setCreateError('Indica o código da disciplina (ex.: SD).');
        return false;
      }
      rest = subject.code
        ? words.filter((w) => w.toLowerCase() !== subject.code!.toLowerCase()).join(' ')
        : rest.replace(new RegExp(subject.name || '', 'i'), ' ');
      const title = rest.replace(/\s+/g, ' ').trim() || 'Prazo';
      const payload = {
        subject_id: subject.id,
        title: title.toUpperCase(),
        category: /^(tp|lab|pl|projeto|trabalho|relat)/i.test(title) ? 'PRATICA' : 'TEORICA',
        weight_percent: 0,
        due_date: isoKey(parsed.date),
        volume_ref: null,
        file_name: null,
        file_url: null,
        has_defense: false,
        grade: null,
        defense_grade: null,
        defense_date: null,
      };
      setCreating(true);
      try {
        const { data, error } = await supabase.from('assessments').insert([payload]).select().single();
        if (error) throw error;
        await putMirror('assessments', data as AssessmentItem);
        setAssessments((prev) => [...prev, data as AssessmentItem]);
        return true;
      } catch (err) {
        if (isNetworkError(err)) {
          const optimistic = { id: generateLocalId(), ...payload } as unknown as AssessmentItem;
          await putMirror('assessments', optimistic);
          await queueMutation({ table: 'assessments', op: 'insert', tempId: optimistic.id, payload });
          setAssessments((prev) => [...prev, optimistic]);
          return true;
        }
        console.error('Erro ao criar prazo:', err);
        setCreateError('Não foi possível guardar o prazo.');
        return false;
      } finally {
        setCreating(false);
      }
    },
    [subjects, supabase, today]
  );

  // ==========================================
  // TABELA DE DISCIPLINAS (ordenada pela próxima aula)
  // ==========================================
  const subjectRows = useMemo<SubjectRowView[]>(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const withNext = subjects.map((x) => {
      let best: { offset: number; start: number; s: ClassSlot } | null = null;
      for (const s of slots.filter((sl) => sl.subjectId === x.id)) {
        const start = parseMinutes(s.start);
        const end = s.end ? parseMinutes(s.end) : start + 90;
        let offset = (s.dayNum - today.getDay() + 7) % 7;
        if (offset === 0 && nowMin >= end) offset = 7;
        if (!best || offset < best.offset || (offset === best.offset && start < best.start)) best = { offset, start, s };
      }
      return { x, best };
    });
    withNext.sort((a, b) => (a.best ? a.best.offset * 1440 + a.best.start : Infinity) - (b.best ? b.best.offset * 1440 + b.best.start : Infinity));

    return withNext.map(({ x, best }) => {
      const regent = teacherName(x.regente);
      const theory = teacherName(x.teacher_teorica);
      const teacher = regent || theory || teacherName(x.teacher_pratica) || '—';
      const roles = [regent === teacher ? 'Regente' : null, theory === teacher ? 'Teórica' : null, teacherName(x.teacher_pratica) === teacher ? 'Prática' : null].filter(Boolean);

      const nextDue = assessments
        .filter((a) => a.subject_id === x.id && getItemEffectiveGrade(a) === null)
        .map((a) => ({ a, due: parseDueDate(a.due_date) }))
        .filter((r): r is { a: AssessmentItem; due: Date } => r.due !== null && r.due >= today)
        .sort((p, q) => p.due.getTime() - q.due.getTime())[0];

      let next = 'Sem aulas no horário';
      let nextWhere = '';
      if (best) {
        const day = best.offset === 0 ? 'Hoje' : best.offset === 1 ? 'Amanhã' : WEEKDAY_LONG_PT[best.s.dayNum].replace('-feira', '');
        next = `${day}, ${best.s.start}${best.s.end ? `–${best.s.end}` : ''}`;
        nextWhere = best.s.room ? `Sala ${best.s.room}` : best.s.typeLabel;
      }
      const dueDays = nextDue ? daysBetween(today, nextDue.due) : 0;

      return {
        id: x.id,
        code: codeOf(x.id),
        name: codeOf(x.id),
        // O nome completo fica na linha de baixo.
        ref: [x.name || null, x.ects ? `${x.ects} ECTS` : null].filter(Boolean).join(' · '),
        teacher,
        teacherRole: roles.join(' · ') || '',
        next,
        nextWhere,
        nextToday: best?.offset === 0,
        due: nextDue ? nextDue.a.title || 'Avaliação' : '—',
        dueWhen: nextDue ? `${shortDate(nextDue.due)} · ${dueDays === 0 ? 'hoje' : `em ${dueDays} ${dueDays === 1 ? 'dia' : 'dias'}`}` : 'sem prazos',
        dueTag: nextDue ? assessmentTag(nextDue.a.title || '') : undefined,
        tone: toneOf.get(x.id) ?? OVERFLOW_TONE,
      };
    });
  }, [subjects, slots, assessments, today, now, toneOf, codeOf]);

  // ==========================================
  // PESQUISA, ATALHOS, CONTA
  // ==========================================
  const searchIndex = useMemo<SearchHit[]>(() => {
    const hits: SearchHit[] = [];
    subjects.forEach((x) => hits.push({ id: `s-${x.id}`, label: x.name || x.code || 'Disciplina', sublabel: 'Disciplina', href: `/faculdade/${x.id}` }));
    assessments.forEach((a) => hits.push({ id: `a-${a.id}`, label: a.title || 'Avaliação', sublabel: `Avaliação · ${nameOf(a.subject_id)}`, href: `/faculdade/${a.subject_id}#avaliacao` }));
    return hits;
  }, [subjects, assessments, nameOf]);

  const goTo = useCallback(
    (id: string) => {
      setActive(id);
      // No iPad vertical e no iPhone os botões de secção ficam colados ao topo.
      const el = document.getElementById(id);
      if (el && (layout === 'phone' || layout === 'tabletV')) {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
      } else {
        scrollToId(id);
      }
    },
    [layout]
  );
  const focusDeadline = useCallback(() => {
    goTo('prazos');
    window.setTimeout(() => deadlineInputRef.current?.focus(), 250);
  }, [goTo]);
  const goNewSubject = useCallback(() => setNewSubjectOpen(true), []);

  // Links "Novo dossiê" de outras páginas chegam com #nova-disciplina: abrir o painel.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash !== '#nova-disciplina') return;
      setNewSubjectOpen(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const onShortcut = useCallback(
    (key: string) => {
      if (key === 'escape') {
        setHelpOpen(false);
        return true;
      }
      if (SECTION_KEYS[key]) goTo(SECTION_KEYS[key]);
      else if (key === 'n') focusDeadline();
      else if (key === 'd') goNewSubject();
      else if (key === '?') setHelpOpen((v) => !v);
      else return false;
      return true;
    },
    [goTo, focusDeadline, goNewSubject]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

  const shortcutItems: ShortcutItem[] = [
    { id: 'agora', key: '1', label: 'Agora' },
    { id: 'semana', key: '2', label: 'Semana' },
    { id: 'disciplinas', key: '3', label: 'Disciplinas', badge: String(subjects.length) },
    { id: 'prazos', key: 'P', label: 'Prazos', badge: String(deadlineRows.length) },
  ];

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [supabase, router]);

  const profileUser = user
    ? {
        name: user.name.toUpperCase(),
        email: user.email,
        role: '—',
        institution: '—',
        code: `USR-${user.id.slice(0, 8).toUpperCase()}`,
        lastAccess: formatRelativeDate(user.lastSignInAt),
      }
    : null;

  const dateLabel = `${WEEKDAY_LONG_PT[today.getDay()]}, ${today.getDate()} de ${MONTHS_PT[today.getMonth()]}`;
  const todayLabel = `${WEEKDAY_LONG_PT[today.getDay()].slice(0, 3)}, ${shortDate(today)}`;

  // ==========================================
  // IPAD E IPHONE (designs "Faculdade — iPad / iPhone")
  // ==========================================
  if (layout !== 'desktop') {
    const phone = layout === 'phone';
    const subjectsCount = `${subjects.length} ${subjects.length === 1 ? 'disciplina' : 'disciplinas'} · ${ects} ECTS`;
    const touchItems: ShortcutItem[] =
      layout === 'tabletH'
        ? [shortcutItems[0], shortcutItems[1], shortcutItems[2], shortcutItems[3]]
        : [shortcutItems[0], shortcutItems[1], shortcutItems[3], shortcutItems[2]];
    const codeLinks = phone ? [] : sortedSubjects.map((x) => ({ href: `/faculdade/${x.id}`, label: codeOf(x.id) }));

    const deadlines = (
      <FacDeadlines
        rows={deadlineRows}
        todaySlots={todaySlots}
        todayLabel={todayLabel}
        inputRef={deadlineInputRef}
        onCreate={createDeadline}
        createError={createError}
        creating={creating}
        touch
        showToday={layout === 'tabletH'}
        plain={layout !== 'tabletH'}
      />
    );
    const agora = <FacTouchAgora layout={layout} slots={slots} average={averageLabel} todaySlots={todaySlots} />;
    const week = phone ? (
      <FacPhoneWeek weekNumber={isoWeek(today)} days={weekDays} todayIndex={todayIndex} blocks={blocks} markers={markers} />
    ) : (
      <FacWeek weekNumber={isoWeek(today)} days={weekDays} todayIndex={todayIndex} blocks={blocks} markers={markers} legend={legend} px={layout === 'tabletH' ? 22 : 24} />
    );
    const newSubject = (
      <section className={layout === 'tabletH' ? undefined : d.inner} style={{ paddingBottom: 48 }}>
        <button type="button" className={d.btnLine} style={{ width: '100%', borderStyle: 'dashed' }} onClick={goNewSubject}>
          + Nova disciplina
        </button>
      </section>
    );

    return (
      <div className={`${d.root} ${layoutClasses(layout)}`}>
        {!phone && (
          <TabletHeader
            active="faculdade"
            searchIndex={searchIndex}
            userName={user?.name ?? null}
            userEmail={user?.email ?? null}
            onOpenProfile={() => setIsProfileOpen(true)}
            onLogout={handleLogout}
          />
        )}

        <FacTouchHeading
          layout={layout}
          periodLabel={phone ? periodLabel : `semana ${isoWeek(today)}`}
          meta={phone ? `${subjectsCount} · ${fmtNum(weekHours)} h/semana` : subjectsCount}
          onAddDeadline={focusDeadline}
          avatar={
            <AvatarMenu
              userName={user?.name ?? null}
              userEmail={user?.email ?? null}
              onOpenProfile={() => setIsProfileOpen(true)}
              onLogout={handleLogout}
            />
          }
        />
        <SectionChips items={touchItems} active={active} onPick={goTo} links={codeLinks} />

        {loading && subjects.length === 0 ? (
          <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 40, paddingBottom: 40 }}>A carregar disciplinas…</p>
        ) : layout === 'tabletH' ? (
          <div className={`${d.inner} ${d.body}`} style={{ gridTemplateColumns: 'minmax(0, 8fr) minmax(0, 4fr)' }}>
            <div className={d.left}>
              {agora}
              {week}
              <FacSubjects rows={subjectRows} />
              {newSubject}
            </div>
            <div style={{ minHeight: 0, overflowY: 'auto' }}>{deadlines}</div>
          </div>
        ) : (
          <div className={`${d.inner} ${d.body}`}>
            {agora}
            {week}
            {phone ? (
              deadlines
            ) : (
              <div className={d.pair}>
                {deadlines}
                <FacTodayList todaySlots={todaySlots} todayLabel={todayLabel} touch />
              </div>
            )}
            <FacSubjectCards rows={subjectRows} columns={phone ? 1 : 2} />
          </div>
        )}

        {layout !== 'tabletH' && newSubject}
        {phone && <PhoneTabBar active="faculdade" searchIndex={searchIndex} />}
        <NewSubjectPanel
          open={newSubjectOpen}
          onClose={() => setNewSubjectOpen(false)}
          onCreated={fetchAll}
          existingCodes={subjects.map((x) => x.code || '').filter(Boolean)}
        />
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
      </div>
    );
  }

  return (
    <div className={d.root}>
      <DensoHeader
        active="faculdade"
        dateLabel={dateLabel}
        searchIndex={searchIndex}
        searchRef={searchRef}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      />

      <FacHeading periodLabel={periodLabel} meta={meta} onAddDeadline={focusDeadline} onAddSubject={goNewSubject} />

      <ShortcutBar
        items={shortcutItems}
        active={active}
        onPick={setActive}
        help={HELP}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        extra={<SubjectJumps subjects={sortedSubjects.map((x) => ({ id: x.id, code: codeOf(x.id), tone: toneOf.get(x.id) ?? OVERFLOW_TONE }))} />}
      />

      {loading && subjects.length === 0 ? (
        <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 48, paddingBottom: 48 }}>A carregar disciplinas…</p>
      ) : (
        <div className={`${d.inner} ${d.split84}`} style={{ paddingTop: 20, paddingBottom: 32 }}>
          <div className={d.col8} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <FacAgora slots={slots} average={averageLabel} todaySlots={todaySlots} />
            <FacWeek weekNumber={isoWeek(today)} days={weekDays} todayIndex={todayIndex} blocks={blocks} markers={markers} legend={legend} />
            <FacSubjects rows={subjectRows} />
          </div>
          <div className={d.col4}>
            <FacDeadlines
              rows={deadlineRows}
              todaySlots={todaySlots}
              todayLabel={todayLabel}
              inputRef={deadlineInputRef}
              onCreate={createDeadline}
              createError={createError}
              creating={creating}
            />
          </div>
        </div>
      )}

      <NewSubjectPanel
        open={newSubjectOpen}
        onClose={() => setNewSubjectOpen(false)}
        onCreated={fetchAll}
        existingCodes={subjects.map((x) => x.code || '').filter(Boolean)}
      />

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
