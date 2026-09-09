'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import MinimalCalendar from '@/components/MinimalCalendar';
import { 
  GraduationCap, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  Plus, 
  ArrowUpRight, 
  BookOpen,
  Layers,
  Calendar
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color: string;
  context: 'academic' | 'work';
  evaluation_data?: any;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  context: 'academic' | 'work';
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const { data: projectsData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    const { data: tasksData } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });

    if (projectsData) setProjects(projectsData);
    if (tasksData) setTasks(tasksData);
    setLoading(false);
  }

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('tasks').update({ completed: !currentStatus }).eq('id', taskId);
    if (!error) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t));
    }
  };

  const academicProjects = projects.filter(p => p.context === 'academic');
  const workProjects = projects.filter(p => p.context === 'work');
  const pendingTasks = tasks.filter(t => !t.completed);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Painel Geral</h1>
          <p className="text-slate-400 text-xs mt-0.5">Mestrado em Cibersegurança & Projetos SAP</p>
        </div>
        <Link
          href="/faculdade"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" /> Criar Cadeira / Projeto
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Cibersegurança</p>
            <p className="text-xl font-bold text-slate-100">{academicProjects.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Iniciativas SAP</p>
            <p className="text-xl font-bold text-slate-100">{workProjects.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Tarefas Pendentes</p>
            <p className="text-xl font-bold text-slate-100">{pendingTasks.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-slate-200">Mestrado em Cibersegurança</h2>
              </div>
              <Link href="/faculdade" className="text-xs text-sky-400 hover:underline flex items-center gap-1">
                Ver todas <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <p className="text-slate-500 text-xs py-2">A carregar...</p>
            ) : academicProjects.length === 0 ? (
              <div className="text-center py-6 bg-slate-950/40 border border-dashed border-slate-800 rounded-lg">
                <BookOpen className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                <p className="text-slate-400 text-xs">Nenhuma cadeira adicionada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {academicProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/faculdade/${p.id}`}
                    className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-all block group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || '#2563eb' }} />
                      <span className="text-[9px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-900">
                        Académico
                      </span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-200 mt-2 group-hover:text-sky-400 transition-colors truncate">
                      {p.name}
                    </h3>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-200">Projetos & Iniciativas SAP</h2>
              </div>
              <Link href="/trabalho" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                Gerir SAP <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <p className="text-slate-500 text-xs py-2">A carregar...</p>
            ) : workProjects.length === 0 ? (
              <div className="text-center py-6 bg-slate-950/40 border border-dashed border-slate-800 rounded-lg">
                <Layers className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                <p className="text-slate-400 text-xs">Sem projetos SAP ativos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workProjects.map((p) => (
                  <Link
                    key={p.id}
                    href="/trabalho"
                    className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-all block group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] uppercase font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/30">
                        SAP Work
                      </span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-200 mt-2 group-hover:text-emerald-400 transition-colors truncate">
                      {p.name}
                    </h3>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-xl h-fit">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-200">Próximas Deadlines</h2>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {pendingTasks.length} ativas
            </span>
          </div>

          {tasks.length === 0 ? (
            <p className="text-slate-500 text-xs py-4 text-center">Sem tarefas registadas.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id, task.completed)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                    task.completed
                      ? 'bg-slate-950/20 border-slate-800/40 opacity-40 line-through'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${task.completed ? 'text-blue-500' : 'text-slate-600'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200 truncate">{task.title}</p>
                    {task.due_date && (
                      <p className="text-[10px] text-amber-400/80 mt-0.5">
                        {new Date(task.due_date).toLocaleDateString('pt-PT')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          
        </div>
      </div>
      <main className="min-h-screen bg-[#ecebe6] p-6 flex justify-center items-center">
      <div className="w-full max-w-6xl">
        <MinimalCalendar />
      </div>
    </main>
    </div>
    
  );
}