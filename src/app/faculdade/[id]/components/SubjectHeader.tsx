'use client';

import { useState, useEffect } from 'react';

export interface SubjectData {
  id?: string;
  code: string;
  name?: string;
  ects?: number;
  semester?: number;
  degree_year?: number;
  academic_year?: string;
  regente?: { name: string; email?: string } | null;
}

interface SubjectHeaderProps {
  subject?: SubjectData | null;
}

const NAV_ITEMS = [
  { id: 'visao-geral', label: '01 VISÃO GERAL' },
  { id: 'notebooks', label: '02 NOTEBOOKS' },
  { id: 'horario', label: '03 HORÁRIO' },
  { id: 'biblioteca', label: '04 BIBLIOTECA' },
];

export function SubjectHeader({ subject }: SubjectHeaderProps) {
  const [activeSection, setActiveSection] = useState<string>('visao-geral');

  useEffect(() => {
    const updateActiveSection = () => {
      const OFFSET = 220;
      let current = NAV_ITEMS[0].id;

      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= OFFSET) {
            current = item.id;
          }
        }
      }

      setActiveSection(current);
    };

    window.addEventListener('scroll', updateActiveSection, true);
    updateActiveSection();

    const interval = setInterval(updateActiveSection, 300);
    const timeout = setTimeout(() => clearInterval(interval), 3000);

    return () => {
      window.removeEventListener('scroll', updateActiveSection, true);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#FCF9F2]/95 backdrop-blur-md border-b border-[#D8D5CC]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* NOME / CÓDIGO DA CADEIRA E ANO LETIVO */}
        <div className="font-mono text-xs font-bold tracking-widest text-[#111111] uppercase flex items-center gap-2">
          <span>FACULDADE</span>
          <span className="text-[#767571] font-normal">//</span>
          <span className="bg-[#111111] text-[#FCF9F2] px-2 py-0.5 rounded-sm">
            {subject?.code || '---'}
          </span>
          {subject?.academic_year && (
            <>
              <span className="text-[#767571] font-normal">//</span>
              <span className="text-[#767571] font-normal">
                {subject.academic_year}
              </span>
            </>
          )}
        </div>

        {/* NAVEGAÇÃO DE SECÇÕES */}
        <nav className="hidden md:flex items-center space-x-8 font-mono text-[11px] tracking-[0.08em] uppercase">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`py-5 border-b-2 transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'border-[#111111] text-[#111111] font-bold'
                    : 'border-transparent text-[#767571] hover:text-[#111111]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* BOTÃO DE AÇÃO */}
        <div>
          <button
            onClick={() => scrollToSection('horario')}
            className="bg-[#111111] hover:bg-[#31312c] text-[#FCF9F2] font-mono text-[10px] font-bold tracking-[0.1em] px-4 py-2.5 uppercase transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <span>VER HORÁRIO</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    </header>
  );
}