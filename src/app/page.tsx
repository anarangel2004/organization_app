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
import {
  BalanceB,
  CaptureAndVolumes,
  DayIndexB,
  DayTitle,
  DeadlineB,
  DeadlinesB,
  FooterB,
  MonthB,
  NotesB,
  PlanB,
  SessionCard,
  TopStripB,
  WeekB,
  WeekCol,
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
  MOCK_STUDY_HOURS,
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

interface FocusState {
  date: string;
  ms: number;
  since: number | null;
}

const HELP: [string, string][] = [
  ['1–5', 'Ir para a secção'],
  ['N', 'Nova tarefa'],
  ['E', 'Novo evento'],
  ['C', 'Captura rápida'],
  ['F', 'Iniciar/pausar foco'],
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
  const [focus, setFocus] = useLocalState<FocusState>('painel:focus', { date: '', ms: 0, since: null });

  const searchRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const eventTitleRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const { bind } = useHoverPin();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectsRes, assessmentsRes, chaptersRes, projects, tasks] = await Promise.all([
        supabase.from('subjects').select('id, name, code, schedules'),
        supabase.from('assessments').select('id, subject_id, title, due_date, weight_percent, category, grade'),
        supabase.from('chapters').select('id, subject_id, category, title, updated_at'),
        getWorkProjects(),
        getWorkTasks(),
      ]);
      setSubjects(subjectsRes.data || []);
      setAssessments(assessmentsRes.data || []);
      setChapters(chaptersRes.data || []);
      setWorkProjects(projects);
      setWorkTasks(tasks);
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
  // FOCO (cronómetro local, reinicia todos os dias)
  // ==========================================
  const focusToday = focus.date === todayKey ? focus : { date: todayKey, ms: 0, since: null };
  const focusRunning = focusToday.since !== null;
  const focusMs = focusToday.ms + (focusToday.since !== null ? Math.max(0, now.getTime() - focusToday.since) : 0);
  const focusMinutes = Math.floor(focusMs / 60000);
  const focusLabel: [string, string] = [
    `${String(Math.floor(focusMinutes / 60)).padStart(2, '0')}h ${String(focusMinutes % 60).padStart(2, '0')}m`,
    'de foco hoje',
  ];

  const toggleFocus = useCallback(() => {
    setFocus((prev) => {
      const key = isoKey(new Date());
      const base = prev.date === key ? prev : { date: key, ms: 0, since: null };
      if (base.since !== null) return { date: key, ms: base.ms + (Date.now() - base.since), since: null };
      return { date: key, ms: base.ms, since: Date.now() };
    });
  }, [setFocus]);

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
  const monday = useMemo(() => mondayOf(today), [today]);
  const weekColumns = useMemo<WeekCol[]>(() => {
    const cols = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, events: getEvents(date) };
    });
    return cols.slice(5).some((c) => c.events.length > 0) ? cols : cols.slice(0, 5);
  }, [monday, getEvents]);
  const weekBlocks = weekColumns.reduce((n, c) => n + c.events.length, 0);

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
        title: a.title || 'Avaliação',
        meta: `Faculdade · ${shortDate(due)}`,
        area: `Faculdade · ${subjectLongName(subj)}${typeof a.weight_percent === 'number' ? ` · peso ${a.weight_percent}%` : ''}`,
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
      else if (key === 'f') toggleFocus();
      else if (key === '?') setHelpOpen((v) => !v);
      else return false;
      return true;
    },
    [goTo, focusTask, focusEvent, toggleFocus]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

  const shortcutItems: ShortcutItem[] = [
    { id: 'dia', key: '1', label: 'Página do dia' },
    { id: 'semana', key: '2', label: 'Semana', badge: String(weekBlocks) },
    { id: 'prazos', key: '3', label: 'Prazos', badge: String(deadlines.length) },
    { id: 'mes', key: '4', label: 'Mês' },
    { id: 'balanco', key: '5', label: 'Balanço', badge: `${fmtNum(MOCK_BILLABLE_HOURS.done + MOCK_STUDY_HOURS.done)} h` },
  ];

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

  return (
    <div className={d.root}>
      <TopStripB focusLabel={focusLabel} nextLabel={loading ? 'A carregar horário…' : nextLabel} quote={MOCK_QUOTE} focusRunning={focusRunning} onToggleFocus={toggleFocus} />

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
            <SessionCard todayClasses={todayClasses} nextClass={nextClassOtherDay} focusRunning={focusRunning} onToggleFocus={toggleFocus} />
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
            <WeekB columns={weekColumns} today={today} weekNumber={isoWeek(today)} bind={bind} />
            <div className={d.two}>
              <DeadlinesB items={deadlines} today={today} bind={bind} />
              <MonthB today={today} getEvents={getEvents} onAddEvent={handleAddEvent} onRemoveEvent={handleRemoveEvent} titleRef={eventTitleRef} bind={bind} />
            </div>
            <BalanceB billable={MOCK_BILLABLE_HOURS} study={MOCK_STUDY_HOURS} expenses={MOCK_EXPENSES} monthName={monthName} />
          </div>
        </div>
      )}

      <FooterB />

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
