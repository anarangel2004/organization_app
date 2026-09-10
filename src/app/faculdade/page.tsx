'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { HeaderSection } from './components/HeaderSection';
import { SubjectCard, type Subject } from './components/SubjectCard'; // <-- Chaves { } adicionadas
import { AddSubjectForm } from './components/AddSubjectForm';
import { FooterSection } from './components/FooterSection';

export default function FaculdadePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('subjects').select('*');
      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.error('Erro ao carregar disciplinas:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF9F2] text-[#111111] font-sans selection:bg-[#111111] selection:text-[#FCF9F2] flex flex-col justify-between">
      <main className="max-w-7xl mx-auto px-6 pt-10 pb-12 space-y-12 w-full flex-1">
        {/* CABEÇALHO & ESTATÍSTICAS */}
        <HeaderSection totalSubjects={subjects.length} />

        <hr className="border-[#D8D5CC]" />

        {/* LISTAGEM DE DISCIPLINAS */}
        <section className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-5xl sm:text-6xl font-black uppercase text-[#111111] tracking-tight">
              DISCIPLINAS.
            </h2>
            <div className="font-mono text-[10px] tracking-widest text-[#767571] uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#111111] inline-block"></span>
              {subjects.length} DE {subjects.length} · ORDENADO POR PRÓXIMA AULA
            </div>
          </div>

          {loading ? (
            <div className="py-12 font-mono text-center text-xs tracking-widest uppercase text-[#767571]">
              A CARREGAR CATÁLOGO CURRICULAR...
            </div>
          ) : (
            <div className="border-b border-[#D8D5CC]">
              {subjects.map((sub, idx) => (
                <SubjectCard key={sub.id} subject={sub} index={idx} />
              ))}
            </div>
          )}

          {/* FORMULÁRIO */}
          <AddSubjectForm onSubjectAdded={fetchSubjects} />
        </section>
      </main>

      {/* RODAPÉ EDITORIAL */}
      <FooterSection />
    </div>
  );
}