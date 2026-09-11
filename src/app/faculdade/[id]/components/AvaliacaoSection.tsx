'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';

export interface AssessmentItem {
  id: string;
  subject_id: string;
  title: string;
  category: 'TEORICA' | 'PRATICA';
  weight_percent: number;
  due_date: string | null;
  grade: number | null;
  has_defense: boolean;
  defense_grade: number | null;
  volume_ref: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at?: string;
}

export interface AvaliacaoSectionProps {
  subjectId?: string;
  onRefresh?: () => void;
}

function formatDateStr(isoString: string | null): string {
  if (!isoString) return 'DATA PENDENTE';
  try {
    const cleanDateStr = isoString.split('T')[0];
    const [year, month, day] = cleanDateStr.split('-').map(Number);
    if (!year || !month || !day) return 'DATA PENDENTE';

    const date = new Date(year, month - 1, day);
    return date
      .toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase()
      .replace(/\./g, '');
  } catch {
    return 'DATA PENDENTE';
  }
}

export function AvaliacaoSection({ subjectId, onRefresh }: AvaliacaoSectionProps) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados dos Pesos Globais da Cadeira
  const [theoryWeight, setTheoryWeight] = useState<number>(50);
  const [practiceWeight, setPracticeWeight] = useState<number>(50);
  const [isEditingWeights, setIsEditingWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);

  // Estados do Formulário de Criação
  const [newCategory, setNewCategory] = useState<'TEORICA' | 'PRATICA'>('TEORICA');
  const [newTitle, setNewTitle] = useState('');
  const [newWeight, setNewWeight] = useState<number | ''>(20);
  const [newDate, setNewDate] = useState('');
  const [newChapters, setNewChapters] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Carregar avaliações e pesos da disciplina
  const fetchAssessmentsAndSubject = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);

    // Carregar itens de avaliação
    const { data: assessData, error: assessError } = await supabase
      .from('assessments')
      .select('*')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: true });

    if (assessError) {
      console.error('Erro ao carregar avaliações:', assessError);
    } else if (assessData) {
      setItems(assessData as AssessmentItem[]);
    }

    // Carregar pesos globais da cadeira (se existirem na tabela subjects)
    const { data: subjData } = await supabase
      .from('subjects')
      .select('theoretical_weight, practical_weight')
      .eq('id', subjectId)
      .single();

    if (subjData) {
      if (typeof subjData.theoretical_weight === 'number') setTheoryWeight(subjData.theoretical_weight);
      if (typeof subjData.practical_weight === 'number') setPracticeWeight(subjData.practical_weight);
    }

    setLoading(false);
  }, [subjectId, supabase]);

  useEffect(() => {
    fetchAssessmentsAndSubject();
  }, [fetchAssessmentsAndSubject]);

  // Guardar Pesos Globais da Cadeira
  const handleSaveBranchWeights = async () => {
    if (!subjectId) return;
    setSavingWeights(true);

    const { error } = await supabase
      .from('subjects')
      .update({
        theoretical_weight: theoryWeight,
        practical_weight: practiceWeight,
      })
      .eq('id', subjectId);

    if (error) {
      console.error('Erro ao atualizar pesos da cadeira:', error);
      alert('ERRO AO GUARDAR PESOS DA CADEIRA.');
    } else {
      setIsEditingWeights(false);
      if (onRefresh) onRefresh();
    }
    setSavingWeights(false);
  };

  // Upload direto do ficheiro para o Supabase Storage
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    targetItemId?: string
  ) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileNameClean = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
      const filePath = `${subjectId || 'geral'}/${fileNameClean}`;

      const { error: uploadError } = await supabase.storage
        .from('assessments-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('assessments-files')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      const originalFileName = file.name.toUpperCase();

      if (targetItemId) {
        await handleUpdateItem(targetItemId, {
          file_name: originalFileName,
          file_url: publicUrl,
        });
      } else {
        setNewFileName(originalFileName);
        setNewFileUrl(publicUrl);
      }
    } catch (error) {
      console.error('Erro ao arquivar ficheiro:', error);
      alert('ERRO AO ARQUIVAR FICHEIRO NO STORAGE.');
    } finally {
      setUploading(false);
    }
  };

  const getItemEffectiveGrade = (item: AssessmentItem): number | null => {
    if (item.category === 'PRATICA' && item.has_defense) {
      const grade = item.grade;
      const defense = item.defense_grade;

      if (typeof grade === 'number' && typeof defense === 'number') {
        return Math.min(grade, defense);
      }
      if (typeof grade === 'number') return grade;
      if (typeof defense === 'number') return defense;
      return null;
    }
    return item.grade;
  };

  const handleGradeChange = async (
    id: string,
    value: string,
    field: 'grade' | 'defense_grade' = 'grade'
  ) => {
    const numericValue = value === '' ? null : Math.min(20, Math.max(0, parseFloat(value) || 0));

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: numericValue } : item))
    );

    const { error } = await supabase
      .from('assessments')
      .update({ [field]: numericValue })
      .eq('id', id);

    if (error) {
      console.error(`Erro ao atualizar ${field}:`, error);
      fetchAssessmentsAndSubject();
    }
  };

  const handleToggleDefense = async (id: string, currentHasDefense: boolean) => {
    const nextHasDefense = !currentHasDefense;

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              has_defense: nextHasDefense,
              defense_grade: nextHasDefense ? item.defense_grade : null,
            }
          : item
      )
    );

    const { error } = await supabase
      .from('assessments')
      .update({
        has_defense: nextHasDefense,
        defense_grade: nextHasDefense ? undefined : null,
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar defesa:', error);
      fetchAssessmentsAndSubject();
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('TEM CERTEZA QUE DESEJA APAGAR ESTA AVALIAÇÃO?')) return;

    setItems((prev) => prev.filter((item) => item.id !== id));

    const { error } = await supabase.from('assessments').delete().eq('id', id);

    if (error) {
      console.error('Erro ao apagar avaliação:', error);
      alert('ERRO AO APAGAR ITEM.');
      fetchAssessmentsAndSubject();
    } else if (onRefresh) {
      onRefresh();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return;

    const categoryItems = items.filter((item) => item.category === newCategory);
    const calculatedIndex = String(categoryItems.length + 1).padStart(2, '0');

    const defaultTitle =
      newCategory === 'TEORICA' ? `TESTE ${calculatedIndex}` : `LAB ${calculatedIndex}`;

    const payload = {
      subject_id: subjectId,
      title: newTitle.trim() ? newTitle.trim().toUpperCase() : defaultTitle,
      category: newCategory,
      weight_percent: typeof newWeight === 'number' ? newWeight : 0,
      due_date: newDate ? newDate : null,
      volume_ref: newChapters.trim() ? newChapters.toUpperCase() : null,
      file_name: newFileName.trim() ? newFileName.trim().toUpperCase() : null,
      file_url: newFileUrl.trim() ? newFileUrl.trim() : null,
      has_defense: false,
      grade: null,
      defense_grade: null,
    };

    const { data, error } = await supabase
      .from('assessments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar avaliação:', error);
      alert('ERRO AO GUARDAR AVALIAÇÃO NA BASE DE DADOS.');
    } else if (data) {
      setItems((prev) => [...prev, data as AssessmentItem]);
      setNewTitle('');
      setNewWeight(20);
      setNewDate('');
      setNewChapters('');
      setNewFileName('');
      setNewFileUrl('');
      setIsAdding(false);
      if (onRefresh) onRefresh();
    }
  };

  const handleUpdateItem = async (id: string, updatedFields: Partial<AssessmentItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );

    const { error } = await supabase.from('assessments').update(updatedFields).eq('id', id);

    if (error) {
      console.error('Erro ao atualizar item:', error);
      fetchAssessmentsAndSubject();
    }
  };

  // Separação de Ramos
  const teoricaItems = items.filter((item) => item.category === 'TEORICA');
  const praticaItems = items.filter((item) => item.category === 'PRATICA');

  // Cálculo da Média Geral Concluída
  const completedItems = items.filter((item) => getItemEffectiveGrade(item) !== null);
  const totalCompletedWeight = completedItems.reduce((acc, item) => acc + item.weight_percent, 0);

  const currentWeightedSum = completedItems.reduce(
    (acc, item) => acc + (getItemEffectiveGrade(item) ?? 0) * (item.weight_percent / 100),
    0
  );

  const mediaAtual =
    totalCompletedWeight > 0
      ? (currentWeightedSum / (totalCompletedWeight / 100)).toFixed(1)
      : '—';

  const calculateSubtotal = (category: 'TEORICA' | 'PRATICA') => {
    const categoryItems = items.filter(
      (item) => item.category === category && getItemEffectiveGrade(item) !== null
    );
    const categoryWeight = categoryItems.reduce((acc, item) => acc + item.weight_percent, 0);
    if (categoryWeight === 0) return '—';
    const sum = categoryItems.reduce(
      (acc, item) => acc + (getItemEffectiveGrade(item) ?? 0) * (item.weight_percent / 100),
      0
    );
    return (sum / (categoryWeight / 100)).toFixed(1);
  };

  return (
    <section id="avaliacao" className="space-y-6 pt-12">
      {/* CABEÇALHO REORGANIZADO & DESTAQUE DE NOTA (ESTILO BANNER) */}
      <div className="border-b border-[#D8D5CC] pb-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase">
          <span>SECÇÃO 05 // CRITÉRIOS & ÍNDICE DE CLASSIFICAÇÃO</span>

          {/* EDITAR PESOS TOTAIS DA CADEIRA */}
          <div className="flex items-center gap-2">
            {isEditingWeights ? (
              <div className="flex items-center gap-2 bg-[#111111] text-[#FCF9F2] px-2 py-1 border border-[#111111]">
                <span>TEÓRICO:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={theoryWeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setTheoryWeight(val);
                    setPracticeWeight(Math.max(0, 100 - val));
                  }}
                  className="w-10 bg-[#1B1B18] text-center font-bold text-[#FCF9F2] focus:outline-none"
                />
                <span>% · PRÁTICO:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={practiceWeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setPracticeWeight(val);
                    setTheoryWeight(Math.max(0, 100 - val));
                  }}
                  className="w-10 bg-[#1B1B18] text-center font-bold text-[#FCF9F2] focus:outline-none"
                />
                <span>%</span>
                <button
                  type="button"
                  onClick={handleSaveBranchWeights}
                  disabled={savingWeights}
                  className="bg-[#FCF9F2] text-[#111111] px-1.5 py-0.5 font-bold hover:bg-[#E5E2D9] ml-1 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingWeights(false)}
                  className="text-[#A1A09A] hover:text-[#FCF9F2] ml-1 cursor-pointer"
                >
                  X
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>
                  PESO TEÓRICO: <strong className="text-[#111111]">{theoryWeight}%</strong>
                </span>
                <span>·</span>
                <span>
                  PESO PRÁTICO: <strong className="text-[#111111]">{practiceWeight}%</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingWeights(true)}
                  className="hover:text-[#111111] underline cursor-pointer font-bold ml-1"
                >
                  [EDITAR PESOS]
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
          <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
            AVALIAÇÃO.
          </h2>

          {/* NOTA COM O MESMO ESTILO DA PERCENTAGEM (EX: NOTEBOOKS 48.3%) */}
          <div className="flex flex-col items-start md:items-end shrink-0">
            <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.12em] text-[#767571] uppercase mb-1">
              MÉDIA ATUAL DA DISCIPLINA
            </span>
            <div className="font-display text-6xl sm:text-7xl md:text-8xl font-black leading-none text-[#111111] tracking-[-0.02em]">
              {mediaAtual}
              {mediaAtual !== '—' && (
                <span className="font-mono text-xl sm:text-2xl font-normal text-[#767571] ml-1.5">
                  /20
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="font-mono text-[10px] text-[#767571] uppercase py-8">
          CARREGANDO AVALIAÇÕES...
        </div>
      ) : (
        <div className="border-t border-[#111111]">
          {/* RAMO TEÓRICO */}
          <div className="py-6 border-b border-[#111111] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] tracking-[0.05em]">
              <div className="font-bold text-[#111111] uppercase flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-[#111111] inline-block"></span>
                <span>RAMO TEÓRICO</span>
                <span className="text-[10px] font-normal text-[#767571] bg-[#F6F3EC] border border-[#D8D5CC] px-1.5 py-0.5">
                  PESO NO TOTAL: {theoryWeight}%
                </span>
              </div>

              <div className="text-[10px] text-[#767571] uppercase flex items-center gap-2.5">
                <span>{teoricaItems.length} PROVAS</span>
                <span>·</span>
                <span className="font-bold text-[#111111]">
                  SUBTOTAL: {calculateSubtotal('TEORICA')} / 20
                </span>
              </div>
            </div>

            <div className="border-t border-[#D8D5CC]">
              {teoricaItems.length === 0 ? (
                <div className="py-4 font-mono text-[10px] text-[#767571] uppercase">
                  NENHUMA PROVA TEÓRICA REGISTADA.
                </div>
              ) : (
                teoricaItems.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  const itemIndex = String(idx + 1).padStart(2, '0');

                  return (
                    <div key={item.id} className="py-3 border-b border-[#D8D5CC] space-y-2">
                      {isEditing ? (
                        <div className="bg-[#111111] text-[#FCF9F2] p-3.5 border border-[#31312C] font-mono text-[10px] space-y-3 uppercase">
                          <div className="flex justify-between items-center border-b border-[#31312C] pb-2">
                            <span className="font-bold tracking-[0.08em] text-[#FCF9F2]">
                              EDITAR TESTE #{itemIndex} — {item.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-[9px] text-[#A1A09A] hover:text-[#FCF9F2] cursor-pointer"
                            >
                              [ CONCLUIR / FECHAR ]
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                1. TÍTULO DA PROVA
                              </label>
                              <input
                                type="text"
                                placeholder="EX: TESTE 1"
                                value={item.title}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, { title: e.target.value.toUpperCase() })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                2. PESO NO RAMO (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="EX: 20"
                                value={item.weight_percent}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    weight_percent: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                3. DATA DA REALIZAÇÃO
                              </label>
                              <input
                                type="date"
                                value={item.due_date ? item.due_date.split('T')[0] : ''}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    due_date: e.target.value ? e.target.value : null,
                                  })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px] [color-scheme:dark]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                4. CAPÍTULOS / MATÉRIA AVALIADA
                              </label>
                              <input
                                type="text"
                                placeholder="EX: CAP. 1 A 4 // REDES"
                                value={item.volume_ref || ''}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    volume_ref: e.target.value.toUpperCase(),
                                  })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px]"
                              />
                            </div>

                            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-[#1B1B18] p-2.5 border border-[#31312C] space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#FCF9F2] tracking-wider">
                                5. FICHEIRO ARQUIVADO / ENUNCIADO DO TESTE (UPLOAD DIRECTO)
                              </label>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <input
                                  type="file"
                                  onChange={(e) => handleFileUpload(e, item.id)}
                                  disabled={uploading}
                                  className="block w-full text-[9px] text-[#A1A09A] file:mr-2 file:py-1 file:px-2 file:border-0 file:text-[9px] file:font-mono file:font-bold file:bg-[#FCF9F2] file:text-[#111111] hover:file:bg-[#E5E2D9] cursor-pointer"
                                />
                                {item.file_name && (
                                  <span className="text-[9px] text-green-400 font-bold shrink-0">
                                    ✓ FICHEIRO ATUAL: {item.file_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] tracking-[0.05em]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 h-5 flex items-center justify-center border border-[#D8D5CC] font-bold text-[#767571] bg-[#FCF9F2] shrink-0 text-[9px]">
                              {itemIndex}
                            </span>
                            <span className="font-bold text-[#111111] uppercase truncate">
                              {item.title}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 text-[#767571] uppercase shrink-0 text-[10px]">
                            <span>PESO {item.weight_percent}%</span>
                            <span>{formatDateStr(item.due_date)}</span>

                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.1"
                                placeholder="—"
                                value={item.grade !== null ? item.grade : ''}
                                onChange={(e) => handleGradeChange(item.id, e.target.value, 'grade')}
                                className="w-14 h-7 bg-[#FCF9F2] border border-[#111111] text-center font-bold text-[11px] text-[#111111] focus:bg-[#111111] focus:text-[#FCF9F2] focus:outline-none transition-colors"
                              />
                              <span className="font-bold text-[#111111]">/ 20</span>
                            </div>

                            <div className="flex items-center gap-1 text-[9px]">
                              <button
                                type="button"
                                onClick={() => setEditingId(item.id)}
                                className="hover:text-[#111111] underline cursor-pointer font-bold"
                              >
                                EDITAR
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="hover:text-red-600 underline cursor-pointer font-bold"
                              >
                                APAGAR
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] tracking-[0.05em] text-[#767571] uppercase pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111111]">CAPÍTULOS:</span>
                          <span className={item.volume_ref && item.volume_ref.trim() !== '' ? 'text-[#111111]' : 'text-[#767571]'}>
                            {item.volume_ref && item.volume_ref.trim() !== ''
                              ? item.volume_ref
                              : 'SEM CAPÍTULOS REGISTADOS'}
                          </span>
                        </div>

                        {item.file_url ? (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#111111] text-[#FCF9F2] px-2 py-0.5 hover:bg-[#31312c] transition-colors font-bold inline-flex items-center gap-1"
                          >
                            <span>🗏 {item.file_name || 'DOCUMENTO ARQUIVADO'}</span>
                            <span>&rarr;</span>
                          </a>
                        ) : (
                          <span className="border border-dashed border-[#D8D5CC] px-1.5 py-0.5 text-[#A1A09A]">
                            SEM DOCUMENTO ARQUIVADO
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RAMO PRÁTICO */}
          <div className="py-6 border-b border-[#111111] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] tracking-[0.05em]">
              <div className="font-bold text-[#111111] uppercase flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-[#111111] inline-block"></span>
                <span>RAMO PRÁTICO</span>
                <span className="text-[10px] font-normal text-[#767571] bg-[#F6F3EC] border border-[#D8D5CC] px-1.5 py-0.5">
                  PESO NO TOTAL: {practiceWeight}%
                </span>
              </div>

              <div className="text-[10px] text-[#767571] uppercase flex items-center gap-2.5">
                <span>{praticaItems.length} TRABALHOS</span>
                <span>·</span>
                <span className="font-bold text-[#111111]">
                  SUBTOTAL: {calculateSubtotal('PRATICA')} / 20
                </span>
              </div>
            </div>

            <div className="border-t border-[#D8D5CC]">
              {praticaItems.length === 0 ? (
                <div className="py-4 font-mono text-[10px] text-[#767571] uppercase">
                  NENHUM TRABALHO PRÁTICO REGISTADO.
                </div>
              ) : (
                praticaItems.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  const itemIndex = String(idx + 1).padStart(2, '0');
                  const effectiveGrade = getItemEffectiveGrade(item);

                  return (
                    <div key={item.id} className="py-3 border-b border-[#D8D5CC] space-y-2">
                      {isEditing ? (
                        <div className="bg-[#111111] text-[#FCF9F2] p-3.5 border border-[#31312C] font-mono text-[10px] space-y-3 uppercase">
                          <div className="flex justify-between items-center border-b border-[#31312C] pb-2">
                            <span className="font-bold tracking-[0.08em] text-[#FCF9F2]">
                              EDITAR TRABALHO #{itemIndex} — {item.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-[9px] text-[#A1A09A] hover:text-[#FCF9F2] cursor-pointer"
                            >
                              [ CONCLUIR / FECHAR ]
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                1. TÍTULO DO TRABALHO / LAB
                              </label>
                              <input
                                type="text"
                                placeholder="EX: LAB 1 — EXPLOIT"
                                value={item.title}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, { title: e.target.value.toUpperCase() })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                2. PESO NO RAMO (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="EX: 20"
                                value={item.weight_percent}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    weight_percent: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                3. DATA DA ENTREGA
                              </label>
                              <input
                                type="date"
                                value={item.due_date ? item.due_date.split('T')[0] : ''}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    due_date: e.target.value ? e.target.value : null,
                                  })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px] [color-scheme:dark]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                                4. CAPÍTULOS / TÓPICOS AVALIADOS
                              </label>
                              <input
                                type="text"
                                placeholder="EX: MÓDULO PRIVILÉGIOS"
                                value={item.volume_ref || ''}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    volume_ref: e.target.value.toUpperCase(),
                                  })
                                }
                                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none focus:border-[#FCF9F2] text-[10px]"
                              />
                            </div>

                            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-[#1B1B18] p-2.5 border border-[#31312C] space-y-1">
                              <label className="block text-[8.5px] font-bold text-[#FCF9F2] tracking-wider">
                                5. FICHEIRO ARQUIVADO / ENUNCIADO DO TRABALHO (UPLOAD DIRECTO)
                              </label>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <input
                                  type="file"
                                  onChange={(e) => handleFileUpload(e, item.id)}
                                  disabled={uploading}
                                  className="block w-full text-[9px] text-[#A1A09A] file:mr-2 file:py-1 file:px-2 file:border-0 file:text-[9px] file:font-mono file:font-bold file:bg-[#FCF9F2] file:text-[#111111] hover:file:bg-[#E5E2D9] cursor-pointer"
                                />
                                {item.file_name && (
                                  <span className="text-[9px] text-green-400 font-bold shrink-0">
                                    ✓ FICHEIRO ATUAL: {item.file_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] tracking-[0.05em]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 h-5 flex items-center justify-center border border-[#D8D5CC] font-bold text-[#767571] bg-[#FCF9F2] shrink-0 text-[9px]">
                              {itemIndex}
                            </span>
                            <span className="font-bold text-[#111111] uppercase truncate">
                              {item.title}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 text-[#767571] uppercase shrink-0 text-[10px]">
                            <span>PESO {item.weight_percent}%</span>
                            <span>{formatDateStr(item.due_date)}</span>

                            <div className="flex items-center gap-2 bg-[#F6F3EC] p-1 border border-[#D8D5CC]">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-[#111111]">
                                  {item.has_defense ? 'PROJETO:' : 'NOTA:'}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.1"
                                  placeholder="—"
                                  value={item.grade !== null ? item.grade : ''}
                                  onChange={(e) =>
                                    handleGradeChange(item.id, e.target.value, 'grade')
                                  }
                                  className="w-12 h-6 bg-[#FCF9F2] border border-[#111111] text-center font-bold text-[10px] text-[#111111] focus:bg-[#111111] focus:text-[#FCF9F2] focus:outline-none"
                                />
                              </div>

                              {item.has_defense && (
                                <>
                                  <span>|</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-[#111111]">DEFESA:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      step="0.1"
                                      placeholder="—"
                                      value={
                                        item.defense_grade !== null ? item.defense_grade : ''
                                      }
                                      onChange={(e) =>
                                        handleGradeChange(item.id, e.target.value, 'defense_grade')
                                      }
                                      className="w-12 h-6 bg-[#FCF9F2] border border-[#111111] text-center font-bold text-[10px] text-[#111111] focus:bg-[#111111] focus:text-[#FCF9F2] focus:outline-none"
                                    />
                                  </div>
                                </>
                              )}

                              <div className="flex items-center gap-1 pl-1 border-l border-[#D8D5CC]">
                                <span className="text-[9px] font-bold text-[#767571]">FINAL:</span>
                                <span className="font-bold text-[#111111]">
                                  {effectiveGrade !== null ? effectiveGrade : '—'} / 20
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-[9px]">
                              <button
                                type="button"
                                onClick={() => setEditingId(item.id)}
                                className="hover:text-[#111111] underline cursor-pointer font-bold"
                              >
                                EDITAR
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="hover:text-red-600 underline cursor-pointer font-bold"
                              >
                                APAGAR
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] tracking-[0.05em] text-[#767571] uppercase pt-0.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleDefense(item.id, item.has_defense)}
                            className="font-bold text-[#111111] hover:underline cursor-pointer"
                          >
                            [ {item.has_defense ? '- REMOVER DEFESA' : '+ ADICIONAR DEFESA'} ]
                          </button>

                          <div className="border-l border-[#D8D5CC] pl-2 flex items-center gap-1">
                            <span className="font-bold text-[#111111]">CAPÍTULOS:</span>
                            <span className={item.volume_ref && item.volume_ref.trim() !== '' ? 'text-[#111111]' : 'text-[#767571]'}>
                              {item.volume_ref && item.volume_ref.trim() !== ''
                                ? item.volume_ref
                                : 'SEM CAPÍTULOS REGISTADOS'}
                            </span>
                          </div>
                        </div>

                        {item.file_url ? (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#111111] text-[#FCF9F2] px-2 py-0.5 hover:bg-[#31312c] transition-colors font-bold inline-flex items-center gap-1"
                          >
                            <span>🗏 {item.file_name || 'DOCUMENTO ARQUIVADO'}</span>
                            <span>&rarr;</span>
                          </a>
                        ) : (
                          <span className="border border-dashed border-[#D8D5CC] px-1.5 py-0.5 text-[#A1A09A]">
                            SEM DOCUMENTO ARQUIVADO
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* FORMULÁRIO DE CRIAÇÃO + UPLOAD DE FICHEIRO */}
          <div className="pt-6 font-mono">
            {isAdding ? (
              <form
                onSubmit={handleAddItem}
                className="bg-[#111111] text-[#FCF9F2] p-4 border border-[#111111] space-y-3 uppercase"
              >
                <div className="flex justify-between items-center border-b border-[#31312C] pb-2">
                  <span className="text-[10px] font-bold text-[#FCF9F2] tracking-[0.1em]">
                    + NOVO ITEM DE AVALIAÇÃO & ARQUIVO DE FICHEIRO
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-[9px] text-[#A1A09A] hover:text-[#FCF9F2] uppercase cursor-pointer"
                  >
                    [ CANCELAR ]
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[10px] uppercase">
                  <div className="space-y-1">
                    <label className="text-[#A1A09A] font-bold text-[9px]">TIPO DE AVALIAÇÃO</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as 'TEORICA' | 'PRATICA')}
                      className="w-full h-8 bg-[#1B1B18] border border-[#31312C] px-2 font-bold text-[#FCF9F2] focus:outline-none uppercase text-[10px]"
                    >
                      <option value="TEORICA">TEÓRICA</option>
                      <option value="PRATICA">PRÁTICA</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[#A1A09A] font-bold text-[9px]">1. NOME / TÍTULO DA PROVA</label>
                    <input
                      type="text"
                      placeholder={newCategory === 'TEORICA' ? 'EX: TESTE 1 — MATÉRIA' : 'EX: LAB 1 — EXPLOIT'}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value.toUpperCase())}
                      className="w-full h-8 bg-[#1B1B18] border border-[#31312C] px-2 font-bold text-[#FCF9F2] focus:outline-none uppercase text-[10px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#A1A09A] font-bold text-[9px]">2. PESO NO RAMO (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={newWeight}
                      onChange={(e) =>
                        setNewWeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full h-8 bg-[#1B1B18] border border-[#31312C] px-2 font-bold text-[#FCF9F2] focus:outline-none uppercase text-[10px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#A1A09A] font-bold text-[9px]">3. DATA DA REALIZAÇÃO / ENTREGA</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full h-8 bg-[#1B1B18] border border-[#31312C] px-2 font-bold text-[#FCF9F2] focus:outline-none uppercase text-[10px] [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#A1A09A] font-bold text-[9px]">4. CAPÍTULOS / MATÉRIA AVALIADA</label>
                    <input
                      type="text"
                      placeholder="EX: CAP. 1 A 4 // REDES"
                      value={newChapters}
                      onChange={(e) => setNewChapters(e.target.value.toUpperCase())}
                      className="w-full h-8 bg-[#1B1B18] border border-[#31312C] px-2 font-bold text-[#FCF9F2] focus:outline-none uppercase text-[10px]"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-3 bg-[#1B1B18] p-3 border border-[#31312C]">
                    <label className="text-[#FCF9F2] font-bold text-[9px] block mb-1">
                      5. ARQUIVAR FICHEIRO / DOCUMENTO (UPLOAD DIRECTO)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e)}
                      disabled={uploading}
                      className="block w-full text-[10px] text-[#A1A09A] file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-[9px] file:font-mono file:font-bold file:bg-[#FCF9F2] file:text-[#111111] hover:file:bg-[#E5E2D9] cursor-pointer"
                    />
                    {uploading && (
                      <span className="text-[9px] text-[#A1A09A] uppercase block mt-1">
                        ENVIANDO FICHEIRO PARA O STORAGE...
                      </span>
                    )}
                    {newFileName && !uploading && (
                      <span className="text-[9px] text-green-400 uppercase block mt-1 font-bold">
                        ✓ FICHEIRO ARQUIVADO: {newFileName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="bg-[#FCF9F2] hover:bg-[#E5E2D9] text-[#111111] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    CONFIRMAR E GUARDAR AVALIAÇÃO
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="w-full font-mono text-[10px] tracking-[0.1em] font-bold uppercase bg-[#111111] text-[#FCF9F2] hover:bg-[#FCF9F2] hover:text-[#111111] p-3.5 border border-[#111111] transition-all cursor-pointer"
              >
                + ADICIONAR ITEM DE AVALIAÇÃO & ARQUIVAR FICHEIROS
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}