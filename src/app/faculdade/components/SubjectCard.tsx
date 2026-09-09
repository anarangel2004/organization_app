'use client';

import Link from 'next/link';
import { Clock, BookOpen, FolderOpen, Award } from 'lucide-react';
import { Subject } from '../types';

export function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between h-[210px] group">
      {/* Clique no cartão abre a Visão Geral */}
      <Link href={`/faculdade/${subject.id}`} className="space-y-3 block">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
            {subject.code}
          </span>
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
        </div>

        <h3 className="font-serif font-bold text-slate-900 text-lg group-hover:text-amber-700 transition-colors line-clamp-1">
          {subject.name}
        </h3>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">Próxima aula:</span>
          </div>
          <span className="font-semibold text-slate-700">Terça, 10:00 - 12:00</span>
        </div>
      </Link>

      {/* Atalhos Diretos para as tuas Sub-Rotas */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acesso Rápido:</span>
        <div className="flex gap-1.5">
          <Link
            href={`/faculdade/${subject.id}/notebook`}
            title="Notebooks"
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-500 text-xs transition-colors border border-slate-200/60"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/faculdade/${subject.id}/materiais`}
            title="Materiais & Ficheiros"
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-500 text-xs transition-colors border border-slate-200/60"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/faculdade/${subject.id}/avaliacao`}
            title="Avaliações"
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-500 text-xs transition-colors border border-slate-200/60"
          >
            <Award className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}