'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SubjectData } from '@/types';
import { ChapterData } from './components/NotebooksSection';
import { SubjectHeader } from './components/SubjectHeader';
import { PrazosSection } from './components/PrazosSection';
import { HeroSection } from './components/HeroSection';
import { VisaoGeralSection } from './components/VisaoGeralSection';
import { NotebooksSection } from './components/NotebooksSection';
import { HorarioSection } from './components/HorarioSection';
import { AvaliacaoSection } from './components/avaliacao/AvaliacaoSection';
import { BibliotecaSection } from './components/BibliotecaSection';
import { SubjectFooter } from './components/SubjectFooter';

// Formas mínimas dos registos crus devolvidos pelo Supabase (sem tipos gerados
// para a base de dados; só os campos que esta página efetivamente lê).
interface RawSubjectRow {
  id: string | number;
  code?: string;
  name?: string;
  teacher_teorica?: string | { name?: string } | null;
  regente?: string | { name?: string } | null;
  ects?: number;
  academic_year?: string;
  degree_year?: number;
  semester?: number;
  schedules?: unknown;
  theoretical_weight?: number | null;
  practical_weight?: number | null;
  updated_at?: string | null;
}

interface RawScheduleEntry {
  id?: string | number;
  day?: string;
  dayOfWeek?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  room?: string;
  sala?: string;
  type?: string;
  tipo?: string;
}

interface RawChapterRow {
  id: string | number;
  category?: string;
  updated_at?: string;
  content?: string;
  pdf_url?: string;
  is_completed?: boolean;
}

interface RawAssessmentRow {
  id: string | number;
  due_date?: string;
  title?: string;
  category?: string;
}

function cleanSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]/g, '');
}

function formatTeacher(teacher: string | { name?: string } | null | undefined): string {
  if (!teacher) return 'N/D';
  if (typeof teacher === 'string') return teacher;
  if (typeof teacher === 'object' && teacher.name) return teacher.name;
  return 'N/D';
}

function calculateDaysRemaining(dueDateStr?: string): number {
  if (!dueDateStr) return 0;

  const cleanDateStr = dueDateStr.split('T')[0];
  const parts = cleanDateStr.split('-');

  let target: Date;
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    target = new Date(year, month - 1, day);
  } else {
    target = new Date(dueDateStr);
  }

  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export default function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const rawId = decodeURIComponent(resolvedParams.id || '');

  const [subject, setSubject] = useState<SubjectData | null>(null);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubject = useCallback(async () => {
    if (!rawId) return;

    try {
      setLoading(true);

      const { data: dbSubjects, error } = await supabase
        .from('subjects')
        .select('*');

      if (error || !dbSubjects) {
        setLoading(false);
        return;
      }

      const searchTarget = cleanSlug(rawId);

      const found = dbSubjects.find((s: RawSubjectRow) => {
        const sId = cleanSlug(String(s.id || ''));
        const sCode = cleanSlug(String(s.code || ''));
        const sName = cleanSlug(String(s.name || ''));

        return (
          sId === searchTarget ||
          sCode === searchTarget ||
          sName === searchTarget ||
          (sName.length > 3 && searchTarget.includes(sName)) ||
          (searchTarget.length > 3 && sName.includes(searchTarget))
        );
      });

      if (found) {
        const subId = String(found.id);

        // 1. CARREGAR AVALIAÇÕES / PRAZOS REAIS (Tabela 'assessments')
        const { data: assessmentsData } = await supabase
          .from('assessments')
          .select('*')
          .eq('subject_id', subId);

        // 2. CARREGAR CAPÍTULOS (Tabela 'chapters')
        const { data: chaptersData } = await supabase
          .from('chapters')
          .select('*')
          .eq('subject_id', subId);

        // Parse dos Horários
        let rawSchedules = found.schedules || [];
        if (typeof rawSchedules === 'string') {
          try {
            rawSchedules = JSON.parse(rawSchedules);
          } catch {
            rawSchedules = [];
          }
        }
        if (!Array.isArray(rawSchedules)) rawSchedules = [];

        const parsedSchedules = rawSchedules.map((s: RawScheduleEntry, idx: number) => ({
          id: String(s.id || idx + 1),
          day: s.day || s.dayOfWeek || 'A definir',
          dayOfWeek: s.day || s.dayOfWeek || 'A definir',
          startTime: s.startTime || s.start_time || '00:00',
          endTime: s.endTime || s.end_time || '00:00',
          room: s.room || s.sala || 'A definir',
          type: s.type || s.tipo || 'Teórica',
        }));

        // Mapeamento dos Capítulos
        setChapters(
          (chaptersData || []).map((c: RawChapterRow) => ({
            id: String(c.id),
            tab: (c.category || 'TEORICAS').toUpperCase() as ChapterData['tab'],
            updatedAt: c.updated_at,
            hasContent: Boolean((c.content || '').replace(/<[^>]*>/g, '').trim()),
            pdfUrl: c.pdf_url,
            isCompleted: Boolean(c.is_completed),
          }))
        );

        // Mapeamento da Disciplina + Avaliações filtradas como Prazos
        setSubject({
          id: subId,
          name: found.name || 'Sem Nome',
          code: found.code || '---',
          teacherTeorica: formatTeacher(found.teacher_teorica || found.regente),
          ects: found.ects || 6,
          academicYear: found.academic_year || '2025/2026',
          degreeYear: found.degree_year || 1,
          semester: found.semester || 1,
          evaluation: {
            teoricaWeight: found.theoretical_weight ?? 50,
            praticaWeight: found.practical_weight ?? 50,
            requiresAttendance: false,
          },
          updatedAt: found.updated_at ?? null,
          schedules: parsedSchedules,
          deadlines: (assessmentsData || [])
            .filter((a: RawAssessmentRow) => a.due_date)
            .map((a: RawAssessmentRow) => {
              const daysLeft = calculateDaysRemaining(a.due_date);
              return {
                id: String(a.id),
                title: a.title || 'AVALIAÇÃO',
                date: a.due_date ?? '',
                daysRemaining: daysLeft,
                location: `AVALIAÇÃO ${a.category || 'GERAL'}`,
                isCritical: daysLeft >= 0 && daysLeft <= 7,
              };
            }),
        });
      }
    } catch (err) {
      console.error('Erro ao carregar disciplina:', err);
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubject();
  }, [fetchSubject]);

  return (
    <div className="min-h-screen bg-[#FCF9F2] text-[#111111] font-sans selection:bg-[#111111] selection:text-[#FCF9F2]">
      <SubjectHeader subject={subject} />

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-16">
        {/* SECÇÃO 01: VISÃO GERAL (PRAZOS NO TOPO + HERO) */}
        <div id="visao-geral" className="space-y-8 scroll-mt-24">
          <PrazosSection deadlines={subject?.deadlines} />
          <HeroSection subject={subject} loading={loading} />
          <VisaoGeralSection subject={subject} />
        </div>

        {/* SECÇÃO 02: NOTEBOOKS */}
        <div id="notebooks" className="scroll-mt-24">
          <NotebooksSection chapters={chapters} subjectId={subject?.id} />
        </div>

        {/* SECÇÃO 03: HORÁRIO */}
        <div id="horario" className="scroll-mt-24">
          <HorarioSection
            subjectId={subject?.id}
            schedules={subject?.schedules}
            onRefresh={fetchSubject}
          />
        </div>

        {/* SECÇÃO 04: BIBLIOTECA */}
        <div id="biblioteca" className="scroll-mt-24">
          <BibliotecaSection />
        </div>

        {/* SECÇÃO 05: AVALIAÇÃO */}
        <div className="scroll-mt-24">
          <AvaliacaoSection
            subjectId={subject?.id}
            onRefresh={fetchSubject}
          />
        </div>

        <SubjectFooter subjectName={subject?.name} />
      </main>
    </div>
  );
}