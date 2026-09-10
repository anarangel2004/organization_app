'use client';

import { SubjectData, Deadline } from '@/types/subject';

interface VisaoGeralSectionProps {
  subject: SubjectData | null;
}

// Filtra prazos para os próximos 30 dias
function getUpcomingDeadlines(deadlines: Deadline[] = []): { title: string; daysLeft: number; dateStr: string }[] {
  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);

  return deadlines
    .map(d => {
      const targetDate = new Date(d.date);
      const diffTime = targetDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        title: d.title,
        daysLeft,
        dateStr: targetDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
        targetDate,
      };
    })
    .filter(item => item.daysLeft >= 0 && item.targetDate <= thirtyDaysLater)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function VisaoGeralSection({ subject }: VisaoGeralSectionProps) {
  const upcomingDeadlines = getUpcomingDeadlines(subject?.deadlines);

  return (
    <section id="visao-geral" className="space-y-6 pt-12">
      <div className="border-b border-[#D8D5CC] pb-4 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase">
          <span>SECÇÃO 01 // PARÂMETROS DA DISCIPLINA</span>
          <span>ÚLTIMA ATUALIZAÇÃO: HÁ 2 DIAS</span>
        </div>

        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em] pt-2">
          VISÃO GERAL.
        </h2>
      </div>

      <div className="border-t border-[#111111]">
        {/* 01: AVALIAÇÃO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-[#D8D5CC] gap-2">
          <div className="font-mono text-[11px] tracking-[0.05em] text-[#111111] uppercase font-bold flex items-center gap-4">
            <span>01</span>
            <span>AVALIAÇÃO</span>
          </div>
          <div className="font-mono text-[11px] font-bold text-[#111111] uppercase">
            EXAME FINAL 60% // TRABALHO DE GRUPO 40%
          </div>
        </div>

        {/* 02: REGENTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-[#D8D5CC] gap-2">
          <div className="font-mono text-[11px] tracking-[0.05em] text-[#111111] uppercase font-bold flex items-center gap-4">
            <span>02</span>
            <span>REGENTE</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.05em]">
            <span className="text-[#767571] uppercase">CORPO DOCENTE</span>
            <span className="font-bold text-[#111111] uppercase">
              {subject?.teacherTeorica || 'N/D'}
            </span>
          </div>
        </div>

        {/* 03: PRÓXIMOS PRAZOS (MÚLTIPLOS) */}
        <div className="py-4 border-b border-[#111111] space-y-3">
          <div className="font-mono text-[11px] tracking-[0.05em] text-[#111111] uppercase font-bold flex items-center gap-4">
            <span>03</span>
            <span>PRÓXIMOS PRAZOS (PRÓXIMO MÊS)</span>
          </div>

          {upcomingDeadlines.length > 0 ? (
            <div className="space-y-2 pl-8">
              {upcomingDeadlines.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between font-mono text-[10px] tracking-[0.05em] bg-[#F6F3EC] p-2.5 border border-[#D8D5CC] gap-2"
                >
                  <span className="font-bold text-[#111111] uppercase">
                    {item.title} ({item.dateStr})
                  </span>
                  <span className="bg-[#111111] text-[#FCF9F2] px-2.5 py-1 font-bold uppercase self-start sm:self-auto">
                    {item.daysLeft === 0 ? 'HOJE' : `FALTAM ${item.daysLeft} DIAS`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="pl-8 font-mono text-[10px] text-[#767571] uppercase">
              NENHUM PRAZO AGENDADO PARA OS PRÓXIMOS 30 DIAS
            </div>
          )}
        </div>
      </div>
    </section>
  );
}