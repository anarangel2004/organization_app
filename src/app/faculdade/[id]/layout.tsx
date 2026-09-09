'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getProjectById, Project } from '@/lib/db';
import { ArrowLeft, BookOpen, FileText, Calculator } from 'lucide-react';

export default function CadeiraLayout({
  children,
  params: paramsPromise,
}: {
  children: React.ReactNode;
  params: Promise<{ cadeiraId: string }>;
}) {
  const params = use(paramsPromise);
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (params.cadeiraId) {
      getProjectById(params.cadeiraId).then(setProject);
    }
  }, [params.cadeiraId]);

  const tabs = [
    { name: 'Materiais', href: `/faculdade/${params.cadeiraId}/materiais`, icon: BookOpen },
    { name: 'Notebook', href: `/faculdade/${params.cadeiraId}/notebook`, icon: FileText },
    { name: 'Avaliação & Notas', href: `/faculdade/${params.cadeiraId}/avaliacao`, icon: Calculator },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho Fixo */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/faculdade"
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project?.color || '#3b82f6' }} />
              <h1 className="text-xl font-bold text-slate-100">{project?.name || 'A carregar...'}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Mestrado em Cibersegurança</p>
          </div>
        </div>
      </div>

      {/* Navegação por Separadores */}
      <div className="flex border-b border-slate-800 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all rounded-t-lg ${
                isActive
                  ? 'border-sky-500 text-sky-400 bg-sky-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo Dinâmico do Separador */}
      <div>{children}</div>
    </div>
  );
}