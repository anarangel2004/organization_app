'use client';

import { FolderOpen, FileUp, Download, Trash2 } from 'lucide-react';

export default function MateriaisPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-sky-400" /> Repositório de Ficheiros
        </h2>
        <button className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
          <FileUp className="w-3.5 h-3.5" /> Adicionar Ficheiro
        </button>
      </div>

      <div className="border border-dashed border-slate-800 rounded-xl py-12 text-center bg-slate-950/40">
        <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400">Nenhum PDF, exame ou exercício associado a esta cadeira.</p>
      </div>
    </div>
  );
}