'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  color?: string;
  backHref?: string;
  categoryCode?: string; // Ex: "DOSSIÊ // DISCIPLINAS"
}

export function PageHeader({
  title,
  subtitle,
  color = '#111111',
  backHref = '/faculdade',
  categoryCode = 'REGISTO // DETALHE'
}: PageHeaderProps) {
  return (
    <div className="w-full bg-[#FBF9F5] border-b border-[#D8D5CC] pb-4 mb-8 font-mono tracking-wider">
      <div className="flex items-start sm:items-center gap-4">
        
        {/* BOTÃO VOLTAR BRUTALISTA */}
        <Link
          href={backHref}
          className="p-2.5 bg-white border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors shrink-0"
          title="RETORNAR"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* IDENTIFICAÇÃO E TÍTULO */}
        <div className="flex-1 space-y-1">
          <span className="text-[9px] text-[#767571] font-bold block uppercase tracking-widest">
            ■ {categoryCode}
          </span>
          
          <div className="flex items-center gap-2.5">
            {/* INDICADOR DE COR EM QUADRADO RECTILÍNEO */}
            <div 
              className="w-3 h-3 border border-black shrink-0" 
              style={{ backgroundColor: color }} 
            />
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#111111] uppercase tracking-tight">
              {title}
            </h1>
          </div>

          {subtitle && (
            <p className="text-[11px] text-[#767571] font-sans normal-case pt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}