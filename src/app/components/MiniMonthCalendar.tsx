'use client';

import { useMemo } from 'react';
import { formatDateStr } from '@/lib/utils';
import { AgendaRow } from './types';

interface MiniMonthCalendarProps {
  monthAnchor: Date;
  today: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  getDayRows: (date: Date) => AgendaRow[];
}

const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MONTH_LABELS = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function getMonthGridDates(monthAnchor: Date): Date[] {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const jsDay = firstOfMonth.getDay(); // 0 = Domingo
  const offsetToMonday = jsDay === 0 ? 6 : jsDay - 1;
  const gridStart = new Date(year, month, 1 - offsetToMonday);

  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// Mini-calendário mensal: navegação por mês, marca dias com aulas/prazos/
// tarefas e mostra um popover ao passar o rato com a agenda desse dia.
export function MiniMonthCalendar({ monthAnchor, today, onPrevMonth, onNextMonth, getDayRows }: MiniMonthCalendarProps) {
  const gridDates = useMemo(() => getMonthGridDates(monthAnchor), [monthAnchor]);
  const monthLabel = `${MONTH_LABELS[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;

  return (
    <div className="border border-[#D8D5CC] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Mês anterior"
          className="font-mono text-[10px] text-[#767571] hover:text-[#111111] px-1 cursor-pointer"
        >
          ◀
        </button>
        <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[#111111]">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Mês seguinte"
          className="font-mono text-[10px] text-[#767571] hover:text-[#111111] px-1 cursor-pointer"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_INITIALS.map((d, i) => (
          <div key={i} className="font-mono text-[8px] text-center text-[#767571] uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDates.map((date) => {
          const inMonth = date.getMonth() === monthAnchor.getMonth();
          const isToday = date.getTime() === today.getTime();
          const rows = inMonth ? getDayRows(date) : [];
          const hasCritical = rows.some((r) => r.kind === 'PRAZO');
          const hasAny = rows.length > 0;
          const isLateCol = date.getDay() === 0 || date.getDay() === 6; // Sáb/Dom: abre o popover para a esquerda

          return (
            <div key={date.toISOString()} className="relative group aspect-square">
              <div
                className={`w-full h-full flex flex-col items-center justify-center font-mono text-[10px] leading-none ${
                  isToday
                    ? 'bg-[#111111] text-[#FCF9F2]'
                    : !inMonth
                    ? 'text-[#D8D5CC]'
                    : 'text-[#111111]'
                }`}
              >
                <span>{date.getDate()}</span>
                {hasAny && (
                  <span
                    className="mt-1 w-1 h-1"
                    style={{ backgroundColor: hasCritical ? '#B91C1C' : isToday ? '#FCF9F2' : '#767571' }}
                  />
                )}
              </div>

              {hasAny && (
                <div
                  className={`hidden group-hover:block absolute z-30 top-0 w-48 bg-[#FCF9F2] border-2 border-[#111111] p-2 space-y-1 shadow-[4px_4px_0_0_#111111] ${
                    isLateCol ? 'right-full mr-2' : 'left-full ml-2'
                  }`}
                >
                  <div className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#767571] border-b border-[#D8D5CC] pb-1 mb-1">
                    {formatDateStr(date.toISOString())}
                  </div>
                  {rows.slice(0, 6).map((row) => (
                    <div key={row.id} className="font-mono text-[8px] uppercase leading-tight">
                      <span className="text-[#767571]">{row.time || row.kind} · </span>
                      <span className="font-bold text-[#111111]">{row.title}</span>
                    </div>
                  ))}
                  {rows.length > 6 && (
                    <div className="font-mono text-[7px] text-[#767571] uppercase">+{rows.length - 6} MAIS</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
