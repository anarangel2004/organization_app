'use client';

import { useState, useEffect } from 'react';
import { getTasks, Task } from '@/lib/db';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const MONTH_NAMES_SHORT = [
  "Jan'", "Feb'", "Mar'", "Apr'", "May'", "Jun'",
  "Jul'", "Aug'", "Sep'", "Oct'", "Nov'", "Dec'"
];

export default function MinimalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar tarefas da base de dados IndexedDB
  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await getTasks();
        setTasks(data || []);
      } catch (err) {
        console.error('Erro ao carregar tarefas:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navegação do Mês
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Cálculos do Calendário
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Ajuste para começar na Segunda-feira (0 = Seg, 6 = Dom)
  const startingDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

  // Formatar Chave YYYY-MM-DD
  const formatDateKey = (yearNum: number, monthNum: number, dayNum: number) => {
    const m = String(monthNum + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return `${yearNum}-${m}-${d}`;
  };

  // Mapear tarefas por data
  const tasksByDate = tasks.reduce((acc, task) => {
    if (task.due_date) {
      const dateKey = task.due_date.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  // Hoje para comparação
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="w-full bg-[#fafafa] text-slate-900 p-8 rounded-3xl font-sans shadow-sm border border-slate-200/80">
      {/* 1. Cabeçalho Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {MONTH_NAMES_SHORT[month]} {year}
            </h1>
            {/* Controlos de Navegação Minimalistas < . > */}
            <div className="flex items-center gap-1 text-slate-400 text-sm ml-2">
              <button 
                onClick={prevMonth}
                className="hover:text-slate-900 p-1 transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300">•</span>
              <button 
                onClick={nextMonth}
                className="hover:text-slate-900 p-1 transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Here all your planned events. You will find information for each event as well you can plan new one.
          </p>
        </div>

        {/* Botão Add Event */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button 
            onClick={() => alert('Abrir modal de novo evento/tarefa')}
            className="bg-[#18181b] hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add event
          </button>
        </div>
      </div>

      {/* 2. Grelha do Calendário */}
      <div className="grid grid-cols-7 gap-x-3 gap-y-6">
        {/* Dias da Semana (MON, TUE...) */}
        {WEEKDAYS.map((day, idx) => {
          const isFriday = day === 'FRI'; // Exemplo de destaque no dia ativo
          return (
            <div 
              key={day} 
              className={`text-[10px] font-bold uppercase tracking-wider pb-2 border-b-2 ${
                isFriday ? 'text-orange-500 border-orange-500' : 'text-slate-400 border-slate-900'
              }`}
            >
              {day}
            </div>
          );
        })}

        {/* Dias do Mês Anterior (Inativos / Apagados) */}
        {Array.from({ length: startingDayIndex }).map((_, idx) => {
          const dayNum = daysInPrevMonth - startingDayIndex + idx + 1;
          return (
            <div key={`prev-${idx}`} className="min-h-[130px] pt-2 opacity-30 select-none">
              <span className="text-xl font-bold text-slate-400 block mb-2">
                {dayNum < 10 ? `0${dayNum}` : dayNum}
              </span>
            </div>
          );
        })}

        {/* Dias do Mês Atual */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const dateKey = formatDateKey(year, month, dayNum);
          const dayTasks = tasksByDate[dateKey] || [];
          const isToday = dateKey === todayKey;

          return (
            <div
              key={dayNum}
              className={`min-h-[130px] p-2.5 rounded-xl transition-all flex flex-col justify-between border-t-2 ${
                isToday
                  ? 'bg-[#f4f2ee] border-orange-500'
                  : 'bg-transparent border-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <div>
                {/* Número do Dia */}
                <span
                  className={`text-2xl font-bold block mb-2 leading-none ${
                    isToday ? 'text-orange-500' : 'text-slate-900'
                  }`}
                >
                  {dayNum < 10 ? `0${dayNum}` : dayNum}
                </span>

                {/* Lista de Eventos inline dentro da Célula */}
                <div className="space-y-2 mt-2">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div key={task.id} className="text-left group cursor-pointer">
                      <p className="text-[11px] font-bold text-slate-900 leading-snug truncate group-hover:text-orange-600 transition-colors">
                        {task.title}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">
                        {task.status === 'done' ? 'Concluído' : '1:00 – 1:20 PM'}
                      </p>
                    </div>
                  ))}

                  {/* Ver mais se houver mais de 2 eventos no dia */}
                  {dayTasks.length > 2 && (
                    <button className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 block transition-colors mt-1">
                      And {dayTasks.length - 2} more
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}