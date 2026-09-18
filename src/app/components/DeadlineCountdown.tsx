'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateStr } from '@/lib/utils';
import { UpcomingRow } from './types';

interface DeadlineCountdownProps {
  deadline: UpcomingRow | null;
}

// Cartão com a contagem decrescente até ao fim do dia do prazo mais
// próximo. O relógio (nowTick) vive aqui, isolado do resto da página,
// para que só este cartão re-renderize a cada segundo.
export function DeadlineCountdown({ deadline }: DeadlineCountdownProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const countdown = useMemo(() => {
    if (!deadline) return null;
    const deadlineEnd = new Date(deadline.date);
    deadlineEnd.setHours(23, 59, 59, 999);
    const diffMs = Math.max(0, deadlineEnd.getTime() - nowTick);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    const isUrgent = diffMs <= 1000 * 60 * 60 * 48; // menos de 48h
    const proximity = Math.min(100, Math.max(4, 100 - (diffMs / (1000 * 60 * 60 * 24 * 7)) * 100));
    return { days, hours, minutes, seconds, isUrgent, proximity };
  }, [deadline, nowTick]);

  return (
    <div className="border border-[#111111] bg-[#F6F3EC] p-6 space-y-4">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase">
        <span>PRAZO MAIS PRÓXIMO</span>
        {countdown?.isUrgent && (
          <span className="bg-[#B91C1C] text-[#FCF9F2] px-2 py-0.5 font-bold">URGENTE</span>
        )}
      </div>

      {deadline && countdown ? (
        <>
          <div className="font-mono text-[10px] tracking-widest text-[#767571] uppercase">
            TEMPO RESTANTE ESTIMADO (ATÉ AO FIM DO DIA)
          </div>
          <div className="font-display text-5xl uppercase leading-none">
            {countdown.days > 0 ? `${countdown.days} DIAS` : 'ÚLTIMO DIA'}
          </div>
          <div className="font-mono text-xs tracking-widest">
            {String(countdown.days).padStart(2, '0')}D : {String(countdown.hours).padStart(2, '0')}H :{' '}
            {String(countdown.minutes).padStart(2, '0')}M : {String(countdown.seconds).padStart(2, '0')}S
          </div>
          <div className="h-1.5 bg-[#D8D5CC] w-full">
            <div className="h-1.5 bg-[#111111]" style={{ width: `${countdown.proximity}%` }} />
          </div>
          <div className="font-mono text-[11px] uppercase pt-1 space-y-1">
            <div className="font-bold">{deadline.title}</div>
            <div className="text-[#767571]">
              {deadline.kind} · {deadline.subtitle} · {formatDateStr(deadline.date.toISOString())}
            </div>
          </div>
          <a
            href="#proximos-7-dias"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest uppercase border-t border-[#D8D5CC] pt-3 w-full hover:text-[#767571]"
          >
            VER TODOS OS PRAZOS →
          </a>
        </>
      ) : (
        <div className="font-mono text-[11px] text-[#767571] uppercase py-4">SEM PRAZOS PRÓXIMOS AGENDADOS.</div>
      )}
    </div>
  );
}
