'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, GraduationCap, Search, Layers, Loader2 } from 'lucide-react';
import { Subject } from './types';
import { SubjectCard } from './components/SubjectCard';
import { AddSubjectModal } from './components/AddSubjectModal';
import { LibraryModal } from './components/LibraryModal';
import { supabase } from '@/lib/supabase'; // Ajusta o caminho se necessário

export default function FaculdadePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado para controlar a visibilidade do modal da Biblioteca e a disciplina selecionada
  const [selectedLibrarySubject, setSelectedLibrarySubject] = useState<Subject | null>(null);

  // 1. CARREGAR DISCIPLINAS DO SUPABASE
  const fetchSubjects = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('subjects').select('*');

    if (error) {
      console.error('Erro ao carregar disciplinas:', error.message);
    } else if (data) {
      // Mapear snake_case do Supabase para camelCase da app
      const formattedSubjects: Subject[] = data.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        color: item.color,
        teacherTeorica: item.teacher_teorica,
        teacherPratica: item.teacher_pratica,
        evaluation: item.evaluation,
        schedules: item.schedules,
        filesCount: item.files_count,
        nextEvaluation: item.next_evaluation,
      }));
      setSubjects(formattedSubjects);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // 2. GUARDAR NOVA DISCIPLINA NO SUPABASE
  const handleAddSubject = async (newSubject: Subject) => {
    const { error } = await supabase.from('subjects').insert([
      {
        id: newSubject.id || newSubject.name.toLowerCase().replace(/\s+/g, '-'),
        name: newSubject.name,
        code: newSubject.code,
        color: newSubject.color,
        teacher_teorica: newSubject.teacherTeorica,
        teacher_pratica: newSubject.teacherPratica,
        evaluation: newSubject.evaluation,
        schedules: newSubject.schedules,
        files_count: newSubject.filesCount || 0,
        next_evaluation: newSubject.nextEvaluation,
      },
    ]);

    if (error) {
      console.error('Erro ao guardar disciplina:', error.message);
      alert('Erro ao guardar disciplina no banco de dados!');
      return;
    }

    // Atualiza a lista no ecrã após guardar com sucesso
    fetchSubjects();
  };

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-slate-900 font-sans p-4 md:p-8 space-y-8 selection:bg-amber-200">
      {/* 1. NAVEGAÇÃO SUPERIOR */}
      <header className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-300/70 pb-4">
          <div className="flex items-center gap-6">
            <span className="font-serif text-lg font-bold tracking-tight text-slate-900">
              Atelier Agenda
            </span>
            <nav className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <Link href="/" className="hover:text-slate-900 pb-0.5 transition-colors">
                Visão Geral
              </Link>
              <Link href="/trabalho" className="hover:text-slate-900 pb-0.5 transition-colors">
                Trabalho
              </Link>
              <Link
                href="/faculdade"
                className="text-slate-900 font-semibold border-b-2 border-slate-900 pb-0.5 transition-colors"
              >
                Faculdade
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar disciplina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400 w-48 lg:w-60"
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 hover:bg-black text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Disciplina
            </button>
          </div>
        </div>
      </header>

      {/* 2. CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">
            <GraduationCap className="w-4 h-4 text-amber-700" /> Vida Académica
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight">
            Faculdade & Notebooks
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Gestão completa das tuas disciplinas, horários, professores e acesso direto aos cadernos dedicados.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="bg-white border border-slate-200/90 p-3 px-4 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Disciplinas Ativas
            </span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {subjects.length}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 p-3 px-4 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Cadernos Ativos
            </span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {subjects.length * 3}
            </span>
          </div>
        </div>
      </div>

      {/* 3. GRELHA DE DISCIPLINAS */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" /> As Minhas Disciplinas
          </h2>
          <span className="text-xs text-slate-400">
            {filteredSubjects.length} de {subjects.length} apresentadas
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-medium">A carregar disciplinas...</span>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500 text-xs">
            Nenhuma disciplina encontrada. Clica em <strong>"Nova Disciplina"</strong> para adicionar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onOpenLibrary={(sub) => setSelectedLibrarySubject(sub)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. MODAL PARA ADICIONAR DISCIPLINA */}
      <AddSubjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddSubject={handleAddSubject}
      />

      {/* 5. MODAL DA BIBLIOTECA DE DOCUMENTOS */}
      
      <LibraryModal
        isOpen={!!selectedLibrarySubject}
        subject={selectedLibrarySubject}
        onClose={() => setSelectedLibrarySubject(null)}
        onFilesUpdated={fetchSubjects}
      />
    </div>
  );
}