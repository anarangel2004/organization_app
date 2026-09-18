'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate } from '@/lib/utils';
import { getWorkProjects, getWorkTasks, WorkProject, WorkTask } from '@/lib/workData';
import ProfileModal from '@/components/ui/ProfileModal';
import { Ticker } from './components/Ticker';
import { HomeMasthead } from './components/HomeMasthead';
import { ModuleCards } from './components/ModuleCards';
import { DeadlineCountdown } from './components/DeadlineCountdown';
import { WeeklyRhythm } from './components/WeeklyRhythm';
import { UpcomingDeadlines } from './components/UpcomingDeadlines';
import { HomeFooter } from './components/HomeFooter';
import { AgendaRow, SearchEntry, UpcomingRow, WeekDayCell } from './components/types';
import {
  AssessmentLite,
  SubjectLite,
  collectClasses,
  dayOfYear,
  DAY_NUM_TO_LABEL,
  formatDaysLeftLabel,
  parseDueDate,
  parseMinutes,
  PT_WEEKDAY_LABEL,
} from './components/homeAgenda';

export default function HomePage() {
  const { user } = useCurrentUser();
  const [supabase] = useState(() => createClient());

  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  const [assessments, setAssessments] = useState<AssessmentLite[]>([]);
  const [workProjects, setWorkProjects] = useState<WorkProject[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectsRes, assessmentsRes, projects, tasks] = await Promise.all([
        supabase.from('subjects').select('id, name, code, schedules'),
        supabase.from('assessments').select('id, subject_id, title, due_date'),
        getWorkProjects(),
        getWorkTasks(),
      ]);

      setSubjects(subjectsRes.data || []);
      setAssessments(assessmentsRes.data || []);
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

  const now = useMemo(() => new Date(), []);
  const jsDay = now.getDay();
  const todayNum = jsDay >= 1 && jsDay <= 5 ? jsDay : 0; // 0 = fim de semana, sem aulas hoje
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const subjectLookup = useMemo(() => {
    const map = new Map<string, SubjectLite>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const projectLookup = useMemo(() => {
    const map = new Map<string, WorkProject>();
    workProjects.forEach((p) => map.set(p.id, p));
    return map;
  }, [workProjects]);

  const classes = useMemo(() => collectClasses(subjects), [subjects]);

  // Próxima aula (a mais próxima ainda por vir esta semana, Seg-Sex)
  const nextClassLabel = useMemo(() => {
    let best: { offset: number; minutes: number; dayNum: number; startTime: string } | null = null;

    for (const c of classes) {
      let offset: number;
      if (todayNum === 0) {
        offset = c.dayNum; // fim de semana: ordena Seg (1) antes de Sex (5)
      } else if (c.dayNum > todayNum) {
        offset = c.dayNum - todayNum;
      } else if (c.dayNum === todayNum && parseMinutes(c.startTime) > nowMinutes) {
        offset = 0;
      } else {
        continue; // já passou esta semana
      }

      const minutes = parseMinutes(c.startTime);
      if (!best || offset < best.offset || (offset === best.offset && minutes < best.minutes)) {
        best = { offset, minutes, dayNum: c.dayNum, startTime: c.startTime };
      }
    }

    if (!best) return 'SEM AULAS AGENDADAS ESTA SEMANA';
    const dayLabel = best.offset === 0 ? 'HOJE' : DAY_NUM_TO_LABEL[best.dayNum];
    return `${dayLabel} ${best.startTime}`;
  }, [classes, todayNum, nowMinutes]);

  const pendingTasksCount = useMemo(
    () => workTasks.filter((t) => !t.completed).length,
    [workTasks]
  );

  // ==========================================
  // "PRÓXIMOS 7 DIAS": prazos + tarefas (sem aulas, que são recorrentes)
  // ==========================================
  const upcomingRows = useMemo<UpcomingRow[]>(() => {
    const rows: UpcomingRow[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 6);
    limit.setHours(23, 59, 59, 999);

    assessments.forEach((a) => {
      const due = parseDueDate(a.due_date);
      if (due && due >= today && due <= limit) {
        const subject = subjectLookup.get(a.subject_id);
        rows.push({
          id: `prazo-${a.id}`,
          kind: 'PRAZO',
          date: due,
          title: a.title || 'AVALIAÇÃO',
          subtitle: subject?.code || subject?.name || 'FACULDADE',
        });
      }
    });

    workTasks
      .filter((t) => !t.completed)
      .forEach((t) => {
        const due = parseDueDate(t.due_date);
        if (due && due >= today && due <= limit) {
          const project = t.project_id ? projectLookup.get(t.project_id) : undefined;
          rows.push({
            id: `tarefa-${t.id}`,
            kind: 'TAREFA',
            date: due,
            title: t.title,
            subtitle: project?.name || 'SEM PROJETO',
          });
        }
      });

    return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assessments, workTasks, subjectLookup, projectLookup]);

  // ==========================================
  // "RITMO SEMANAL": grelha Seg-Dom da semana atual
  // ==========================================
  const weekDays = useMemo<WeekDayCell[]>(() => {
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const jsDayNow = todayMid.getDay();
    const diffToMonday = jsDayNow === 0 ? -6 : 1 - jsDayNow;
    const monday = new Date(todayMid);
    monday.setDate(todayMid.getDate() + diffToMonday);

    const cells: WeekDayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const jsDayOfCell = date.getDay();
      const classDayNum = jsDayOfCell >= 1 && jsDayOfCell <= 5 ? jsDayOfCell : 0;
      const isToday = date.getTime() === todayMid.getTime();
      const isPast = date.getTime() < todayMid.getTime();

      const rows: AgendaRow[] = [];

      if (classDayNum !== 0) {
        classes
          .filter((c) => c.dayNum === classDayNum)
          .sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime))
          .forEach((c) => {
            rows.push({
              id: `aula-${c.subjectId}-${c.startTime}-${i}`,
              kind: 'AULA',
              time: c.startTime,
              title: `${c.subjectCode}${c.type ? ` · ${c.type}` : ''}`,
              subtitle: c.room ? `SALA ${c.room}` : 'AULA',
            });
          });
      }

      assessments.forEach((a) => {
        const due = parseDueDate(a.due_date);
        if (due && due.getTime() === date.getTime()) {
          const subject = subjectLookup.get(a.subject_id);
          rows.push({
            id: `prazo-${a.id}-${i}`,
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
              id: `tarefa-${t.id}-${i}`,
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

      const hasCritical = rows.some((r) => r.kind === 'PRAZO');
      let status: WeekDayCell['status'];
      if (isPast) status = 'CONCLUÍDO';
      else if (isToday) status = 'HOJE';
      else if (hasCritical) status = 'CRÍTICO';
      else if (rows.length > 0) status = 'PROGRAMADO';
      else status = 'FLEXÍVEL';

      cells.push({
        date,
        dayLabel: PT_WEEKDAY_LABEL[jsDayOfCell],
        dateLabel: String(date.getDate()).padStart(2, '0'),
        isToday,
        isPast,
        status,
        rows,
      });
    }
    return cells;
  }, [classes, assessments, workTasks, subjectLookup, projectLookup]);

  // ==========================================
  // TICKER: os itens mais urgentes (hoje + próximos 7 dias)
  // ==========================================
  const tickerItems = useMemo(() => {
    return upcomingRows.slice(0, 6).map((row) => ({
      id: row.id,
      text: `${row.title} — ${row.subtitle}`,
      tag: formatDaysLeftLabel(row.date, now),
    }));
  }, [upcomingRows, now]);

  const nearestDeadline = upcomingRows[0] || null;

  // ==========================================
  // PESQUISA (sobre os dados já carregados, sem chamadas extra)
  // ==========================================
  const searchIndex = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = [];
    subjects.forEach((s) =>
      entries.push({
        id: `search-subj-${s.id}`,
        label: s.name || s.code || 'Disciplina',
        sublabel: 'FACULDADE // DISCIPLINA',
        href: `/faculdade/${s.id}`,
      })
    );
    assessments.forEach((a) =>
      entries.push({
        id: `search-assess-${a.id}`,
        label: a.title || 'Avaliação',
        sublabel: 'FACULDADE // PRAZO',
        href: `/faculdade/${a.subject_id}`,
      })
    );
    workProjects.forEach((p) =>
      entries.push({
        id: `search-proj-${p.id}`,
        label: p.name,
        sublabel: 'TRABALHO // PROJETO',
        href: '/trabalho',
      })
    );
    workTasks.forEach((t) =>
      entries.push({
        id: `search-task-${t.id}`,
        label: t.title,
        sublabel: 'TRABALHO // TAREFA',
        href: '/trabalho',
      })
    );
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

  const todayFormatted = now
    .toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();

  const editionLabel = `VOL. ${now.getFullYear()} · Nº ${String(dayOfYear(now)).padStart(3, '0')}`;

  return (
    <div className="min-h-screen bg-[#FCF9F2] text-[#111111] font-sans selection:bg-[#111111] selection:text-[#FCF9F2] flex flex-col justify-between">
      <Ticker items={tickerItems} />

      <main className="max-w-7xl mx-auto px-6 pt-10 pb-12 space-y-12 w-full flex-1">
        <HomeMasthead
          editionLabel={editionLabel}
          todayFormatted={todayFormatted}
          searchIndex={searchIndex}
          profileUser={profileUser}
          onOpenProfileModal={() => setIsProfileOpen(true)}
        />

        {loading ? (
          <div className="py-12 font-mono text-center text-xs tracking-widest uppercase text-[#767571]">
            A CARREGAR AGENDA...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <ModuleCards
                  subjectsCount={subjects.length}
                  nextClassLabel={nextClassLabel}
                  projectsCount={workProjects.length}
                  pendingTasksCount={pendingTasksCount}
                />
              </div>
              <div className="lg:col-span-4">
                <DeadlineCountdown deadline={nearestDeadline} />
              </div>
            </section>

            <hr className="border-[#D8D5CC]" />

            <WeeklyRhythm weekDays={weekDays} />

            <hr className="border-[#D8D5CC]" />

            <UpcomingDeadlines rows={upcomingRows} />
          </>
        )}
      </main>

      <HomeFooter />

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
