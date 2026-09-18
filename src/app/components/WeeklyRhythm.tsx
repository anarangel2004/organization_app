'use client';

import { formatDateStr } from '@/lib/utils';
import { WeekDayCell } from './types';

interface WeeklyRhythmProps {
  weekDays: WeekDayCell[];
}

// Grelha Seg-Dom da semana atual: aulas, prazos e tarefas de cada dia,
// com o estado calculado a partir dos dados reais (nunca inventado).
export function WeeklyRhythm({ weekDays }: WeeklyRhythmProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-4xl sm:text-5xl uppercase text-[#111111] tracking-tight">
          Ritmo Semanal.
        </h2>
        <span className="font-mono text-[10px] tracking-widest text-[#767571] uppercase">
          SEMANA DE {weekDays[0] ? formatDateStr(weekDays[0].date.toISOString()) : ''}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {weekDays.map((day) => (
          <div
            key={day.date.toISOString()}
            className={`shrink-0 w-44 border p-3 space-y-2 ${
              day.isToday ? 'border-[#111111] border-2 bg-white' : 'border-[#D8D5CC] bg-[#F6F3EC]/40'
            }`}
          >
            <div className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase">
              <span className="font-bold">
                {day.dayLabel} {day.dateLabel} {day.isToday && '[HOJE]'}
              </span>
            </div>
            <span
              className={`inline-block font-mono text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 ${
                day.status === 'CRÍTICO'
                  ? 'bg-[#B91C1C] text-[#FCF9F2]'
                  : day.status === 'HOJE'
                  ? 'bg-[#111111] text-[#FCF9F2]'
                  : day.status === 'CONCLUÍDO'
                  ? 'bg-[#D8D5CC] text-[#767571]'
                  : 'bg-transparent text-[#767571] border border-[#D8D5CC]'
              }`}
            >
              {day.status}
            </span>

            <div className="space-y-1.5 pt-1 min-h-[2rem]">
              {day.rows.length > 0 ? (
                day.rows.slice(0, 5).map((row) => (
                  <div key={row.id} className="font-mono text-[9px] uppercase leading-tight">
                    <span className="text-[#767571]">{row.time || row.kind} · </span>
                    <span className="font-bold text-[#111111]">{row.title}</span>
                  </div>
                ))
              ) : (
                <div className="font-mono text-[9px] text-[#767571] uppercase">LIVRE</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
