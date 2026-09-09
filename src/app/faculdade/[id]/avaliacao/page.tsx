'use client';

import { Calculator, CheckCircle2 } from 'lucide-react';

export default function AvaliacaoPage() {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-xl flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-sky-400" /> Ponderações & Calculadora de Média
        </h2>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl text-center">
        <p className="text-xs text-slate-400">Gere aqui os pesos dos testes, exames e trabalhos para calcular a média estimada.</p>
      </div>
    </div>
  );
}