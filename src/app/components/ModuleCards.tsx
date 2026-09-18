'use client';

import Link from 'next/link';

interface ModuleCardsProps {
  subjectsCount: number;
  nextClassLabel: string;
  projectsCount: number;
  pendingTasksCount: number;
}

// As duas fichas de acesso rápido — Faculdade e Trabalho — cada uma com
// um resumo real do módulo, não decorativo.
export function ModuleCards({
  subjectsCount,
  nextClassLabel,
  projectsCount,
  pendingTasksCount,
}: ModuleCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <Link
        href="/faculdade"
        className="group border border-[#111111] p-6 space-y-4 hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors"
      >
        <div className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase">
          <span>01 // FACULDADE</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl uppercase leading-none">Arquivo Académico.</h2>
        <div className="font-mono text-[11px] uppercase space-y-1.5 pt-2 border-t border-[#D8D5CC] group-hover:border-[#767571]">
          <div className="flex justify-between">
            <span className="text-[#767571] group-hover:text-[#D8D5CC]">DISCIPLINAS ATIVAS</span>
            <span className="font-bold">{String(subjectsCount).padStart(2, '0')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#767571] group-hover:text-[#D8D5CC]">PRÓXIMA AULA</span>
            <span className="font-bold">{nextClassLabel}</span>
          </div>
        </div>
      </Link>

      <Link
        href="/trabalho"
        className="group border border-[#111111] p-6 space-y-4 hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors"
      >
        <div className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase">
          <span>02 // TRABALHO</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl uppercase leading-none">Gestão Profissional.</h2>
        <div className="font-mono text-[11px] uppercase space-y-1.5 pt-2 border-t border-[#D8D5CC] group-hover:border-[#767571]">
          <div className="flex justify-between">
            <span className="text-[#767571] group-hover:text-[#D8D5CC]">PROJETOS</span>
            <span className="font-bold">{String(projectsCount).padStart(2, '0')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#767571] group-hover:text-[#D8D5CC]">TAREFAS PENDENTES</span>
            <span className="font-bold">{String(pendingTasksCount).padStart(2, '0')}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
