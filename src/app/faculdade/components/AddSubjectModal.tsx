'use client';

import { useState } from 'react';
import { Plus, Clock, X, Sparkles, Trash2 } from 'lucide-react';
import { Subject, Schedule } from '../types';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSubject: (newSubject: Subject) => void;
}

export function AddSubjectModal({
  isOpen,
  onClose,
  onAddSubject
}: AddSubjectModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teacherTeoricaName, setTeacherTeoricaName] = useState('');
  const [teacherTeoricaEmail, setTeacherTeoricaEmail] = useState('');
  const [teacherPraticaName, setTeacherPraticaName] = useState('');
  const [teacherPraticaEmail, setTeacherPraticaEmail] = useState('');

  // Pesos proporcionais (Total = 100%)
  const [teoricaWeight, setTeoricaWeight] = useState<number>(50);
  const [praticaWeight, setPraticaWeight] = useState<number>(50);
  const [requiresAttendance, setRequiresAttendance] = useState<boolean>(true);

  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      dayOfWeek: 'Segunda-feira',
      startTime: '09:00',
      endTime: '11:00',
      room: '',
      type: 'Teórica'
    }
  ]);

  if (!isOpen) return null;

  const handleTeoricaWeightChange = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    setTeoricaWeight(clamped);
    setPraticaWeight(100 - clamped);
  };

  const handlePraticaWeightChange = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    setPraticaWeight(clamped);
    setTeoricaWeight(100 - clamped);
  };

  const addScheduleSlot = () => {
    setSchedules([
      ...schedules,
      {
        dayOfWeek: 'Segunda-feira',
        startTime: '09:00',
        endTime: '11:00',
        room: '',
        type: 'Teórica'
      }
    ]);
  };

  const removeScheduleSlot = (index: number) => {
    if (schedules.length === 1) return;
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const updateScheduleSlot = (
    index: number,
    field: keyof Schedule,
    value: string
  ) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newSub: Subject = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name.trim(),
      code: code.trim().toUpperCase() || 'ACAD-2026',
      color: 'bg-slate-800',
      teacherTeorica: teacherTeoricaName.trim()
        ? { name: teacherTeoricaName.trim(), email: teacherTeoricaEmail.trim() }
        : undefined,
      teacherPratica: teacherPraticaName.trim()
        ? { name: teacherPraticaName.trim(), email: teacherPraticaEmail.trim() }
        : undefined,
      evaluation: {
        teoricaWeight: Number(teoricaWeight),
        praticaWeight: Number(praticaWeight),
        requiresAttendance
      },
      schedules: schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room.trim() || 'A definir',
        type: s.type
      })),
      filesCount: 0
    };

    onAddSubject(newSub);
    onClose();

    // Reset Form
    setName('');
    setCode('');
    setTeacherTeoricaName('');
    setTeacherTeoricaEmail('');
    setTeacherPraticaName('');
    setTeacherPraticaEmail('');
    setTeoricaWeight(50);
    setPraticaWeight(50);
    setRequiresAttendance(true);
    setSchedules([
      {
        dayOfWeek: 'Segunda-feira',
        startTime: '09:00',
        endTime: '11:00',
        room: '',
        type: 'Teórica'
      }
    ]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" /> Registar Nova Disciplina
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Coluna Esquerda */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Disciplina *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Metodologia e Investigação"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código / Sigla
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MIV-2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white uppercase"
                  />
                </div>
              </div>

              {/* Professores */}
              <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Docentes
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Prof. Teórica
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do professor"
                      value={teacherTeoricaName}
                      onChange={(e) => setTeacherTeoricaName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Email Teórica
                    </label>
                    <input
                      type="email"
                      placeholder="email@univ.pt"
                      value={teacherTeoricaEmail}
                      onChange={(e) => setTeacherTeoricaEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/40">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Prof. Prática
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do professor"
                      value={teacherPraticaName}
                      onChange={(e) => setTeacherPraticaName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Email Prática
                    </label>
                    <input
                      type="email"
                      placeholder="email@univ.pt"
                      value={teacherPraticaEmail}
                      onChange={(e) => setTeacherPraticaEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Pesos Proporcionais */}
              <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Método de Avaliação & Presença
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Peso Teórica (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={teoricaWeight}
                      onChange={(e) =>
                        handleTeoricaWeightChange(Number(e.target.value))
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Peso Prática (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={praticaWeight}
                      onChange={(e) =>
                        handlePraticaWeightChange(Number(e.target.value))
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/40">
                  <label className="block text-[11px] text-slate-600 mb-1.5">
                    Frequência / Assiduidade
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="attendance"
                        checked={requiresAttendance === true}
                        onChange={() => setRequiresAttendance(true)}
                        className="accent-slate-900"
                      />
                      <span>Frequência Obrigatória</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="attendance"
                        checked={requiresAttendance === false}
                        onChange={() => setRequiresAttendance(false)}
                        className="accent-slate-900"
                      />
                      <span>Pode Faltar / Sem Limite</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita (Horários) */}
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/60 h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" /> Horários e Salas
                  </span>
                  <button
                    type="button"
                    onClick={addScheduleSlot}
                    className="text-[11px] text-amber-800 hover:text-amber-900 font-semibold flex items-center gap-1 bg-amber-100/70 border border-amber-300/60 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Horário
                  </button>
                </div>

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {schedules.map((sched, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-2 relative group shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Horário #{idx + 1}
                        </span>
                        {schedules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeScheduleSlot(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">
                            Tipo de Aula
                          </label>
                          <select
                            value={sched.type}
                            onChange={(e) =>
                              updateScheduleSlot(idx, 'type', e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                          >
                            <option value="Teórica">Teórica</option>
                            <option value="Prática">Prática</option>
                            <option value="Teórico-Prática">Teórico-Prática</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">
                            Dia da Semana
                          </label>
                          <select
                            value={sched.dayOfWeek}
                            onChange={(e) =>
                              updateScheduleSlot(idx, 'dayOfWeek', e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                          >
                            <option value="Segunda-feira">Segunda-feira</option>
                            <option value="Terça-feira">Terça-feira</option>
                            <option value="Quarta-feira">Quarta-feira</option>
                            <option value="Quinta-feira">Quinta-feira</option>
                            <option value="Sexta-feira">Sexta-feira</option>
                            <option value="Sábado">Sábado</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Das</label>
                          <input
                            type="time"
                            value={sched.startTime}
                            onChange={(e) =>
                              updateScheduleSlot(idx, 'startTime', e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Até</label>
                          <input
                            type="time"
                            value={sched.endTime}
                            onChange={(e) =>
                              updateScheduleSlot(idx, 'endTime', e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Sala</label>
                          <input
                            type="text"
                            placeholder="Ex: 3.02"
                            value={sched.room}
                            onChange={(e) =>
                              updateScheduleSlot(idx, 'room', e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 flex gap-2 justify-end border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-black transition-colors"
            >
              Criar Disciplina
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}