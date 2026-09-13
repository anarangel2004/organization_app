'use client';

import { useState } from 'react';
import { SubjectData, ClassSchedule, Deadline } from '@/types';

interface HeroSectionProps {
  subject: SubjectData | null;
  loading: boolean;
  deadlines?: Deadline[];
}

const DEFAULT_DEADLINES: Deadline[] = [
  {
    id: '1',
    title: 'ENTREGA DO PROJETO PRÁTICO N1',
    date: '2026-09-25',
    daysRemaining: 12,
    location: 'SUBMISSÃO VIA PORTAL ACADÉMICO',
    isCritical: true,
  },
  {
    id: '2',
    title: 'TESTE TEÓRICO INTERMÉDIO',
    date: '2026-10-11',
    daysRemaining: 28,
    isCritical: false,
  },
  {
    id: '3',
    title: 'DEFESA ORAL DO LABORATÓRIO',
    date: '2026-10-28',
    daysRemaining: 45,
    isCritical: false,
  },
];

const DAY_NAMES = ['', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

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

function getNextClass(schedules: ClassSchedule[] = []): string {
  if (!schedules || schedules.length === 0) return 'SEM AULAS AGENDADAS';

  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const mapped = schedules.map((s) => {
    const dayNum = normalizeDayNumber(s.dayOfWeek);
    let daysDiff = (dayNum - currentDay + 7) % 7;
    
    if (daysDiff === 0 && s.startTime <= currentTime) {
      daysDiff = 7;
    }
    return { ...s, dayNum, daysDiff };
  });

  mapped.sort((a, b) => (a.daysDiff === b.daysDiff ? a.startTime.localeCompare(b.startTime) : a.daysDiff - b.daysDiff));

  const next = mapped[0];
  if (!next) return 'SEM AULAS AGENDADAS';

  const isToday = next.daysDiff === 0;
  const dayLabel = isToday ? 'HOJE' : DAY_NAMES[next.dayNum] || `DIA ${next.dayNum}`;

  return `PRÓXIMA AULA [${next.type || 'TP'}] · ${dayLabel} ${next.startTime}–${next.endTime} · ${next.room}`;
}

export function HeroSection({ subject, loading, deadlines }: HeroSectionProps) {
  const [note, setNote] = useState<string>('');
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);

  const activeDeadlines = deadlines && deadlines.length > 0 ? deadlines : DEFAULT_DEADLINES;
  const criticalDeadline = activeDeadlines.find((d) => d.isCritical) || activeDeadlines[0];
  const secondaryDeadlines = activeDeadlines.filter((d) => d.id !== criticalDeadline?.id);

  const nextClassText = subject ? getNextClass(subject.schedules) : 'CARREGANDO...';

  return (
    <div className="space-y-6">
      {/* BLOCO SUPERIOR DE PRAZOS */}
      <div className="space-y-3">
        {/* BANNER DE PRAZO CRÍTICO */}
        {criticalDeadline && (
          <div className="bg-[#111111] text-[#FCF9F2] p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-[#111111]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono text-[9px] tracking-[0.12em] text-[#D8D5CC] uppercase">
                  PRAZO CRÍTICO
                </span>
              </div>
              <h3 className="font-display text-2xl sm:text-4xl uppercase tracking-tight">
                {criticalDeadline.title}
              </h3>
            </div>

            <div className="text-left md:text-right font-mono shrink-0">
              <span className="text-2xl sm:text-3xl font-bold block">
                {criticalDeadline.daysRemaining ?? 0} DIAS RESTANTES
              </span>
              {criticalDeadline.location && (
                <span className="text-[10px] text-[#D8D5CC] uppercase block mt-0.5">
                  {criticalDeadline.location}
                </span>
              )}
            </div>
          </div>
        )}

        {/* PRAZOS FUTUROS (SEGUNDÁRIOS) */}
        {secondaryDeadlines.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secondaryDeadlines.map((item) => (
              <div
                key={item.id}
                className="border border-[#D8D5CC] p-4 bg-[#F6F3EC] hover:border-[#111111] flex justify-between items-center font-mono transition-colors"
              >
                <div className="space-y-1">
                  <span className="text-[9px] text-[#767571] uppercase block">
                    PRAZO FUTURO
                  </span>
                  <span className="text-[12px] font-bold text-[#111111] uppercase block">
                    {item.title}
                  </span>
                </div>
                <span className="bg-[#EBE8E1] border border-[#D8D5CC] px-2.5 py-1 text-[10px] font-bold text-[#111111] shrink-0">
                  FALTAM {item.daysRemaining ?? 0} DIAS
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* METADADOS SUPERIORES DA DISCIPLINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center font-mono text-[9px] tracking-[0.12em] text-[#767571] uppercase border-b border-[#D8D5CC] pb-2 gap-1 pt-2">
        <div>[DOSSIÉ ARQUIVO] UNIDADE CURRICULAR</div>
        <div>
          REF: {subject?.code || '---'} · ANO LETIVO {subject?.academicYear || '2024/2025'}
        </div>
      </div>

      {/* GRELHA PRINCIPAL DO HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#111111] text-[#FCF9F2] font-mono text-[10px] tracking-[0.1em] font-bold px-2.5 py-1 uppercase">
            <span className="w-1.5 h-1.5 bg-[#FCF9F2] inline-block" />
            {nextClassText}
          </div>

          <h1 className="font-display text-5xl sm:text-7xl lg:text-[76px] leading-[0.9] text-[#111111] uppercase tracking-[-0.01em] break-words pt-1 pb-1">
            {loading ? 'A CARREGAR...' : subject?.name || 'SELECIONE UMA DISCIPLINA'}
          </h1>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tracking-[0.05em] text-[#767571] uppercase pt-3 border-t border-[#D8D5CC]">
            <span>CÓDIGO: <strong className="text-[#111111]">{subject?.code || '---'}</strong></span>
            <span>·</span>
            <span>ANO: <strong className="text-[#111111]">{subject?.degreeYear || 1}º ANO</strong></span>
            <span>·</span>
            <span>SEMESTRE: <strong className="text-[#111111]">{subject?.semester || 1}º SEM</strong></span>
          </div>
        </div>

        {/* CARD LATERAL DA FICHA */}
        <div className="lg:col-span-5 border border-[#D8D5CC] p-6 bg-[#F6F3EC] space-y-4">
          <div className="flex justify-between items-center font-mono text-[10px] tracking-[0.1em] uppercase border-b border-[#D8D5CC] pb-2 text-[#767571]">
            <span className="text-[#111111] font-bold">FICHA_ARQUIVO</span>
            <span>{subject?.code || '---'} // {subject?.academicYear || '2024/2025'}</span>
          </div>

          <div className="space-y-2 font-mono text-[11px] tracking-[0.05em]">
            <div className="flex justify-between items-center py-2 border-b border-[#E5E2DB]">
  <span className="text-[#767571] uppercase text-[9px] tracking-[0.12em]">REGENTE</span>
  <span className="font-bold text-[#111111]">
    {typeof subject?.teacherTeorica === 'object'
      ? subject.teacherTeorica.name
      : subject?.teacherTeorica || 'N/D'}
  </span>
</div>
            <div className="flex justify-between items-center py-2 border-b border-[#E5E2DB]">
              <span className="text-[#767571] uppercase text-[9px] tracking-[0.12em]">Nº DE CRÉDITOS / ECTS</span>
              <span className="font-bold text-[#111111]">
                {subject?.ects ? String(subject.ects).padStart(2, '0') : '00'} ECTS
              </span>
            </div>
          </div>

          <div className="border-t border-[#D8D5CC] pt-3">
            {!showNoteInput && !note ? (
              <button
                onClick={() => setShowNoteInput(true)}
                className="font-mono text-[10px] tracking-[0.1em] text-[#767571] hover:text-[#111111] uppercase transition-colors"
              >
                + ADICIONAR NOTA
              </button>
            ) : (
              <div className="space-y-2">
                <span className="font-mono text-[9px] tracking-[0.12em] text-[#767571] uppercase block">
                  NOTA PESSOAL
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Escreve uma anotação sobre a disciplina..."
                  className="w-full bg-[#FCF9F2] border border-[#D8D5CC] p-2 font-sans text-[12px] text-[#111111] focus:outline-none focus:border-[#111111] resize-none h-20"
                />
              </div>
            )}
          </div>

          {/* BOTÕES DE NAVEGAÇÃO */}
          <div className="pt-2 space-y-2">
            <a
              href="#biblioteca"
              className="flex items-center justify-center bg-[#111111] hover:bg-white border border-[#111111] font-mono text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors text-center group"
            >
              <span className="text-[#FCF9F2] group-hover:text-[#111111] transition-colors">
                ABRIR BIBLIOTECA &rarr;
              </span>
            </a>
            <a
              href="#horario"
              className="flex items-center justify-center border border-[#111111] hover:bg-[#111111] font-mono text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors text-center group"
            >
              <span className="text-[#111111] group-hover:text-[#FCF9F2] transition-colors">
                VER HORÁRIO COMPLETO &rarr;
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}