'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AddSubjectFormProps {
  onSubjectAdded: () => void;
}

interface ScheduleSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  type: 'TEÓRICO' | 'PRÁTICO' | 'TEÓRICO-PRÁTICO';
}

const ACADEMIC_YEARS = [
  '2024/2025',
  '2025/2026',
  '2026/2027',
  '2027/2028',
  '2028/2029',
  '2029/2030',
  '2030/2031',
];

const DAYS_OF_WEEK = [
  'SEGUNDA-FEIRA',
  'TERÇA-FEIRA',
  'QUARTA-FEIRA',
  'QUINTA-FEIRA',
  'SEXTA-FEIRA',
  'SÁBADO',
];

export function AddSubjectForm({ onSubjectAdded }: AddSubjectFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Identificação Principal (OBRIGATÓRIO)
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ects, setEcts] = useState<number | ''>(6);
  const [semester, setSemester] = useState<number | ''>(1);
  const [degreeYear, setDegreeYear] = useState<number | ''>(1);
  const [academicYear, setAcademicYear] = useState('2025/2026');

  // 2. Docentes (OPCIONAL)
  const [regenteName, setRegenteName] = useState('');
  const [regenteEmail, setRegenteEmail] = useState('');
  const [regenteIsTeorica, setRegenteIsTeorica] = useState(true);

  const [teoricaName, setTeoricaName] = useState('');
  const [teoricaEmail, setTeoricaEmail] = useState('');

  const [praticaName, setPraticaName] = useState('');
  const [praticaEmail, setPraticaEmail] = useState('');

  // 3. Horários (OPCIONAL)
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);

  // 4. Avaliação (OPCIONAL)
  const [pesoTeorica, setPesoTeorica] = useState<number | ''>('');
  const [pesoPratica, setPesoPratica] = useState<number | ''>('');

  const addScheduleSlot = () => {
    setSchedules([
      ...schedules,
      {
        id: Date.now().toString(),
        day: 'SEGUNDA-FEIRA',
        startTime: '09:00',
        endTime: '11:00',
        room: '',
        type: 'PRÁTICO',
      },
    ]);
  };

  const removeScheduleSlot = (id: string) => {
    setSchedules(schedules.filter((s) => s.id !== id));
  };

  const updateSchedule = (id: string, field: keyof ScheduleSlot, value: string) => {
    setSchedules(
      schedules.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const pt = pesoTeorica !== '' ? Number(pesoTeorica) : null;
    const pp = pesoPratica !== '' ? Number(pesoPratica) : null;

    if (pt !== null && pp !== null && pt + pp !== 100) {
      setErrorMsg('A soma das percentagens da Teórica e Prática deve ser 100%.');
      return;
    }

    setLoading(true);

    try {
      // Mapeamento correto para a estrutura JSONB e colunas da tabela
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        ects: Number(ects),
        semester: Number(semester),
        degree_year: Number(degreeYear),
        academic_year: academicYear,
        regente: regenteName.trim()
          ? { name: regenteName.trim(), email: regenteEmail.trim() || null }
          : null,
        teacher_teorica: regenteIsTeorica
          ? regenteName.trim()
            ? { name: regenteName.trim(), email: regenteEmail.trim() || null }
            : null
          : teoricaName.trim()
          ? { name: teoricaName.trim(), email: teoricaEmail.trim() || null }
          : null,
        teacher_pratica: praticaName.trim()
          ? { name: praticaName.trim(), email: praticaEmail.trim() || null }
          : null,
        evaluation:
          pt !== null || pp !== null
            ? { weight_teorica: pt, weight_pratica: pp }
            : null,
        schedules: schedules.length > 0 ? schedules : null,
      };

      const { error } = await supabase.from('subjects').insert([payload]);
      if (error) throw error;

      // Limpar formulário
      setCode('');
      setName('');
      setEcts(6);
      setSemester(1);
      setDegreeYear(1);
      setRegenteName('');
      setRegenteEmail('');
      setTeoricaName('');
      setTeoricaEmail('');
      setPraticaName('');
      setPraticaEmail('');
      setSchedules([]);
      setPesoTeorica('');
      setPesoPratica('');
      setIsOpen(false);
      onSubjectAdded();
    } catch (err: any) {
      console.error('Erro ao adicionar cadeira:', err);
      setErrorMsg(err.message || 'Erro ao guardar no banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111111] text-[#FCF9F2] font-mono text-xs border border-[#262626]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between font-bold text-[#FCF9F2] hover:bg-[#181818] transition-colors uppercase tracking-widest text-[11px]"
      >
        <span className="flex items-center gap-2">
          <span>{isOpen ? '−' : '+'}</span>
          <span>ADICIONAR NOVA DISCIPLINA // INGRESSO AO DOSSIÊ</span>
        </span>
        <span className="text-[10px] text-[#767571]">
          [ {isOpen ? 'RECOLHER FORMULÁRIO' : 'EXPANDIR FORMULÁRIO'} ]
        </span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 border-t border-[#262626] space-y-8">
          {errorMsg && (
            <div className="p-3 border border-red-500/50 bg-red-950/40 text-red-400 text-[10px] uppercase font-bold tracking-wider">
              ⚠ ERRO: {errorMsg}
            </div>
          )}

          {/* SECÇÃO 01: IDENTIFICAÇÃO PRINCIPAL (OBRIGATÓRIA) */}
          <div className="space-y-4">
            <div className="text-[10px] font-bold text-[#767571] uppercase tracking-widest border-b border-[#262626] pb-2 flex justify-between">
              <span>01 // IDENTIFICAÇÃO CURRICULAR</span>
              <span className="text-[#FCF9F2]">* OBRIGATÓRIO</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">CÓDIGO (EX: SSC) *</label>
                <input
                  type="text"
                  required
                  placeholder="EX: SSC"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">NOME DA DISCIPLINA *</label>
                <input
                  type="text"
                  required
                  placeholder="EX: SEGURANÇA DE SISTEMAS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">ECTS *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={30}
                  value={ects}
                  onChange={(e) => setEcts(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">SEMESTRE *</label>
                <select
                  required
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                >
                  <option value={1}>1º SEMESTRE</option>
                  <option value={2}>2º SEMESTRE</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">ANO CURRICULAR *</label>
                <select
                  required
                  value={degreeYear}
                  onChange={(e) => setDegreeYear(Number(e.target.value))}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                >
                  <option value={1}>1º ANO</option>
                  <option value={2}>2º ANO</option>
                  <option value={3}>3º ANO</option>
                  <option value={4}>4º ANO</option>
                  <option value={5}>5º ANO</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">ANO LETIVO *</label>
                <select
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                >
                  {ACADEMIC_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECÇÃO 02: CORPO DOCENTE (OPCIONAL) */}
          <div className="space-y-4">
            <div className="text-[10px] font-bold text-[#767571] uppercase tracking-widest border-b border-[#262626] pb-2 flex justify-between">
              <span>02 // CORPO DOCENTE</span>
              <span className="text-[#555555]">OPCIONAL</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#161616] p-4 border border-[#2A2A2A]">
              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">DOCENTE / REGENTE</label>
                <input
                  type="text"
                  placeholder="EX: PROF. JOÃO ALMEIDA"
                  value={regenteName}
                  onChange={(e) => setRegenteName(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">EMAIL DO REGENTE</label>
                <input
                  type="email"
                  placeholder="EX: REGENTE@UNIVERSIDADE.PT"
                  value={regenteEmail}
                  onChange={(e) => setRegenteEmail(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>

              <div className="md:col-span-2 pt-2 border-t border-[#262626] flex items-center gap-2">
                <input
                  type="checkbox"
                  id="regenteIsTeorica"
                  checked={regenteIsTeorica}
                  onChange={(e) => setRegenteIsTeorica(e.target.checked)}
                  className="accent-[#FCF9F2] cursor-pointer"
                />
                <label htmlFor="regenteIsTeorica" className="text-[10px] text-[#A0A0A0] uppercase cursor-pointer select-none">
                  O Regente assegura as Aulas Teóricas
                </label>
              </div>
            </div>

            {!regenteIsTeorica && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#161616] p-4 border border-[#2A2A2A]">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#767571] uppercase font-bold">PROFESSOR DAS TEÓRICAS</label>
                  <input
                    type="text"
                    placeholder="EX: PROF. MARIA SANTOS"
                    value={teoricaName}
                    onChange={(e) => setTeoricaName(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#767571] uppercase font-bold">EMAIL TEÓRICAS</label>
                  <input
                    type="email"
                    placeholder="EX: TEORICA@UNIVERSIDADE.PT"
                    value={teoricaEmail}
                    onChange={(e) => setTeoricaEmail(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#161616] p-4 border border-[#2A2A2A]">
              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">PROFESSOR DAS PRÁTICAS</label>
                <input
                  type="text"
                  placeholder="EX: PROF. JOÃO FERREIRA"
                  value={praticaName}
                  onChange={(e) => setPraticaName(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs uppercase text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">EMAIL PRÁTICAS</label>
                <input
                  type="email"
                  placeholder="EX: PRATICA@UNIVERSIDADE.PT"
                  value={praticaEmail}
                  onChange={(e) => setPraticaEmail(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                />
              </div>
            </div>
          </div>

          {/* SECÇÃO 03: HORÁRIOS (OPCIONAL) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="text-[10px] font-bold text-[#767571] uppercase tracking-widest">
                03 // HORÁRIOS & SALAS <span className="text-[#555555] font-normal">(OPCIONAL)</span>
              </span>
              <button
                type="button"
                onClick={addScheduleSlot}
                className="text-[9px] font-bold bg-[#2A2A2A] text-[#FCF9F2] hover:bg-[#333333] px-2.5 py-1 uppercase transition-colors border border-[#444444]"
              >
                + ADICIONAR HORÁRIO
              </button>
            </div>

            {schedules.length === 0 ? (
              <div className="text-[10px] text-[#555555] italic py-2">
                Nenhum horário adicionado. Clique no botão acima para adicionar um bloco de aula.
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((slot) => (
                  <div
                    key={slot.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#161616] p-3 border border-[#2A2A2A] items-end"
                  >
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[8px] text-[#767571] uppercase font-bold">DIA DA SEMANA</label>
                      <select
                        value={slot.day}
                        onChange={(e) => updateSchedule(slot.id, 'day', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1.5 text-[11px] uppercase text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                      >
                        {DAYS_OF_WEEK.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[8px] text-[#767571] uppercase font-bold">INÍCIO</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSchedule(slot.id, 'startTime', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1.5 text-[11px] text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[8px] text-[#767571] uppercase font-bold">FIM</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSchedule(slot.id, 'endTime', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1.5 text-[11px] text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[8px] text-[#767571] uppercase font-bold">SALA</label>
                      <input
                        type="text"
                        placeholder="EX: SALA 4"
                        value={slot.room}
                        onChange={(e) => updateSchedule(slot.id, 'room', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1.5 text-[11px] uppercase text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[8px] text-[#767571] uppercase font-bold">TIPO</label>
                      <select
                        value={slot.type}
                        onChange={(e) => updateSchedule(slot.id, 'type', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1.5 text-[11px] uppercase text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2]"
                      >
                        <option value="TEÓRICO">TEÓRICO</option>
                        <option value="PRÁTICO">PRÁTICO</option>
                        <option value="TEÓRICO-PRÁTICO">TEÓRICO-PRÁTICO</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeScheduleSlot(slot.id)}
                        className="w-full h-[31px] border border-[#2A2A2A] bg-[#1A1A1A] text-[#767571] hover:bg-red-950 hover:text-red-400 hover:border-red-800 transition-colors flex items-center justify-center font-bold text-xs"
                        title="Eliminar Horário"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECÇÃO 04: AVALIAÇÃO (OPCIONAL) */}
          <div className="space-y-4">
            <div className="text-[10px] font-bold text-[#767571] uppercase tracking-widest border-b border-[#262626] pb-2 flex justify-between">
              <span>04 // MÉTODO DE AVALIAÇÃO</span>
              <span className="text-[#555555]">OPCIONAL</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#161616] p-4 border border-[#2A2A2A]">
              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">PESO DA TEÓRICA (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="EX: 50"
                    value={pesoTeorica}
                    onChange={(e) => setPesoTeorica(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                  />
                  <span className="font-bold text-[#767571]">%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-[#767571] uppercase font-bold">PESO DA PRÁTICA (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="EX: 50"
                    value={pesoPratica}
                    onChange={(e) => setPesoPratica(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-xs text-[#FCF9F2] placeholder-[#555555] focus:outline-none focus:border-[#FCF9F2]"
                  />
                  <span className="font-bold text-[#767571]">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#262626] flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="border border-[#333333] bg-transparent text-[#767571] hover:text-[#FCF9F2] hover:border-[#555555] px-5 py-3 uppercase font-bold tracking-widest transition-colors text-[10px]"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={loading}
              className="border border-[#FCF9F2] bg-[#FCF9F2] text-[#111111] hover:bg-white px-8 py-3 uppercase font-bold tracking-widest transition-colors text-[11px] disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'A GUARDAR...' : 'REGISTAR DISCIPLINA'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default AddSubjectForm;