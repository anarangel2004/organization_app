'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { getAllMirror } from '@/lib/offline/db';
import { isNetworkError } from '@/lib/offline/sync';

export type ClassType = 'TEÓRICA' | 'PRÁTICA' | 'AVALIAÇÃO' | 'GERAL';

interface AgendaItem {
  id: string;
  day: 'SEGUNDA' | 'TERÇA' | 'QUARTA' | 'QUINTA' | 'SEXTA';
  tag: string;
  time: string;
  title: string;
  classType: ClassType;
  location: string;
  room?: string;
  isImportant?: boolean;
  startMin: number;
}

const DAYS = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA'] as const;
type Day = (typeof DAYS)[number];

const FILTERS = ['TODOS', 'TEÓRICAS', 'PRÁTICAS', 'TESTES & PRAZOS'] as const;
type Filter = (typeof FILTERS)[number];

const DAY_NAME_MAP: Record<string, Day> = {
  'SEGUNDA-FEIRA': 'SEGUNDA', SEGUNDA: 'SEGUNDA', SEG: 'SEGUNDA',
  'TERÇA-FEIRA': 'TERÇA', 'TERCA-FEIRA': 'TERÇA', TERÇA: 'TERÇA', TERCA: 'TERÇA', TER: 'TERÇA',
  'QUARTA-FEIRA': 'QUARTA', QUARTA: 'QUARTA', QUA: 'QUARTA',
  'QUINTA-FEIRA': 'QUINTA', QUINTA: 'QUINTA', QUI: 'QUINTA',
  'SEXTA-FEIRA': 'SEXTA', SEXTA: 'SEXTA', SEX: 'SEXTA',
};

// getDay() do JS: 0 = domingo ... 6 = sábado
const JS_WEEKDAY_TO_DAY: Record<number, Day> = {
  1: 'SEGUNDA', 2: 'TERÇA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA',
};

function normalizeDay(raw: unknown): Day | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return JS_WEEKDAY_TO_DAY[raw] ?? null;
  const clean = String(raw).trim().toUpperCase();
  if (DAY_NAME_MAP[clean]) return DAY_NAME_MAP[clean];
  const numeric = Number(clean);
  if (!Number.isNaN(numeric)) return JS_WEEKDAY_TO_DAY[numeric] ?? null;
  return null;
}

function parseMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function classifyScheduleType(type?: string | null): ClassType {
  const clean = (type || '').toUpperCase();
  if (clean.includes('PRÁT') || clean.includes('PRAT')) return 'PRÁTICA';
  if (clean.includes('TEÓR') || clean.includes('TEOR')) return 'TEÓRICA';
  return 'GERAL';
}

// Segunda-feira (00h00) → Sexta-feira (23h59) da semana atual
function getWeekRange(reference: Date): { start: Date; end: Date } {
  const date = new Date(reference);
  const weekday = date.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { start: monday, end: friday };
}

function parseDueDate(dueDateStr: string | null): Date | null {
  if (!dueDateStr) return null;
  const cleanDateStr = dueDateStr.split('T')[0];
  const [year, month, day] = cleanDateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

interface SubjectRow {
  id: string;
  name: string | null;
  code: string | null;
  schedules: unknown;
}

interface AssessmentRow {
  id: string;
  subject_id: string;
  title: string | null;
  category: string | null;
  due_date: string | null;
}

export function ScheduleSection() {
  const [activeFilter, setActiveFilter] = useState<Filter>('TODOS');
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayLabel = useMemo(() => {
    const jsDay = new Date().getDay();
    return JS_WEEKDAY_TO_DAY[jsDay] ?? null;
  }, []);

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let subjectRows: SubjectRow[];
      let assessmentRows: AssessmentRow[];
      try {
        const supabase = createClient();
        const [{ data: subjects, error: subjectsError }, { data: assessments, error: assessmentsError }] =
          await Promise.all([
            supabase.from('subjects').select('id, name, code, schedules'),
            supabase.from('assessments').select('id, subject_id, title, category, due_date'),
          ]);

        if (subjectsError) throw subjectsError;
        if (assessmentsError) throw assessmentsError;

        subjectRows = (subjects || []) as SubjectRow[];
        assessmentRows = (assessments || []) as AssessmentRow[];
      } catch (fetchErr) {
        if (!isNetworkError(fetchErr)) throw fetchErr;
        // Sem rede: usa o que já estiver em cache (ficou lá ao abrir /faculdade
        // ou a página de uma disciplina anteriormente com ligação).
        subjectRows = await getAllMirror<SubjectRow>('subjects');
        assessmentRows = await getAllMirror<AssessmentRow>('assessments');
      }
      const subjectById = new Map(subjectRows.map((s) => [s.id, s]));

      const classItems: AgendaItem[] = [];
      subjectRows.forEach((subject) => {
        let rawSchedules = subject.schedules;
        if (typeof rawSchedules === 'string') {
          try {
            rawSchedules = JSON.parse(rawSchedules);
          } catch {
            rawSchedules = [];
          }
        }
        if (!Array.isArray(rawSchedules)) return;

        rawSchedules.forEach((slot: Record<string, unknown>, idx: number) => {
          const day = normalizeDay((slot.day as string) ?? (slot.dayOfWeek as string));
          if (!day) return;

          const startTime = (slot.startTime as string) || (slot.start_time as string) || '00:00';
          const endTime = (slot.endTime as string) || (slot.end_time as string) || '00:00';
          const classType = classifyScheduleType((slot.type as string) || (slot.tipo as string));

          classItems.push({
            id: `${subject.id}-${idx}`,
            day,
            tag: subject.code || 'AULA',
            time: `${startTime} - ${endTime}`,
            title: subject.name || 'Disciplina',
            classType,
            location: (slot.room as string) || 'SALA A DEFINIR',
            room: (slot.room as string) || undefined,
            startMin: parseMinutes(startTime),
          });
        });
      });

      const { start: weekStart, end: weekEnd } = getWeekRange(new Date());

      const deadlineItems: AgendaItem[] = assessmentRows
        .map((a): AgendaItem | null => {
          const due = parseDueDate(a.due_date);
          if (!due || due < weekStart || due > weekEnd) return null;
          const day = JS_WEEKDAY_TO_DAY[due.getDay()];
          if (!day) return null;

          const daysRemaining = Math.round((due.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
          const subject = subjectById.get(a.subject_id);

          return {
            id: `assessment-${a.id}`,
            day,
            tag: subject?.code || 'AVALIAÇÃO',
            time: 'ENTREGA',
            title: a.title || 'Avaliação',
            classType: 'AVALIAÇÃO' as ClassType,
            location: `AVALIAÇÃO ${a.category || 'GERAL'}`,
            isImportant: daysRemaining >= 0 && daysRemaining <= 7,
            startMin: 24 * 60,
          };
        })
        .filter((item): item is AgendaItem => item !== null);

      setItems([...classItems, ...deadlineItems]);
    } catch (err) {
      console.error('Erro ao carregar horário & agenda:', err);
      setErrorMessage('Não foi possível carregar o horário. Tenta atualizar a página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- correr apenas uma vez ao montar
  }, []);

  const visibleItems = items.filter((item) => {
    if (activeFilter === 'TODOS') return true;
    if (activeFilter === 'TEÓRICAS') return item.classType === 'TEÓRICA';
    if (activeFilter === 'PRÁTICAS') return item.classType === 'PRÁTICA';
    return item.classType === 'AVALIAÇÃO';
  });

  const totalClasses = items.filter((i) => i.classType === 'TEÓRICA' || i.classType === 'PRÁTICA').length;
  const totalTests = items.filter((i) => i.classType === 'AVALIAÇÃO').length;
  const totalMinutes = items
    .filter((i) => i.classType === 'TEÓRICA' || i.classType === 'PRÁTICA')
    .reduce((sum, i) => {
      const [, endStr] = i.time.split(' - ');
      return sum + Math.max(0, parseMinutes(endStr) - i.startMin);
    }, 0);
  const totalHoursLabel = `${Math.floor(totalMinutes / 60)}H${String(totalMinutes % 60).padStart(2, '0')}`;

  return (
    <section className="space-y-6 font-mono text-black">
      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#D8D5CC] pb-4">
        <div>
          <span className="text-[10px] tracking-[0.12em] text-[#767571] uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-black inline-block"></span>
            SECÇÃO 01 // MAPA SEMANAL &amp; AGENDA INTEGRADA
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mt-1">
            HORÁRIO &amp; AGENDA INTEGRADA // DISCIPLINAS, TESTES E PRAZOS
          </h2>
        </div>

        {/* METRICS */}
        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
          <div className="border border-black px-3 py-1 bg-white">{totalHoursLabel} TOTAL</div>
          <div className="border border-black px-3 py-1 bg-white">{totalClasses} AULAS</div>
          <div className="border border-black px-3 py-1 bg-black text-white">
            {totalTests} {totalTests === 1 ? 'TESTE AGENDADO' : 'TESTES AGENDADOS'}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">{errorMessage}</div>
      )}

      {/* FILTROS E LEGENDA DE TIPOS DE AULA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#767571] font-bold">FILTROS:</span>
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-2.5 py-1 border border-black transition-colors ${
                activeFilter === filter ? 'bg-black text-white font-bold' : 'bg-white hover:bg-neutral-100'
              }`}
            >
              {filter}
              {activeFilter === filter ? ' [ATIVO]' : ''}
            </button>
          ))}
        </div>

        {/* LEGENDA VISUAL */}
        <div className="flex items-center gap-3 text-[9px] uppercase font-bold">
          <span className="flex items-center gap-1.5 border border-black px-1.5 py-0.5 bg-white text-black">
            <span className="w-1.5 h-1.5 border border-black inline-block"></span> [T] TEÓRICA
          </span>
          <span className="flex items-center gap-1.5 bg-black text-white px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 bg-white inline-block"></span> [P] PRÁTICA
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs tracking-widest uppercase text-[#767571]">
          A CARREGAR AGENDA...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {DAYS.map((day) => {
            const dayItems = visibleItems
              .filter((item) => item.day === day)
              .sort((a, b) => a.startMin - b.startMin);
            const isToday = day === todayLabel;

            return (
              <div key={day} className="space-y-3">
                {/* CABEÇALHO DO DIA */}
                <div className={`flex items-center justify-between p-2 border border-black text-[10px] font-bold ${
                  isToday ? 'bg-black text-white' : 'bg-[#F5F1E8]'
                }`}>
                  <span>{day}</span>
                  {isToday && <span className="bg-white text-black px-1 text-[8px]">HOJE</span>}
                </div>

                {/* CARTÕES DAS AULAS */}
                <div className="space-y-2">
                  {dayItems.length === 0 && (
                    <div className="p-3 border border-dashed border-[#D8D5CC] text-[9px] text-[#9C9A91] uppercase text-center">
                      Sem registos
                    </div>
                  )}
                  {dayItems.map((item) => {
                    const isTeorica = item.classType === 'TEÓRICA';
                    const isPratica = item.classType === 'PRÁTICA';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 border text-[9px] uppercase space-y-2.5 transition-all ${
                          item.isImportant
                            ? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)]'
                            : isPratica
                            ? 'bg-[#F4F1EA] text-black border-black border-l-4 border-l-black'
                            : 'bg-white text-black border-[#D8D5CC] hover:border-black'
                        }`}
                      >
                        {/* HEADER DO CARTÃO: TAG + HORÁRIO */}
                        <div className="flex justify-between items-center text-[8px] font-bold border-b pb-1.5 border-current opacity-90">
                          <span>{item.tag}</span>
                          <span>{item.time}</span>
                        </div>

                        {/* TÍTULO */}
                        <div className="pt-0.5">
                          <h4 className="font-extrabold text-[11px] leading-snug">{item.title}</h4>
                        </div>

                        {/* RODAPÉ DO CARTÃO: TIPO (T/P) + SALA */}
                        <div className="flex justify-between items-center text-[8px] pt-1.5 border-t border-current">
                          {isTeorica && (
                            <span className="border border-black px-1.5 py-0.2 bg-white text-black font-extrabold">
                              [T] TEÓRICA
                            </span>
                          )}
                          {isPratica && (
                            <span className="bg-black text-white px-1.5 py-0.2 font-extrabold">
                              [P] PRÁTICA
                            </span>
                          )}
                          {!isTeorica && !isPratica && (
                            <span className="opacity-75">{item.room || item.location}</span>
                          )}

                          <span className="font-bold tracking-wider">{item.location}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
