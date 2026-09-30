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
import { flushSessions, loadSessionsSince, loadStudySettings, saveStudySettings, type StudySessionRow } from '@/lib/study';
import {
  DEFAULT_SETTINGS,
  computePlan,
  fmtHours,
  mondayOf,
  startOfDay,
  studyStreak,
  weekTotals,
  type PlanSubject,
  type StudySettings,
} from '@/lib/studyPlan';
import { EstudoHeading, EstudoHistory, EstudoSettings, EstudoStats, EstudoSubjects, type StatTile, type WeekBar } from './EstudoView';

interface ChapterLite {
  id: string;
  subject_id: string;
  number: string | number | null;
  title: string | null;
  category: string | null;
}

const HISTORY_WEEKS = 8;

export default function EstudoPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const layout = useDensoLayout();
  const phone = layout === 'phone';

  const [subjects, setSubjects] = useState<PlanSubject[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [chapters, setChapters] = useState<ChapterLite[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);
  const [missingTable, setMissingTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState('resumo');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
      // 8 semanas de histórico + 14 dias antes, para a janela de preparação.
      const since = new Date(mondayOf(new Date()).getTime() - (HISTORY_WEEKS * 7 + 14) * 86400000);
      const [subj, assess, chaps, sess, sett] = await Promise.all([
        supabase.from('subjects').select('*'),
        supabase.from('assessments').select('*'),
        supabase.from('chapters').select('id, subject_id, number, title, category'),
        loadSessionsSince(since),
        loadStudySettings(),
      ]);
      if (subj.error) throw subj.error;
      setSubjects(((subj.data ?? []) as PlanSubject[]).map((s) => ({ ...s, id: String(s.id) })));
      setAssessments((assess.data ?? []) as AssessmentItem[]);
      setChapters(((chaps.data ?? []) as ChapterLite[]).map((c) => ({ ...c, id: String(c.id), subject_id: String(c.subject_id) })));
      setSessions(sess);
      setSettings(sett.settings);
      setMissingTable(sett.missingTable);
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

  const saveSettings = useCallback(async (s: StudySettings) => {
    setSettings(s);
    await saveStudySettings(s);
    setMissingTable(false);
  }, []);

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
    { id: 'historico', key: '3', label: 'Histórico' },
    { id: 'definicoes', key: '4', label: 'Definições' },
  ];

  const [helpOpen, setHelpOpen] = useState(false);
  const onShortcut = useCallback(
    (key: string) => {
      const target = ({ '1': 'resumo', '2': 'disciplinas', '3': 'historico', '4': 'definicoes' } as Record<string, string>)[key];
      if (key === 'escape') setHelpOpen(false);
      else if (key === '?') setHelpOpen((v) => !v);
      else if (target) goTo(target);
      else return false;
      return true;
    },
    [goTo]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

  const heading = (
    <EstudoHeading
      layout={layout}
      subtitle={subtitle}
      meta={meta}
      trailing={phone ? <AvatarMenu {...profile} /> : undefined}
      onSettings={() => goTo('definicoes')}
    />
  );
  const statsEl = <EstudoStats tiles={tiles} columns={phone ? 2 : 4} />;
  const subjectsEl = <EstudoSubjects rows={planRows} toneOf={toneOf} cards={phone} />;
  const historyEl = <EstudoHistory weeks={weekBars} chapters={chapterRows} />;
  const settingsEl = <EstudoSettings settings={settings} period={period} missingTable={missingTable} onSave={saveSettings} />;
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
            {subjectsEl}
            {layout === 'tabletH' ? (
              <div className={d.two}>
                {historyEl}
                {settingsEl}
              </div>
            ) : (
              <>
                {historyEl}
                {settingsEl}
              </>
            )}
          </div>
        )}
        {phone && <PhoneTabBar active="estudo" searchIndex={searchIndex} />}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
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
          ['1–4', 'Ir para a secção'],
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
            {subjectsEl}
          </div>
          <div className={d.col4} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {historyEl}
            <div className={d.aside} style={{ padding: 16 }}>{settingsEl}</div>
          </div>
        </div>
      )}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
