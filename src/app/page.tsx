'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate } from '@/lib/utils';
import {
  createWorkTask,
  getWorkProjects,
  getWorkTasks,
  toggleWorkTask,
  WorkProject,
  WorkTask,
} from '@/lib/workData';
import ProfileModal from '@/components/ui/ProfileModal';
import { SubjectLite, collectClasses, dayOfYear, parseDueDate, parseMinutes } from './components/homeAgenda';
import d from './components/denso/denso.module.css';
import {
  DensoHeader,
  SearchHit,
  ShortcutBar,
  ShortcutItem,
  scrollToId,
  useHoverPin,
  useShortcuts,
} from './components/denso/DensoChrome';
import { AvatarMenu, PhoneTabBar, SectionChips, TabletHeader, layoutClasses, useDensoLayout } from './components/denso/DensoTouch';
import {
  BalanceB,
  CaptureAndVolumes,
  CaptureBox,
  DayIndexB,
  DayTitle,
  DeadlineB,
  DeadlinesB,
  FooterB,
  MonthB,
  NotesB,
  PhoneWeekB,
  PlanB,
  SessionCard,
  TopStripB,
  VolumeTiles,
  WeekB,
  WeekCol,
  WeekNav,
  deadlineKind,
} from './components/denso/PainelB';
import type { HeroClass, HeroNextClass, HeroTile } from './components/painel/PainelHero';
import { useLocalState, useNow } from './components/painel/useLocalState';
import {
  MOCK_BILLABLE_HOURS,
  MOCK_DEADLINE_PREP,
  MOCK_EXPENSES,
  MOCK_LOCATION,
  MOCK_QUOTE,
} from './components/painel/mockData';
import {
  AssessmentFull,
  ChapterLite,
  EventSources,
  LocalEvent,
  MONTHS_PT,
  PainelCat,
  WEEKDAY_LONG_PT,
  addDays,
  buildEventsForDate,
  classTypeLabel,
  daysBetween,
  fmtNum,
  isoKey,
  isoWeek,
  mondayOf,
  notebookLabel,
  relativeTime,
  shortDate,
  startOfDay,
  subjectLongName,
  subjectShortName,
} from './components/painel/painelData';
import { dueLabel, fmtDuration } from './faculdade/[id]/components/disciplinaData';
import type { AssessmentItem } from '@/types';
import { loadSessionsSince, loadStudySettings, type StudySessionRow } from '@/lib/study';
import { DEFAULT_SETTINGS, computePlan, type StudySettings } from '@/lib/studyPlan';

// "TESTE 1" → "Teste 1" (títulos todos em maiúsculas, como os gravados pelo editor antigo).
function niceTitle(title: string): string {
  const t = title.trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

const HELP: [string, string][] = [
  ['1–5', 'Ir para a secção'],
  ['N', 'Nova tarefa'],
  ['E', 'Novo evento'],
  ['C', 'Captura rápida'],
  ['Ctrl K', 'Pesquisa global'],
  ['?', 'Mostrar/esconder esta ajuda'],
  ['Esc', 'Fechar detalhes fixados'],
];

const SECTION_KEYS: Record<string, string> = { '1': 'dia', '2': 'semana', '3': 'prazos', '4': 'mes', '5': 'balanco' };

export default function HomePage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [supabase] = useState(() => createClient());

  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  const [assessments, setAssessments] = useState<AssessmentFull[]>([]);
  const [chapters, setChapters] = useState<ChapterLite[]>([]);
  const [workProjects, setWorkProjects] = useState<WorkProject[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set());
  const [touchedTaskIds, setTouchedTaskIds] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState('dia');
  const [helpOpen, setHelpOpen] = useState(false);

  // Sem tabela no Supabase: guardado só neste browser.
  const [notes, setNotes] = useLocalState<string[]>('painel:notes', []);
  const [localEvents, setLocalEvents] = useLocalState<LocalEvent[]>('painel:events', []);

  const searchRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const eventTitleRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const { bind } = useHoverPin();
  // iPhone / iPad de pé / iPad deitado / computador (ver DensoTouch).
  const layout = useDensoLayout();

  const [studySessions, setStudySessions] = useState<StudySessionRow[]>([]);
  const [studySettings, setStudySettings] = useState<StudySettings>(DEFAULT_SETTINGS);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Sessões desde 14 dias antes desta semana (janela de preparação dos testes).
      const studySince = new Date(mondayOf(new Date()).getTime() - 14 * 86400000);
      const [subjectsRes, assessmentsRes, chaptersRes, projects, tasks, sessions, sett] = await Promise.all([
        supabase.from('subjects').select('id, name, code, schedules, ects, theoretical_weight, practical_weight'),
        supabase.from('assessments').select('id, subject_id, title, due_date, due_time, duration_minutes, weight_percent, category, grade, has_defense, defense_grade'),
        supabase.from('chapters').select('id, subject_id, category, title, updated_at'),
        getWorkProjects(),
        getWorkTasks(),
        loadSessionsSince(studySince),
        loadStudySettings(),
      ]);
      setSubjects(subjectsRes.data || []);
      setAssessments(assessmentsRes.data || []);
      setChapters(chaptersRes.data || []);
      setWorkProjects(projects);
      setWorkTasks(tasks);
      setStudySessions(sessions);
      setStudySettings(sett.settings);
    } catch (err) {
      console.error('Erro ao carregar a página principal:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido inicial de dados
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- correr apenas uma vez ao montar
  }, []);

  const now = useNow(30_000);
  const todayKey = isoKey(now);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só muda quando muda o dia
  const today = useMemo(() => startOfDay(now), [todayKey]);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const subjectLookup = useMemo(() => new Map(subjects.map((x) => [x.id, x])), [subjects]);
  const projectLookup = useMemo(() => new Map(workProjects.map((p) => [p.id, p])), [workProjects]);
  const classes = useMemo(() => collectClasses(subjects), [subjects]);

  const sources = useMemo<EventSources>(
    () => ({ classes, assessments, tasks: workTasks, localEvents, subjectLookup, projectLookup }),
    [classes, assessments, workTasks, localEvents, subjectLookup, projectLookup]
  );
  const getEvents = useCallback((date: Date) => buildEventsForDate(date, sources), [sources]);
  const todayEvents = useMemo(() => getEvents(today), [getEvents, today]);

  // ==========================================
  // AULAS: hoje (sessão em curso) e a próxima noutro dia
  // ==========================================
  const todayClasses = useMemo<HeroClass[]>(
    () =>
      classes
        .filter((c) => c.dayNum === today.getDay())
        .sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime))
        .map((c) => ({
          subjectId: c.subjectId,
          title: subjectLongName(subjectLookup.get(c.subjectId)),
          typeLabel: classTypeLabel(c.type),
          start: c.startTime,
          end: c.endTime,
          room: c.room,
        })),
    [classes, today, subjectLookup]
  );

  const nextClassOtherDay = useMemo<HeroNextClass | null>(() => {
    let best: { offset: number; minutes: number; c: (typeof classes)[number] } | null = null;
    for (const c of classes) {
      const offset = (c.dayNum - today.getDay() + 7) % 7 || 7;
      const minutes = parseMinutes(c.startTime);
      if (!best || offset < best.offset || (offset === best.offset && minutes < best.minutes)) best = { offset, minutes, c };
    }
    if (!best) return null;
    const date = addDays(today, best.offset);
    return {
      subjectId: best.c.subjectId,
      title: subjectLongName(subjectLookup.get(best.c.subjectId)),
      dayLabel: best.offset === 1 ? 'amanhã' : WEEKDAY_LONG_PT[date.getDay()].toLowerCase(),
      start: best.c.startTime,
      end: best.c.endTime,
      room: best.c.room,
    };
  }, [classes, today, subjectLookup]);

  const nextLabel = useMemo(() => {
    const code = (id: string) => subjectShortName(subjectLookup.get(id));
    const room = (r: string) => (r ? ` · Sala ${r}` : '');
    const current = todayClasses.find((c) => {
      const start = parseMinutes(c.start);
      const end = c.end ? parseMinutes(c.end) : start + 90;
      return nowMinutes >= start && nowMinutes < end;
    });
    if (current) return `Aula ${code(current.subjectId)} a decorrer${room(current.room)}`;
    const later = todayClasses.find((c) => parseMinutes(c.start) > nowMinutes);
    if (later) {
      const diff = parseMinutes(later.start) - nowMinutes;
      const inLabel = diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)} h ${String(diff % 60).padStart(2, '0')} min`;
      return `Aula ${code(later.subjectId)}${room(later.room)} · em ${inLabel}`;
    }
    if (nextClassOtherDay) return `Próxima aula: ${code(nextClassOtherDay.subjectId)}, ${nextClassOtherDay.dayLabel} às ${nextClassOtherDay.start}`;
    return 'Sem aulas no horário';
  }, [todayClasses, nowMinutes, nextClassOtherDay, subjectLookup]);

  // ==========================================
  // VOLUMES: disciplinas pela edição de capítulos mais recente
  // ==========================================
  const tiles = useMemo<HeroTile[]>(() => {
    const byCode = [...subjects].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
    const volOf = new Map(byCode.map((x, i) => [x.id, `Vol. ${String(i + 1).padStart(2, '0')}`]));
    const latest = new Map<string, ChapterLite>();
    const counts = new Map<string, { chapters: number; notebooks: Set<string> }>();
    chapters.forEach((ch) => {
      // Só os cadernos contam (fica de fora, p.ex., o "Programa" da cadeira).
      const cat = (ch.category || 'TEORICAS').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (cat !== 'TEORICAS' && cat !== 'PRATICAS' && cat !== 'TESTES') return;
      const cur = latest.get(ch.subject_id);
      if (!cur || (ch.updated_at || '') > (cur.updated_at || '')) latest.set(ch.subject_id, ch);
      const c = counts.get(ch.subject_id) || { chapters: 0, notebooks: new Set<string>() };
      c.chapters += 1;
      c.notebooks.add(ch.category || 'TEORICAS');
      counts.set(ch.subject_id, c);
    });
    const ranked = [...byCode].sort((a, b) => (latest.get(b.id)?.updated_at || '').localeCompare(latest.get(a.id)?.updated_at || ''));

    return ranked.slice(0, 2).map((subj) => {
      const ch = latest.get(subj.id);
      const count = counts.get(subj.id);
      const vol = volOf.get(subj.id) || 'Vol.';
      const name = subjectShortName(subj);
      if (!ch || !count) {
        return {
          subjectId: subj.id,
          vol,
          name,
          sub: 'Teóricas · sem capítulos',
          tipTitle: `${vol}, ${subjectLongName(subj)}`,
          tipBody: 'Ainda não há capítulos nos cadernos desta disciplina.',
          href: `/faculdade/${subj.id}/notebook?tab=TEORICAS`,
        };
      }
      const label = notebookLabel(ch.category);
      const rel = relativeTime(ch.updated_at, now);
      return {
        subjectId: subj.id,
        vol,
        name,
        sub: `${label} · ${rel}`,
        tipTitle: `${vol}, ${subjectLongName(subj)}`,
        tipBody: `${count.chapters} ${count.chapters === 1 ? 'capítulo' : 'capítulos'} em ${count.notebooks.size} ${count.notebooks.size === 1 ? 'caderno' : 'cadernos'}; último: ${ch.title || 'sem título'}.`,
        href: `/faculdade/${subj.id}/notebook?tab=${ch.category || 'TEORICAS'}`,
      };
    });
  }, [subjects, chapters, now]);

  // ==========================================
  // SEMANA (Seg–Sex, mais fim de semana se tiver eventos)
  // ==========================================
  // 0 = esta semana; ‹ › andam de 7 em 7 dias.
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = useMemo(() => addDays(mondayOf(today), weekOffset * 7), [today, weekOffset]);
  const weekColumns = useMemo<WeekCol[]>(() => {
    const cols = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, events: getEvents(date) };
    });
    return cols.slice(5).some((c) => c.events.length > 0) ? cols : cols.slice(0, 5);
  }, [monday, getEvents]);
  // O número no atalho "Semana" conta sempre a semana atual.
  // Horas de estudo reais desta semana (contador do caderno) vs. a sugestão do /estudo.
  const studyHours = useMemo(() => {
    const { rows } = computePlan({
      subjects,
      assessments: assessments as unknown as AssessmentItem[],
      sessions: studySessions,
      settings: studySettings,
      today,
    });
    return {
      done: rows.reduce((n, r) => n + r.doneWeek, 0),
      target: rows.reduce((n, r) => n + r.suggestedWeek, 0),
    };
  }, [subjects, assessments, studySessions, studySettings, today]);

  const weekBlocks = useMemo(() => {
    const start = mondayOf(today);
    return Array.from({ length: 7 }, (_, i) => getEvents(addDays(start, i)).length).reduce((a, b) => a + b, 0);
  }, [today, getEvents]);
  const weekNav: WeekNav = {
    offset: weekOffset,
    label: `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`,
    onPrev: () => setWeekOffset((o) => o - 1),
    onNext: () => setWeekOffset((o) => o + 1),
    onToday: () => setWeekOffset(0),
  };
  const shownWeek = isoWeek(monday);

  // ==========================================
  // PRAZOS (os 3 mais próximos: avaliações por classificar + tarefas)
  // ==========================================
  const deadlines = useMemo<DeadlineB[]>(() => {
    const items: Omit<DeadlineB, 'pct' | 'status'>[] = [];
    assessments.forEach((a) => {
      const due = parseDueDate(a.due_date);
      if (!due || due < today || typeof a.grade === 'number') return;
      const subj = subjectLookup.get(a.subject_id);
      items.push({
        id: `a-${a.id}`,
        date: due,
        kind: deadlineKind(a.title || ''),
        // "Teste 1 - SSC": título (sem maiúsculas a gritar) e sigla da cadeira.
        title: `${niceTitle(a.title || 'Avaliação')}${subj?.code ? ` - ${subj.code}` : ''}`,
        meta: `Faculdade · ${dueLabel(a, due)}`,
        area: `Faculdade · ${subjectLongName(subj)}${a.duration_minutes ? ` · ${fmtDuration(a.duration_minutes)}` : ''}${typeof a.weight_percent === 'number' ? ` · peso ${a.weight_percent}%` : ''}`,
        href: `/faculdade/${a.subject_id}#avaliacao`,
      });
    });
    workTasks
      .filter((t) => !t.completed)
      .forEach((t) => {
        const due = parseDueDate(t.due_date);
        if (!due || due < today) return;
        const project = t.project_id ? projectLookup.get(t.project_id) : undefined;
        items.push({
          id: `t-${t.id}`,
          date: due,
          kind: 'ENTREGA',
          title: t.title,
          meta: `${project?.name || 'Trabalho'} · ${shortDate(due)}`,
          area: `Trabalho · ${project?.name || 'sem projeto'}`,
          href: '/trabalho',
        });
      });
    return items
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 3)
      .map((x, i) => ({ ...x, pct: MOCK_DEADLINE_PREP[i]?.prep ?? 0, status: MOCK_DEADLINE_PREP[i]?.state ?? '—' }));
  }, [assessments, workTasks, today, subjectLookup, projectLookup]);

  // ==========================================
  // PLANO DE AÇÃO
  // ==========================================
  const planTasks = useMemo(
    () =>
      workTasks.filter((t) => {
        if (!t.completed || touchedTaskIds.has(t.id)) return true;
        const due = parseDueDate(t.due_date);
        return due !== null && daysBetween(today, due) === 0;
      }),
    [workTasks, touchedTaskIds, today]
  );

  const handleToggleTask = useCallback(async (task: WorkTask) => {
    const next = !task.completed;
    setPendingTaskIds((prev) => new Set(prev).add(task.id));
    setTouchedTaskIds((prev) => new Set(prev).add(task.id));
    setWorkTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    try {
      await toggleWorkTask(task.id, next);
    } catch (err) {
      console.error('Erro ao atualizar a tarefa:', err);
      setWorkTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)));
    } finally {
      setPendingTaskIds((prev) => {
        const copy = new Set(prev);
        copy.delete(task.id);
        return copy;
      });
    }
  }, []);

  const handleAddTask = useCallback(
    async (title: string, projectId: string | null) => {
      try {
        const created = await createWorkTask({ title, project_id: projectId, due_date: todayKey });
        setWorkTasks((prev) => [created, ...prev]);
      } catch (err) {
        console.error('Erro ao criar a tarefa:', err);
      }
    },
    [todayKey]
  );

  // ==========================================
  // EVENTOS LOCAIS / NOTAS
  // ==========================================
  const handleAddEvent = useCallback(
    (dateKey: string, title: string, time: string, cat: PainelCat) => {
      setLocalEvents((prev) => [...prev, { id: `${Date.now()}`, date: dateKey, time, title, cat }]);
    },
    [setLocalEvents]
  );
  const handleRemoveEvent = useCallback((id: string) => setLocalEvents((prev) => prev.filter((e) => e.id !== id)), [setLocalEvents]);
  const addNote = useCallback((text: string) => setNotes((prev) => [...prev, text]), [setNotes]);

  // ==========================================
  // PESQUISA, ATALHOS, CONTA
  // ==========================================
  const searchIndex = useMemo<SearchHit[]>(() => {
    const hits: SearchHit[] = [];
    subjects.forEach((x) => hits.push({ id: `s-${x.id}`, label: x.name || x.code || 'Disciplina', sublabel: 'Faculdade · Disciplina', href: `/faculdade/${x.id}` }));
    assessments.forEach((a) => hits.push({ id: `a-${a.id}`, label: a.title || 'Avaliação', sublabel: 'Faculdade · Prazo', href: `/faculdade/${a.subject_id}#avaliacao` }));
    workProjects.forEach((p) => hits.push({ id: `p-${p.id}`, label: p.name, sublabel: 'Trabalho · Projeto', href: '/trabalho' }));
    workTasks.forEach((t) => hits.push({ id: `t-${t.id}`, label: t.title, sublabel: 'Trabalho · Tarefa', href: '/trabalho' }));
    return hits;
  }, [subjects, assessments, workProjects, workTasks]);

  const goTo = useCallback((id: string) => {
    setActive(id);
    scrollToId(id);
  }, []);
  const focusTask = useCallback(() => {
    goTo('dia');
    window.setTimeout(() => taskInputRef.current?.focus(), 250);
  }, [goTo]);
  const focusEvent = useCallback(() => {
    goTo('mes');
    window.setTimeout(() => eventTitleRef.current?.focus(), 250);
  }, [goTo]);

  const onShortcut = useCallback(
    (key: string) => {
      if (key === 'escape') {
        setHelpOpen(false);
        return true;
      }
      if (SECTION_KEYS[key]) goTo(SECTION_KEYS[key]);
      else if (key === 'n') focusTask();
      else if (key === 'e') focusEvent();
      else if (key === 'c') captureRef.current?.focus();
      else if (key === '?') setHelpOpen((v) => !v);
      else return false;
      return true;
    },
    [goTo, focusTask, focusEvent]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

  const shortcutItems: ShortcutItem[] = [
    { id: 'dia', key: '1', label: 'Página do dia' },
    { id: 'semana', key: '2', label: 'Semana', badge: String(weekBlocks) },
    { id: 'prazos', key: '3', label: 'Prazos', badge: String(deadlines.length) },
    { id: 'mes', key: '4', label: 'Mês' },
    { id: 'balanco', key: '5', label: 'Balanço', badge: `${fmtNum(MOCK_BILLABLE_HOURS.done + studyHours.done)} h` },
  ];

  // iPhone: barra de secções fixa no topo (como na Faculdade e nas disciplinas).
  const phoneItems: ShortcutItem[] = [
    { id: 'sessao', key: '', label: 'Agora' },
    { id: 'hoje', key: '', label: 'Hoje', badge: todayEvents.length ? String(todayEvents.length) : undefined },
    { id: 'tarefas', key: '', label: 'Tarefas', badge: planTasks.length ? String(planTasks.length) : undefined },
    { id: 'notas', key: '', label: 'Notas', badge: notes.length ? String(notes.length) : undefined },
    { id: 'volumes', key: '', label: 'Cadernos' },
    { id: 'semana', key: '', label: 'Semana' },
    { id: 'prazos', key: '', label: 'Prazos', badge: deadlines.length ? String(deadlines.length) : undefined },
    { id: 'mes', key: '', label: 'Mês' },
    { id: 'balanco', key: '', label: 'Balanço' },
  ];
  const spyLock = useRef(0);
  const goToPhone = useCallback((id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (!el) return;
    // Enquanto o scroll suave anda, a secção ativa não salta pelas do meio.
    spyLock.current = Date.now() + 900;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 62, behavior: 'smooth' });
  }, []);
  const phoneIds = phoneItems.map((it) => it.id).join(',');
  useEffect(() => {
    if (layout !== 'phone') return;
    const ids = phoneIds.split(',');
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Date.now() < spyLock.current) return;
        let current = ids[0];
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= 90) current = id;
        }
        // No fim da página a última secção fica ativa, mesmo que seja curta.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = ids[ids.length - 1];
        setActive(current);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [layout, phoneIds]);

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

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [supabase, router]);

  const monthName = MONTHS_PT[today.getMonth()];
  const weekdayShort = WEEKDAY_LONG_PT[today.getDay()].replace('-feira', '');
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // ==========================================
  // IPAD E IPHONE (designs "Visão Geral — iPad / iPhone")
  // ==========================================
  if (layout !== 'desktop') {
    const phone = layout === 'phone';
    const profile = {
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      onOpenProfile: () => setIsProfileOpen(true),
      onLogout: handleLogout,
    };
    const col = { display: 'flex', flexDirection: 'column', gap: 26, minWidth: 0 } as const;
    const two = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, alignItems: 'start' } as const;

    const session = <SessionCard todayClasses={todayClasses} nextClass={nextClassOtherDay} />;
    const index = <DayIndexB events={todayEvents} nowMinutes={nowMinutes} today={today} bind={bind} />;
    const plan = (
      <PlanB
        tasks={planTasks}
        projects={workProjects}
        today={today}
        pendingIds={pendingTaskIds}
        onToggle={handleToggleTask}
        onAdd={handleAddTask}
        inputRef={taskInputRef}
        bind={bind}
      />
    );
    const notesEl = <NotesB notes={notes} onAdd={addNote} onClear={() => setNotes([])} />;
    const capture = <CaptureBox onCapture={addNote} captureRef={captureRef} kbd={false} />;
    const volumes = <VolumeTiles tiles={tiles} bind={bind} minHeight={130} linkOnly={phone} />;
    const week = phone ? (
      <PhoneWeekB columns={weekColumns} today={today} weekNumber={shownWeek} nav={weekNav} />
    ) : (
      <WeekB columns={weekColumns} today={today} weekNumber={shownWeek} bind={bind} nav={weekNav} />
    );
    const deadlinesEl = <DeadlinesB items={deadlines} today={today} bind={bind} />;
    const month = (
      <MonthB
        today={today}
        getEvents={getEvents}
        onAddEvent={handleAddEvent}
        onRemoveEvent={handleRemoveEvent}
        titleRef={eventTitleRef}
        bind={bind}
        sheet={phone}
      />
    );
    const balance = <BalanceB billable={MOCK_BILLABLE_HOURS} study={studyHours} expenses={MOCK_EXPENSES} monthName={monthName} />;

    return (
      <div className={`${d.root} ${layout === 'tabletH' ? d.touch : layoutClasses(layout)}`}>
        {!phone && <TabletHeader active="home" searchIndex={searchIndex} {...profile} />}
        <TopStripB nextLabel={loading ? 'A carregar horário…' : nextLabel} quote={MOCK_QUOTE} />
        <DayTitle
          size={phone ? 'phone' : 'tablet'}
          title={`${weekdayShort}, ${today.getDate()}`}
          monthLine={`de ${monthName}, semana ${isoWeek(today)}`}
          subjectsCount={subjects.length}
          onAddTask={focusTask}
          onAddEvent={focusEvent}
          trailing={phone ? <AvatarMenu {...profile} /> : undefined}
        />
        {phone && <SectionChips items={phoneItems} active={active} onPick={goToPhone} />}

        {loading ? (
          <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 40, paddingBottom: 40 }}>A carregar agenda…</p>
        ) : layout === 'tabletH' ? (
          <div className={d.inner} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: 20, paddingTop: 16, paddingBottom: 32, alignItems: 'start' }}>
            <aside id="dia" className={d.aside} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
                <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 26 }}>A página de hoje</span>
                <span className={d.muted} style={{ fontSize: 12 }}>{clock}</span>
              </div>
              {session}
              {index}
              {plan}
              {notesEl}
            </aside>
            <div style={col}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'stretch' }}>
                {capture}
                {volumes}
              </div>
              {week}
              <div style={two}>
                {deadlinesEl}
                {month}
              </div>
              {balance}
            </div>
          </div>
        ) : layout === 'tabletV' ? (
          <div id="dia" className={d.inner} style={{ ...col, paddingTop: 16, paddingBottom: 40 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14 }}>
              {session}
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 14 }}>{volumes}</div>
            </div>
            <div style={two}>
              {index}
              {plan}
            </div>
            <div style={two}>
              {notesEl}
              {capture}
            </div>
            {week}
            <div style={two}>
              {deadlinesEl}
              {month}
            </div>
            {balance}
          </div>
        ) : (
          <div id="dia" className={d.inner} style={{ ...col, gap: 28, paddingTop: 14, paddingBottom: 110 }}>
            {session}
            {index}
            {plan}
            {notesEl}
            {/* Volumes a deslizar na horizontal */}
            <div
              id="volumes"
              style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridAutoColumns: '150px',
                gap: 10,
                overflowX: 'auto',
                margin: '0 calc(var(--gutter) * -1)',
                padding: '0 var(--gutter)',
                scrollbarWidth: 'none',
              }}
            >
              {volumes}
            </div>
            {capture}
            {week}
            {deadlinesEl}
            {month}
            {balance}
          </div>
        )}

        {phone && <PhoneTabBar active="home" searchIndex={searchIndex} />}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
      </div>
    );
  }

  return (
    <div className={d.root}>
      <TopStripB nextLabel={loading ? 'A carregar horário…' : nextLabel} quote={MOCK_QUOTE} />

      <DensoHeader
        active="home"
        inset
        brandNote={`${MOCK_LOCATION} · N.º ${dayOfYear(today)}`}
        searchIndex={searchIndex}
        searchRef={searchRef}
        searchPlaceholder="Pesquisar em tudo…"
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      />

      <DayTitle
        title={`${weekdayShort}, ${today.getDate()}`}
        monthLine={`de ${monthName}, semana ${isoWeek(today)}`}
        subjectsCount={subjects.length}
        onAddTask={focusTask}
        onAddEvent={focusEvent}
      />

      <ShortcutBar
        items={shortcutItems}
        active={active}
        onPick={setActive}
        help={HELP}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        hint="Passa o rato para ver detalhes · clica para fixar"
      />

      {loading ? (
        <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 48, paddingBottom: 48 }}>A carregar agenda…</p>
      ) : (
        <div className={`${d.inner} ${d.split48}`} style={{ paddingTop: 28, paddingBottom: 36 }}>
          <aside id="dia" className={`${d.col4} ${d.aside}`} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 28, scrollMarginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
              <span className={d.serif} style={{ fontStyle: 'italic', fontSize: 28 }}>A página de hoje</span>
              <span style={{ fontSize: 12, color: 'var(--mut2)' }}>{clock}</span>
            </div>
            <SessionCard todayClasses={todayClasses} nextClass={nextClassOtherDay} />
            <DayIndexB events={todayEvents} nowMinutes={nowMinutes} today={today} bind={bind} />
            <PlanB
              tasks={planTasks}
              projects={workProjects}
              today={today}
              pendingIds={pendingTaskIds}
              onToggle={handleToggleTask}
              onAdd={handleAddTask}
              inputRef={taskInputRef}
              bind={bind}
            />
            <NotesB notes={notes} onAdd={addNote} onClear={() => setNotes([])} />
          </aside>

          <div className={d.col8} style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            <CaptureAndVolumes tiles={tiles} onCapture={addNote} captureRef={captureRef} bind={bind} />
            <WeekB columns={weekColumns} today={today} weekNumber={shownWeek} bind={bind} nav={weekNav} />
            <div className={d.two}>
              <DeadlinesB items={deadlines} today={today} bind={bind} />
              <MonthB today={today} getEvents={getEvents} onAddEvent={handleAddEvent} onRemoveEvent={handleRemoveEvent} titleRef={eventTitleRef} bind={bind} />
            </div>
            <BalanceB billable={MOCK_BILLABLE_HOURS} study={studyHours} expenses={MOCK_EXPENSES} monthName={monthName} />
          </div>
        </div>
      )}

      <FooterB />

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
