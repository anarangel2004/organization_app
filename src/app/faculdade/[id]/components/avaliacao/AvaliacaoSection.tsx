'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { AssessmentItem, AvaliacaoSectionProps } from './types';
import { getItemEffectiveGrade } from './utils';
import { AvaliacaoHeader } from './AvaliacaoHeader';
import { NewAssessmentForm } from './NewAssessmentForm';
import { AssessmentItemRow } from './AssessmentItemRow';

export function AvaliacaoSection({ subjectId, onRefresh }: AvaliacaoSectionProps) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pesos Globais da Cadeira
  const [theoryWeight, setTheoryWeight] = useState<number>(50);
  const [practiceWeight, setPracticeWeight] = useState<number>(50);
  const [isEditingWeights, setIsEditingWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch Dados
  const fetchAssessmentsAndSubject = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);

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

  // Guardar Pesos Globais
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
      alert('ERRO AO GUARDAR PESOS DA CADEIRA.');
    } else {
      setIsEditingWeights(false);
      if (onRefresh) onRefresh();
    }
    setSavingWeights(false);
  };

  // Upload no Storage Supabase
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    targetItemId?: string
  ) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileParts = file.name.split('.');
      const fileExt = fileParts.length > 1 ? fileParts.pop() : '';
      const baseName = fileParts.join('.');
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileNameClean = `${Date.now()}_${cleanBaseName}.${fileExt}`;
      
      const filePath = `${subjectId || 'geral'}/${fileNameClean}`;

      const { error: uploadError } = await supabase.storage
        .from('assessments-files')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        alert(`ERRO NO STORAGE: ${uploadError.message}`);
        return;
      }

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
        alert('FICHEIRO PRÉ-CARREGADO COM SUCESSO!');
        return { fileName: originalFileName, fileUrl: publicUrl };
      }
    } catch (error: any) {
      alert(`ERRO AO PROCESSAR FICHEIRO: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  // Apagar Ficheiro
  const handleDeleteFile = async (itemId: string) => {
    if (!confirm('TEM CERTEZA QUE DESEJA REMOVER O FICHEIRO ANEXADO?')) return;

    await handleUpdateItem(itemId, {
      file_name: null,
      file_url: null,
    });
  };

  // Alterar Notas
  const handleGradeChange = async (
    id: string,
    value: string,
    field: 'grade' | 'defense_grade' = 'grade'
  ) => {
    const cleanValue = value.replace(',', '.');
    const numericValue =
      cleanValue === '' ? null : Math.min(20, Math.max(0, parseFloat(cleanValue) || 0));

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: numericValue } : item))
    );

    const { error } = await supabase
      .from('assessments')
      .update({ [field]: numericValue })
      .eq('id', id);

    if (error) fetchAssessmentsAndSubject();
  };

  // Ativar/Desativar Defesa
  const handleToggleDefense = async (id: string, currentHasDefense: boolean) => {
    const nextHasDefense = !currentHasDefense;

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              has_defense: nextHasDefense,
              defense_grade: nextHasDefense ? item.defense_grade : null,
              defense_date: nextHasDefense ? item.defense_date : null,
            }
          : item
      )
    );

    const updatePayload: Partial<AssessmentItem> = {
      has_defense: nextHasDefense,
    };
    if (!nextHasDefense) {
      updatePayload.defense_grade = null;
      updatePayload.defense_date = null;
    }

    const { error } = await supabase
      .from('assessments')
      .update(updatePayload)
      .eq('id', id);

    if (error) fetchAssessmentsAndSubject();
  };

  // Apagar Item
  const handleDeleteItem = async (id: string) => {
    if (!confirm('TEM CERTEZA QUE DESEJA APAGAR ESTA AVALIAÇÃO?')) return;

    setItems((prev) => prev.filter((item) => item.id !== id));

    const { error } = await supabase.from('assessments').delete().eq('id', id);

    if (error) {
      alert('ERRO AO APAGAR ITEM.');
      fetchAssessmentsAndSubject();
    } else if (onRefresh) {
      onRefresh();
    }
  };

  // Criar Item
  const handleAddItem = async (formData: {
    category: 'TEORICA' | 'PRATICA';
    title: string;
    weight: number;
    date: string;
    chapters: string;
    fileName: string;
    fileUrl: string;
  }) => {
    if (!subjectId) return;

    const categoryItems = items.filter((item) => item.category === formData.category);
    const calculatedIndex = String(categoryItems.length + 1).padStart(2, '0');

    const defaultTitle =
      formData.category === 'TEORICA' ? `TESTE ${calculatedIndex}` : `LAB ${calculatedIndex}`;

    const payload = {
      subject_id: subjectId,
      title: formData.title.trim() ? formData.title.trim().toUpperCase() : defaultTitle,
      category: formData.category,
      weight_percent: formData.weight,
      due_date: formData.date ? formData.date : null,
      volume_ref: formData.chapters.trim() ? formData.chapters.toUpperCase() : null,
      file_name: formData.fileName.trim() ? formData.fileName.trim().toUpperCase() : null,
      file_url: formData.fileUrl.trim() ? formData.fileUrl.trim() : null,
      has_defense: false,
      grade: null,
      defense_grade: null,
      defense_date: null,
    };

    const { data, error } = await supabase
      .from('assessments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      alert('ERRO AO GUARDAR AVALIAÇÃO NA BASE DE DADOS.');
    } else if (data) {
      setItems((prev) => [...prev, data as AssessmentItem]);
      setIsAdding(false);
      if (onRefresh) onRefresh();
    }
  };

  // Atualizar Item
  const handleUpdateItem = async (id: string, updatedFields: Partial<AssessmentItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );

    const { error } = await supabase.from('assessments').update(updatedFields).eq('id', id);

    if (error) fetchAssessmentsAndSubject();
  };

  // Filtros por Ramo
  const teoricaItems = items.filter((item) => item.category === 'TEORICA');
  const praticaItems = items.filter((item) => item.category === 'PRATICA');

  // Cálculos de Médias
  const calculateSubtotalNum = (category: 'TEORICA' | 'PRATICA'): number | null => {
    const categoryItems = items.filter(
      (item) => item.category === category && getItemEffectiveGrade(item) !== null
    );
    const categoryWeight = categoryItems.reduce((acc, item) => acc + item.weight_percent, 0);
    if (categoryWeight === 0) return null;

    const sum = categoryItems.reduce(
      (acc, item) => acc + (getItemEffectiveGrade(item) ?? 0) * (item.weight_percent / 100),
      0
    );
    return sum / (categoryWeight / 100);
  };

  const subtotalTeoricaNum = calculateSubtotalNum('TEORICA');
  const subtotalPraticaNum = calculateSubtotalNum('PRATICA');

  const calculateSubtotal = (category: 'TEORICA' | 'PRATICA') => {
    const val = calculateSubtotalNum(category);
    return val !== null ? val.toFixed(1) : '—';
  };

  const calculateMediaAtual = (): string => {
    const hasTheory = subtotalTeoricaNum !== null;
    const hasPractice = subtotalPraticaNum !== null;

    if (hasTheory && hasPractice) {
      const totalBranchWeight = theoryWeight + practiceWeight;
      if (totalBranchWeight === 0) return '—';
      const weightedGrade =
        (subtotalTeoricaNum * theoryWeight + subtotalPraticaNum * practiceWeight) /
        totalBranchWeight;
      return weightedGrade.toFixed(1);
    } else if (hasTheory) {
      return subtotalTeoricaNum.toFixed(1);
    } else if (hasPractice) {
      return subtotalPraticaNum.toFixed(1);
    }
    return '—';
  };

  return (
    <section id="avaliacao" className="space-y-6 pt-12">
      <AvaliacaoHeader
        theoryWeight={theoryWeight}
        setTheoryWeight={setTheoryWeight}
        practiceWeight={practiceWeight}
        setPracticeWeight={setPracticeWeight}
        isEditingWeights={isEditingWeights}
        setIsEditingWeights={setIsEditingWeights}
        savingWeights={savingWeights}
        onSaveWeights={handleSaveBranchWeights}
        mediaAtual={calculateMediaAtual()}
      />

      {loading ? (
        <div className="font-mono text-[10px] text-[#767571] uppercase py-8">
          CARREGANDO AVALIAÇÕES...
        </div>
      ) : (
        <div className="border-t border-[#111111] space-y-6">
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
                teoricaItems.map((item, idx) => (
                  <AssessmentItemRow
                    key={item.id}
                    item={item}
                    indexStr={String(idx + 1).padStart(2, '0')}
                    isEditing={editingId === item.id}
                    uploading={uploading}
                    onEditToggle={setEditingId}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                    onGradeChange={handleGradeChange}
                    onToggleDefense={handleToggleDefense}
                    onFileUpload={handleFileUpload}
                    onDeleteFile={handleDeleteFile}
                  />
                ))
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
                praticaItems.map((item, idx) => (
                  <AssessmentItemRow
                    key={item.id}
                    item={item}
                    indexStr={String(idx + 1).padStart(2, '0')}
                    isEditing={editingId === item.id}
                    uploading={uploading}
                    onEditToggle={setEditingId}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                    onGradeChange={handleGradeChange}
                    onToggleDefense={handleToggleDefense}
                    onFileUpload={handleFileUpload}
                    onDeleteFile={handleDeleteFile}
                  />
                ))
              )}
            </div>
          </div>

          {/* BOTÃO & FORMULÁRIO DE CRIAR (CAIXA ESCURA NO FINAL) */}
          <div className="pt-2">
            {!isAdding ? (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="w-full bg-[#111111] hover:bg-[#1B1B18] text-[#FCF9F2] py-4 px-6 border border-[#111111] flex items-center justify-between font-mono text-[11px] font-bold tracking-[0.08em] uppercase transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">+</span>
                  <span>ADICIONAR NOVA AVALIAÇÃO</span>
                </div>
                <span className="text-[9px] text-[#A1A09A] group-hover:text-[#FCF9F2] transition-colors">
                  [ TEÓRICA OU PRÁTICA ]
                </span>
              </button>
            ) : (
              <div className="bg-[#111111] border border-[#111111] p-1">
                <div className="flex justify-end p-2 border-b border-[#31312C]">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-[9px] text-[#A1A09A] hover:text-[#FCF9F2] font-mono font-bold cursor-pointer uppercase"
                  >
                    [ CANCELAR ]
                  </button>
                </div>
                <NewAssessmentForm
                  onAddItem={handleAddItem}
                  onFileUpload={handleFileUpload}
                  uploading={uploading}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}