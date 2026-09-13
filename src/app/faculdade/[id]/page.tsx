'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SubjectData } from '@/types/subject';
import { ChapterData } from './components/NotebooksSection';
import { SubjectHeader } from './components/SubjectHeader';
import { HeroSection } from './components/HeroSection';
import { VisaoGeralSection } from './components/VisaoGeralSection';
import { NotebooksSection } from './components/NotebooksSection';
import { HorarioSection } from './components/HorarioSection';
import { AvaliacaoSection } from './components/avaliacao/AvaliacaoSection';
import { BibliotecaPrazosSection } from './components/BibliotecaPrazosSection';
import { SubjectFooter } from './components/SubjectFooter';


function cleanSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]/g, '');
}

function formatTeacher(teacher: any): string {
  if (!teacher) return 'N/D';
  if (typeof teacher === 'string') return teacher;
  if (typeof teacher === 'object' && teacher.name) return teacher.name;
  return 'N/D';
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

  // Recarrega os dados da disciplina e capítulos sem dar reload total
  const fetchSubject = useCallback(async () => {
    if (!rawId) return;

    try {
      const { data: dbSubjects, error } = await supabase
        .from('subjects')
        .select('*');

      if (error || !dbSubjects) {
        setLoading(false);
        return;
      }

      const searchTarget = cleanSlug(rawId);

      const found = dbSubjects.find((s: any) => {
        const sId = cleanSlug(String(s.id || ''));
        const sCode = cleanSlug(String(s.code || s.codigo || ''));
        const sName = cleanSlug(String(s.name || s.nome || ''));

        return (
          sId === searchTarget ||
          sCode === searchTarget ||
          sName === searchTarget ||
          (sName.length > 3 && searchTarget.includes(sName)) ||
          (searchTarget.length > 3 && sName.includes(searchTarget))
        );
      });

      if (found) {
        let rawSchedules = found.schedules || found.horarios || found.schedule || [];

        if (typeof rawSchedules === 'string') {
          try {
            rawSchedules = JSON.parse(rawSchedules);
          } catch (e) {
            rawSchedules = [];
          }
        }

        if (!Array.isArray(rawSchedules)) rawSchedules = [];

        const parsedSchedules = rawSchedules.map((s: any, idx: number) => {
          const detectedDay =
            s.day ||
            s.dayOfWeek ||
            s.day_of_week ||
            s.dia ||
            s.dia_semana ||
            s.weekday ||
            s.day_name ||
            'A definir';

          return {
            id: String(s.id || idx + 1),
            day: detectedDay,
            dayOfWeek: detectedDay,
            startTime: s.startTime || s.start_time || s.hora_inicio || s.start || '00:00',
            endTime: s.endTime || s.end_time || s.hora_fim || s.end || '00:00',
            room: s.room || s.sala || 'A definir',
            type: s.type || s.tipo || 'Teórica',
          };
        });

        const subId = String(found.id || '').toLowerCase();
        const subCode = String(found.code || found.codigo || '').toLowerCase();

        // 1. CARREGAR DEADLINES
        const { data: deadlinesData } = await supabase.from('deadlines').select('*');
        const subjectDeadlines = (deadlinesData || []).filter((d: any) => {
          const fk = String(d.subject_id ?? d.subject ?? '').toLowerCase();
          return fk === subId || fk === subCode;
        });

        // 2. CARREGAR CAPÍTULOS DOS NOTEBOOKS
        const { data: chaptersData } = await supabase.from('chapters').select('*');
        const subjectChapters = (chaptersData || []).filter((c: any) => {
          const fk = String(c.subject_id ?? c.subject ?? '').toLowerCase();
          return fk === subId || fk === subCode;
        });

        // Dentro do fetchSubject no page.tsx:
setChapters(
  subjectChapters.map((c: any) => ({
    id: String(c.id),
    tab: (c.tab || c.type || 'TEORICAS').toUpperCase(),
    updatedAt: c.updated_at || c.updatedAt,
    hasContent: Boolean((c.content || '').replace(/<[^>]*>/g, '').trim()),
    pdfUrl: c.pdf_url || c.pdfUrl,
    isCompleted: Boolean(c.is_completed), // <-- Adicionado
  }))
);

        setSubject({
          id: String(found.id),
          name: found.name || found.nome || 'Sem Nome',
          code: found.code || found.codigo || '---',
          teacherTeorica: formatTeacher(
            found.teacher_teorica || found.teacher || found.regente
          ),
          ects: found.ects || found.creditos || 6,
          academicYear: found.academic_year || found.ano_letivo || '2025/2026',
          degreeYear: found.degree_year || found.ano || 1,
          semester: found.semester || found.semestre || 1,
          schedules: parsedSchedules,
          deadlines: subjectDeadlines.map((d: any) => ({
            id: String(d.id),
            title: d.title || d.titulo || 'Prazo',
            date: d.date || d.due_date || d.data,
            type: d.type || d.tipo,
          })),
        });
      }
    } catch (err) {
      console.error('Erro ao carregar disciplina:', err);
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchSubject();
  }, [fetchSubject]);

  return (
    <div className="min-h-screen bg-[#FCF9F2] text-[#111111] font-sans selection:bg-[#111111] selection:text-[#FCF9F2]">
      <SubjectHeader subject={subject} />

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-24">
        {/* SECÇÃO 01: VISÃO GERAL */}
        <div id="visao-geral" className="space-y-16 scroll-mt-24">
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

        {/* SECÇÃO 04: BIBLIOTECA & PRAZOS */}
        <div id="biblioteca" className="scroll-mt-24">
          <BibliotecaPrazosSection />
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