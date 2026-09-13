'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export interface ChapterData {
  id: string;
  tab: 'TEORICAS' | 'PRATICAS' | 'TESTES';
  updatedAt?: string;
  hasContent?: boolean;
  pdfUrl?: string;
  isCompleted?: boolean;
}

interface NotebooksSectionProps {
  chapters?: ChapterData[];
  subjectId?: string;
}

function formatRelativeDate(isoDateStr?: string): string {
  if (!isoDateStr || isoDateStr === 'SEM REGISTO') return 'SEM REGISTO';

  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return isoDateStr;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'HOJE';
  if (diffDays === 1) return 'HÁ 1 DIA';
  if (diffDays < 30) return `HÁ ${diffDays} DIAS`;

  return date.toLocaleDateString('pt-PT');
}

function getLatestUpdateDate(chapters: ChapterData[]): string {
  const validTimestamps = chapters
    .map((c) => c.updatedAt)
    .filter((d): d is string => !!d && d !== 'SEM REGISTO')
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));

  if (validTimestamps.length === 0) return 'SEM REGISTO';

  const latestMs = Math.max(...validTimestamps);
  return formatRelativeDate(new Date(latestMs).toISOString());
}

export function NotebooksSection({ chapters = [], subjectId: propSubjectId }: NotebooksSectionProps) {
  const params = useParams();
  const subjectId = propSubjectId || (params?.id as string);

  const stats = useMemo(() => {
    const normalizeTab = (tab?: string) =>
      tab?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

    const teoricas = chapters.filter((c) => normalizeTab(c.tab) === 'TEORICAS');
    const praticas = chapters.filter((c) => normalizeTab(c.tab) === 'PRATICAS');
    const testes = chapters.filter((c) => normalizeTab(c.tab) === 'TESTES');

    const teoricasCompleted = teoricas.filter((c) => c.isCompleted).length;
    const praticasCompleted = praticas.filter((c) => c.isCompleted).length;

    const totalChapters = chapters.length;
    const totalCompleted = chapters.filter((c) => c.isCompleted).length;

    const percentage = totalChapters > 0
      ? ((totalCompleted / totalChapters) * 100).toFixed(1)
      : '0.0';

    return {
      teoricasCount: teoricas.length,
      praticasCount: praticas.length,
      testesCount: testes.length,
      teoricasLastEdit: getLatestUpdateDate(teoricas),
      praticasLastEdit: getLatestUpdateDate(praticas),
      percentage,
      teoricasProgress: teoricas.length > 0 ? (teoricasCompleted / teoricas.length) * 100 : 0,
      praticasProgress: praticas.length > 0 ? (praticasCompleted / praticas.length) * 100 : 0,
    };
  }, [chapters]);

  return (
    <section id="notebooks" className="space-y-6 pt-12 font-mono select-none">
      <div className="border-b border-[#D8D5CC] pb-4 flex justify-between items-end">
        <div>
          <span className="text-[10px] tracking-[0.12em] text-[#767571] uppercase block mb-1">
            SECÇÃO 02 // REPOSITÓRIO DE APONTAMENTOS
          </span>
          <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
            NOTEBOOKS.
          </h2>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-[9px] tracking-[0.12em] text-[#767571] uppercase block">
            % DE CAPÍTULOS PREENCHIDOS
          </span>
          <span className="font-sans font-black text-4xl text-[#111111]">{stats.percentage}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARTÃO 1: TEÓRICAS */}
        <div className="border border-[#D8D5CC] p-6 bg-[#F6F3EC] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="text-[9px] tracking-[0.12em] text-[#767571] uppercase block border-b border-[#D8D5CC] pb-2">
              VOL. 01 · TEÓRICAS
            </span>
            <div className="text-[11px] text-[#111111] font-bold uppercase">
              {stats.teoricasCount} CAPÍTULOS // EDITADO {stats.teoricasLastEdit}
            </div>
            <div className="w-full bg-[#E5E2DB] h-1.5 overflow-hidden">
              <div
                className="bg-[#111111] h-full transition-all duration-500"
                style={{ width: `${stats.teoricasProgress}%` }}
              />
            </div>
          </div>
          <Link
            href={`/faculdade/${subjectId}/notebook?tab=TEORICAS`}
            className="w-full bg-[#111111] text-[#FCF9F2] hover:bg-[#31312c] text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors text-center block border border-[#111111]"
          >
            ABRIR TEÓRICAS &rarr;
          </Link>
        </div>

        {/* CARTÃO 2: PRÁTICAS */}
        <div className="border border-[#D8D5CC] p-6 bg-[#F6F3EC] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="text-[9px] tracking-[0.12em] text-[#767571] uppercase block border-b border-[#D8D5CC] pb-2">
              VOL. 02 · PRÁTICAS
            </span>
            <div className="text-[11px] text-[#111111] font-bold uppercase">
              {stats.praticasCount} CAPÍTULOS // EDITADO {stats.praticasLastEdit}
            </div>
            <div className="w-full bg-[#E5E2DB] h-1.5 overflow-hidden">
              <div
                className="bg-[#111111] h-full transition-all duration-500"
                style={{ width: `${stats.praticasProgress}%` }}
              />
            </div>
          </div>
          <Link
            href={`/faculdade/${subjectId}/notebook?tab=PRATICAS`}
            className="w-full bg-[#111111] text-[#FCF9F2] hover:bg-[#31312c] text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors text-center block border border-[#111111]"
          >
            ABRIR PRÁTICAS &rarr;
          </Link>
        </div>

        {/* CARTÃO 3: TESTES */}
        <div className="border border-[#D8D5CC] p-6 bg-[#F6F3EC] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="text-[9px] tracking-[0.12em] text-[#767571] uppercase block border-b border-[#D8D5CC] pb-2">
              VOL. 03 · TESTES
            </span>
            <div className="text-[11px] text-[#111111] font-bold uppercase">
              {stats.testesCount} TESTES ANTERIORES
            </div>
            <p className="font-sans text-[12px] text-[#767571]">
              Exames resolvidos e enunciados arquivados.
            </p>
          </div>
          <Link
            href={`/faculdade/${subjectId}/notebook?tab=TESTES`}
            className="w-full bg-[#111111] text-[#FCF9F2] hover:bg-[#31312c] text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors text-center block border border-[#111111]"
          >
            ABRIR TESTES &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}