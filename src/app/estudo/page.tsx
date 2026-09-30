'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate } from '@/lib/utils';
import type { AssessmentItem } from '@/types';
import ProfileModal from '@/components/ui/ProfileModal';
import d from '@/app/components/denso/denso.module.css';
import { DensoHeader, SearchHit, ShortcutBar, ShortcutItem, scrollToId, useShortcuts } from '@/app/components/denso/DensoChrome';
import { AvatarMenu, PhoneTabBar, SectionChips, TabletHeader, useDensoLayout } from '@/app/components/denso/DensoTouch';
import { useNow } from '@/app/components/painel/useLocalState';
import { FAC_TONES, OVERFLOW_TONE } from '@/app/faculdade/components/FaculdadeDenso';
import { MONTHS_LONG, WEEKDAY_LONG } from '@/app/faculdade/[id]/components/disciplinaData';
import {
  deleteBlocks,
  deleteSession,
  flushSessions,
  loadSavedBlocks,
  loadSessionsSince,
  loadStudySettings,
  newId,
  publishReminders,
  queueSession,
  saveBlocks,
  studyErrorMessage,
  updateBlock,
  updateSession,
  type StudySessionRow,
} from '@/lib/study';
import { getWorkShifts, type WorkShift } from '@/lib/workData';
import {
  DEFAULT_SETTINGS,
  buildWeekPlan,
  chaptersToReview,
  computePlan,
  fmtHours,
  hoursVsGrade,
  isoDay,
  mondayOf,
  reminderItems,
  resolveWeekPlan,
  staleSubjects,
  startOfDay,
  studyStreak,
  weekTotals,
  type PlanBlock,
  type PlanSubject,
  type SavedBlock,
  type StudySettings,
} from '@/lib/studyPlan';
import { ManualSessionDialog } from '@/app/faculdade/[id]/notebook/components/ManualSessionDialog';
import {
  EstudoAlerts,
  EstudoHeading,
  EstudoHistory,
  EstudoHoursGrade,
  EstudoPlan,
  EstudoReview,
  EstudoSessions,
  EstudoStats,
  EstudoSubjects,
  EstudoWeekSummary,
  SETTINGS_EVENT,
  type BlockAction,
  type StatTile,
  type WeekBar,
} from './EstudoView';

interface ChapterLite {
  id: string;
  subject_id: string;
  number: string | number | null;
  title: string | null;
  category: string | null;
}

const HISTORY_WEEKS = 8;

// Dia do bloco + hora (HH:MM) → data e hora completas.
function blockStart(b: { date: Date; start: string }) {
  const at = new Date(b.date);
  at.setHours(Number(b.start.slice(0, 2)), Number(b.start.slice(3, 5)), 0, 0);
  return at;
}

export default function EstudoPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const layout = useDensoLayout();
  const phone = layout === 'phone';

  const [subjects, setSubjects] = useState<PlanSubject[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [chapters, setChapters] = useState<ChapterLite[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState('resumo');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([]);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [sessBusy, setSessBusy] = useState(false);
  const [sessError, setSessError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const now = useNow(60_000);
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só muda quando muda o dia
  const today = useMemo(() => startOfDay(now), [todayKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await flushSessions();
      // 8 semanas de histórico + 14 dias antes (janela de preparação), ou desde
      // o início do semestre se for antes (para "horas vs. nota").
      const sett = await loadStudySettings();
      const recent = new Date(mondayOf(new Date()).getTime() - (HISTORY_WEEKS * 7 + 14) * 86400000);
      const semStart = sett.settings.semesterStart ? new Date(`${sett.settings.semesterStart}T00:00:00`) : null;
      const since = semStart && semStart < recent ? semStart : recent;
      const [subj, assess, chaps, sess, shiftRows] = await Promise.all([
        supabase.from('subjects').select('*'),
        supabase.from('assessments').select('*'),
        supabase.from('chapters').select('id, subject_id, number, title, category'),
        loadSessionsSince(since),
        getWorkShifts().catch(() => [] as WorkShift[]),
      ]);
      setShifts(shiftRows);
      if (subj.error) throw subj.error;
      setSubjects(((subj.data ?? []) as PlanSubject[]).map((s) => ({ ...s, id: String(s.id) })));
      setAssessments((assess.data ?? []) as AssessmentItem[]);
      setChapters(((chaps.data ?? []) as ChapterLite[]).map((c) => ({ ...c, id: String(c.id), subject_id: String(c.subject_id) })));
      setSessions(sess);
      setSettings(sett.settings);
    } catch (err) {
      console.error('Erro ao carregar o estudo:', err);
      setLoadError('Não foi possível carregar os dados do estudo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido inicial de dados
    load();
  }, [load]);

  // Blocos fixados desta semana (voltam a ser lidos quando muda a semana).
  const weekKey = isoDay(mondayOf(today));
  useEffect(() => {
    let alive = true;
    loadSavedBlocks(weekKey).then((rows) => alive && setSavedBlocks(rows));
    return () => {
      alive = false;
    };
  }, [weekKey]);

  // Definições gravadas no perfil: recalcula logo.
  useEffect(() => {
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent<StudySettings>).detail;
      if (s) setSettings(s);
    };
    window.addEventListener(SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_EVENT, onSettings);
  }, []);

  // ==========================================
  // CÁLCULOS
  // ==========================================
  const sorted = useMemo(() => [...subjects].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || '')), [subjects]);
  const toneMap = useMemo(() => {
    const m = new Map<string, string>();
    sorted.forEach((s, i) => {
      const t = FAC_TONES[i] ?? OVERFLOW_TONE;
      m.set(s.id, t.bg === 'transparent' ? t.bd : t.bg);
    });
    return m;
  }, [sorted]);
  const toneOf = useCallback((id: string) => toneMap.get(id) ?? '#7fb0cb', [toneMap]);

  const { rows, period } = useMemo(
    () => computePlan({ subjects: sorted, assessments, sessions, settings, today }),
    [sorted, assessments, sessions, settings, today]
  );
  // Primeiro as disciplinas com mais a fazer esta semana.
  const planRows = useMemo(
    () => [...rows].sort((a, b) => b.suggestedWeek - b.doneWeek - (a.suggestedWeek - a.doneWeek) || a.code.localeCompare(b.code)),
    [rows]
  );

  // Blocos para o resto da semana (refeitos a cada minuto, com a hora atual).
  const weekPlan = useMemo(
    () => buildWeekPlan({ rows, subjects: sorted, assessments, shifts, settings, now }),
    [rows, sorted, assessments, shifts, settings, now]
  );
  // Com blocos guardados, o plano passa a ser esse (fixado).
  const plan = useMemo(() => resolveWeekPlan(weekPlan.days, savedBlocks, rows), [weekPlan.days, savedBlocks, rows]);

  // Lembretes: o componente global lê esta lista e avisa antes de cada bloco.
  useEffect(() => {
    if (loading) return;
    publishReminders({ enabled: settings.reminders, minutesBefore: settings.reminderMinutes, items: reminderItems(plan.days, now) });
  }, [plan.days, settings.reminders, settings.reminderMinutes, now, loading]);

  const onBlockAction = useCallback(
    async (a: BlockAction) => {
      const target = a.block;
      const edit = (r: SavedBlock): SavedBlock | null => {
        if (a.kind === 'delete') return null;
        if (a.kind === 'done') return { ...r, status: 'done' };
        if (a.kind === 'undone') return { ...r, status: 'planned' };
        return { ...r, date: isoDay(a.date), start_time: a.start, end_time: a.end };
      };
      const toRow = (b: PlanBlock): SavedBlock => ({
        id: newId(),
        subject_id: b.subjectId,
        week_start: weekKey,
        date: isoDay(b.date),
        start_time: b.start,
        end_time: b.end,
        status: b.status ?? 'planned',
        reason: b.reason,
      });

      setPlanBusy(true);
      setPlanError(null);
      try {
        let next = savedBlocks;
        // Primeira mexida: a sugestão inteira fica guardada (o plano fixa).
        if (!plan.fixed) {
          const fresh: SavedBlock[] = [];
          for (const day of plan.days) {
            for (const b of day.blocks) {
              if (b.saved) continue;
              const row = b.id === target.id ? edit(toRow(b)) : toRow(b);
              if (row) fresh.push(row);
            }
          }
          await saveBlocks(fresh);
          next = [...next, ...fresh];
        }
        if (target.saved) {
          const row = savedBlocks.find((r) => r.id === target.id);
          const out = row ? edit(row) : null;
          if (row && !out) {
            await deleteBlocks([row.id]);
            next = next.filter((r) => r.id !== row.id);
          } else if (row && out) {
            await updateBlock(row.id, { date: out.date, start_time: out.start_time, end_time: out.end_time, status: out.status });
            next = next.map((r) => (r.id === row.id ? out : r));
          }
        }
        setSavedBlocks(next);

        // Feito: regista a sessão, se o caderno ainda não contou esse tempo.
        const start = blockStart(target);
        if (a.kind === 'done') {
          const end = new Date(Math.min(blockStart({ date: target.date, start: target.end }).getTime(), Date.now()));
          const overlaps = sessions.some(
            (s) => s.subject_id === target.subjectId && new Date(s.started_at) < end && new Date(s.ended_at) > start
          );
          if (!overlaps && end > start) {
            const row: StudySessionRow = {
              id: newId(),
              subject_id: target.subjectId,
              chapter_id: null,
              started_at: start.toISOString(),
              ended_at: end.toISOString(),
              duration_seconds: Math.round((end.getTime() - start.getTime()) / 1000),
              source: 'manual',
            };
            queueSession(row);
            setSessions((prev) => [...prev, row]);
          }
        }
        // Desfazer: tira a sessão que o "Feito" criou.
        if (a.kind === 'undone') {
          const auto = sessions.find(
            (s) => s.source === 'manual' && s.subject_id === target.subjectId && s.started_at === start.toISOString() && !s.chapter_id
          );
          if (auto) {
            await deleteSession(auto.id);
            setSessions((prev) => prev.filter((s) => s.id !== auto.id));
          }
        }
      } catch (err) {
        console.error('Erro no plano:', err);
        setPlanError(studyErrorMessage(err));
      } finally {
        setPlanBusy(false);
      }
    },
    [plan, savedBlocks, sessions, weekKey]
  );

  // Refazer: apaga os blocos por fazer; os feitos ficam.
  const onRedo = useCallback(async () => {
    setPlanBusy(true);
    setPlanError(null);
    try {
      await deleteBlocks(savedBlocks.filter((b) => b.status === 'planned').map((b) => b.id));
      setSavedBlocks((prev) => prev.filter((b) => b.status === 'done'));
    } catch (err) {
      console.error('Erro ao refazer o plano:', err);
      setPlanError(studyErrorMessage(err));
    } finally {
      setPlanBusy(false);
    }
  }, [savedBlocks]);

  // Sessões: apagar, corrigir e acrescentar à mão.
  const onDeleteSession = useCallback(async (id: string) => {
    setSessBusy(true);
    setSessError(null);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Erro ao apagar a sessão:', err);
      setSessError(studyErrorMessage(err));
    } finally {
      setSessBusy(false);
    }
  }, []);

  const onUpdateSession = useCallback(async (id: string, patch: { chapter_id?: string | null; duration_seconds?: number }) => {
    setSessBusy(true);
    setSessError(null);
    try {
      await updateSession(id, patch);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const nextRow = { ...s, ...patch };
          if (patch.duration_seconds != null) nextRow.ended_at = new Date(new Date(s.started_at).getTime() + patch.duration_seconds * 1000).toISOString();
          return nextRow;
        })
      );
    } catch (err) {
      console.error('Erro ao corrigir a sessão:', err);
      setSessError(studyErrorMessage(err));
    } finally {
      setSessBusy(false);
    }
  }, []);

  const onAddSession = useCallback((row: Omit<StudySessionRow, 'id' | 'source'>) => {
    const full: StudySessionRow = { ...row, id: newId(), source: 'manual' };
    queueSession(full);
    setSessions((prev) => [...prev, full]);
  }, []);

  // Resumo da semana passada: o mesmo cálculo, visto do domingo passado.
  const lastWeekRows = useMemo(() => {
    const lastSunday = new Date(mondayOf(today).getTime() - 86400000);
    return computePlan({ subjects: sorted, assessments, sessions, settings, today: startOfDay(lastSunday) }).rows;
  }, [sorted, assessments, sessions, settings, today]);

  const weeks = useMemo(() => weekTotals(sessions, today, HISTORY_WEEKS), [sessions, today]);
  const weekBars = useMemo<WeekBar[]>(
    () =>
      weeks.map((w) => ({
        start: w.start,
        hours: w.hours,
        parts: sorted
          .filter((s) => (w.bySubject.get(s.id) || 0) > 0)
          .map((s) => ({ color: toneOf(s.id), hours: w.bySubject.get(s.id) || 0, label: s.code || s.name || 'Disciplina' })),
      })),
    [weeks, sorted, toneOf]
  );

  const doneWeek = rows.reduce((n, r) => n + r.doneWeek, 0);
  const suggestedWeek = rows.reduce((n, r) => n + r.suggestedWeek, 0);
  const doneToday = rows.reduce((n, r) => n + r.doneToday, 0);
  const todaySubjects = rows.filter((r) => r.doneToday > 0).length;
  const last4 = weeks.slice(-5, -1);
  const avg4 = last4.length ? last4.reduce((n, w) => n + w.hours, 0) / last4.length : 0;
  const streak = useMemo(() => studyStreak(sessions, today), [sessions, today]);

  // Extras: disciplinas paradas, capítulos para rever, horas vs. nota.
  const stale = useMemo(() => staleSubjects(rows, today), [rows, today]);
  const review = useMemo(() => chaptersToReview({ chapters, sessions, assessments, today }), [chapters, sessions, assessments, today]);
  const hoursGradeSince = useMemo(
    () => period.start ?? new Date(mondayOf(today).getTime() - HISTORY_WEEKS * 7 * 86400000),
    [period.start, today]
  );
  const hoursGrade = useMemo(() => hoursVsGrade(sorted, assessments, sessions, hoursGradeSince), [sorted, assessments, sessions, hoursGradeSince]);
  const codeOf = useCallback((id: string) => {
    const s = subjects.find((x) => x.id === id);
    return s?.code || (s?.name || '?').slice(0, 3).toUpperCase();
  }, [subjects]);

  const tiles: StatTile[] = [
    {
      label: 'ESTA SEMANA',
      value: fmtHours(doneWeek).replace(' h', ''),
      unit: doneWeek > 0 && doneWeek < 1 ? undefined : 'h',
      note: `de ${fmtHours(suggestedWeek)} sugeridas`,
      pct: suggestedWeek > 0 ? (doneWeek / suggestedWeek) * 100 : null,
      accent: true,
    },
    {
      label: 'HOJE',
      value: fmtHours(doneToday).replace(' h', ''),
      unit: doneToday > 0 && doneToday < 1 ? undefined : 'h',
      note: todaySubjects ? `em ${todaySubjects} ${todaySubjects === 1 ? 'disciplina' : 'disciplinas'}` : 'ainda sem estudo hoje',
    },
    { label: 'MÉDIA · 4 SEMANAS', value: fmtHours(avg4).replace(' h', ''), unit: avg4 > 0 && avg4 < 1 ? undefined : 'h', note: 'por semana' },
    { label: 'DIAS SEGUIDOS', value: String(streak), unit: streak === 1 ? 'dia' : 'dias', note: streak ? 'a estudar' : 'estuda hoje para começar' },
  ];

  // Horas por capítulo (das sessões carregadas)
  const chapterRows = useMemo(() => {
    const byChapter = new Map<string, number>();
    let none = 0;
    for (const s of sessions) {
      const h = s.duration_seconds / 3600;
      if (s.chapter_id) byChapter.set(String(s.chapter_id), (byChapter.get(String(s.chapter_id)) || 0) + h);
      else none += h;
    }
    const chapterById = new Map(chapters.map((c) => [c.id, c]));
    const subjById = new Map(subjects.map((s) => [s.id, s]));
    const list = Array.from(byChapter.entries())
      .map(([id, hours]) => {
        const ch = chapterById.get(id);
        const subj = ch ? subjById.get(ch.subject_id) : undefined;
        return {
          label: ch ? `${String(ch.number ?? '').padStart(2, '0')} · ${ch.title || 'Sem título'}` : 'Capítulo apagado',
          sub: subj ? subj.code || subj.name || '' : '',
          hours,
          href: ch ? `/faculdade/${ch.subject_id}/notebook?tab=${(ch.category || 'TEORICAS').toUpperCase()}&chapter=${ch.id}` : undefined,
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
    if (none > 0) list.push({ label: 'Sem capítulo', sub: 'sessões manuais ou fora de um capítulo', hours: none, href: undefined });
    return list;
  }, [sessions, chapters, subjects]);

  // ==========================================
  // CABEÇALHO, NAVEGAÇÃO, CONTA
  // ==========================================
  const searchIndex = useMemo<SearchHit[]>(
    () => subjects.map((s) => ({ id: `s-${s.id}`, label: s.name || s.code || 'Disciplina', sublabel: 'Caderno da disciplina', href: `/faculdade/${s.id}/notebook` })),
    [subjects]
  );

  const goTo = useCallback(
    (id: string) => {
      setActive(id);
      const el = document.getElementById(id);
      if (el && (layout === 'phone' || layout === 'tabletV')) {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
      } else scrollToId(id);
    },
    [layout]
  );

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  const profile = {
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    onOpenProfile: () => setIsProfileOpen(true),
    onLogout: handleLogout,
  };
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

  const subtitle = period.usingDefaults
    ? 'defina as datas do semestre'
    : period.inSemester
      ? `semana ${period.weekNumber} de ${period.totalWeeks}`
      : 'fora do semestre';
  const meta = `${fmtHours(doneWeek)} de ${fmtHours(suggestedWeek)} esta semana`;
  const dateLabel = `${WEEKDAY_LONG[today.getDay()]}${today.getDay() === 0 || today.getDay() === 6 ? '' : '-feira'}, ${today.getDate()} de ${MONTHS_LONG[today.getMonth()]}`;

  const items: ShortcutItem[] = [
    { id: 'resumo', key: '1', label: 'Resumo' },
    { id: 'disciplinas', key: '2', label: 'Disciplinas', badge: String(subjects.length) },
    { id: 'plano', key: '3', label: 'Plano', badge: String(plan.days.reduce((n, dd) => n + dd.blocks.filter((b) => b.status !== 'done').length, 0)) },
    { id: 'rever', key: '4', label: 'Rever', badge: review.length ? String(review.length) : undefined },
    { id: 'historico', key: '5', label: 'Histórico' },
    { id: 'sessoes', key: '6', label: 'Sessões' },
    { id: 'resumo-semanal', key: '7', label: 'Semana' },
  ];

  // As definições do estudo estão no perfil; "Definições" abre-o nessa secção.
  const [profileStudy, setProfileStudy] = useState(false);
  const openSettings = useCallback(() => {
    setProfileStudy(true);
    setIsProfileOpen(true);
  }, []);
  const closeProfile = useCallback(() => {
    setIsProfileOpen(false);
    setProfileStudy(false);
  }, []);

  const [helpOpen, setHelpOpen] = useState(false);
  const onShortcut = useCallback(
    (key: string) => {
      const target = ({ '1': 'resumo', '2': 'disciplinas', '3': 'plano', '4': 'rever', '5': 'historico', '6': 'sessoes', '7': 'resumo-semanal' } as Record<string, string>)[key];
      if (key === 'escape') setHelpOpen(false);
      else if (key === '?') setHelpOpen((v) => !v);
      else if (key === 'd') openSettings();
      else if (key === 'n') setAddOpen(true);
      else if (target) goTo(target);
      else return false;
      return true;
    },
    [goTo, openSettings]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

  const heading = (
    <EstudoHeading
      layout={layout}
      subtitle={subtitle}
      meta={meta}
      trailing={phone ? <AvatarMenu {...profile} /> : undefined}
      onSettings={openSettings}
    />
  );
  const profileModal = <ProfileModal isOpen={isProfileOpen} onClose={closeProfile} user={profileUser} focusStudy={profileStudy} />;
  const statsEl = <EstudoStats tiles={tiles} columns={phone ? 2 : 4} />;
  const subjectsEl = <EstudoSubjects rows={planRows} toneOf={toneOf} cards={phone} today={today} />;
  const historyEl = <EstudoHistory weeks={weekBars} chapters={chapterRows} />;
  const planEl = (
    <EstudoPlan
      days={plan.days}
      unplaced={plan.fixed ? [] : weekPlan.unplaced}
      toneOf={toneOf}
      today={today}
      now={now}
      compact={phone}
      fixed={plan.fixed}
      busy={planBusy}
      error={planError}
      onAction={onBlockAction}
      onRedo={onRedo}
    />
  );
  const sessionsEl = (
    <EstudoSessions
      sessions={sessions}
      chapters={chapters}
      toneOf={toneOf}
      codeOf={codeOf}
      busy={sessBusy}
      error={sessError}
      onDelete={onDeleteSession}
      onUpdate={onUpdateSession}
      onAdd={() => setAddOpen(true)}
    />
  );
  // À segunda-feira mostra primeiro como correu a semana que acabou.
  const summaryEl = <EstudoWeekSummary thisWeek={rows} lastWeek={lastWeekRows} toneOf={toneOf} defaultLast={today.getDay() === 1} />;
  const addDialog = addOpen && sorted.length > 0 && (
    <ManualSessionDialog
      subjectId={sorted[0].id}
      subjectLabel={sorted[0].code || sorted[0].name || 'Disciplina'}
      subjects={sorted.map((s) => ({ id: s.id, label: [s.code, s.name].filter(Boolean).join(' · ') || 'Disciplina' }))}
      chapters={chapters
        .filter((c) => ['TEORICAS', 'PRATICAS', 'TESTES'].includes((c.category || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))
        .map((c) => ({ id: c.id, subjectId: c.subject_id, number: String(c.number ?? '').padStart(2, '0'), title: c.title || '' }))}
      currentChapterId={null}
      onSave={onAddSession}
      onClose={() => setAddOpen(false)}
    />
  );
  const alertsEl = <EstudoAlerts items={stale} />;
  const reviewEl = <EstudoReview items={review} toneOf={toneOf} codeOf={codeOf} />;
  const hoursGradeEl = (
    <EstudoHoursGrade rows={hoursGrade} toneOf={toneOf} sinceLabel={period.start ? 'desde o início do semestre' : `últimas ${HISTORY_WEEKS} semanas`} />
  );
  const status = loading && subjects.length === 0 ? (
    <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 40, paddingBottom: 40 }}>A carregar o estudo…</p>
  ) : loadError ? (
    <p className={d.inner} role="alert" style={{ paddingTop: 24, color: '#e38b7a' }}>{loadError}</p>
  ) : null;

  // ==========================================
  // IPAD E IPHONE
  // ==========================================
  if (layout !== 'desktop') {
    return (
      <div className={`${d.root} ${d.touch} ${phone ? d.phone : layout === 'tabletV' ? d.tabletV : ''}`}>
        {!phone && <TabletHeader active="estudo" searchIndex={searchIndex} {...profile} />}
        {heading}
        <SectionChips items={items} active={active} onPick={goTo} />
        {status ?? (
          <div className={d.inner} style={{ display: 'flex', flexDirection: 'column', gap: phone ? 28 : 26, paddingTop: phone ? 14 : 18, paddingBottom: phone ? 110 : 40 }}>
            {statsEl}
            {alertsEl}
            {subjectsEl}
            {planEl}
            {summaryEl}
            {reviewEl}
            {sessionsEl}
            {historyEl}
            {hoursGradeEl}
            <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={openSettings} style={{ alignSelf: 'flex-start' }}>
              Definições do estudo (no perfil) →
            </button>
          </div>
        )}
        {phone && <PhoneTabBar active="estudo" searchIndex={searchIndex} />}
        {profileModal}
        {addDialog}
      </div>
    );
  }

  // ==========================================
  // COMPUTADOR
  // ==========================================
  return (
    <div className={d.root}>
      <DensoHeader active="estudo" dateLabel={dateLabel} searchIndex={searchIndex} searchRef={searchRef} {...profile} />
      {heading}
      <ShortcutBar
        items={items}
        active={active}
        onPick={goTo}
        help={[
          ['1–7', 'Ir para a secção'],
          ['N', 'Registar sessão (+ sessão)'],
          ['D', 'Definições do estudo (perfil)'],
          ['Ctrl K', 'Pesquisa global'],
          ['?', 'Mostrar/esconder esta ajuda'],
          ['Esc', 'Fechar'],
        ]}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        hint="O caderno conta o tempo sozinho · + sessão para estudo fora da app"
      />
      {status ?? (
        <div className={`${d.inner} ${d.split84}`} style={{ paddingTop: 20, paddingBottom: 40 }}>
          <div className={d.col8} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {statsEl}
            {alertsEl}
            {subjectsEl}
            {planEl}
            {sessionsEl}
          </div>
          <div className={d.col4} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {summaryEl}
            {reviewEl}
            {historyEl}
            {hoursGradeEl}
            <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={openSettings} style={{ alignSelf: 'flex-start' }}>
              Definições do estudo (no perfil) →
            </button>
          </div>
        </div>
      )}
      {profileModal}
      {addDialog}
    </div>
  );
}
