'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getAllMirror, reconcileMirror } from '@/lib/offline/db';
import { isNetworkError } from '@/lib/offline/sync';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate, getItemEffectiveGrade } from '@/lib/utils';
import { getWorkProjects, getWorkTasks, WorkProject, WorkTask } from '@/lib/workData';
import type { AssessmentItem } from '@/types';
import ProfileModal from '@/components/ui/ProfileModal';
import s from '@/app/components/painel/painel.module.css';
import { SiteHeader } from '@/app/components/painel/PainelTop';
import { useNow } from '@/app/components/painel/useLocalState';
import type { SearchEntry } from '@/app/components/types';
import {
  ClassOccurrence,
  collectClasses,
  computeSubjectHours,
  parseDueDate,
  parseMinutes,
} from '@/app/components/homeAgenda';
import {
  MONTHS_PT,
  WEEKDAY_LONG_PT,
  addDays,
  classTypeLabel,
  daysBetween,
  fmtNum,
  isoKey,
  isoWeek,
  mondayOf,
  shortDate,
  startOfDay,
} from '@/app/components/painel/painelData';
import { AddSubjectForm } from './components/AddSubjectForm';
import {
  ClassSlot,
  EnterAgenda,
  FacHero,
  FacStat,
  OVERFLOW_TONE,
  SUBJECT_TONES,
  SubjectCardView,
  SubjectGrid,
  SubjectTone,
  TimetableBlock,
  Upcoming,
  UpcomingItem,
  WeekTimetable,
} from './components/FaculdadePainel';

type Teacher = string | { name?: string | null } | null | undefined;

interface FacSubject {
  id: string;
  code: string | null;
  name: string | null;
  ects?: number | null;
  semester?: number | null;
  degree_year?: number | null;
  academic_year?: string | null;
  teacher_teorica?: Teacher;
  regente?: Teacher;
  schedules: unknown;
}

interface ChapterRef {
  id: string;
  subject_id: string;
}

const WORK_DOT: SubjectTone = { bg: 'var(--bone)', fg: 'var(--inkdark)', tc: 'var(--bone)' };

function teacherName(t: Teacher): string | null {
  if (!t) return null;
  if (typeof t === 'string') return t.trim() || null;
  return t.name?.trim() || null;
}

function typeShort(type: string): string {
  const t = type.toUpperCase();
  if (t.startsWith('TEÓRICO-P') || t.startsWith('TEORICO-P') || t === 'TP') return 'TP';
  if (t.startsWith('P')) return 'P';
  if (t.startsWith('T')) return 'T';
  return t.slice(0, 2);
}

// Tolera leituras falhadas por falta de rede, caindo para o espelho local.
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

export default function FaculdadePage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [supabase] = useState(() => createClient());

  const [subjects, setSubjects] = useState<FacSubject[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [workProjects, setWorkProjects] = useState<WorkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      // O Supabase aplica a RLS e traz apenas as disciplinas do utilizador.
      const [subs, assess, chaps, tasks, projects] = await Promise.all([
        readTable<FacSubject>('subjects', () => supabase.from('subjects').select('*')),
        readTable<AssessmentItem>('assessments', () => supabase.from('assessments').select('*')),
        readTable<ChapterRef>('chapters', () => supabase.from('chapters').select('id, subject_id')).catch(() => []),
        getWorkTasks().catch(() => []),
        getWorkProjects().catch(() => []),
      ]);
      setSubjects(subs);
      setAssessments(assess);
      setChapters(chaps);
      setWorkTasks(tasks);
      setWorkProjects(projects);
    } catch (err) {
      console.error('Erro ao carregar a faculdade:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Pedido inicial de dados ao montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- correr apenas uma vez ao montar
  }, []);

  const now = useNow(60_000);
  const todayKey = isoKey(now);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só muda quando muda o dia
  const today = useMemo(() => startOfDay(now), [todayKey]);
  const monday = useMemo(() => mondayOf(today), [today]);

  const subjectById = useMemo(() => new Map(subjects.map((x) => [x.id, x])), [subjects]);
  const projectById = useMemo(() => new Map(workProjects.map((p) => [p.id, p])), [workProjects]);

  // Tom fixo por disciplina, pela ordem do código.
  const toneOf = useMemo(() => {
    const sorted = [...subjects].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
    const map = new Map<string, SubjectTone>();
    sorted.forEach((x, i) => map.set(x.id, SUBJECT_TONES[i] ?? OVERFLOW_TONE));
    return map;
  }, [subjects]);

  const classes = useMemo<ClassOccurrence[]>(() => collectClasses(subjects), [subjects]);
  const nameOf = useCallback((id: string) => {
    const x = subjectById.get(id);
    return x?.name || x?.code || 'Disciplina';
  }, [subjectById]);

  const slots = useMemo<ClassSlot[]>(
    () =>
      classes.map((c) => ({
        subjectId: c.subjectId,
        subjectName: nameOf(c.subjectId),
        typeLabel: classTypeLabel(c.type),
        dayNum: c.dayNum,
        start: c.startTime,
        end: c.endTime,
        room: c.room,
      })),
    [classes, nameOf]
  );

  // ==========================================
  // NÚMEROS DA ABERTURA
  // ==========================================
  const stats = useMemo<FacStat[]>(() => {
    const ects = subjects.reduce((sum, x) => sum + (Number(x.ects) || 0), 0);
    const hours = computeSubjectHours(classes).reduce((sum, x) => sum + x.hours, 0);

    const upcomingDays = assessments
      .map((a) => parseDueDate(a.due_date))
      .filter((d): d is Date => d !== null && d >= today)
      .map((d) => daysBetween(today, d));
    const nextDeadline = upcomingDays.length ? Math.min(...upcomingDays) : null;

    let weighted = 0;
    let weights = 0;
    assessments.forEach((a) => {
      const g = getItemEffectiveGrade(a);
      if (typeof g !== 'number') return;
      const w = a.weight_percent || 1;
      weighted += g * w;
      weights += w;
    });

    return [
      { value: String(ects), label: 'ECTS em curso' },
      { value: fmtNum(hours), label: 'horas de aula por semana' },
      {
        value: nextDeadline === null ? '—' : String(nextDeadline),
        label: nextDeadline === 0 ? 'prazo para hoje' : 'dias até ao próximo prazo',
      },
      { value: weights ? fmtNum(weighted / weights) : '—', label: 'nota média atual' },
    ];
  }, [subjects, classes, assessments, today]);

  // ==========================================
  // PRÓXIMOS 7 DIAS (avaliações + tarefas de trabalho)
  // ==========================================
  const upcoming = useMemo<UpcomingItem[]>(() => {
    const limit = addDays(today, 6);
    const items: UpcomingItem[] = [];
    assessments.forEach((a) => {
      const due = parseDueDate(a.due_date);
      if (!due || due < today || due > limit) return;
      const weight = typeof a.weight_percent === 'number' ? ` Peso: ${a.weight_percent}%.` : '';
      items.push({
        id: `a-${a.id}`,
        date: due,
        title: a.title || 'Avaliação',
        subtitle: nameOf(a.subject_id),
        desc: `${a.title || 'Avaliação'}, ${shortDate(due)}.${weight}`,
        tone: toneOf.get(a.subject_id) ?? OVERFLOW_TONE,
        href: `/faculdade/${a.subject_id}`,
      });
    });
    workTasks
      .filter((t) => !t.completed)
      .forEach((t) => {
        const due = parseDueDate(t.due_date);
        if (!due || due < today || due > limit) return;
        const project = t.project_id ? projectById.get(t.project_id) : undefined;
        items.push({
          id: `t-${t.id}`,
          date: due,
          title: t.title,
          subtitle: project?.name || 'Trabalho',
          desc: `Tarefa de trabalho com prazo a ${shortDate(due)}.`,
          tone: WORK_DOT,
          href: '/trabalho',
        });
      });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assessments, workTasks, today, nameOf, toneOf, projectById]);

  // ==========================================
  // SEMANA: aulas recorrentes + prazos do dia (22:30–23:00)
  // ==========================================
  const blocks = useMemo<TimetableBlock[]>(() => {
    const out: TimetableBlock[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      classes
        .filter((c) => c.dayNum === date.getDay())
        .forEach((c) => {
          const room = c.room ? `Sala ${c.room}` : 'Sala a definir';
          out.push({
            id: `c-${c.subjectId}-${c.startTime}-${i}`,
            date,
            start: c.startTime,
            end: c.endTime,
            label: [c.subjectCode, c.type ? typeShort(c.type) : null, c.room || null].filter(Boolean).join(' · '),
            title: nameOf(c.subjectId),
            desc: `${classTypeLabel(c.type)}. ${room}. ${c.startTime}${c.endTime ? ` às ${c.endTime}` : ''}.`,
            tone: toneOf.get(c.subjectId) ?? OVERFLOW_TONE,
            href: `/faculdade/${c.subjectId}`,
          });
        });
      assessments.forEach((a) => {
        const due = parseDueDate(a.due_date);
        if (!due || isoKey(due) !== isoKey(date)) return;
        out.push({
          id: `p-${a.id}`,
          date,
          start: '22:30',
          end: '23:00',
          label: `Prazo · ${a.title || 'Avaliação'}`,
          title: `Prazo: ${a.title || 'Avaliação'}`,
          desc: `${nameOf(a.subject_id)}. Entrega até ao fim do dia.`,
          tone: toneOf.get(a.subject_id) ?? OVERFLOW_TONE,
          href: `/faculdade/${a.subject_id}`,
        });
      });
    }
    return out;
  }, [monday, classes, assessments, nameOf, toneOf]);

  const legend = useMemo(
    () =>
      [...subjects]
        .sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''))
        .map((x) => ({ label: x.name || x.code || 'Disciplina', tone: toneOf.get(x.id) ?? OVERFLOW_TONE })),
    [subjects, toneOf]
  );

  // ==========================================
  // CARTÕES DAS DISCIPLINAS (ordenados pela próxima aula)
  // ==========================================
  const cards = useMemo<SubjectCardView[]>(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const withNext = subjects.map((x) => {
      let best: { offset: number; start: number; c: ClassOccurrence } | null = null;
      classes
        .filter((c) => c.subjectId === x.id)
        .forEach((c) => {
          const start = parseMinutes(c.startTime);
          const end = c.endTime ? parseMinutes(c.endTime) : start + 90;
          let offset = (c.dayNum - today.getDay() + 7) % 7;
          if (offset === 0 && nowMin >= end) offset = 7;
          if (!best || offset < best.offset || (offset === best.offset && start < best.start)) best = { offset, start, c };
        });
      return { x, best: best as { offset: number; start: number; c: ClassOccurrence } | null };
    });
    withNext.sort((a, b) => (a.best ? a.best.offset * 1440 + a.best.start : Infinity) - (b.best ? b.best.offset * 1440 + b.best.start : Infinity));

    return withNext.map(({ x, best }) => {
      const code = x.code || '';
      const initials = (code || (x.name || '?').split(/\s+/).map((w) => w[0]).join('')).slice(0, 3).toUpperCase();
      const teacher = teacherName(x.teacher_teorica) || teacherName(x.regente);
      const meta = [teacher, code || null, x.ects ? `${x.ects} ECTS` : null].filter(Boolean).join(' · ');

      const chapterCount = chapters.filter((c) => c.subject_id === x.id).length;
      const nextAssessment = assessments
        .filter((a) => a.subject_id === x.id)
        .map((a) => ({ a, due: parseDueDate(a.due_date) }))
        .filter((r): r is { a: AssessmentItem; due: Date } => r.due !== null && r.due >= today)
        .sort((p, q) => p.due.getTime() - q.due.getTime())[0];
      const period = [
        x.degree_year ? `${x.degree_year}.º ano` : null,
        x.semester ? `${x.semester}.º semestre` : null,
        x.academic_year || null,
      ]
        .filter(Boolean)
        .join(', ');
      const summary = [
        period || null,
        `${chapterCount} ${chapterCount === 1 ? 'capítulo' : 'capítulos'} nos notebooks`,
        nextAssessment ? `próxima avaliação: ${nextAssessment.a.title || 'avaliação'}, ${shortDate(nextAssessment.due)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      let nextLabel = 'sem aulas no horário';
      if (best) {
        const day =
          best.offset === 0
            ? 'hoje'
            : best.offset === 1
              ? 'amanhã'
              : WEEKDAY_LONG_PT[best.c.dayNum].replace('-feira', '').toLowerCase();
        const range = best.c.endTime ? `${best.c.startTime}–${best.c.endTime}` : best.c.startTime;
        nextLabel = `${day}, ${range}${best.c.room ? `, Sala ${best.c.room}` : ''}`;
      }

      return {
        id: x.id,
        initials: initials || '?',
        name: x.name || x.code || 'Disciplina',
        meta,
        summary: summary.charAt(0).toUpperCase() + summary.slice(1) + '.',
        nextLabel,
        tone: toneOf.get(x.id) ?? OVERFLOW_TONE,
      };
    });
  }, [subjects, classes, chapters, assessments, today, now, toneOf]);

  const searchIndex = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = [];
    subjects.forEach((x) =>
      entries.push({ id: `s-${x.id}`, label: x.name || x.code || 'Disciplina', sublabel: 'Disciplina', href: `/faculdade/${x.id}` })
    );
    assessments.forEach((a) =>
      entries.push({ id: `a-${a.id}`, label: a.title || 'Avaliação', sublabel: `Avaliação · ${nameOf(a.subject_id)}`, href: `/faculdade/${a.subject_id}` })
    );
    return entries;
  }, [subjects, assessments, nameOf]);

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

  const dateLabel = `${WEEKDAY_LONG_PT[today.getDay()]}, ${today.getDate()} de ${MONTHS_PT[today.getMonth()]}`;

  return (
    <div className={s.root}>
      <SiteHeader
        active="faculdade"
        dateLabel={dateLabel}
        searchIndex={searchIndex}
        searchPlaceholder="Pesquisar índice…"
        newDossierHref="#nova-disciplina"
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      />

      {loading ? (
        <p className={`${s.inner} ${s.muted}`} style={{ paddingTop: 96, paddingBottom: 96, fontSize: 16 }}>
          A carregar disciplinas…
        </p>
      ) : (
        <>
          <FacHero stats={stats} slots={slots} />
          <Upcoming items={upcoming} today={today} />
          <WeekTimetable monday={monday} today={today} weekNumber={isoWeek(today)} blocks={blocks} legend={legend} />
          <SubjectGrid subjects={cards} />
        </>
      )}

      <section id="nova-disciplina" className={s.inner} style={{ paddingTop: 32, scrollMarginTop: 24 }}>
        <AddSubjectForm onSubjectAdded={fetchAll} />
      </section>

      <EnterAgenda />

      <svg aria-hidden="true" className={s.grain}>
        <filter id="faculdade-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#faculdade-grain)" />
      </svg>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
