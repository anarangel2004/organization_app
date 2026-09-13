'use client';

import { Deadline } from '@/types';

interface PrazosSectionProps {
  deadlines?: Deadline[];
}

export function PrazosSection({ deadlines = [] }: PrazosSectionProps) {
  // Se não houver prazos na BD, mostra o estado vazio
  if (!deadlines || deadlines.length === 0) {
    return (
      <section className="border border-dashed border-[#D8D5CC] p-6 text-center font-mono text-[11px] text-[#767571] uppercase tracking-[0.05em]">
        [SISTEMA] NENHUM PRAZO OU ENTREGA REGISTADA PARA ESTA DISCIPLINA.
      </section>
    );
  }

  // Ordena os prazos por dias restantes (os mais próximos primeiro)
  const sortedDeadlines = [...deadlines].sort(
    (a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0)
  );

  // O prazo crítico é o marcado como isCritical OU o mais próximo com dias restantes >= 0
  const criticalDeadline =
    sortedDeadlines.find((d) => d.isCritical) ||
    sortedDeadlines.find((d) => (d.daysRemaining ?? 0) >= 0) ||
    sortedDeadlines[0];

  const secondaryDeadlines = sortedDeadlines.filter(
    (d) => d.id !== criticalDeadline?.id
  );

  return (
    <section className="space-y-3">
      {/* BANNER DE PRAZO CRÍTICO */}
      {criticalDeadline && (
        <div className="bg-[#111111] text-[#FCF9F2] p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-[#111111]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono text-[9px] tracking-[0.12em] text-[#D8D5CC] uppercase">
                {criticalDeadline.isCritical ? 'PRAZO CRÍTICO' : 'PRÓXIMA ENTREGA'}
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-4xl uppercase tracking-tight">
              {criticalDeadline.title}
            </h3>
          </div>

          <div className="text-left md:text-right font-mono shrink-0">
            <span className="text-2xl sm:text-3xl font-bold block">
              {criticalDeadline.daysRemaining === 0
                ? 'ENTREGA HOJE'
                : `${criticalDeadline.daysRemaining} DIAS RESTANTES`}
            </span>
            {criticalDeadline.location && (
              <span className="text-[10px] text-[#D8D5CC] uppercase block mt-0.5">
                {criticalDeadline.location}
              </span>
            )}
          </div>
        </div>
      )}

      {/* PRAZOS SECUNDÁRIOS / FUTUROS */}
      {secondaryDeadlines.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {secondaryDeadlines.map((item) => (
            <div
              key={item.id}
              className="border border-[#D8D5CC] p-4 bg-[#F6F3EC] hover:border-[#111111] flex justify-between items-center font-mono transition-colors"
            >
              <div className="space-y-1">
                <span className="text-[9px] text-[#767571] uppercase block">
                  {item.date ? new Date(item.date).toLocaleDateString('pt-PT') : 'PRAZO FUTURO'}
                </span>
                <span className="text-[12px] font-bold text-[#111111] uppercase block">
                  {item.title}
                </span>
              </div>
              <span className="bg-[#EBE8E1] border border-[#D8D5CC] px-2.5 py-1 text-[10px] font-bold text-[#111111] shrink-0">
                {item.daysRemaining === 0 ? 'HOJE' : `FALTAM ${item.daysRemaining} DIAS`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}