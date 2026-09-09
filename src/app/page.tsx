'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Check,
  Shuffle,
  Clock,
  MoreHorizontal,
  GripVertical,
  Flame,
  FileText
} from 'lucide-react';

interface TaskItem {
  id: string;
  title: string;
  time?: string;
  location?: string;
  category: 'trabalho' | 'estudo';
  completed: boolean;
  priority?: 'alta' | 'media' | 'baixa';
}

interface DeadlineItem {
  id: string;
  title: string;
  daysLeft: string;
  urgency: 'alta' | 'media' | 'baixa';
}

export default function Dashboard() {
  // --- Estados Principais ---
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: '1',
      title: 'Revisão de fontes primárias e citações do séc. XIX',
      time: '14:00 - 15:30',
      location: 'Biblioteca Central',
      category: 'estudo',
      completed: false,
      priority: 'alta'
    },
    {
      id: '2',
      title: 'Design Sprint: Prototipar grelha tipográfica da Monografia',
      time: '16:30 - 18:00',
      location: 'Sala Criativa Atelier',
      category: 'trabalho',
      completed: false,
      priority: 'media'
    }
  ]);

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([
    { id: '1', title: 'Exame de Estatística', daysLeft: '3 dias', urgency: 'alta' },
    { id: '2', title: 'Entrega Q4 Briefing', daysLeft: '5 dias', urgency: 'media' }
  ]);

  const [chaoticMode, setChaoticMode] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // --- Estado do Bloco de Notas ---
  const [notes, setNotes] = useState<string[]>([
    'Lembrar de pedir amostras do papel algodão Fedrigoni.',
    'Falar com Prof. Vasconcelos sobre metodologia mista.'
  ]);
  const [newNote, setNewNote] = useState('');

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes([...notes, newNote.trim()]);
    setNewNote('');
  };

  // --- Temporizador Pomodoro ---
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerRunning && pomodoroTime > 0) {
      timer = setInterval(() => setPomodoroTime((prev) => prev - 1), 1000);
    } else if (pomodoroTime === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, pomodoroTime]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setPomodoroTime(25 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // --- Gestão de Tarefas ---
  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      category: 'trabalho',
      completed: false,
      priority: 'media'
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const displayTasks = chaoticMode
    ? [...tasks].sort((a, b) => (a.priority === 'alta' ? -1 : 1))
    : tasks;

  const nextTask = displayTasks.find((t) => !t.completed);

  const totalTasks = displayTasks.length;
  const trabalhoCount = displayTasks.filter((t) => t.category === 'trabalho').length;
  const trabalhoPercent = totalTasks > 0 ? Math.round((trabalhoCount / totalTasks) * 100) : 60;
  const estudoPercent = 100 - trabalhoPercent;

  const weekdays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-slate-900 font-sans p-4 md:p-8 space-y-6 selection:bg-amber-200">
      {/* 1. NAVEGAÇÃO SUPERIOR */}
      <header className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-300/70 pb-4">
          <div className="flex items-center gap-6">
            <span className="font-serif text-lg font-bold tracking-tight text-slate-900">
              Atelier Agenda
            </span>
            <nav className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <Link
                href="/"
                className="text-slate-900 font-semibold border-b-2 border-slate-900 pb-0.5 transition-colors"
              >
                Visão Geral
              </Link>
              <Link
                href="/trabalho"
                className="hover:text-slate-900 pb-0.5 transition-colors"
              >
                SAP
              </Link>
              <Link
                href="/faculdade"
                className="hover:text-slate-900 pb-0.5 transition-colors"
              >
                Mestrado
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setChaoticMode(!chaoticMode)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-all flex items-center gap-1.5 ${
                chaoticMode
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              {chaoticMode ? 'Modo Caótico Ativo' : 'Modo Dia Caótico'}
            </button>
            <button className="bg-slate-900 hover:bg-black text-white text-xs px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Novo Registro
            </button>
          </div>
        </div>

        {/* Prazos Críticos */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs py-1 scrollbar-none">
          <span className="font-bold text-[10px] tracking-wider text-slate-400 uppercase pr-2 whitespace-nowrap">
            Prazos Críticos:
          </span>
          {deadlines.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200/80 px-3 py-1 rounded-full flex items-center gap-2 whitespace-nowrap shadow-2xs">
              <span className={`w-1.5 h-1.5 rounded-full ${item.urgency === 'alta' ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span className="text-slate-700">{item.title}</span>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {item.daysLeft}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* 2. GRID SUPERIOR: PRÓXIMA COISA + POMODORO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próxima Coisa a Fazer */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md">
                Próxima coisa a fazer
              </span>
              {nextTask && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {nextTask.time || 'Sem hora definida'}
                </span>
              )}
            </div>

            {nextTask ? (
              <>
                <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 leading-tight">
                  {nextTask.title}
                </h2>
                <p className="text-xs text-slate-500 max-w-2xl">
                  {nextTask.location ? `Local: ${nextTask.location}` : 'Sem notas adicionais para esta tarefa.'}
                </p>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400">
                <p className="text-sm">Nenhuma tarefa pendente no momento.</p>
              </div>
            )}
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 mt-4">
            <button
              disabled={!nextTask}
              onClick={() => setIsTimerRunning(true)}
              className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Focar Agora
            </button>
            {nextTask?.priority && (
              <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-1 rounded-md capitalize">
                Prioridade: {nextTask.priority}
              </span>
            )}
          </div>
        </div>

        {/* Temporizador Pomodoro */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-between text-center">
          <div className="w-full flex justify-between items-center text-xs text-slate-400">
            <span className="font-bold tracking-wider uppercase text-[10px]">
              Sessão Pomodoro
            </span>
            <span>Bloco 3/4</span>
          </div>

          <div className="my-4 relative flex flex-col items-center justify-center">
            <div className="text-4xl font-extrabold font-mono tracking-tight text-slate-900">
              {formatTime(pomodoroTime)}
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
              {isTimerRunning ? 'Foco Puro' : 'Parado'}
            </span>
          </div>

          <div className="w-full space-y-2">
            <div className="flex justify-center gap-2">
              <button
                onClick={toggleTimer}
                className="bg-slate-900 hover:bg-black text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 flex-1 justify-center"
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {isTimerRunning ? 'Pausa' : 'Iniciar'}
              </button>
              <button
                onClick={resetTimer}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400">3/4 blocos concluídos hoje • 75m acumulados</p>
          </div>
        </div>
      </div>

      {/* 3. RITMO SEMANAL */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-serif font-bold text-slate-900">Ritmo Semanal</h3>
            <p className="text-xs text-slate-400">Semana 43 • Visão geral</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900" /> Trabalho (Atelier & Clientes)
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Estudo & Investigação
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 pt-2">
          {weekdays.map((day, idx) => (
            <div key={day} className={`p-3 rounded-xl border space-y-2 min-h-[100px] ${idx === 1 ? 'border-slate-900 bg-white ring-1 ring-slate-900' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400">{day}</span>
                <span className="text-[10px] font-bold text-slate-700">{23 + idx}</span>
              </div>
              {idx === 1 && (
                <div className="space-y-1">
                  <div className="bg-slate-900 text-white text-[9px] p-1.5 rounded font-medium">Revisão de Tese</div>
                  <div className="bg-slate-100 text-slate-800 text-[9px] p-1.5 rounded font-medium">Design Sprint</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. SEÇÃO INFERIOR: PLANO DE AÇÃO + NOTAS & FOCO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Esquerda: Plano de Ação (2 colunas) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-serif font-bold text-slate-900">Plano de Ação: Hoje</h3>
              <p className="text-xs text-slate-400">{displayTasks.length} compromissos prioritários</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-right min-w-[200px]">
              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                <span>Balanço do Dia:</span>
                <span>{trabalhoPercent}% Trabalho • {estudoPercent}% Estudo</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                <div className="bg-slate-900 h-full transition-all duration-300" style={{ width: `${trabalhoPercent}%` }} />
                <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${estudoPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  task.completed ? 'bg-slate-50/60 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      task.completed ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div>
                    <p className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {task.title}
                    </p>
                    {task.time && <span className="text-[10px] text-slate-400">{task.time} • {task.location}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${task.category === 'estudo' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {task.category === 'trabalho' ? 'Trabalho' : 'Estudo'}
                  </span>
                  <button className="text-slate-400 hover:text-slate-600 p-1">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddTask} className="pt-2">
            <input
              type="text"
              placeholder="Adicionar nova tarefa para hoje (pressione Enter para gravar)..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
            />
          </form>
        </div>

        {/* Direita: Notas de Ateliê + Ritmo Sustentável de Foco (1 coluna) */}
        <div className="space-y-6">
          {/* Cartão Nota de Ateliê */}
          <div className="bg-[#fcfbf7] border border-amber-200/80 rounded-2xl p-5 shadow-xs space-y-3 font-serif">
            <div className="flex justify-between items-center text-[10px] font-sans font-bold tracking-wider text-slate-400 uppercase border-b border-amber-200/50 pb-2">
              <span className="flex items-center gap-1 text-slate-700">
                <FileText className="w-3.5 h-3.5 text-amber-700" /> Nota de Ateliê
              </span>
              <span>Papel 120g • Rascunho</span>
            </div>

            <p className="text-xs italic text-slate-700 leading-relaxed pt-1">
              "A beleza reside na precisão com que removemos o acessório, deixando apenas a essência da proporção."
            </p>

            <ul className="space-y-1.5 text-xs font-sans text-slate-600 list-disc list-inside pt-1">
              {notes.map((note, index) => (
                <li key={index} className="leading-snug">{note}</li>
              ))}
            </ul>

            <form onSubmit={handleAddNote} className="pt-2 font-sans">
              <input
                type="text"
                placeholder="Apontar ideia ou lembrete..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full bg-white/80 border border-amber-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white"
              />
            </form>
          </div>

          {/* Cartão Carga Semanal & Foco */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800">
                  <Flame className="w-4 h-4 fill-amber-500 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">12 dias consecutivos</h4>
                  <p className="text-[10px] text-slate-400">Ritmo sustentável de foco</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carga Semanal Acumulada</span>
                <span className="font-bold text-slate-900 text-xs">44h Total</span>
              </div>

              {/* Barra Trabalho */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Trabalho (Atelier)</span>
                  <span className="font-medium text-slate-800">26h / 30h</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-slate-900 h-full rounded-full" style={{ width: '86%' }} />
                </div>
              </div>

              {/* Barra Estudo */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Estudo & Pesquisa</span>
                  <span className="font-medium text-slate-800">18h / 20h</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '90%' }} />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                Meta semanal 92% atingida
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}