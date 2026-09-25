'use client';

import { SubjectHours } from './homeAgenda';

interface TimeBreakdownProps {
  data: SubjectHours[];
}

// Barras horizontais de horas de aula por disciplina esta semana.
// Cor = paleta categórica validada (identidade); texto sempre em tinta,
// nunca na cor da série (skill dataviz). Track neutro, valor na ponta.
export function TimeBreakdown({ data }: TimeBreakdownProps) {
  const maxHours = Math.max(...data.map((d) => d.hours), 1);

  return (
    <div className="border border-[#D8D5CC] p-3 space-y-3">
      <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[#111111]">
        CARGA SEMANAL POR DISCIPLINA
      </span>

      {data.length === 0 ? (
        <div className="font-mono text-[9px] text-[#767571] uppercase py-2">SEM AULAS AGENDADAS.</div>
      ) : (
        <div className="space-y-2.5">
          {data.map((d) => (
            <div key={d.subjectId} title={`${d.code} · ${d.hours.toFixed(1)}H ESTA SEMANA`}>
              <div className="flex items-baseline justify-between font-mono text-[9px] uppercase tracking-wide mb-1">
                <span className="font-bold text-[#111111]">{d.code}</span>
                <span className="text-[#767571]">{d.hours.toFixed(1)}H</span>
              </div>
              <div className="h-[8px] bg-[#F0EDE4]">
                <div
                  className="h-full"
                  style={{ width: `${Math.max((d.hours / maxHours) * 100, 2)}%`, backgroundColor: d.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
