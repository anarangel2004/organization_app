'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate } from '@/lib/utils';
import {
  createWorkProject,
  createWorkTask,
  deleteWorkProject,
  deleteWorkTask,
  getWorkProjects,
  getWorkTasks,
  toggleWorkTask,
  updateWorkProject,
  updateWorkTask,
  type WorkProject,
  type WorkTask,
} from '@/lib/workData';
import ProfileModal from '@/components/ui/ProfileModal';
import d from '@/app/components/denso/denso.module.css';
import { DensoHeader, ShortcutBar, useShortcuts, type SearchHit, type ShortcutItem } from '@/app/components/denso/DensoChrome';
import { AvatarMenu, PhoneTabBar, SectionChips, TabletHeader, useDensoLayout } from '@/app/components/denso/DensoTouch';
import { errorMessage } from '@/app/components/denso/DensoForm';
import { useLocalState, useNow } from '@/app/components/painel/useLocalState';
import { MOCK_BILLABLE_HOURS, MOCK_PROJECT_HOURS } from '@/app/components/painel/mockData';
import {
  MONTHS_SHORT,
  PROJECT_COLORS,
  ProjectDrawer,
  ProjectsTable,
  TaskDrawer,
  TasksPanel,
  WorkHeading,
  WorkStats,
  daysFrom,
  dueOf,
  fmtHours,
  groupOf,
  startOfDay,
  toDateInput,
  toDueValue,
  type ProjectRowView,
  type Stat,
  type TaskDraft,
} from './components/TrabalhoView';

const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const HELP: [string, string][] = [
  ['1–3', 'Ir para a secção'],
  ['N', 'Nova tarefa (escrever)'],
  ['T', 'Nova tarefa (painel)'],
  ['P', 'Novo projeto'],
  ['Ctrl K', 'Pesquisa global'],
  ['?', 'Mostrar/esconder esta ajuda'],
  ['Esc', 'Tirar o filtro de projeto'],
];

// undefined = todos; null = só "sem projeto"; string = um projeto.
type ProjectFilter = string | null | undefined;
type Editing = { kind: 'task'; task: WorkTask | null } | { kind: 'project'; project: WorkProject | null } | null;

export default function TrabalhoPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const layout = useDensoLayout();

  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const [filter, setFilter] = useState<ProjectFilter>(undefined);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [active, setActive] = useState('projetos');
  const [helpOpen, setHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Notas das tarefas: não há coluna no Supabase, ficam neste dispositivo.
  const [notes, setNotes] = useLocalState<Record<string, string>>('trabalho:notes', {});

  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  const now = useNow(60_000);
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só muda quando muda o dia
  const today = useMemo(() => startOfDay(now), [todayKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, t] = await Promise.all([getWorkProjects(), getWorkTasks()]);
      setProjects(p);
      setTasks(t);
    } catch (err) {
      console.error('Erro ao carregar o trabalho:', err);
      setLoadError('Não foi possível carregar os projetos e tarefas. Tenta atualizar a página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido inicial de dados
    load();
  }, [load]);

  // ==========================================
  // DADOS DERIVADOS
  // ==========================================
  const byDue = useCallback((a: WorkTask, b: WorkTask) => {
    const da = dueOf(a)?.getTime() ?? Infinity;
    const db = dueOf(b)?.getTime() ?? Infinity;
    return da - db || a.title.localeCompare(b.title, 'pt');
  }, []);

  const pending = useMemo(() => tasks.filter((t) => !t.completed).sort(byDue), [tasks, byDue]);
  const late = pending.filter((t) => groupOf(t, today) === 'late');
  const dueToday = pending.filter((t) => groupOf(t, today) === 'today');
  const thisWeek = pending.filter((t) => ['today', 'tomorrow', 'week'].includes(groupOf(t, today)));

  const inFilter = useCallback(
    (t: WorkTask) => filter === undefined || (filter === null ? !t.project_id || !projects.some((p) => p.id === t.project_id) : t.project_id === filter),
    [filter, projects]
  );
  const shownPending = pending.filter(inFilter);
  const shownDone = useMemo(
    () => tasks.filter((t) => t.completed && inFilter(t)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [tasks, inFilter]
  );

  const projectRows = useMemo<ProjectRowView[]>(() => {
    const rows: ProjectRowView[] = projects.map((p, i) => {
      const list = tasks.filter((t) => t.project_id === p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color || PROJECT_COLORS[0],
        total: list.length,
        done: list.filter((t) => t.completed).length,
        next: list.filter((t) => !t.completed).sort(byDue)[0] ?? null,
        hours: MOCK_PROJECT_HOURS[i] ?? null,
      };
    });
    // Tarefas sem projeto (ou de um projeto que já não existe).
    const loose = tasks.filter((t) => !t.project_id || !projects.some((p) => p.id === t.project_id));
    if (loose.length) {
      rows.push({
        id: null,
        name: 'Sem projeto',
        color: 'transparent',
        total: loose.length,
        done: loose.filter((t) => t.completed).length,
        next: loose.filter((t) => !t.completed).sort(byDue)[0] ?? null,
        hours: null,
      });
    }
    return rows;
  }, [projects, tasks, byDue]);

  const filterProject = filter === undefined ? undefined : filter === null ? null : projects.find((p) => p.id === filter) ?? null;

  const nextDue = pending.find((t) => dueOf(t) && daysFrom(today, dueOf(t)!) >= 0);
  const stats: Stat[] = [
    {
      label: 'POR FAZER',
      value: String(pending.length),
      note: `${tasks.length - pending.length} concluídas no total`,
    },
    {
      label: 'ATRASADAS',
      value: String(late.length),
      note: late.length ? `a mais antiga: ${late[0].title}` : 'Nada em atraso',
      tone: late.length ? 'amber' : undefined,
      onTap: late.length ? () => goTo('tarefas') : undefined,
    },
    {
      label: 'ESTA SEMANA',
      value: String(thisWeek.length),
      note: nextDue ? `próxima: ${nextDue.title}` : 'Sem prazos marcados',
      tone: dueToday.length ? 'sky' : undefined,
    },
    {
      label: 'HORAS FATURÁVEIS*',
      value: fmtHours(MOCK_BILLABLE_HOURS.done),
      note: `de ${MOCK_BILLABLE_HOURS.target} h este mês · exemplo`,
      pct: (MOCK_BILLABLE_HOURS.done / MOCK_BILLABLE_HOURS.target) * 100,
      mock: true,
    },
  ];

  const searchIndex = useMemo<SearchHit[]>(
    () => [
      ...projects.map((p) => ({ id: `p-${p.id}`, label: p.name, sublabel: 'Projeto', href: '#projetos' })),
      ...tasks.map((t) => ({ id: `t-${t.id}`, label: t.title, sublabel: t.completed ? 'Tarefa concluída' : 'Tarefa', href: '#tarefas' })),
    ],
    [projects, tasks]
  );

  // ==========================================
  // AÇÕES
  // ==========================================
  const phone = layout === 'phone';
  const goTo = useCallback(
    (id: string) => {
      setActive(id);
      const el = document.getElementById(id);
      if (!el) return;
      const offset = phone ? 62 : 16;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    },
    [phone]
  );

  const pickProject = (id: string | null) => {
    setFilter((f) => (f === id ? undefined : id));
    // No iPhone as tarefas vêm por baixo: leva-as à vista.
    if (phone) window.setTimeout(() => goTo('tarefas'), 50);
  };

  const withPending = async (id: string, fn: () => Promise<void>) => {
    setPendingIds((s) => new Set(s).add(id));
    try {
      await fn();
    } finally {
      setPendingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const handleToggle = (t: WorkTask) =>
    withPending(t.id, async () => {
      setActionError(null);
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !t.completed } : x)));
      try {
        await toggleWorkTask(t.id, !t.completed);
      } catch (err) {
        setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: t.completed } : x)));
        setActionError(`Não foi possível atualizar a tarefa: ${errorMessage(err)}`);
      }
    });

  const quickAdd = async (title: string, date: string) => {
    setActionError(null);
    try {
      const created = await createWorkTask({ title, project_id: typeof filter === 'string' ? filter : null, due_date: toDueValue(date) });
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      setActionError(`Não foi possível criar a tarefa: ${errorMessage(err)}`);
    }
  };

  const openNewTask = useCallback(() => {
    setDrawerError(null);
    setEditing({ kind: 'task', task: null });
  }, []);
  const openNewProject = useCallback(() => {
    setDrawerError(null);
    setEditing({ kind: 'project', project: null });
  }, []);
  const closeDrawer = useCallback(() => setEditing(null), []);

  const saveTask = async (task: WorkTask | null, draft: TaskDraft) => {
    setSaving(true);
    setDrawerError(null);
    const patch = { title: draft.title.trim(), project_id: draft.projectId || null, due_date: toDueValue(draft.date) };
    try {
      let id: string;
      if (task) {
        await updateWorkTask(task.id, patch);
        setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, ...patch } : x)));
        id = task.id;
      } else {
        const created = await createWorkTask(patch);
        setTasks((prev) => [created, ...prev]);
        id = created.id;
      }
      setNotes((prev) => {
        const next = { ...prev };
        if (draft.note.trim()) next[id] = draft.note.trim();
        else delete next[id];
        return next;
      });
      setEditing(null);
    } catch (err) {
      setDrawerError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (task: WorkTask) => {
    setSaving(true);
    try {
      await deleteWorkTask(task.id);
      setTasks((prev) => prev.filter((x) => x.id !== task.id));
      setNotes((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      setEditing(null);
    } catch (err) {
      setDrawerError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async (project: WorkProject | null, name: string, color: string) => {
    setSaving(true);
    setDrawerError(null);
    try {
      if (project) {
        await updateWorkProject(project.id, { name, color });
        setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name, color } : p)));
      } else {
        const created = await createWorkProject({ name, color });
        setProjects((prev) => [created, ...prev]);
      }
      setEditing(null);
    } catch (err) {
      setDrawerError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async (project: WorkProject) => {
    setSaving(true);
    try {
      await deleteWorkProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setTasks((prev) => prev.filter((t) => t.project_id !== project.id));
      if (filter === project.id) setFilter(undefined);
      setEditing(null);
    } catch (err) {
      setDrawerError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Atalhos de teclado (computador).
  const onShortcut = useCallback(
    (key: string) => {
      if (key === 'escape') {
        setHelpOpen(false);
        setFilter(undefined);
        return true;
      }
      if (editing) return false;
      if (key === '1') goTo('resumo');
      else if (key === '2') goTo('projetos');
      else if (key === '3') goTo('tarefas');
      else if (key === 'n') {
        goTo('tarefas');
        window.setTimeout(() => quickRef.current?.focus(), 250);
      } else if (key === 't') openNewTask();
      else if (key === 'p') openNewProject();
      else if (key === '?') setHelpOpen((v) => !v);
      else return false;
      return true;
    },
    [editing, goTo, openNewTask, openNewProject]
  );
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useShortcuts(onShortcut, focusSearch);

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
  const profile = {
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    onOpenProfile: () => setIsProfileOpen(true),
    onLogout: handleLogout,
  };

  // ==========================================
  // PEÇAS
  // ==========================================
  const subtitle = loading ? 'a carregar…' : `${pending.length} por fazer${late.length ? ` · ${late.length} em atraso` : ''}`;
  const meta = `${projects.length} ${projects.length === 1 ? 'projeto' : 'projetos'} · ${today.getDate()} ${MONTHS_SHORT[today.getMonth()]}`;
  const dateLabel = `${WEEKDAY_LONG[today.getDay()]}${today.getDay() === 0 || today.getDay() === 6 ? '' : '-feira'}, ${today.getDate()} de ${MONTHS_LONG[today.getMonth()]}`;

  const heading = (
    <WorkHeading
      layout={layout}
      subtitle={subtitle}
      meta={meta}
      onAddTask={openNewTask}
      onAddProject={openNewProject}
      trailing={phone ? <AvatarMenu {...profile} /> : undefined}
    />
  );
  const errors = (loadError || actionError) && (
    <p className={d.inner} role="alert" style={{ margin: '0 auto', paddingTop: 10, fontSize: 13, color: '#e38b7a' }}>
      {loadError || actionError}
    </p>
  );
  const statsEl = <WorkStats stats={stats} columns={phone ? 2 : 4} />;
  const projectsEl = (
    <ProjectsTable
      rows={projectRows}
      today={today}
      selected={filter}
      onSelect={pickProject}
      onEdit={(id) => {
        setDrawerError(null);
        setEditing({ kind: 'project', project: projects.find((p) => p.id === id) ?? null });
      }}
      cards={phone}
    />
  );
  const tasksEl = (
    <TasksPanel
      tasks={shownPending}
      done={shownDone}
      projects={projects}
      today={today}
      filterProject={filterProject}
      onClearFilter={() => setFilter(undefined)}
      notes={notes}
      onToggle={handleToggle}
      onOpen={(t) => {
        setDrawerError(null);
        setEditing({ kind: 'task', task: t });
      }}
      onQuickAdd={quickAdd}
      inputRef={quickRef}
      pendingIds={pendingIds}
      showDone={showDone}
      onToggleShowDone={() => setShowDone((v) => !v)}
      boxed={layout === 'desktop' || layout === 'tabletH'}
    />
  );

  const editingTask = editing?.kind === 'task' ? editing.task : null;
  const drawer =
    editing?.kind === 'task' ? (
      <TaskDrawer
        key={editingTask?.id ?? 'new'}
        task={editingTask}
        initial={{
          title: editingTask?.title ?? '',
          projectId: editingTask?.project_id ?? (typeof filter === 'string' ? filter : ''),
          date: editingTask ? toDateInput(editingTask) : '',
          note: editingTask ? notes[editingTask.id] ?? '' : '',
        }}
        projects={projects}
        today={today}
        saving={saving}
        error={drawerError}
        onSave={(draft) => saveTask(editingTask, draft)}
        onDelete={editingTask ? () => removeTask(editingTask) : undefined}
        onClose={closeDrawer}
      />
    ) : editing?.kind === 'project' ? (
      <ProjectDrawer
        key={editing.project?.id ?? 'new'}
        project={editing.project}
        taskCount={editing.project ? tasks.filter((t) => t.project_id === editing.project!.id).length : 0}
        saving={saving}
        error={drawerError}
        onSave={(name, color) => saveProject(editing.project, name, color)}
        onDelete={editing.project ? () => removeProject(editing.project!) : undefined}
        onClose={closeDrawer}
      />
    ) : null;

  const loadingEl = <p className={`${d.inner} ${d.muted}`} style={{ paddingTop: 40, paddingBottom: 40 }}>A carregar projetos e tarefas…</p>;

  // ==========================================
  // IPAD E IPHONE
  // ==========================================
  if (layout !== 'desktop') {
    const phoneItems: ShortcutItem[] = [
      { id: 'resumo', key: '', label: 'Resumo' },
      { id: 'tarefas', key: '', label: 'Tarefas', badge: pending.length ? String(pending.length) : undefined },
      { id: 'projetos', key: '', label: 'Projetos', badge: projects.length ? String(projects.length) : undefined },
    ];
    return (
      <div className={`${d.root} ${d.touch} ${phone ? d.phone : layout === 'tabletV' ? d.tabletV : ''}`}>
        {!phone && <TabletHeader active="trabalho" searchIndex={searchIndex} {...profile} />}
        {heading}
        {phone && <SectionChips items={phoneItems} active={active} onPick={goTo} />}
        {errors}
        {loading && tasks.length === 0 ? (
          loadingEl
        ) : layout === 'tabletH' ? (
          <div className={d.inner} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 22, paddingTop: 12, paddingBottom: 32, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              {statsEl}
              {projectsEl}
            </div>
            {tasksEl}
          </div>
        ) : (
          <div className={d.inner} style={{ display: 'flex', flexDirection: 'column', gap: phone ? 28 : 26, paddingTop: phone ? 14 : 12, paddingBottom: phone ? 110 : 40 }}>
            {statsEl}
            {phone ? (
              <>
                {tasksEl}
                {projectsEl}
              </>
            ) : (
              <>
                {projectsEl}
                {tasksEl}
              </>
            )}
          </div>
        )}
        {phone && <PhoneTabBar active="trabalho" searchIndex={searchIndex} />}
        {drawer}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
      </div>
    );
  }

  // ==========================================
  // COMPUTADOR
  // ==========================================
  const shortcutItems: ShortcutItem[] = [
    { id: 'resumo', key: '1', label: 'Resumo' },
    { id: 'projetos', key: '2', label: 'Projetos', badge: String(projects.length) },
    { id: 'tarefas', key: '3', label: 'Tarefas', badge: String(pending.length) },
  ];

  return (
    <div className={d.root}>
      <DensoHeader active="trabalho" dateLabel={dateLabel} searchIndex={searchIndex} searchRef={searchRef} {...profile} />
      {heading}
      <ShortcutBar
        items={shortcutItems}
        active={active}
        onPick={goTo}
        help={HELP}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        hint="N escreve uma tarefa · clica num projeto para filtrar"
      />
      {errors}
      {loading && tasks.length === 0 ? (
        loadingEl
      ) : (
        <div className={`${d.inner} ${d.split84}`} style={{ paddingTop: 20, paddingBottom: 32 }}>
          <div className={d.col8} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {statsEl}
            {projectsEl}
          </div>
          <div className={d.col4}>{tasksEl}</div>
        </div>
      )}
      {drawer}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}
