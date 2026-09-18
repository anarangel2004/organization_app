'use client';

import { formatDateStr } from '@/lib/utils';
import { UpcomingRow } from './types';

interface UpcomingDeadlinesProps {
  rows: UpcomingRow[];
}

// Lista linear de prazos académicos + tarefas de trabalho dos próximos
// 7 dias (janela contínua a partir de hoje, pode entrar na semana seguinte
// — diferente do Ritmo Semanal, que só mostra a semana Seg-Dom atual).
export function UpcomingDeadlines({ rows }: UpcomingDeadlinesProps) {
  return (
    <section id="proximos-7-dias" className="space-y-4">
      <h2 className="font-display text-4xl sm:text-5xl uppercase text-[#111111] tracking-tight">
        Próximos 7 Dias.
      </h2>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between font-mono text-[10px] tracking-[0.05em] bg-[#F6F3EC] p-2.5 border border-[#D8D5CC] gap-2"
            >
              <span className="font-bold text-[#111111] uppercase">
                {row.kind === 'PRAZO' ? '// ' : '· '}
                {row.title} — {row.subtitle}
              </span>
              <span className="bg-[#111111] text-[#FCF9F2] px-2.5 py-1 font-bold uppercase self-start sm:self-auto">
                {formatDateStr(row.date.toISOString())}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 font-mono text-[10px] text-[#767571] uppercase border-y border-[#D8D5CC]">
          NENHUM PRAZO OU TAREFA NOS PRÓXIMOS 7 DIAS.
        </div>
      )}
    </section>
  );
}
