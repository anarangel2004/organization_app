'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BookOpen, FolderOpen, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SubjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const pathname = usePathname();
  const resolvedParams = use(params);
  const rawId = decodeURIComponent(resolvedParams.id).toLowerCase();

  const [subject, setSubject] = useState<{
    id: string;
    name: string;
    color?: string;
    degree?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubject = async () => {
      setLoading(true);

      const { data, error } = await supabase.from('subjects').select('*');

      if (error) {
        console.error('Erro ao carregar disciplina:', error.message);
      } else if (data) {
        const found = data.find((s) => {
          const sId = String(s.id).toLowerCase();
          const sCode = String(s.code || '').toLowerCase();
          const sNameSlug = s.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');

          const cleanRawId = rawId
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

          return sId === rawId || sCode === rawId || sNameSlug === cleanRawId;
        });

        setSubject(found || null);
      }
      setLoading(false);
    };

    if (rawId) fetchSubject();
  }, [rawId]);

  const tabs = [
    { name: 'Materiais', href: `/faculdade/${resolvedParams.id}/materiais`, icon: FolderOpen },
    { name: 'Notebook', href: `/faculdade/${resolvedParams.id}/notebook`, icon: BookOpen },
    { name: 'Avaliação & Notas', href: `/faculdade/${resolvedParams.id}/avaliacao`, icon: Calculator },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-6 font-sans">
      {/* CABEÇALHO */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/faculdade"
          className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: subject?.color || '#3b82f6' }}
            />
            <h1 className="text-xl font-bold text-white">
              {loading ? 'A carregar...' : subject?.name || 'Unidade Curricular'}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {subject?.degree || 'Mestrado em Cibersegurança'}
          </p>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="flex gap-2 border-b border-slate-800/80 pb-3 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}