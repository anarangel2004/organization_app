'use client';

import { AgendaRow } from './types';

interface TodayAgendaProps {
  rows: AgendaRow[];
  todayLabel: string;
}

// Lista compacta dos eventos de hoje (aulas com hora, prazos e tarefas),
// para a coluna lateral do Ritmo Semanal.
export function TodayAgenda({ rows, todayLabel }: TodayAgendaProps) {
  return (
    <div className="border border-[#D8D5CC] p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[#111111]">
          EVENTOS DE HOJE
        </span>
        <span className="font-mono text-[8px] text-[#767571] uppercase">{todayLabel}</span>
      </div>

      {rows.length === 0 ? (
        <div className="font-mono text-[9px] text-[#767571] uppercase py-2">SEM EVENTOS HOJE.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-2 font-mono text-[9px] uppercase leading-tight">
              <span
                className="mt-0.5 w-1.5 h-1.5 shrink-0"
                style={{ backgroundColor: row.kind === 'PRAZO' ? '#B91C1C' : row.color || '#767571' }}
              />
              <div>
                <span className="text-[#767571]">
                  {row.time ? `${row.time}${row.endTime ? `–${row.endTime}` : ''}` : row.kind} ·{' '}
                </span>
                <span className="font-bold text-[#111111]">{row.title}</span>
                <span className="text-[#767571]"> — {row.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
