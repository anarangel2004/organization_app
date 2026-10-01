'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate } from '@/lib/utils';
import type { AssessmentItem } from '@/types';
import ProfileModal from '@/components/ui/ProfileModal';
import d from '@/app/components/denso/denso.module.css';
import { DensoHeader, SearchHit, ShortcutBar, ShortcutItem, useShortcuts } from '@/app/components/denso/DensoChrome';
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
  mergeCloseSessions,
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
  hoursVsGrade,
  isoDay,
  mondayOf,
  planPeriod,
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
import { classSlots, withoutClassTime } from '@/lib/studyPath';
import {
  EstudoChapterHours,
  EstudoHeading,
  EstudoHistory,
  EstudoHoursGrade,
  EstudoReview,
  EstudoSessions,
  EstudoSubjects,
  EstudoWeekSummary,
  SETTINGS_EVENT,
  type WeekBar,
} from './EstudoView';
import { EstudoNow, EstudoPlanList, EstudoWeekGrid, type BlockAction } from './EstudoPlanViews';

// Separadores da página (a ordem é a das teclas 1–4).
const TABS = ['plano', 'disciplinas', 'sessoes', 'estatisticas'] as const;
type Tab = (typeof TABS)[number];
// Só estas categorias são capítulos do caderno (o "Programa" não).
const NOTEBOOK_CATEGORIES = ['TEORICAS', 'PRATICAS', 'TESTES'];

interface ChapterLite {
  id: string;
  subject_id: string;
  number: string | number | null;
  title: string | null;
  category: string | null;
  is_completed: boolean | null;
  created_at: string | null;
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
  const [tab, setTab] = useState<Tab>('plano');
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
        supabase.from('chapters').select('id, subject_id, number, title, category, is_completed, created_at'),
        loadSessionsSince(since),
        getWorkShifts().catch(() => [] as WorkShift[]),
      ]);
      setShifts(shiftRows);
      if (subj.error) throw subj.error;
      setSubjects(((subj.data ?? []) as PlanSubject[]).map((s) => ({ ...s, id: String(s.id) })));
      setAssessments((assess.data ?? []) as AssessmentItem[]);
      setChapters(((chaps.data ?? []) as ChapterLite[]).map((c) => ({ ...c, id: String(c.id), subject_id: String(c.subject_id) })));
      // Sessões seguidas (≤ 15 min) passam a ser uma só, também no servidor.
      setSessions(await mergeCloseSessions(sess));
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

  // O tempo das aulas da própria disciplina não conta como estudo (também nas sessões antigas).
  const classRange = useMemo(() => {
    const p = planPeriod(settings, today);
    return p.usingDefaults ? { start: null, end: null } : { start: p.start, end: p.classesEnd };
  }, [settings, today]);
  const studied = useMemo(
    () => withoutClassTime(sessions, new Map(subjects.map((x) => [x.id, classSlots(x.schedules)])), classRange),
    [sessions, subjects, classRange]
  );

  const { rows, period } = useMemo(
    () => computePlan({ subjects: sorted, assessments, sessions: studied, settings, today, chapters, now }),
    [sorted, assessments, studied, settings, today, chapters, now]
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

  // Marcar um capítulo como concluído daqui: o percurso passa ao passo seguinte.
  const onToggleChapter = useCallback(async (chapterId: string, done: boolean) => {
    setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, is_completed: done } : c)));
    const { error } = await supabase.from('chapters').update({ is_completed: done }).eq('id', chapterId);
    if (error) {
      console.error('Erro ao marcar o capítulo:', error);
      setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, is_completed: !done } : c)));
    }
  }, []);

  // Resumo da semana passada: o mesmo cálculo, visto do domingo passado.
  const lastWeekRows = useMemo(() => {
    const lastSunday = new Date(mondayOf(today).getTime() - 86400000);
    return computePlan({ subjects: sorted, assessments, sessions: studied, settings, today: startOfDay(lastSunday), chapters, now: lastSunday }).rows;
  }, [sorted, assessments, studied, settings, today, chapters]);

  const weeks = useMemo(() => weekTotals(studied, today, HISTORY_WEEKS), [studied, today]);
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
  const last4 = weeks.slice(-5, -1);
  const avg4 = last4.length ? last4.reduce((n, w) => n + w.hours, 0) / last4.length : 0;
  const streak = useMemo(() => studyStreak(studied, today), [studied, today]);

  // Extras: disciplinas paradas, capítulos para rever, horas vs. nota.
  const stale = useMemo(() => staleSubjects(rows, today), [rows, today]);
  const review = useMemo(() => chaptersToReview({ chapters, sessions: studied, assessments, today }), [chapters, studied, assessments, today]);
  const hoursGradeSince = useMemo(
    () => period.start ?? new Date(mondayOf(today).getTime() - HISTORY_WEEKS * 7 * 86400000),
    [period.start, today]
  );
  const hoursGrade = useMemo(() => hoursVsGrade(sorted, assessments, studied, hoursGradeSince), [sorted, assessments, studied, hoursGradeSince]);
  const codeOf = useCallback((id: string) => {
    const s = subjects.find((x) => x.id === id);
    return s?.code || (s?.name || '?').slice(0, 3).toUpperCase();
  }, [subjects]);

  // Horas por capítulo (das sessões carregadas)
  const chapterRows = useMemo(() => {
    const byChapter = new Map<string, number>();
    let none = 0;
    for (const s of studied) {
      const h = s.duration_seconds / 3600;
      if (s.chapter_id) byChapter.set(String(s.chapter_id), (byChapter.get(String(s.chapter_id)) || 0) + h);
      else none += h;
    }
    const chapterById = new Map(chapters.map((c) => [c.id, c]));
    const subjById = new Map(subjects.map((s) => [s.id, s]));
    const list: { label: string; sub: string; hours: number; href?: string; color?: string }[] = Array.from(byChapter.entries())
      .map(([id, hours]) => {
        const ch = chapterById.get(id);
        const subj = ch ? subjById.get(ch.subject_id) : undefined;
        return {
          label: ch ? `${String(ch.number ?? '').padStart(2, '0')} · ${ch.title || 'Sem título'}` : 'Capítulo apagado',
          sub: subj ? subj.code || subj.name || '' : '',
          hours,
          href: ch ? `/faculdade/${ch.subject_id}/notebook?tab=${(ch.category || 'TEORICAS').toUpperCase()}&chapter=${ch.id}` : undefined,
          color: ch ? toneOf(ch.subject_id) : undefined,
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
    if (none > 0) list.push({ label: 'Sem capítulo', sub: '', hours: none });
    return list;
  }, [studied, chapters, subjects, toneOf]);

  // ==========================================
  // CABEÇALHO, SEPARADORES, CONTA
  // ==========================================
  const searchIndex = useMemo<SearchHit[]>(
    () => subjects.map((s) => ({ id: `s-${s.id}`, label: s.name || s.code || 'Disciplina', sublabel: 'Caderno da disciplina', href: `/faculdade/${s.id}/notebook` })),
    [subjects]
  );

  // O separador fica no endereço (#sessoes…): recarregar não volta ao início.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Tab;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lido do endereço só depois de montar
    if (TABS.includes(fromHash)) setTab(fromHash);
  }, []);
  const pickTab = useCallback((id: string) => {
    if (!TABS.includes(id as Tab)) return;
    setTab(id as Tab);
    window.history.replaceState(null, '', `#${id}`);
    // Se a página estiver rolada para baixo, sobe até aos separadores.
    const bar = document.getElementById('estudo-tabs');
    if (bar && bar.getBoundingClientRect().top < 0) window.scrollTo({ top: bar.getBoundingClientRect().top + window.scrollY - 8, behavior: 'smooth' });
  }, []);

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
  const dateLabel = `${WEEKDAY_LONG[today.getDay()]}${today.getDay() === 0 || today.getDay() === 6 ? '' : '-feira'}, ${today.getDate()} de ${MONTHS_LONG[today.getMonth()]}`;

  const openBlocks = plan.days.reduce((n, dd) => n + dd.blocks.filter((b) => b.status !== 'done').length, 0);
  const items: ShortcutItem[] = [
    { id: 'plano', key: '1', label: 'Plano', badge: openBlocks ? String(openBlocks) : undefined },
    { id: 'disciplinas', key: '2', label: 'Disciplinas', badge: String(subjects.length) },
    { id: 'sessoes', key: '3', label: 'Sessões' },
    { id: 'estatisticas', key: '4', label: 'Estatísticas' },
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
      const target = TABS[Number(key) - 1];
      if (key === 'escape') setHelpOpen(false);
      else if (key === '?') setHelpOpen((v) => !v);
      else if (key === 'd') openSettings();
      else if (key === 'n') setAddOpen(true);
      else if (target) pickTab(target);
      else return false;
      return true;
    },
    [pickTab, openSettings]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

  // ==========================================
  // PEÇAS
  // ==========================================
  const wide = layout === 'desktop' || layout === 'tabletH';
  const heading = (
    <EstudoHeading
      layout={layout}
      subtitle={subtitle}
      trailing={phone ? <AvatarMenu {...profile} /> : undefined}
      onSettings={openSettings}
      onAdd={() => setAddOpen(true)}
    />
  );
  const profileModal = <ProfileModal isOpen={isProfileOpen} onClose={closeProfile} user={profileUser} focusStudy={profileStudy} />;
  const nowEl = (
    <EstudoNow
      days={plan.days}
      now={now}
      today={today}
      toneOf={toneOf}
      rows={rows}
      busy={planBusy}
      onAction={onBlockAction}
      todayDone={doneToday}
      weekDone={doneWeek}
      weekTarget={suggestedWeek}
      streak={streak}
      stale={stale}
      compact={!wide}
    />
  );
  const planProps = {
    days: plan.days,
    unplaced: plan.fixed ? [] : weekPlan.unplaced,
    toneOf,
    today,
    now,
    fixed: plan.fixed,
    busy: planBusy,
    error: planError,
    onAction: onBlockAction,
    onRedo,
  };
  const planEl = wide ? (
    <EstudoWeekGrid {...planProps} sessions={studied} monday={mondayOf(today)} codeOf={codeOf} />
  ) : (
    <EstudoPlanList {...planProps} />
  );
  const sessionsEl = (
    <EstudoSessions
      sessions={studied}
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
        .filter((c) => NOTEBOOK_CATEGORIES.includes((c.category || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))
        .map((c) => ({ id: c.id, subjectId: c.subject_id, number: String(c.number ?? '').padStart(2, '0'), title: c.title || '' }))}
      currentChapterId={null}
      onSave={onAddSession}
      onClose={() => setAddOpen(false)}
    />
  );
  const status = loading && subjects.length === 0 ? (
    <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 40, paddingBottom: 40 }}>A carregar o estudo…</p>
  ) : loadError ? (
    <p className={d.inner} role="alert" style={{ paddingTop: 24, color: '#e38b7a' }}>{loadError}</p>
  ) : null;

  // Conteúdo de cada separador: duas colunas em ecrãs largos, uma no resto.
  const panes: Record<Tab, [ReactNode, ReactNode?]> = {
    plano: [planEl, <EstudoReview key="r" items={review} toneOf={toneOf} codeOf={codeOf} />],
    disciplinas: [<EstudoSubjects key="s" rows={planRows} toneOf={toneOf} cards={phone} today={today} onToggleChapter={onToggleChapter} />],
    sessoes: [sessionsEl, <EstudoChapterHours key="c" chapters={chapterRows} />],
    estatisticas: [
      <div key="w" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {summaryEl}
        <EstudoHistory weeks={weekBars} avg={avg4} />
      </div>,
      <EstudoHoursGrade key="h" rows={hoursGrade} toneOf={toneOf} sinceLabel={period.start ? 'desde o início do semestre' : `últimas ${HISTORY_WEEKS} semanas`} />,
    ],
  };
  const [main, side] = panes[tab];
  const body = (
    <div role="tabpanel" aria-label={items.find((i) => i.id === tab)?.label}>
      {side && wide ? (
        <div className={d.split84}>
          <div className={d.col8}>{main}</div>
          <div className={d.col4}>{side}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {main}
          {side}
        </div>
      )}
    </div>
  );

  // ==========================================
  // IPAD E IPHONE
  // ==========================================
  if (layout !== 'desktop') {
    return (
      <div className={`${d.root} ${d.touch} ${phone ? d.phone : layout === 'tabletV' ? d.tabletV : ''}`}>
        {!phone && <TabletHeader active="estudo" searchIndex={searchIndex} {...profile} />}
        {heading}
        {status ?? (
          <>
            <div className={d.inner} style={{ paddingTop: 4, paddingBottom: 14 }}>{nowEl}</div>
            <div id="estudo-tabs">
              <SectionChips items={items} active={tab} onPick={pickTab} />
            </div>
            <div className={d.inner} style={{ paddingTop: phone ? 14 : 18, paddingBottom: phone ? 110 : 40 }}>{body}</div>
          </>
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
      {status ?? (
        <>
          <div className={d.inner} style={{ paddingTop: 4, paddingBottom: 18 }}>{nowEl}</div>
          <div id="estudo-tabs">
            <ShortcutBar
              items={items}
              active={tab}
              onPick={pickTab}
              help={[
                ['1–4', 'Mudar de separador'],
                ['N', 'Registar sessão (+ sessão)'],
                ['D', 'Definições do estudo (perfil)'],
                ['Ctrl K', 'Pesquisa global'],
                ['?', 'Mostrar/esconder esta ajuda'],
                ['Esc', 'Fechar'],
              ]}
              helpOpen={helpOpen}
              onToggleHelp={() => setHelpOpen((v) => !v)}
              hint="O caderno conta o tempo sozinho"
            />
          </div>
          <div className={d.inner} style={{ paddingTop: 20, paddingBottom: 40 }}>{body}</div>
        </>
      )}
      {profileModal}
      {addDialog}
    </div>
  );
}
