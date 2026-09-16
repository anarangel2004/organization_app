'use client';

import React, { useState } from 'react';

export type ClassType = 'TEÓRICA' | 'PRÁTICA' | 'AVALIAÇÃO' | 'GERAL';

interface AgendaItem {
  id: string;
  day: 'SEGUNDA' | 'TERÇA' | 'QUARTA' | 'QUINTA' | 'SEXTA';
  tag: string;
  time: string;
  title: string;
  classType?: ClassType; // Distinção entre TEÓRICA e PRÁTICA
  location: string;
  room?: string;
  isImportant?: boolean;
}

const SCHEDULE_DATA: AgendaItem[] = [
  // SEGUNDA
  { id: '1', day: 'SEGUNDA', tag: 'FOCO', time: '09:00 - 11:00', title: 'ESTUDO AUTÓNOMO', classType: 'GERAL', location: 'BIBLIOTECA', room: 'ESP. PESSOAL' },
  { id: '2', day: 'SEGUNDA', tag: 'TRABALHO', time: '14:00 - 15:30', title: 'TURNO REMOTO', classType: 'GERAL', location: 'ATELIER LAB', room: 'REMOTO' },
  { id: '3', day: 'SEGUNDA', tag: 'SSC - DÚV', time: '17:00 - 18:30', title: 'SESSÃO DE DÚVIDAS', classType: 'TEÓRICA', location: 'INFORMÁTICA', room: 'GAB. 2.14' },

  // TERÇA
  { id: '4', day: 'TERÇA', tag: 'AULA - SSC', time: '09:00 - 11:00', title: 'SEGURANÇA DE SISTEMAS', classType: 'TEÓRICA', location: 'BLOCO PRINC.', room: 'SALA 1' },
  { id: '5', day: 'TERÇA', tag: 'LEITURA', time: '14:00 - 15:30', title: 'LEITURA ORIENTADA', classType: 'TEÓRICA', location: 'ALA NORTE', room: 'BIBLIOTECA' },
  { id: '6', day: 'TERÇA', tag: 'SSC - LAB', time: '16:00 - 18:00', title: 'LAB EXTRA / EXERCÍCIOS', classType: 'PRÁTICA', location: 'DEP. INFORMÁTICA', room: 'LAB 3' },

  // QUARTA
  { id: '7', day: 'QUARTA', tag: 'PESQUISA', time: '10:30 - 12:30', title: 'ESTUDO DE ARQUIVO', classType: 'GERAL', location: 'DEP. ARTES', room: 'ARQUIVO' },
  { id: '8', day: 'QUARTA', tag: 'AULA - HAC', time: '14:30 - 16:30', title: 'HISTÓRIA DA ARTE CONTEMP.', classType: 'TEÓRICA', location: 'PAV. NORTE', room: 'SALA 4' },
  { id: '9', day: 'QUARTA', tag: 'ENTREGA CRÍTICA', time: '23:59', title: 'ENSAIO TEÓRICO 01', classType: 'AVALIAÇÃO', location: 'PRAZO IMPRETERÍVEL', room: 'PORTAL ACAD.', isImportant: true },

  // QUINTA
  { id: '10', day: 'QUINTA', tag: 'TRABALHO', time: '09:30 - 12:00', title: 'TURNO EDITORIAL', classType: 'GERAL', location: 'IMPRENSA', room: 'OFICINA' },
  { id: '11', day: 'QUINTA', tag: 'AULA - SSC', time: '14:00 - 16:00', title: 'SEGURANÇA DE SISTEMAS', classType: 'PRÁTICA', location: 'INFORMÁTICA', room: 'LAB 3' },
  { id: '12', day: 'QUINTA', tag: 'PRÁTICA - HAC', time: '16:30 - 18:00', title: 'CRÍTICA VISUAL', classType: 'PRÁTICA', location: 'EDIF. SUL', room: 'ATELIER 2' },

  // SEXTA
  { id: '13', day: 'SEXTA', tag: 'AVALIAÇÃO', time: '09:00 - 10:30', title: 'MINI-TESTE 01 - SSC', classType: 'AVALIAÇÃO', location: 'AVALIAÇÃO 25%', room: 'SALA 1', isImportant: true },
  { id: '14', day: 'SEXTA', tag: 'AULA - HAC', time: '11:00 - 12:30', title: 'HISTÓRIA DA ARTE CONTEMP.', classType: 'PRÁTICA', location: 'CENTRAIS', room: 'ATELIER 4' },
  { id: '15', day: 'SEXTA', tag: 'REVISÃO', time: '14:30 - 16:00', title: 'FECHO DE CADERNOS', classType: 'GERAL', location: 'AUTÓNOMO', room: 'SALA DE ESTUDO' }
];

const DAYS = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA'] as const;

export function ScheduleSection() {
  const [activeFilter, setActiveFilter] = useState('TODOS [ATIVO]');

  return (
    <section className="space-y-6 font-mono text-black">
      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#D8D5CC] pb-4">
        <div>
          <span className="text-[10px] tracking-[0.12em] text-[#767571] uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-black inline-block"></span>
            SECÇÃO 01 // MAPA SEMANAL & AGENDA INTEGRADA
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mt-1">
            HORÁRIO & AGENDA INTEGRADA // DISCIPLINAS, TESTES E PRAZOS
          </h2>
        </div>

        {/* METRICS */}
        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
          <div className="border border-black px-3 py-1 bg-white">18H30 TOTAL</div>
          <div className="border border-black px-3 py-1 bg-white">7 AULAS</div>
          <div className="border border-black px-3 py-1 bg-black text-white">1 TESTE AGENDADO</div>
        </div>
      </div>

      {/* FILTROS E LEGENDA DE TIPOS DE AULA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#767571] font-bold">FILTROS:</span>
          {['TODOS [ATIVO]', 'TEÓRICAS', 'PRÁTICAS', 'TESTES & PRAZOS'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-2.5 py-1 border border-black transition-colors ${
                activeFilter === filter ? 'bg-black text-white font-bold' : 'bg-white hover:bg-neutral-100'
              }`}
            >
              {filter}
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

      {/* GRELHA SEMANAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
        {DAYS.map((day) => {
          const items = SCHEDULE_DATA.filter((item) => item.day === day);
          const isToday = day === 'TERÇA';

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
                {items.map((item) => {
                  const isTeorica = item.classType === 'TEÓRICA';
                  const isPratica = item.classType === 'PRÁTICA';

                  return (
                    <div
                      key={item.id}
                      className={`p-3 border text-[9px] uppercase space-y-2.5 transition-all ${
                        item.isImportant
                          ? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)]'
                          : isPratica
                          ? 'bg-[#F4F1EA] text-black border-black border-l-4 border-l-black' // PRÁTICA: BORDA ESQUERDA MAIS ESPESSA
                          : 'bg-white text-black border-[#D8D5CC] hover:border-black'
                      }`}
                    >
                      {/* HEADER DO CARTÃO: TAG + HORÁRIO */}
                      <div className="flex justify-between items-center text-[8px] font-bold border-b pb-1.5 border-current opacity-90">
                        <span>{item.tag}</span>
                        <span>{item.time}</span>
                      </div>

                      {/* TÍTULO DA AULA (SEM SUBTÍTULO/DESCRIÇÃO) */}
                      <div className="pt-0.5">
                        <h4 className="font-extrabold text-[11px] leading-snug">{item.title}</h4>
                      </div>

                      {/* RODAPÉ DO CARTÃO: TIPO (T/P) + SALA */}
                      <div className="flex justify-between items-center text-[8px] pt-1.5 border-t border-current">
                        {/* BADGE DE DISTINÇÃO: TEÓRICA vs PRÁTICA */}
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
    </section>
  );
}