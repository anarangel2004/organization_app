'use client';

import { useRouter } from 'next/navigation';

export interface ScheduleSlot {
  id?: string;
  dayOfWeek?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  type?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  teacher_teorica?: string | { name?: string; email?: string } | null;
  ects?: number;
  schedules?: ScheduleSlot[] | null;
}

interface SubjectCardProps {
  subject: Subject;
  index: number;
  onDelete?: (id: string) => void;
}

const DAY_MAP: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, 'segunda-feira': 1, seg: 1,
  terça: 2, terca: 2, 'terça-feira': 2, 'terca-feira': 2, ter: 2,
  quarta: 3, 'quarta-feira': 3, qua: 3,
  quinta: 4, 'quinta-feira': 4, qui: 4,
  sexta: 5, 'sexta-feira': 5, sex: 5,
  sábado: 6, sabado: 6, sab: 6,
};

const getTeacherName = (teacher: string | { name?: string | null } | null | undefined): string => {
  if (!teacher) return 'NÃO ATRIBUÍDO';

  if (typeof teacher === 'string') {
    const trimmed = teacher.trim();
    return trimmed.length > 0 ? trimmed : 'NÃO ATRIBUÍDO';
  }

  if (typeof teacher === 'object' && teacher.name) {
    const trimmed = String(teacher.name).trim();
    return trimmed.length > 0 ? trimmed : 'NÃO ATRIBUÍDO';
  }

  return 'NÃO ATRIBUÍDO';
};

const getDayNumber = (dayStr?: string): number => {
  if (!dayStr) return -1;
  const clean = dayStr.toLowerCase().trim();
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (clean.includes(key)) return val;
  }
  return -1;
};

const getNextClassInfo = (schedules?: ScheduleSlot[] | null) => {
  if (!schedules || schedules.length === 0) {
    return {
      timeText: 'SEM AULAS AGENDADAS',
      locationText: 'HORÁRIO NÃO DEFINIDO',
    };
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMinutes = (timeStr?: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const calculatedSlots = schedules
    .map((slot) => {
      const dayStr = slot.dayOfWeek || slot.day || '';
      const dayNum = getDayNumber(dayStr);
      if (dayNum === -1) return null;

      const startMin = parseMinutes(slot.startTime);
      const endMin = parseMinutes(slot.endTime) || startMin + 120;

      let daysUntil = dayNum - currentDay;

      if (daysUntil < 0) {
        daysUntil += 7;
      } else if (daysUntil === 0) {
        if (currentMinutes >= endMin) {
          daysUntil = 7;
        }
      }

      return { slot, daysUntil, startMin };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (calculatedSlots.length === 0) {
    const slot = schedules[0];
    return {
      timeText: `${(slot.dayOfWeek || slot.day || '').toUpperCase()} · ${slot.startTime || ''}–${slot.endTime || ''}`,
      locationText: `${(slot.room || 'SALA A DEFINIR').toUpperCase()} · ${(slot.type || 'TEÓRICA').toUpperCase()}`,
    };
  }

  calculatedSlots.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return a.startMin - b.startMin;
  });

  const { slot, daysUntil } = calculatedSlots[0];
  const timeRange = slot.startTime && slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime || '';

  let dayLabel = '';
  if (daysUntil === 0) {
    dayLabel = 'HOJE';
  } else if (daysUntil === 1) {
    dayLabel = 'AMANHÃ';
  } else {
    dayLabel = (slot.dayOfWeek || slot.day || '').toUpperCase().replace('-FEIRA', '');
  }

  const room = (slot.room || 'SALA A DEFINIR').toUpperCase();
  const type = (slot.type || 'TEÓRICA').toUpperCase();

  return {
    timeText: `PRÓXIMA · ${dayLabel} ${timeRange}`,
    locationText: `${room} · ${type}`,
  };
};

export function SubjectCard({ subject, index }: SubjectCardProps) {
  const router = useRouter();
  const subNumber = String(index + 1).padStart(2, '0');

  const handleCardClick = () => {
    router.push(`/faculdade/${subject.id}`);
  };

  const handleNotebookClick = (e: React.MouseEvent, tab: 'TEORICAS' | 'PRATICAS' | 'TESTES') => {
    e.stopPropagation();
    router.push(`/faculdade/${subject.id}/notebook?tab=${tab}`);
  };

  const teacherDisplay = getTeacherName(subject.teacher_teorica);
  const nextClass = getNextClassInfo(subject.schedules);

  return (
    <div
      onClick={handleCardClick}
      className="border-t border-[#D8D5CC] py-5 transition-colors cursor-pointer hover:bg-[#F5F1E8]/60 px-2 -mx-2 group"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* NÚMERO E NOME DA DISCIPLINA */}
        <div className="lg:col-span-6 flex items-start gap-3">
          <span className="font-mono text-sm sm:text-base font-normal text-[#111111] leading-none pt-1 min-w-[28px]">
            {subNumber}
          </span>

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase">
              <span className="border border-[#D8D5CC] bg-[#FCF9F2] px-1.5 py-0.5 font-bold text-[#111111]">
                {subject.code || 'SSC'}
              </span>
              <span className="text-[#767571]">
                REF: CS-402 // {String(subject.ects || 6).padStart(2, '0')} ECTS
              </span>
            </div>

            <h3 className="font-display font-bold text-2xl sm:text-3xl text-[#111111] uppercase leading-tight tracking-normal group-hover:underline">
              {subject.name}
            </h3>

            <p className="font-mono text-[10px] tracking-wider text-[#767571] uppercase font-bold">
              {teacherDisplay}
            </p>
          </div>
        </div>

        {/* DESTAQUE TEMPORAL DINÂMICO */}
        <div className="lg:col-span-3 font-mono text-[10px] tracking-wider uppercase space-y-1">
          <div className="text-[#767571] font-bold flex items-center gap-1.5 text-[9px]">
            <span className="w-2 h-2 bg-[#111111] inline-block"></span>
            DESTAQUE TEMPORAL
          </div>
          <div className="text-[#111111] font-bold tracking-widest">
            {nextClass.timeText}
          </div>
          <div className="text-[#767571] text-[9px]">
            {nextClass.locationText}
          </div>
        </div>

        {/* CADERNOS DA DISCIPLINA (TEÓRICAS, PRÁTICAS, EXAMES) */}
        <div className="lg:col-span-3 flex justify-end items-center">
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Caderno Teóricas */}
            <button
              type="button"
              title="Caderno de Teóricas"
              onClick={(e) => handleNotebookClick(e, 'TEORICAS')}
              className="h-7 px-2.5 border border-[#D8D5CC] bg-[#FCF9F2] flex items-center gap-1.5 text-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors font-mono text-[9px] font-bold uppercase tracking-wider"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>TEÓRICAS</span>
            </button>

            {/* Caderno Práticas */}
            <button
              type="button"
              title="Caderno de Práticas"
              onClick={(e) => handleNotebookClick(e, 'PRATICAS')}
              className="h-7 px-2.5 border border-[#D8D5CC] bg-[#FCF9F2] flex items-center gap-1.5 text-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors font-mono text-[9px] font-bold uppercase tracking-wider"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>PRÁTICAS</span>
            </button>

            {/* Caderno Exames */}
            <button
              type="button"
              title="Caderno de Testes e Exames"
              onClick={(e) => handleNotebookClick(e, 'TESTES')}
              className="h-7 px-2.5 border border-[#D8D5CC] bg-[#FCF9F2] flex items-center gap-1.5 text-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors font-mono text-[9px] font-bold uppercase tracking-wider"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>EXAMES</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubjectCard;