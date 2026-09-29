'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getAllMirror, putAllMirror, reconcileMirror } from '@/lib/offline/db';
import { isNetworkError } from '@/lib/offline/sync';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate, getItemEffectiveGrade } from '@/lib/utils';
import type { AssessmentItem } from '@/types';
import ProfileModal from '@/components/ui/ProfileModal';
import { useLocalState, useNow } from '@/app/components/painel/useLocalState';
import { parseDueDate } from '@/app/components/homeAgenda';
import { HorarioSection } from './components/HorarioSection';
import { AvaliacaoSection } from './components/avaliacao/AvaliacaoSection';
import { BibliotecaSection } from './components/BibliotecaSection';
import d from '@/app/components/denso/denso.module.css';
import {
  AgoraCards,
  AssessmentTable,
  DHeading,
  Library,
  NotebookStat,
  NotebooksPanel,
  SchedulePanel,
  TasksPanel,
  TeachersPanel,
} from './components/DisciplinaView';
import { DensoHeader, SearchHit, ShortcutBar, ShortcutItem } from '@/app/components/denso/DensoChrome';
import {
  AvatarMenu,
  PhoneTabBar,
  SectionChips,
  TabletHeader,
  layoutClasses,
  useDensoLayout,
} from '@/app/components/denso/DensoTouch';

const SHORTCUT_HELP: [string, string][] = [
  ['1–5, B', 'Ir para a secção'],
  ['N', 'Nova tarefa'],
  ['/', 'Pesquisar na biblioteca'],
  ['Ctrl K', 'Pesquisa global'],
  ['F', 'Biblioteca em ecrã inteiro'],
  ['?', 'Mostrar/esconder esta ajuda'],
  ['Esc', 'Fechar'],
];
import {
  ChapterRow,
  FileRow,
  LibCategory,
  LocalTask,
  MONTHS_LONG,
  SubjectFull,
  WEEKDAY_LONG,
  currentAverage,
  effectiveWeight,
  fmtGrade,
  nextSlot,
  parseSlots,
  startOfDay,
  teacherName,
  toLibDoc,
} from './components/disciplinaData';

function cleanSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]/g, '');
}

// Aceita o id, o código ou o nome da disciplina no URL (como antes).
function findSubject(rows: SubjectFull[], rawId: string): SubjectFull | undefined {
  const target = cleanSlug(rawId);
  return rows.find((s) => {
    const id = cleanSlug(String(s.id || ''));
    const code = cleanSlug(String(s.code || ''));
    const name = cleanSlug(String(s.name || ''));
    return (
      id === target ||
      code === target ||
      name === target ||
      (name.length > 3 && target.includes(name)) ||
      (target.length > 3 && name.includes(target))
    );
  });
}

// Leitura filtrada por disciplina, com recurso ao espelho local sem rede.
async function readSubjectRows<T extends { id: string | number; subject_id?: string | number }>(
  table: string,
  subjectId: string,
  query: () => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (error) throw error;
    const rows = data ?? [];
    await putAllMirror(table, rows);
    return rows;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return (await getAllMirror<T>(table)).filter((r) => String(r.subject_id ?? '') === subjectId);
  }
}

type ManagePanel = 'horario' | 'avaliacao' | 'biblioteca';

const MANAGE_TABS: [ManagePanel, string][] = [
  ['horario', 'Horário'],
  ['avaliacao', 'Avaliação e pesos'],
  ['biblioteca', 'Biblioteca'],
];

const SECTION_KEYS: Record<string, string> = {
  '1': 'agora',
  '2': 'tarefas',
  '3': 'cadernos',
  '4': 'horario',
  '5': 'avaliacao',
  b: 'biblioteca',
};

export default function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const rawId = decodeURIComponent(resolvedParams.id || '');
  const router = useRouter();
  const { user } = useCurrentUser();

  const [allSubjects, setAllSubjects] = useState<SubjectFull[]>([]);
  const [subject, setSubject] = useState<SubjectFull | null>(null);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [active, setActive] = useState('agora');
  const [helpOpen, setHelpOpen] = useState(false);
  const [libFull, setLibFull] = useState(false);
  const [manage, setManage] = useState<ManagePanel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const layout = useDensoLayout();

  const globalSearchRef = useRef<HTMLInputElement>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const manageRef = useRef<HTMLDivElement>(null);

  const subjectId = subject?.id ?? '';
  // Sem tabela no Supabase para tarefas por disciplina nem para "fixados".
  const [tasks, setTasks] = useLocalState<LocalTask[]>(`disciplina:${subjectId}:tasks`, []);
  const [pins, setPins] = useLocalState<string[]>(`disciplina:${subjectId}:pins`, []);

  const fetchAll = useCallback(async () => {
    if (!rawId) return;
    try {
      setLoading(true);
      let rows: SubjectFull[];
      try {
        const { data, error } = await supabase.from('subjects').select('*');
        if (error) throw error;
        rows = data ?? [];
        await reconcileMirror('subjects', rows);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        rows = await getAllMirror<SubjectFull>('subjects');
      }
      setAllSubjects(rows);

      const found = findSubject(rows, rawId);
      if (!found) {
        setNotFound(true);
        return;
      }
      const id = String(found.id);
      setSubject({ ...found, id });
      setNotFound(false);

      const [assess, chaps, fileRows] = await Promise.all([
        readSubjectRows<AssessmentItem>('assessments', id, () =>
          supabase.from('assessments').select('*').eq('subject_id', id).order('created_at', { ascending: true })
        ),
        readSubjectRows<ChapterRow>('chapters', id, () =>
          supabase.from('chapters').select('id, subject_id, category, title, is_completed, updated_at').eq('subject_id', id)
        ),
        readSubjectRows<FileRow>('subject_files', id, () =>
          supabase.from('subject_files').select('*').eq('subject_id', id).order('created_at', { ascending: false })
        ).catch((err) => {
          console.error('Erro ao carregar a biblioteca:', err);
          return [] as FileRow[];
        }),
      ]);
      setAssessments(assess);
      setChapters(chaps);
      setFiles(fileRows);
    } catch (err) {
      console.error('Erro ao carregar disciplina:', err);
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido inicial de dados
    fetchAll();
  }, [fetchAll]);

  const now = useNow(60_000);
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só muda quando muda o dia
  const today = useMemo(() => startOfDay(now), [todayKey]);

  // ==========================================
  // DADOS DERIVADOS
  // ==========================================
  const theory = typeof subject?.theoretical_weight === 'number' ? subject.theoretical_weight : 50;
  const practice = typeof subject?.practical_weight === 'number' ? subject.practical_weight : 50;

  const slots = useMemo(() => parseSlots(subject?.schedules), [subject]);
  const next = useMemo(() => nextSlot(slots, now), [slots, now]);

  const upcoming = useMemo(
    () =>
      assessments
        .filter((a) => getItemEffectiveGrade(a) === null)
        .map((a) => ({ a, due: parseDueDate(a.due_date) }))
        .filter((r): r is { a: AssessmentItem; due: Date } => r.due !== null && r.due >= today)
        .sort((x, y) => x.due.getTime() - y.due.getTime())
        .map((r) => r.a),
    [assessments, today]
  );

  const average = useMemo(() => currentAverage(assessments, theory, practice), [assessments, theory, practice]);
  const gradedCount = assessments.filter((a) => getItemEffectiveGrade(a) !== null).length;

  const notebookStats = useMemo<NotebookStat[]>(() => {
    const tabs: [NotebookStat['tab'], string][] = [
      ['TEORICAS', 'Teóricas'],
      ['PRATICAS', 'Práticas'],
      ['TESTES', 'Testes'],
    ];
    return tabs.map(([tab, label]) => {
      const inTab = chapters.filter((c) => (c.category || 'TEORICAS').toUpperCase() === tab);
      return { tab, label, total: inTab.length, done: inTab.filter((c) => c.is_completed).length };
    });
  }, [chapters]);
  const chaptersTotal = notebookStats.reduce((n, x) => n + x.total, 0);
  const chaptersDone = notebookStats.reduce((n, x) => n + x.done, 0);

  const teachers = useMemo(() => {
    if (!subject) return [];
    const byName = new Map<string, string[]>();
    const add = (name: string | null, role: string) => {
      if (!name) return;
      byName.set(name, [...(byName.get(name) || []), role]);
    };
    add(teacherName(subject.regente), 'Regente');
    add(teacherName(subject.teacher_teorica), 'Teórica');
    add(teacherName(subject.teacher_pratica), 'Prática');
    return Array.from(byName.entries()).map(([name, roles]) => ({ name, role: roles.join(' · ') }));
  }, [subject]);

  const docs = useMemo(() => files.map(toLibDoc), [files]);
  const pendingTasks = tasks.filter((t) => !t.done).length;

  const shortcutItems: ShortcutItem[] = [
    { id: 'agora', key: '1', label: 'Agora' },
    { id: 'tarefas', key: '2', label: 'Tarefas', badge: pendingTasks ? String(pendingTasks) : undefined },
    { id: 'cadernos', key: '3', label: 'Cadernos', badge: chaptersTotal ? `${Math.round((chaptersDone / chaptersTotal) * 100)}%` : undefined },
    { id: 'horario', key: '4', label: 'Horário' },
    { id: 'avaliacao', key: '5', label: 'Avaliação', badge: average !== null ? fmtGrade(average) : undefined },
    { id: 'biblioteca', key: 'B', label: 'Biblioteca', badge: String(docs.length) },
  ];
  // No iPad vertical e no iPhone a biblioteca vem logo a seguir aos cadernos.
  const chipItems =
    layout === 'phone' || layout === 'tabletV'
      ? ['agora', 'tarefas', 'cadernos', 'biblioteca', 'horario', 'avaliacao'].map((id) => shortcutItems.find((s) => s.id === id)!)
      : shortcutItems;

  const searchIndex = useMemo<SearchHit[]>(() => {
    const hits: SearchHit[] = [];
    allSubjects.forEach((x) =>
      hits.push({ id: `s-${x.id}`, label: x.name || x.code || 'Disciplina', sublabel: 'Disciplina', href: `/faculdade/${x.id}` })
    );
    assessments.forEach((a) =>
      hits.push({ id: `a-${a.id}`, label: a.title || 'Avaliação', sublabel: 'Avaliação desta disciplina', href: '#avaliacao' })
    );
    docs.forEach((doc) =>
      hits.push({ id: `f-${doc.id}`, label: doc.title, sublabel: `Biblioteca · ${doc.type}`, href: doc.url || '#biblioteca', external: Boolean(doc.url) })
    );
    return hits;
  }, [allSubjects, assessments, docs]);

  // ==========================================
  // AÇÕES
  // ==========================================
  const goTo = useCallback(
    (id: string) => {
      setActive(id);
      const el = document.getElementById(id);
      if (!el) return;
      // No iPad vertical e no iPhone os botões de secção ficam colados ao topo.
      if (layout === 'phone' || layout === 'tabletV') {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [layout]
  );

  const openManage = useCallback((panel: ManagePanel) => {
    setLibFull(false);
    setManage(panel);
    window.setTimeout(() => manageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, []);

  const closeManage = useCallback(() => {
    setManage(null);
    // Os editores gravam diretamente no Supabase: recarrega a vista densa.
    fetchAll();
  }, [fetchAll]);

  const focusNewTask = useCallback(() => {
    goTo('tarefas');
    window.setTimeout(() => taskInputRef.current?.focus(), 250);
  }, [goTo]);

  const handleUpload = useCallback(
    async (list: File[], category: LibCategory) => {
      if (!subjectId) return;
      setUploading(true);
      setUploadError(null);
      try {
        const inserted: FileRow[] = [];
        for (const file of list) {
          const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
          const path = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const { error: upErr } = await supabase.storage.from('academic_materials').upload(path, file);
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from('academic_materials').getPublicUrl(path);
          const { data: row, error: dbErr } = await supabase
            .from('subject_files')
            .insert([
              {
                subject_id: subjectId,
                title: file.name.replace(/\.[^.]+$/, ''),
                file_name: file.name,
                category,
                file_url: pub.publicUrl,
              },
            ])
            .select()
            .single();
          if (dbErr) throw dbErr;
          if (row) inserted.push(row as FileRow);
        }
        setFiles((prev) => [...inserted, ...prev]);
      } catch (err) {
        console.error('Erro ao enviar ficheiros:', err);
        setUploadError(`Não foi possível enviar: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      } finally {
        setUploading(false);
      }
    },
    [subjectId]
  );

  const togglePin = useCallback(
    (id: string) => setPins((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])),
    [setPins]
  );

  // Atalhos de teclado (ignorados enquanto se escreve, exceto Esc e Ctrl+K).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        setLibFull(false);
        setHelpOpen(false);
        if (typing) el?.blur();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (SECTION_KEYS[key]) {
        e.preventDefault();
        goTo(SECTION_KEYS[key]);
      } else if (key === 'n') {
        e.preventDefault();
        focusNewTask();
      } else if (key === '/') {
        e.preventDefault();
        librarySearchRef.current?.focus();
      } else if (key === 'f') {
        e.preventDefault();
        setLibFull((v) => !v);
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, focusNewTask]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

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

  const dateLabel = `${WEEKDAY_LONG[today.getDay()]}${today.getDay() === 0 || today.getDay() === 6 ? '' : '-feira'}, ${today.getDate()} de ${MONTHS_LONG[today.getMonth()]}`;

  const meta = subject
    ? [
        subject.degree_year ? `${subject.degree_year}.º ano` : null,
        subject.semester ? `${subject.semester}.º sem` : null,
        teacherName(subject.regente) || teacherName(subject.teacher_teorica),
        subject.ects ? `${subject.ects} ECTS` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  // Formato esperado pelo editor de horário existente.
  const editorSchedules = useMemo(
    () =>
      slots.map((sl) => ({
        id: sl.key,
        day: WEEKDAY_LONG[sl.dayNum].toUpperCase() + (sl.dayNum === 0 || sl.dayNum === 6 ? '' : '-FEIRA'),
        dayOfWeek: WEEKDAY_LONG[sl.dayNum].toUpperCase() + (sl.dayNum === 0 || sl.dayNum === 6 ? '' : '-FEIRA'),
        startTime: sl.start,
        endTime: sl.end || '00:00',
        room: sl.room || 'A definir',
        type: sl.typeLabel,
      })),
    [slots]
  );

  // ==========================================
  // PEÇAS (a ordem muda entre computador, iPad e iPhone)
  // ==========================================
  const touch = layout !== 'desktop';
  const oneColumn = layout === 'phone' || layout === 'tabletV';

  const agoraEl = (
    <AgoraCards
      next={next}
      deadline={upcoming[0] ?? null}
      deadlineAfter={upcoming[1] ?? null}
      deadlineWeight={upcoming[0] ? effectiveWeight(upcoming[0], theory, practice) : null}
      today={today}
      average={average}
      gradedCount={gradedCount}
      totalCount={assessments.length}
      theory={theory}
      practice={practice}
      weekSlots={slots}
      layout={layout}
    />
  );
  const tasksEl = (
    <TasksPanel
      tasks={tasks}
      inputRef={taskInputRef}
      onToggle={(id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))}
      onAdd={(text) => setTasks((prev) => [...prev, { id: `${Date.now()}`, text, done: false }])}
      onClearDone={() => setTasks((prev) => prev.filter((t) => !t.done))}
    />
  );
  const notebooksEl = <NotebooksPanel subjectId={subjectId} stats={notebookStats} />;
  const scheduleEl = <SchedulePanel slots={slots} onManage={() => openManage('horario')} />;
  const teachersEl = <TeachersPanel teachers={teachers} />;
  const assessmentEl = (
    <AssessmentTable
      items={assessments}
      theory={theory}
      practice={practice}
      today={today}
      onEditWeights={() => openManage('avaliacao')}
      onAddGrade={() => openManage('avaliacao')}
      layout={layout}
    />
  );
  const libraryEl = (
    <Library
      layout={layout}
      docs={docs}
      loading={loading}
      pins={pins}
      onTogglePin={togglePin}
      onUpload={handleUpload}
      uploading={uploading}
      uploadError={uploadError}
      fullscreen={libFull}
      onToggleFullscreen={() => setLibFull((v) => !v)}
      onManage={() => openManage('biblioteca')}
      searchRef={librarySearchRef}
    />
  );

  // GERIR: os editores completos já existentes (horário, avaliação, biblioteca)
  const manageEl = (
    <div ref={manageRef} className={layout === 'tabletH' ? undefined : d.inner} style={{ paddingBottom: 48, scrollMarginTop: 16 }}>
      <div className={d.sectionHead} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2 className={d.h2}>GERIR</h2>
          {MANAGE_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => (manage === id ? closeManage() : openManage(id))}
              aria-pressed={manage === id}
              className={`${manage === id ? d.btnFill : d.btnLine} ${d.sm}`}
            >
              {label}
            </button>
          ))}
        </div>
        {manage && (
          <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={closeManage}>
            Fechar e atualizar
          </button>
        )}
      </div>
      {manage && (
        <div className={d.manage} style={{ padding: 'clamp(12px, 2vw, 24px)' }}>
          {manage === 'horario' && <HorarioSection subjectId={subjectId} schedules={editorSchedules} onRefresh={fetchAll} />}
          {manage === 'avaliacao' && <AvaliacaoSection subjectId={subjectId} onRefresh={fetchAll} />}
          {manage === 'biblioteca' && <BibliotecaSection subjectId={subjectId} />}
        </div>
      )}
    </div>
  );

  const avatarEl = (
    <AvatarMenu
      userName={user?.name ?? null}
      userEmail={user?.email ?? null}
      onOpenProfile={() => setIsProfileOpen(true)}
      onLogout={handleLogout}
    />
  );

  if (touch) {
    return (
      <div className={`${d.root} ${layoutClasses(layout)}`}>
        {layout !== 'phone' && (
          <TabletHeader
            active="faculdade"
            searchIndex={searchIndex}
            userName={user?.name ?? null}
            userEmail={user?.email ?? null}
            onOpenProfile={() => setIsProfileOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {loading && !subject ? (
          <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 48, paddingBottom: 48 }}>A carregar disciplina…</p>
        ) : notFound || !subject ? (
          <div className={d.inner} style={{ paddingTop: 48, paddingBottom: 48 }}>
            <p style={{ fontSize: 18, margin: 0 }}>Disciplina não encontrada.</p>
            <Link href="/faculdade" style={{ display: 'inline-block', marginTop: 12, color: 'var(--sky)' }}>← Voltar à Faculdade</Link>
          </div>
        ) : (
          <>
            <DHeading
              layout={layout}
              avatar={avatarEl}
              code={subject.code || '—'}
              name={subject.name || 'Disciplina'}
              meta={meta}
              onAddNote={() => router.push(`/faculdade/${subjectId}/notebook?tab=TEORICAS`)}
              onAddTask={focusNewTask}
              onAddResource={() => openManage('biblioteca')}
            />
            <SectionChips items={chipItems} active={active} onPick={goTo} />

            {oneColumn ? (
              <div className={`${d.inner} ${d.body}`}>
                {agoraEl}
                {layout === 'phone' ? (
                  <>
                    {tasksEl}
                    {notebooksEl}
                  </>
                ) : (
                  <div className={d.pair}>
                    {tasksEl}
                    {notebooksEl}
                  </div>
                )}
                {libraryEl}
                {layout === 'phone' ? (
                  <>
                    {scheduleEl}
                    {teachersEl}
                  </>
                ) : (
                  <div className={d.pair}>
                    {scheduleEl}
                    {teachersEl}
                  </div>
                )}
                {assessmentEl}
              </div>
            ) : (
              <div className={`${d.inner} ${d.body}`}>
                <div className={d.left}>
                  {agoraEl}
                  <div className={d.pair}>
                    {tasksEl}
                    {notebooksEl}
                  </div>
                  <div className={d.pair}>
                    {scheduleEl}
                    {teachersEl}
                  </div>
                  {assessmentEl}
                  {manageEl}
                </div>
                <div className={d.libWrap}>{libraryEl}</div>
              </div>
            )}

            {oneColumn && manageEl}
          </>
        )}

        {layout === 'phone' && <PhoneTabBar active="faculdade" searchIndex={searchIndex} />}
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
        searchRef={globalSearchRef}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      />

      {loading && !subject ? (
        <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 64, paddingBottom: 64 }}>A carregar disciplina…</p>
      ) : notFound || !subject ? (
        <div className={d.inner} style={{ paddingTop: 64, paddingBottom: 64 }}>
          <p style={{ fontSize: 18, margin: 0 }}>Disciplina não encontrada.</p>
          <Link href="/faculdade" style={{ display: 'inline-block', marginTop: 12, color: 'var(--sky)' }}>← Voltar à Faculdade</Link>
        </div>
      ) : (
        <>
          <DHeading
            code={subject.code || '—'}
            name={subject.name || 'Disciplina'}
            meta={meta}
            onAddNote={() => router.push(`/faculdade/${subjectId}/notebook?tab=TEORICAS`)}
            onAddTask={focusNewTask}
            onAddResource={() => openManage('biblioteca')}
          />

          <ShortcutBar
            items={shortcutItems}
            active={active}
            onPick={setActive}
            help={SHORTCUT_HELP}
            helpOpen={helpOpen}
            onToggleHelp={() => setHelpOpen((v) => !v)}
          />

          <div className={`${d.inner} ${d.body}`}>
            <div className={d.left}>
              {agoraEl}
              <div className={d.pair}>
                {tasksEl}
                {notebooksEl}
              </div>
              <div className={d.pair}>
                {scheduleEl}
                {teachersEl}
              </div>
              {assessmentEl}
            </div>
            <div className={d.libWrap}>{libraryEl}</div>
          </div>

          {manageEl}
        </>
      )}

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
