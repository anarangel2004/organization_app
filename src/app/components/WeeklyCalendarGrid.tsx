'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateStr } from '@/lib/utils';
import { AgendaRow, WeekDayCell } from './types';

interface WeeklyCalendarGridProps {
  weekDays: WeekDayCell[];
}

const HOUR_HEIGHT = 40; // px por hora
const DEFAULT_DURATION_MIN = 90; // usado quando falta endTime em horários antigos
const RANGE_PADDING_HOURS = 1; // folga antes/depois da primeira/última aula da semana
const ABS_MIN_HOUR = 6;
const ABS_MAX_HOUR = 23;
const FALLBACK_START_HOUR = 9; // só quando não há nenhuma aula agendada
const FALLBACK_END_HOUR = 18;
const MAX_GRID_HEIGHT = 460; // px: acima disto a grelha ganha scroll interno

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface LaidOutBlock {
  row: AgendaRow;
  start: number;
  end: number;
  col: number;
  numCols: number;
}

function layoutDayBlocks(rows: AgendaRow[]): LaidOutBlock[] {
  const items = rows
    .filter((r) => r.kind === 'AULA' && r.time)
    .map((r) => {
      const start = minutesOf(r.time as string);
      const end = r.endTime ? minutesOf(r.endTime) : start + DEFAULT_DURATION_MIN;
      return { row: r, start, end: Math.max(end, start + 20) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const clusters: (typeof items)[] = [];
  let current: typeof items = [];
  let clusterEnd = -Infinity;

  items.forEach((item) => {
    if (current.length === 0 || item.start < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end;
    }
  });
  if (current.length) clusters.push(current);

  const out: LaidOutBlock[] = [];
  clusters.forEach((cluster) => {
    const columnEnds: number[] = [];
    const colIndex: number[] = [];

    cluster.forEach((item) => {
      let placed = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.start) {
          columnEnds[c] = item.end;
          placed = c;
          break;
        }
      }
      if (placed === -1) {
        columnEnds.push(item.end);
        placed = columnEnds.length - 1;
      }
      colIndex.push(placed);
    });

    const numCols = columnEnds.length;
    cluster.forEach((item, idx) => {
      out.push({ row: item.row, start: item.start, end: item.end, col: colIndex[idx], numCols });
    });
  });

  return out;
}

// Grelha semanal Seg-Dom com blocos de aula posicionados/dimensionados por
// hora (estilo agenda visual), coloridos por disciplina, mais uma faixa
// "todo o dia" para prazos e tarefas (que não têm hora marcada). O eixo de
// horas ajusta-se aos dados reais da semana, com scroll interno se a
// amplitude for grande.
export function WeeklyCalendarGrid({ weekDays }: WeeklyCalendarGridProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { hourStart, hourEnd } = useMemo(() => {
    const times: number[] = [];
    weekDays.forEach((day) =>
      day.rows.forEach((row) => {
        if (row.kind === 'AULA' && row.time) {
          times.push(minutesOf(row.time));
          times.push(row.endTime ? minutesOf(row.endTime) : minutesOf(row.time) + DEFAULT_DURATION_MIN);
        }
      })
    );
    if (times.length === 0) return { hourStart: FALLBACK_START_HOUR, hourEnd: FALLBACK_END_HOUR };
    const min = Math.floor(Math.min(...times) / 60);
    const max = Math.ceil(Math.max(...times) / 60);
    return {
      hourStart: Math.max(ABS_MIN_HOUR, min - RANGE_PADDING_HOURS),
      hourEnd: Math.min(ABS_MAX_HOUR, max + RANGE_PADDING_HOURS),
    };
  }, [weekDays]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = hourStart; h <= hourEnd; h++) list.push(h);
    return list;
  }, [hourStart, hourEnd]);

  const gridHeight = (hourEnd - hourStart) * HOUR_HEIGHT;
  const scrollable = gridHeight > MAX_GRID_HEIGHT;

  const nowOffset = useMemo(() => {
    if (!now) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = hourStart * 60;
    const endMin = hourEnd * 60;
    if (nowMin < startMin || nowMin > endMin) return null;
    return ((nowMin - startMin) / 60) * HOUR_HEIGHT;
  }, [now, hourStart, hourEnd]);

  const columnsTemplate = '44px repeat(7, minmax(72px, 1fr))';

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <span className="font-mono text-[10px] tracking-widest text-[#767571] uppercase">
          SEMANA DE {weekDays[0] ? formatDateStr(weekDays[0].date.toISOString()) : ''}
        </span>
      </div>

      <div className="border border-[#D8D5CC] overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Cabeçalho dos dias */}
          <div className="grid border-b border-[#D8D5CC]" style={{ gridTemplateColumns: columnsTemplate }}>
            <div className="border-r border-[#D8D5CC]" />
            {weekDays.map((day) => (
              <div
                key={`head-${day.date.toISOString()}`}
                className={`px-1.5 py-1.5 border-r border-[#D8D5CC] last:border-r-0 space-y-1 ${
                  day.isToday ? 'bg-white' : day.isPast ? 'bg-[#F6F3EC]/20 opacity-60' : 'bg-[#F6F3EC]/40'
                }`}
              >
                <div className="font-mono text-[9px] tracking-widest uppercase font-bold text-[#111111]">
                  {day.dayLabel} {day.dateLabel} {day.isToday && '[HOJE]'}
                </div>
                <span
                  className={`inline-block font-mono text-[7px] font-bold tracking-widest uppercase px-1 py-0.5 ${
                    day.status === 'CRÍTICO'
                      ? 'bg-[#B91C1C] text-[#FCF9F2]'
                      : day.status === 'HOJE'
                      ? 'bg-[#111111] text-[#FCF9F2]'
                      : day.status === 'CONCLUÍDO'
                      ? 'bg-[#D8D5CC] text-[#767571]'
                      : 'bg-transparent text-[#767571] border border-[#D8D5CC]'
                  }`}
                >
                  {day.status}
                </span>
              </div>
            ))}
          </div>

          {/* Faixa "todo o dia": prazos e tarefas, sem hora marcada */}
          <div className="grid border-b border-[#D8D5CC]" style={{ gridTemplateColumns: columnsTemplate }}>
            <div className="border-r border-[#D8D5CC]" />
            {weekDays.map((day) => {
              const allDayRows = day.rows.filter((r) => r.kind !== 'AULA');
              return (
                <div
                  key={`allday-${day.date.toISOString()}`}
                  className="border-r border-[#D8D5CC] last:border-r-0 px-1 py-1 space-y-1 min-h-[1.5rem]"
                >
                  {allDayRows.slice(0, 2).map((row) => (
                    <div
                      key={row.id}
                      className={`font-mono text-[7px] uppercase leading-tight px-1 py-0.5 border truncate ${
                        row.kind === 'PRAZO'
                          ? 'border-[#B91C1C] text-[#B91C1C]'
                          : 'border-[#767571] text-[#767571]'
                      }`}
                      title={`${row.title} — ${row.subtitle}`}
                    >
                      {row.title}
                    </div>
                  ))}
                  {allDayRows.length > 2 && (
                    <div className="font-mono text-[7px] text-[#767571] uppercase">+{allDayRows.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grelha de horas (com scroll interno se ultrapassar a altura máxima) */}
          <div style={scrollable ? { maxHeight: MAX_GRID_HEIGHT, overflowY: 'auto' } : undefined}>
            <div className="grid" style={{ gridTemplateColumns: columnsTemplate }}>
              <div className="border-r border-[#D8D5CC] relative" style={{ height: gridHeight }}>
                {hours.map((h, idx) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 -translate-y-1/2 pr-1 text-right font-mono text-[7px] text-[#767571]"
                    style={{ top: idx * HOUR_HEIGHT }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {weekDays.map((day) => {
                const blocks = layoutDayBlocks(day.rows);
                return (
                  <div
                    key={`col-${day.date.toISOString()}`}
                    className={`relative border-r border-[#D8D5CC] last:border-r-0 ${
                      day.isToday ? 'bg-white' : day.isPast ? 'bg-[#F6F3EC]/10 opacity-70' : 'bg-transparent'
                    }`}
                    style={{ height: gridHeight }}
                  >
                    {hours.map((h, idx) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-[#D8D5CC]/60"
                        style={{ top: idx * HOUR_HEIGHT }}
                      />
                    ))}

                    {day.isToday && nowOffset !== null && (
                      <div className="absolute left-0 right-0 z-20" style={{ top: nowOffset }}>
                        <div className="relative h-0 border-t-2 border-[#B91C1C]">
                          <span className="absolute -left-[3px] -top-[4px] w-[7px] h-[7px] rounded-full bg-[#B91C1C]" />
                        </div>
                      </div>
                    )}

                    {blocks.map((block) => {
                      const top = ((block.start - hourStart * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((block.end - block.start) / 60) * HOUR_HEIGHT, 20);
                      const widthPct = 100 / block.numCols;
                      const leftPct = block.col * widthPct;
                      const color = block.row.color || '#374151';

                      return (
                        <div
                          key={block.row.id}
                          className="absolute overflow-hidden px-1 py-0.5 border-l-[3px] bg-white"
                          style={{
                            top,
                            height,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 2px)`,
                            borderColor: color,
                            backgroundColor: `${color}1A`,
                          }}
                          title={`${block.row.title} — ${block.row.subtitle}`}
                        >
                          <div
                            className="font-mono text-[6px] font-bold tracking-tight uppercase leading-tight"
                            style={{ color }}
                          >
                            {block.row.time}
                            {block.row.endTime ? `–${block.row.endTime}` : ''}
                          </div>
                          <div className="font-mono text-[7px] font-bold uppercase leading-tight text-[#111111] truncate">
                            {block.row.title}
                          </div>
                          <div className="font-mono text-[6px] uppercase leading-tight text-[#767571] truncate">
                            {block.row.subtitle}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
