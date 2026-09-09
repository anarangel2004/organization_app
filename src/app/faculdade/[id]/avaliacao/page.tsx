'use client';

import { Calculator, Plus } from 'lucide-react';

export default function AvaliacaoPage() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm text-white">
          <Calculator className="w-4 h-4 text-emerald-400" />
          <span>Critérios & Notas de Avaliação</span>
        </div>

        <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> Adicionar Elemento
        </button>
      </div>

      <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-8 min-h-[250px] flex items-center justify-center text-center text-slate-500">
        <p className="text-xs">Sem notas registadas.</p>
      </div>
    </div>
  );
}