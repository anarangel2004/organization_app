'use client';

import { ClassSchedule } from '@/types/subject';

interface HorarioSectionProps {
  schedules?: ClassSchedule[];
}

const DAY_FULL_NAMES: Record<number, string> = {
  1: 'SEGUNDA-FEIRA',
  2: 'TERÇA-FEIRA',
  3: 'QUARTA-FEIRA',
  4: 'QUINTA-FEIRA',
  5: 'SEXTA-FEIRA',
  6: 'SÁBADO',
  7: 'DOMINGO',
};

function normalizeDayNumber(day: any): number {
  if (typeof day === 'number' && !isNaN(day)) return day;
  const str = String(day || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (str.includes('seg') || str === '1') return 1;
  if (str.includes('ter') || str === '2') return 2;
  if (str.includes('qua') || str === '3') return 3;
  if (str.includes('qui') || str === '4') return 4;
  if (str.includes('sex') || str === '5') return 5;
  if (str.includes('sab') || str === '6') return 6;
  if (str.includes('dom') || str === '7' || str === '0') return 7;

  return 1;
}

export function HorarioSection({ schedules = [] }: HorarioSectionProps) {
  const now = new Date();
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

  const sortedSchedules = [...schedules].sort((a, b) => {
    const dayA = normalizeDayNumber(a.dayOfWeek);
    const dayB = normalizeDayNumber(b.dayOfWeek);
    if (dayA === dayB) {
      return (a.startTime || '').localeCompare(b.startTime || '');
    }
    return dayA - dayB;
  });

  return (
    <section className="space-y-6 pt-12">
      <div className="border-b border-[#D8D5CC] pb-4 space-y-2">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase block">
          SECÇÃO 03 // CALENDÁRIO SEMANAL
        </span>
        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
          HORÁRIO & SESSÕES.
        </h2>
        <p className="font-sans text-[13px] text-[#767571]">
          Aulas presenciais e horas de estudo associadas a esta disciplina.
        </p>
      </div>

      <div className="border-t border-[#111111]">
        {sortedSchedules.length > 0 ? (
          sortedSchedules.map((s, index) => {
            const dayNum = normalizeDayNumber(s.dayOfWeek);
            const isToday = dayNum === currentDayOfWeek;
            const dayName = DAY_FULL_NAMES[dayNum] || `DIA ${dayNum}`;
            const typeLabel = s.type ? ` (${s.type})` : '';
            const sessionNum = String(index + 1).padStart(2, '0');

            return (
              <div
                key={s.id || index}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-[#D8D5CC] gap-2"
              >
                <div className="font-mono text-[11px] tracking-[0.05em] text-[#111111] uppercase font-bold flex flex-wrap items-center gap-2 sm:gap-4">
                  <span>{sessionNum}</span>
                  <span>{dayName}{typeLabel}</span>
                  <span className="text-[#767571] font-normal">
                    · {s.startTime}–{s.endTime}
                  </span>
                  <span className="text-[#767571] font-normal hidden md:inline">
                    · {s.room || 'SALA N/D'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[#767571] font-mono text-[10px] md:hidden">
                    {s.room || 'SALA N/D'}
                  </span>
                  {isToday ? (
                    <span className="bg-[#111111] text-[#FCF9F2] font-mono text-[9px] font-bold px-2.5 py-1 uppercase">
                      HOJE
                    </span>
                  ) : (
                    <span className="border border-[#111111] text-[#111111] font-mono text-[9px] font-bold px-2.5 py-1 uppercase">
                      SEMANAL
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 font-mono text-[10px] text-[#767571] uppercase">
            NENHUMA SESSÃO DE AULA AGENDADA PARA ESTA DISCIPLINA
          </div>
        )}
      </div>
    </section>
  );
}