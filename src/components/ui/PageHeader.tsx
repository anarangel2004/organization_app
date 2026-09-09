// src/components/ui/PageHeader.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  color?: string;
  backHref?: string;
}

export function PageHeader({ title, subtitle, color = '#3b82f6', backHref = '/faculdade' }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Link
        href={backHref}
        className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>
      <div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}