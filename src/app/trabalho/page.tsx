'use client';

import { useEffect, useState } from 'react';
import { 
  getProjects, 
  createProject, 
  deleteProject, 
  getTasks, 
  createTask, 
  toggleTaskStatus, 
  deleteTask,
  Project, 
  Task 
} from '@/lib/db';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Layers, 
  X, 
  CheckCircle2, 
  Clock, 
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

const SAP_PRESET_COLORS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#0d9488', // Teal
  '#3b82f6', // Blue
];

export default function TrabalhoPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Form State: Projetos
  const [projectName, setProjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(SAP_PRESET_COLORS[0]);
  
  // Form State: Tarefas
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [projectsData, tasksData] = await Promise.all([
        getProjects('work'),
        getTasks()
      ]);
      setProjects(projectsData);
      setTasks(tasksData.filter(t => t.context === 'work'));
    } catch (err) {
      console.error('Erro ao carregar dados do trabalho:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setSubmitting(true);
    try {
      await createProject({
        name: projectName.trim(),
        color: selectedColor,
        context: 'work',
      });

      setProjectName('');
      setIsProjectModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Erro ao criar iniciativa SAP:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setSubmitting(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        project_id: selectedProjectId || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        completed: false,
        context: 'work',
      });

      setTaskTitle('');
      setDueDate('');
      setSelectedProjectId('');
      setIsTaskModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Erro ao criar tarefa SAP:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Tens a certeza que queres eliminar o projeto SAP "${name}"?`)) return;
    try {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
      setTasks(tasks.filter(t => t.project_id !== id));
    } catch (err) {
      console.error('Erro ao eliminar projeto:', err);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      await toggleTaskStatus(taskId, !currentStatus);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t));
    } catch (err) {
      console.error('Erro ao atualizar estado da tarefa:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Erro ao eliminar tarefa:', err);
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" /> Módulo Profissional
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Projetos & Iniciativas SAP</h1>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg font-medium text-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" /> Nova Iniciativa SAP
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lista de Projetos SAP (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-400" /> Iniciativas Ativas ({projects.length})
          </h2>

          {loading ? (
            <div className="text-slate-500 text-xs py-8 text-center">A carregar projetos SAP...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">Nenhum projeto SAP registado</h3>
              <p className="text-slate-500 text-xs mt-1 mb-4">Adiciona módulos como FI/CO, SD, MM ou integrações ativas.</p>
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Registar primeira iniciativa
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map((p) => {
                const projectTasks = tasks.filter(t => t.project_id === p.id);
                const doneTasks = projectTasks.filter(t => t.completed);

                return (
                  <div
                    key={p.id}
                    className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color || '#10b981' }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                            SAP
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteProject(p.id, p.name)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                          title="Eliminar projeto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {p.name}
                      </h3>
                    </div>

                    <div className="mt-6 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                      <span>Progresso de entregas:</span>
                      <span className="font-semibold text-slate-200">
                        {projectTasks.length === 0 ? 'Sem tarefas' : `${doneTasks.length}/${projectTasks.length}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista de Entregáveis / Tarefas SAP */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-xl h-fit space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" /> Entregáveis & Tarefas
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {pendingTasks.length} pendentes
            </span>
          </div>

          {tasks.length === 0 ? (
            <p className="text-slate-500 text-xs py-4 text-center">Nenhuma tarefa SAP registada.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {tasks.map((task) => {
                const project = projects.find(p => p.id === task.project_id);

                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border transition-all flex items-start gap-3 group ${
                      task.completed
                        ? 'bg-slate-950/20 border-slate-800/40 opacity-50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTask(task.id, task.completed)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <CheckCircle2 className={`w-4 h-4 ${task.completed ? 'text-emerald-500' : 'text-slate-600 hover:text-emerald-400'}`} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium text-slate-200 ${task.completed ? 'line-through text-slate-500' : ''}`}>
                        {task.title}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {project && (
                          <span className="text-[9px] font-medium text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {project.name}
                          </span>
                        )}

                        {task.due_date && (
                          <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(task.due_date).toLocaleDateString('pt-PT')}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Modal: Nova Iniciativa SAP */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsProjectModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-400" /> Nova Iniciativa SAP
            </h2>
            <p className="text-xs text-slate-400 mb-5">Regista um novo projeto, módulo ou entrega de trabalho.</p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Projeto / Módulo</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: Implementação SAP FI/CO ou Migração S/4HANA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Cor Identificadora</label>
                <div className="flex gap-2">
                  {SAP_PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        selectedColor === color ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {submitting ? 'A guardar...' : 'Criar Iniciativa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Tarefa SAP */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Nova Tarefa SAP
            </h2>
            <p className="text-xs text-slate-400 mb-5">Adiciona uma pendência ou entrega de trabalho.</p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Título da Tarefa</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex: Configurar regras de validação no S/4HANA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Iniciativa Associada (Opcional)</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Geral / Sem projeto associado</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data Limite (Deadline)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {submitting ? 'A guardar...' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}