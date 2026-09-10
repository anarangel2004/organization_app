'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ScheduleSlot {
  id?: string;
  day?: string;
  dayOfWeek?: string | number;
  startTime?: string;
  endTime?: string;
  room?: string;
  type?: string;
}

interface HorarioSectionProps {
  subjectId?: string | number;
  schedules?: ScheduleSlot[] | null;
  onRefresh?: () => void;
}

const DAYS_OPTIONS = [
  'SEGUNDA-FEIRA',
  'TERÇA-FEIRA',
  'QUARTA-FEIRA',
  'QUINTA-FEIRA',
  'SEXTA-FEIRA',
  'SÁBADO',
];

const TYPE_OPTIONS = [
  'TEÓRICO',
  'PRÁTICO',
  'TEÓRICO-PRÁTICO',
];

const DAY_NUMBER_MAP: Record<number, string> = {
  1: 'SEGUNDA-FEIRA',
  2: 'TERÇA-FEIRA',
  3: 'QUARTA-FEIRA',
  4: 'QUINTA-FEIRA',
  5: 'SEXTA-FEIRA',
  6: 'SÁBADO',
  0: 'DOMINGO',
  7: 'DOMINGO',
};

const resolveDayName = (day?: string, dayOfWeek?: string | number): string => {
  if (day && typeof day === 'string' && day.trim().length > 0) {
    return day;
  }
  if (dayOfWeek !== undefined && dayOfWeek !== null) {
    if (typeof dayOfWeek === 'number') {
      return DAY_NUMBER_MAP[dayOfWeek] || 'SEGUNDA-FEIRA';
    }
    if (typeof dayOfWeek === 'string' && dayOfWeek.trim().length > 0) {
      return dayOfWeek;
    }
  }
  return 'SEGUNDA-FEIRA';
};

const INITIAL_FORM: ScheduleSlot = {
  day: 'SEGUNDA-FEIRA',
  dayOfWeek: 'SEGUNDA-FEIRA',
  startTime: '11:00',
  endTime: '13:00',
  room: 'ED 2: LAB 112',
  type: 'TEÓRICO',
};

export function HorarioSection({ subjectId, schedules = [], onRefresh }: HorarioSectionProps) {
  const [localSchedules, setLocalSchedules] = useState<ScheduleSlot[]>(schedules || []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<ScheduleSlot>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // Evita o erro de renderização infinita comparando o conteúdo e não a referência
  const schedulesKey = JSON.stringify(schedules);
  useEffect(() => {
    setLocalSchedules(schedules || []);
  }, [schedulesKey]);

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setFormData(INITIAL_FORM);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (slot: ScheduleSlot, index: number) => {
    const dayName = resolveDayName(slot.day, slot.dayOfWeek).toUpperCase();
    setEditingIndex(index);
    setFormData({
      id: slot.id,
      day: dayName,
      dayOfWeek: dayName,
      startTime: slot.startTime || '11:00',
      endTime: slot.endTime || '13:00',
      room: slot.room || '',
      type: (slot.type || 'TEÓRICO').toUpperCase(),
    });
    setIsFormOpen(true);
  };

  const saveSchedulesToDatabase = async (updatedSchedules: ScheduleSlot[]) => {
    if (!subjectId) {
      alert('Erro: O ID da disciplina (subjectId) não foi encontrado.');
      return;
    }

    setSaving(true);

    try {
      // O .select() obriga o Supabase a devolver os dados alterados para podermos confirmar
      const { data, error } = await supabase
        .from('subjects')
        .update({ schedules: updatedSchedules })
        .eq('id', subjectId)
        .select();

      console.log('Resultado ao guardar no Supabase:', { data, error });

      if (error) {
        alert(`Erro ao guardar no Supabase: ${error.message}`);
      } else if (!data || data.length === 0) {
        alert(
          `O Supabase não atualizou nenhuma linha (0 afetadas).\n\nPossíveis motivos:\n1. O ID "${subjectId}" não existe na tabela "subjects".\n2. As permissões de segurança (RLS) do Supabase bloqueiam o UPDATE.`
        );
      } else {
        setLocalSchedules(updatedSchedules);
        setIsFormOpen(false);
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      console.error('Erro de ligação:', err);
      alert(`Erro inesperado: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    let updated: ScheduleSlot[] = [];

    if (editingIndex !== null) {
      updated = localSchedules.map((slot, idx) =>
        idx === editingIndex ? { ...formData } : slot
      );
    } else {
      const newSlot = { ...formData, id: String(Date.now()) };
      updated = [...localSchedules, newSlot];
    }

    saveSchedulesToDatabase(updated);
  };

  const handleDelete = async (indexToDelete: number) => {
    if (!subjectId) {
      alert('Erro: Não é possível apagar porque o subjectId não está presente.');
      return;
    }

    const previousSchedules = [...localSchedules];
    const updated = localSchedules.filter((_, idx) => idx !== indexToDelete);

    // Atualiza temporariamente na interface para resposta imediata
    setLocalSchedules(updated);

    try {
      const { data, error } = await supabase
        .from('subjects')
        .update({ schedules: updated })
        .eq('id', subjectId)
        .select();

      console.log('Resultado do apagar no Supabase:', { data, error });

      if (error) {
        alert(`Erro ao eliminar no Supabase: ${error.message}`);
        setLocalSchedules(previousSchedules); // Reverte se falhar
      } else if (!data || data.length === 0) {
        alert(
          `Não foi possível apagar na base de dados (0 linhas afetadas).\n\nCausas prováveis:\n- O ID "${subjectId}" não coincide com a coluna "id" da tabela "subjects".\n- Falta de permissão para UPDATE na política de RLS do Supabase.`
        );
        setLocalSchedules(previousSchedules); // Reverte
      } else if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Erro na ligação:', err);
      alert(`Erro inesperado: ${err.message || err}`);
      setLocalSchedules(previousSchedules);
    }
  };

  return (
    <section className="space-y-6 font-mono">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#D8D5CC]">
        <div>
          <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase block mb-1">
            SECÇÃO 03 // CALENDÁRIO SEMANAL
          </span>
          <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
            HORÁRIO & SESSÕES.
          </h2>
          <p className="text-xs text-[#767571] mt-1">
            Aulas presenciais e horas de estudo associadas a esta disciplina.
          </p>
        </div>

        {/* BOTÃO ADICIONAR */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="bg-[#111111] hover:bg-[#31312c] text-[#FCF9F2] text-xs font-bold px-4 py-2.5 uppercase tracking-wider transition-all self-start sm:self-auto cursor-pointer"
        >
          + ADICIONAR HORÁRIO
        </button>
      </div>

      {/* FORMULÁRIO ESCURO (TEMA PRETO) */}
      {isFormOpen && (
        <div className="bg-[#111111] text-[#FCF9F2] border border-[#111111] p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#333333] pb-3">
            <span className="text-xs font-bold uppercase tracking-wider">
              {editingIndex !== null ? 'EDITAR SESSÃO DE HORÁRIO' : 'NOVA SESSÃO DE HORÁRIO'}
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-[#A0A0A0] hover:text-[#FCF9F2] font-bold uppercase transition-colors"
            >
              [FECHAR]
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* DIA */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#A0A0A0] uppercase font-bold block">
                Dia da Semana
              </label>
              <select
                value={formData.day}
                onChange={(e) =>
                  setFormData({ ...formData, day: e.target.value, dayOfWeek: e.target.value })
                }
                className="w-full bg-[#1A1A1A] border border-[#333333] p-2 text-[#FCF9F2] font-mono focus:outline-none focus:border-[#FCF9F2]"
              >
                {DAYS_OPTIONS.map((d) => (
                  <option key={d} value={d} className="bg-[#111111] text-[#FCF9F2]">
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* HORAS */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#A0A0A0] uppercase font-bold block">
                Horário (Início - Fim)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  placeholder="11:00"
                  className="w-full bg-[#1A1A1A] border border-[#333333] p-2 text-[#FCF9F2] font-mono text-center focus:outline-none focus:border-[#FCF9F2]"
                />
                <span className="text-[#A0A0A0]">-</span>
                <input
                  type="text"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  placeholder="13:00"
                  className="w-full bg-[#1A1A1A] border border-[#333333] p-2 text-[#FCF9F2] font-mono text-center focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>
            </div>

            {/* SALA / EDIFÍCIO */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#A0A0A0] uppercase font-bold block">
                Sala / Local
              </label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="ED 2: LAB 112"
                className="w-full bg-[#1A1A1A] border border-[#333333] p-2 text-[#FCF9F2] font-mono uppercase focus:outline-none focus:border-[#FCF9F2]"
              />
            </div>

            {/* TIPO DE AULA (DROPDOWN SELECT) */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#A0A0A0] uppercase font-bold block">
                Tipo
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-[#1A1A1A] border border-[#333333] p-2 text-[#FCF9F2] font-mono uppercase focus:outline-none focus:border-[#FCF9F2]"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t} className="bg-[#111111] text-[#FCF9F2]">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-[#333333] bg-[#1A1A1A] text-[#FCF9F2] text-xs font-bold uppercase hover:bg-[#2A2A2A] transition-colors"
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#FCF9F2] text-[#111111] text-xs font-bold uppercase hover:bg-[#E5E5E5] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'A GUARDAR...' : 'GUARDAR HORÁRIO'}
            </button>
          </div>
        </div>
      )}

      {/* LISTA DE HORÁRIOS */}
      <div className="divide-y divide-[#D8D5CC] border-t border-b border-[#D8D5CC]">
        {localSchedules.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#767571] uppercase tracking-wider">
            NENHUM HORÁRIO CONFIGURADO.
          </div>
        ) : (
          localSchedules.map((slot, index) => {
            const dayLabel = resolveDayName(slot.day, slot.dayOfWeek).toUpperCase();
            const typeLabel = (slot.type || 'TEÓRICO').toUpperCase();
            const timeRange = `${slot.startTime || '00:00'}–${slot.endTime || '00:00'}`;
            const roomLabel = (slot.room || 'SALA A DEFINIR').toUpperCase();

            return (
              <div
                key={slot.id || index}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F1E8]/50 transition-colors px-2 -mx-2"
              >
                {/* INFORMAÇÕES DA SESSÃO */}
                <div className="text-xs font-bold text-[#111111] uppercase tracking-wider flex flex-wrap items-center gap-2 sm:gap-3">
                  <span>
                    {dayLabel} ({typeLabel})
                  </span>
                  <span className="text-[#767571] font-normal">·</span>
                  <span className="text-[#767571] font-normal">{timeRange}</span>
                  <span className="text-[#767571] font-normal">·</span>
                  <span className="text-[#767571] font-normal">{roomLabel}</span>
                </div>

                {/* BOTÕES DE AÇÃO INDIVIDUAIS */}
                <div className="flex items-center gap-2">
                  <span className="border border-[#111111] px-2 py-1 text-[10px] font-bold text-[#111111] uppercase tracking-widest bg-[#FCF9F2]">
                    SEMANAL
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(slot, index)}
                    title="Editar horário"
                    className="border border-[#D8D5CC] bg-[#FCF9F2] hover:bg-[#111111] hover:text-[#FCF9F2] text-[10px] font-bold px-2 py-1 uppercase transition-colors cursor-pointer"
                  >
                    EDITAR
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    title="Eliminar horário"
                    className="border border-[#D8D5CC] bg-[#FCF9F2] hover:bg-red-600 hover:text-white hover:border-red-600 text-[10px] font-bold px-2 py-1 uppercase transition-colors cursor-pointer"
                  >
                    X
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}