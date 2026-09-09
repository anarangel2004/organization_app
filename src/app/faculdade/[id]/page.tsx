'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  getProjectById, 
  updateProject, 
  getTasks, 
  createTask, 
  toggleTaskStatus, 
  deleteTask, 
  Project, 
  Task, 
  EvaluationData 
} from '@/lib/db';
import { 
  GraduationCap, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Calculator, 
  CheckCircle2, 
  Clock, 
  Percent, 
  BookOpen, 
  FileText 
} from 'lucide-react';

export default function UCDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ucId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Form para novos elementos de avaliação
  const [itemType, setItemType] = useState<'test' | 'project'>('test');
  const [itemName, setItemName] = useState('');
  const [itemWeight, setItemWeight] = useState(50);
  const [itemGrade, setItemGrade] = useState<string>('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Form para nova tarefa
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  useEffect(() => {
    if (ucId) loadUCData();
  }, [ucId]);

  async function loadUCData() {
    setLoading(true);
    try {
      const [ucData, tasksData] = await Promise.all([
        getProjectById(ucId),
        getTasks(ucId)
      ]);
      setProject(ucData);
      setTasks(tasksData);
    } catch (err) {
      console.error('Erro ao carregar dados da cadeira:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- CÁLCULO DAS NOTAS ---
  const evalData = project?.evaluation_data || {
    theory_weight: 50,
    practical_weight: 50,
    tests: [],
    projects: []
  };

  const calculateSubAverage = (items: Array<{ weight: number; grade?: number }>) => {
    const graded = items.filter(i => typeof i.grade === 'number');
    if (graded.length === 0) return null;

    let totalWeight = 0;
    let sum = 0;
    graded.forEach(i => {
      sum += (i.grade! * i.weight);
      totalWeight += i.weight;
    });

    return totalWeight > 0 ? sum / totalWeight : null;
  };

  const theoryAvg = calculateSubAverage(evalData.tests || []);
  const practicalAvg = calculateSubAverage(evalData.projects || []);

  const calculateFinalGrade = () => {
    const tWeight = (evalData.theory_weight || 50) / 100;
    const pWeight = (evalData.practical_weight || 50) / 100;

    if (theoryAvg !== null && practicalAvg !== null) {
      return (theoryAvg * tWeight + practicalAvg * pWeight).toFixed(1);
    } else if (theoryAvg !== null) {
      return theoryAvg.toFixed(1);
    } else if (practicalAvg !== null) {
      return practicalAvg.toFixed(1);
    }
    return null;
  };

  const finalGrade = calculateFinalGrade();

  // --- GUARDA ALTERAÇÕES NAS AVALIAÇÕES ---
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !itemName.trim()) return;

    const newItem = {
      id: crypto.randomUUID(),
      name: itemName.trim(),
      weight: Number(itemWeight),
      grade: itemGrade !== '' ? Number(itemGrade) : undefined
    };

    const updatedData: EvaluationData = { ...evalData };
    if (itemType === 'test') {
      updatedData.tests = [...(updatedData.tests || []), newItem];
    } else {
      updatedData.projects = [...(updatedData.projects || []), newItem];
    }

    try {
      const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
      setProject(updatedProject);
      setItemName('');
      setItemGrade('');
      setIsAddingItem(false);
    } catch (err) {
      console.error('Erro ao guardar avaliação:', err);
    }
  };

  const handleUpdateGrade = async (type: 'test' | 'project', itemId: string, gradeValue: string) => {
    if (!project) return;
    const updatedData: EvaluationData = { ...evalData };
    const list = type === 'test' ? updatedData.tests : updatedData.projects;

    const item = list.find(i => i.id === itemId);
    if (item) {
      item.grade = gradeValue !== '' ? Number(gradeValue) : undefined;
      const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
      setProject(updatedProject);
    }
  };

  const handleDeleteItem = async (type: 'test' | 'project', itemId: string) => {
    if (!project) return;
    const updatedData: EvaluationData = { ...evalData };
    if (type === 'test') {
      updatedData.tests = updatedData.tests.filter(i => i.id !== itemId);
    } else {
      updatedData.projects = updatedData.projects.filter(i => i.id !== itemId);
    }

    const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
    setProject(updatedProject);
  };

  // --- GUARDA TAREFAS ---
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const task = await createTask({
        title: newTaskTitle.trim(),
        project_id: ucId,
        due_date: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
        completed: false,
        context: 'academic'
      });
      setTasks([...tasks, task]);
      setNewTaskTitle('');
      setNewTaskDueDate('');
    } catch (err) {
      console.error('Erro ao criar tarefa:', err);
    }
  };

  if (loading) {
    return <div className="text-slate-500 text-xs py-10 text-center">A carregar detalhes da unidade curricular...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-10">
        <p className="text-slate-400 text-sm">Cadeira não encontrada.</p>
        <Link href="/faculdade" className="text-sky-400 text-xs mt-2 inline-block hover:underline">
          Voltar às cadeiras
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/faculdade" className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color || '#3b82f6' }} />
              <h1 className="text-xl font-bold text-slate-100">{project.name}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Mestrado em Cibersegurança</p>
          </div>
        </div>

        {/* Nota Final Estimada */}
        <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Nota Estimada</span>
          <span className={`text-xl font-extrabold ${finalGrade ? (Number(finalGrade) >= 9.5 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
            {finalGrade ? `${finalGrade} / 20` : 'Sem Média'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Avaliações Teóricas & Práticas (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Componente Teórica */}
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-slate-200">Componente Teórica ({evalData.theory_weight}%)</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Média: <strong className="text-sky-400">{theoryAvg !== null ? theoryAvg.toFixed(1) : '-'}</strong>
              </span>
            </div>

            {evalData.tests.length === 0 ? (
              <p className="text-slate-500 text-xs py-2">Nenhum teste ou exame registado.</p>
            ) : (
              <div className="space-y-2">
                {evalData.tests.map((test) => (
                  <div key={test.id} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-slate-200">{test.name}</p>
                      <span className="text-[10px] text-slate-500">Peso: {test.weight}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="Nota"
                        value={test.grade ?? ''}
                        onChange={(e) => handleUpdateGrade('test', test.id, e.target.value)}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                      <button onClick={() => handleDeleteItem('test', test.id)} className="text-slate-600 hover:text-red-400 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Componente Prática */}
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-200">Componente Prática ({evalData.practical_weight}%)</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Média: <strong className="text-emerald-400">{practicalAvg !== null ? practicalAvg.toFixed(1) : '-'}</strong>
              </span>
            </div>

            {evalData.projects.length === 0 ? (
              <p className="text-slate-500 text-xs py-2">Nenhum projeto ou trabalho prático registado.</p>
            ) : (
              <div className="space-y-2">
                {evalData.projects.map((proj) => (
                  <div key={proj.id} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-slate-200">{proj.name}</p>
                      <span className="text-[10px] text-slate-500">Peso: {proj.weight}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="Nota"
                        value={proj.grade ?? ''}
                        onChange={(e) => handleUpdateGrade('project', proj.id, e.target.value)}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                      <button onClick={() => handleDeleteItem('project', proj.id)} className="text-slate-600 hover:text-red-400 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form de Adição rápida de Teste/Trabalho */}
            {!isAddingItem ? (
              <button
                onClick={() => setIsAddingItem(true)}
                className="w-full py-2 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Elemento de Avaliação
              </button>
            ) : (
              <form onSubmit={handleAddItem} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemType('test')}
                    className={`py-1 rounded text-xs font-semibold border ${itemType === 'test' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    Teste / Exame
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('project')}
                    className={`py-1 rounded text-xs font-semibold border ${itemType === 'project' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    Trabalho / Projeto
                  </button>
                </div>

                <input
                  type="text"
                  required
                  placeholder="Nome (Ex: Frequência 1)"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    placeholder="Peso em %"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    placeholder="Nota (Opcional)"
                    value={itemGrade}
                    onChange={(e) => setItemGrade(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setIsAddingItem(false)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">
                    Cancelar
                  </button>
                  <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded font-medium">
                    Adicionar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Tarefas / Prazos da UC */}
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl h-fit space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-sky-400" /> Tarefas desta Cadeira
          </h2>

          <form onSubmit={handleAddTask} className="space-y-2">
            <input
              type="text"
              required
              placeholder="Nova tarefa..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-400 focus:outline-none"
              />
              <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-lg text-xs font-medium">
                Adicionar
              </button>
            </div>
          </form>

          <div className="space-y-2 pt-2">
            {tasks.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-2">Sem tarefas adicionadas.</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={async () => {
                      await toggleTaskStatus(task.id, !task.completed);
                      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
                    }}>
                      <CheckCircle2 className={`w-4 h-4 ${task.completed ? 'text-sky-500' : 'text-slate-600'}`} />
                    </button>
                    <span className={`text-xs text-slate-200 truncate ${task.completed ? 'line-through text-slate-500' : ''}`}>
                      {task.title}
                    </span>
                  </div>
                  <button onClick={async () => {
                    await deleteTask(task.id);
                    setTasks(tasks.filter(t => t.id !== task.id));
                  }} className="text-slate-600 hover:text-red-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}