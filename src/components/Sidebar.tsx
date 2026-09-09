'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  GraduationCap, 
  Briefcase, 
  CheckSquare, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils'; // ou concatenação simples de classes

const navItems = [
  { name: 'Dashboard Central', href: '/', icon: LayoutDashboard },
  { name: 'Cibersegurança (Mestrado)', href: '/faculdade', icon: GraduationCap },
  { name: 'Projetos SAP', href: '/trabalho', icon: Briefcase },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 min-h-screen sticky top-0">
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100 tracking-wide">Organiza.me</h1>
            <p className="text-xs text-slate-400">Cibersegurança & SAP</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl mt-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
            <Sparkles className="w-4 h-4" /> PWA Ativa
          </div>
          <p className="text-xs text-slate-400">Modo offline e acesso instantâneo ativado.</p>
        </div>
      </aside>

      {/* Navigation Bar Mobile (Fixa no Rodapé para PWA) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 px-6 py-2">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}