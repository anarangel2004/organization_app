'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { SearchEntry } from './components/types';
import {
  SubjectLite,
  collectClasses,
  computeSubjectHours,
  dayOfYear,
  parseDueDate,
  parseMinutes,
} from './components/homeAgenda';
import s from './components/painel/painel.module.css';
import { CtxFilter, PainelHeader, TopStrip, ViewMode } from './components/painel/PainelTop';
import { HeroClass, HeroNextClass, HeroTile, PainelHero } from './components/painel/PainelHero';
import { DayIndex, WeekColumn, WeekGrid } from './components/painel/PainelAgenda';
import { PainelMonth } from './components/painel/PainelMonth';
import { ActionPlan, Balance, DeadlineItem, Deadlines, PainelFooter } from './components/painel/PainelLower';
import { useLocalState, useNow } from './components/painel/useLocalState';
import { MOCK_LOCATION, MOCK_QUOTE, MOCK_TASK_HOURS } from './components/painel/mockData';
import {
  AssessmentFull,
  ChapterLite,
  EventSources,
  LocalEvent,
  MONTHS_PT,
  PainelCat,
  WEEKDAY_HERO_PT,
  WEEKDAY_LONG_PT,
  addDays,
  buildEventsForDate,
  classTypeLabel,
  daysBetween,
  isoKey,
  isoWeek,
  mondayOf,
  notebookLabel,
  relativeTime,
  startOfDay,
  subjectLongName,
  subjectShortName,
} from './components/painel/painelData';

interface FocusState {
  date: string;
  ms: number;
  since: number | null;
}

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
  const [ctx, setCtx] = useState<CtxFilter>('all');
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set());
  const [touchedTaskIds, setTouchedTaskIds] = useState<Set<string>>(() => new Set());

  // Sem tabela no Supabase: guardado só neste browser.
  const [mode, setMode] = useLocalState<ViewMode>('painel:mode', 'revue');
  const [notes, setNotes] = useLocalState<string[]>('painel:notes', []);
  const [localEvents, setLocalEvents] = useLocalState<LocalEvent[]>('painel:events', []);
  const [focus, setFocus] = useLocalState<FocusState>('painel:focus', { date: '', ms: 0, since: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectsRes, assessmentsRes, chaptersRes, projects, tasks] = await Promise.all([
        supabase.from('subjects').select('id, name, code, schedules'),
        supabase.from('assessments').select('id, subject_id, title, due_date, weight_percent, category'),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- correr apenas uma vez ao montar
  }, []);

  const now = useNow(60_000);
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
  // AULAS: hoje (para a sessão em curso) e a próxima noutro dia
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
      if (!best || offset < best.offset || (offset === best.offset && minutes < best.minutes)) {
        best = { offset, minutes, c };
      }
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
    const room = (r: string) => (r ? `, Sala ${r}` : '');
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
      return `Aula ${code(later.subjectId)}${room(later.room)}, em ${inLabel}`;
    }
    if (nextClassOtherDay) {
      return `Próxima aula: ${code(nextClassOtherDay.subjectId)}, ${nextClassOtherDay.dayLabel} às ${nextClassOtherDay.start}`;
    }
    return 'Sem aulas no horário';
  }, [todayClasses, nowMinutes, nextClassOtherDay, subjectLookup]);

  // ==========================================
  // FOCO (cronómetro local, reinicia todos os dias)
  // ==========================================
  const focusToday = focus.date === todayKey ? focus : { date: todayKey, ms: 0, since: null };
  const focusRunning = focusToday.since !== null;
  const focusMs = focusToday.ms + (focusToday.since !== null ? Math.max(0, now.getTime() - focusToday.since) : 0);
  const focusMinutes = Math.floor(focusMs / 60000);
  const focusLabel = `${String(Math.floor(focusMinutes / 60)).padStart(2, '0')}h ${String(focusMinutes % 60).padStart(2, '0')}m de foco hoje`;

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
      const cur = latest.get(ch.subject_id);
      if (!cur || (ch.updated_at || '') > (cur.updated_at || '')) latest.set(ch.subject_id, ch);
      const c = counts.get(ch.subject_id) || { chapters: 0, notebooks: new Set<string>() };
      c.chapters += 1;
      c.notebooks.add(ch.category || 'TEORICAS');
      counts.set(ch.subject_id, c);
    });

    const ranked = [...byCode].sort((a, b) => {
      const ta = latest.get(a.id)?.updated_at || '';
      const tb = latest.get(b.id)?.updated_at || '';
      return tb.localeCompare(ta);
    });

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
          sub: 'Sem capítulos',
          tipTitle: `${vol}, ${subjectLongName(subj)}`,
          tipBody: 'Ainda não há capítulos nos notebooks desta disciplina. Abre para começar pelas Teóricas.',
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
        tipBody: `${count.chapters} ${count.chapters === 1 ? 'capítulo' : 'capítulos'} em ${count.notebooks.size} ${
          count.notebooks.size === 1 ? 'notebook' : 'notebooks'
        }. Abre no último que editaste: ${label} (${ch.title || 'sem título'}, ${rel}).`,
        href: `/faculdade/${subj.id}/notebook?tab=${ch.category || 'TEORICAS'}`,
      };
    });
  }, [subjects, chapters, now]);

  // ==========================================
  // SEMANA (Seg–Sex, mais fim de semana se tiver eventos)
  // ==========================================
  const monday = useMemo(() => mondayOf(today), [today]);
  const weekColumns = useMemo<WeekColumn[]>(() => {
    const cols = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, events: getEvents(date) };
    });
    const weekend = cols.slice(5).some((c) => c.events.length > 0);
    return weekend ? cols : cols.slice(0, 5);
  }, [monday, getEvents]);

  // ==========================================
  // PRAZOS (avaliações + tarefas nos próximos 14 dias)
  // ==========================================
  const deadlineItems = useMemo<DeadlineItem[]>(() => {
    const limit = addDays(today, 14);
    const items: DeadlineItem[] = [];
    assessments.forEach((a) => {
      const due = parseDueDate(a.due_date);
      if (!due || due < today || due > limit) return;
      const subj = subjectLookup.get(a.subject_id);
      const weight = typeof a.weight_percent === 'number' ? ` Peso: ${a.weight_percent}%.` : '';
      items.push({
        id: `a-${a.id}`,
        cat: 'prazo',
        date: due,
        title: a.title || 'Avaliação',
        typeLabel: `Faculdade · ${subjectShortName(subj)}`,
        desc: `Avaliação de ${subjectLongName(subj)}.${weight}`,
        href: `/faculdade/${a.subject_id}`,
      });
    });
    workTasks
      .filter((t) => !t.completed)
      .forEach((t) => {
        const due = parseDueDate(t.due_date);
        if (!due || due < today || due > limit) return;
        const project = t.project_id ? projectLookup.get(t.project_id) : undefined;
        items.push({
          id: `t-${t.id}`,
          cat: 'trab',
          date: due,
          title: t.title,
          typeLabel: project?.name || 'Trabalho',
          desc: `Tarefa de ${project?.name || 'trabalho sem projeto'}.`,
          href: '/trabalho',
        });
      });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
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

  const classHoursWeek = useMemo(
    () => computeSubjectHours(classes).reduce((sum, x) => sum + x.hours, 0),
    [classes]
  );
  const taskHoursWeek = useMemo(() => {
    const sunday = addDays(monday, 6);
    return (
      workTasks.filter((t) => {
        if (t.completed) return false;
        const due = parseDueDate(t.due_date);
        return due !== null && due <= sunday;
      }).length * MOCK_TASK_HOURS
    );
  }, [workTasks, monday]);

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
  const handleRemoveEvent = useCallback(
    (id: string) => setLocalEvents((prev) => prev.filter((e) => e.id !== id)),
    [setLocalEvents]
  );
  const addNote = useCallback((text: string) => setNotes((prev) => [...prev, text]), [setNotes]);

  // ==========================================
  // PESQUISA (sobre os dados já carregados)
  // ==========================================
  const searchIndex = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = [];
    subjects.forEach((x) =>
      entries.push({ id: `s-${x.id}`, label: x.name || x.code || 'Disciplina', sublabel: 'Faculdade · Disciplina', href: `/faculdade/${x.id}` })
    );
    assessments.forEach((a) =>
      entries.push({ id: `a-${a.id}`, label: a.title || 'Avaliação', sublabel: 'Faculdade · Prazo', href: `/faculdade/${a.subject_id}` })
    );
    workProjects.forEach((p) => entries.push({ id: `p-${p.id}`, label: p.name, sublabel: 'Trabalho · Projeto', href: '/trabalho' }));
    workTasks.forEach((t) => entries.push({ id: `t-${t.id}`, label: t.title, sublabel: 'Trabalho · Tarefa', href: '/trabalho' }));
    return entries;
  }, [subjects, assessments, workProjects, workTasks]);

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
  const dateLabel = `${WEEKDAY_LONG_PT[today.getDay()]}, ${today.getDate()} de ${monthName}`;
  const indexLabel = `${WEEKDAY_LONG_PT[today.getDay()].replace('-feira', '').toLowerCase()}, ${today.getDate()}`;

  return (
    <div className={s.root}>
      <TopStrip
        focusLabel={focusLabel}
        nextLabel={loading ? 'A carregar horário…' : nextLabel}
        quote={MOCK_QUOTE}
        focusRunning={focusRunning}
        onToggleFocus={toggleFocus}
      />

      <PainelHeader
        location={MOCK_LOCATION}
        editionNumber={dayOfYear(today)}
        dateLabel={dateLabel}
        mode={mode}
        onModeChange={setMode}
        ctx={ctx}
        onCtxChange={setCtx}
        searchIndex={searchIndex}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      />

      {loading ? (
        <p className={`${s.inner} ${s.muted}`} style={{ paddingTop: 96, paddingBottom: 96, fontSize: 16 }}>
          A carregar agenda…
        </p>
      ) : (
        <>
          <PainelHero
            weekdayLabel={WEEKDAY_HERO_PT[today.getDay()]}
            dayNumber={today.getDate()}
            monthLine={`de ${monthName}, semana ${isoWeek(today)}`}
            mode={mode}
            todayClasses={todayClasses}
            nextClass={nextClassOtherDay}
            tiles={tiles}
            subjectsCount={subjects.length}
            focusRunning={focusRunning}
            onToggleFocus={toggleFocus}
            onCapture={addNote}
          />

          <main className={`${s.inner} ${s.grid12}`} style={{ paddingTop: 64 }}>
            <div className={s.colMain}>
              <DayIndex events={todayEvents} nowMinutes={nowMinutes} ctx={ctx} dayLabel={indexLabel} />
            </div>
            <div className={s.colSide}>
              <WeekGrid columns={weekColumns} today={today} weekNumber={isoWeek(today)} ctx={ctx} />
            </div>
          </main>

          <PainelMonth today={today} getEvents={getEvents} onAddEvent={handleAddEvent} onRemoveEvent={handleRemoveEvent} />

          <Deadlines items={deadlineItems} today={today} ctx={ctx} />

          <div className={`${s.inner} ${s.grid12}`} style={{ paddingTop: 80 }}>
            <div className={s.colMain}>
              <ActionPlan
                tasks={planTasks}
                projects={workProjects}
                classHours={classHoursWeek}
                taskHours={taskHoursWeek}
                today={today}
                pendingIds={pendingTaskIds}
                onToggle={handleToggleTask}
                onAdd={handleAddTask}
              />
            </div>
            <div className={s.colSide}>
              <Balance notes={notes} onAddNote={addNote} onClearNotes={() => setNotes([])} />
            </div>
          </div>
        </>
      )}

      <PainelFooter />

      <svg aria-hidden="true" className={s.grain}>
        <filter id="painel-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#painel-grain)" />
      </svg>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
