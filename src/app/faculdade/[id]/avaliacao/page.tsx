'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProjectById, updateProject, Project, EvaluationData } from '@/lib/db';
import { Calculator, Plus, Trash2, FileText, BookOpen, Settings, Check, X } from 'lucide-react';

export default function AvaliacaoPage() {
  const params = useParams();
  const rawId = params?.cadeiraId;
  const cadeiraId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para Edição das Percentagens
  const [isEditingWeights, setIsEditingWeights] = useState(false);
  const [theoryWeightInput, setTheoryWeightInput] = useState<number>(50);
  const [practicalWeightInput, setPracticalWeightInput] = useState<number>(50);

  // Estado do Formulário de Elementos
  const [itemType, setItemType] = useState<'test' | 'project'>('test');
  const [itemName, setItemName] = useState('');
  const [itemWeight, setItemWeight] = useState<number>(50);
  const [itemGrade, setItemGrade] = useState<string>('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUCData() {
      setLoading(true);
      try {
        if (cadeiraId) {
          const data = await getProjectById(cadeiraId);
          if (isMounted && data) {
            setProject(data);
            const tw = data.evaluation_data?.theory_weight ?? 50;
            const pw = data.evaluation_data?.practical_weight ?? 50;
            setTheoryWeightInput(tw);
            setPracticalWeightInput(pw);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar avaliações:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUCData();

    return () => {
      isMounted = false;
    };
  }, [cadeiraId]);

  const evalData = project?.evaluation_data || {
    theory_weight: 50,
    practical_weight: 50,
    tests: [],
    projects: []
  };

  const tests = evalData.tests || [];
  const projects = evalData.projects || [];

  const calculateSubAverage = (items: Array<{ weight: number; grade?: number }>) => {
    if (!items || items.length === 0) return null;
    const graded = items.filter((i) => typeof i.grade === 'number' && !isNaN(i.grade));
    if (graded.length === 0) return null;

    let totalWeight = 0;
    let sum = 0;
    graded.forEach((i) => {
      sum += i.grade! * i.weight;
      totalWeight += i.weight;
    });

    return totalWeight > 0 ? sum / totalWeight : null;
  };

  const theoryAvg = calculateSubAverage(tests);
  const practicalAvg = calculateSubAverage(projects);

  const calculateFinalGrade = () => {
    const tWeight = (evalData.theory_weight || 50) / 100;
    const pWeight = (evalData.practical_weight || 50) / 100;

    if (theoryAvg !== null && practicalAvg !== null) {
      return (theoryAvg * tWeight + practicalAvg * pWeight).toFixed(1);
    } else if (theoryAvg !== null) {
      return theoryAvg.toFixed(1);
    } else if (practicalAvg !== null) {
      return practicalAvg.toFixed(1);
    }
    return null;
  };

  const finalGrade = calculateFinalGrade();

  // Guardar as novas percentagens da Cadeira
  const handleSaveWeights = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newTheory = Math.min(100, Math.max(0, Number(theoryWeightInput) || 0));
    const newPractical = Math.min(100, Math.max(0, Number(practicalWeightInput) || 0));

    const updatedData: EvaluationData = {
      theory_weight: newTheory,
      practical_weight: newPractical,
      tests,
      projects
    };

    if (project) {
      try {
        const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
        setProject(updatedProject);
      } catch {
        setProject({ ...project, evaluation_data: updatedData });
      }
    }

    setIsEditingWeights(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const newItem = {
      id: crypto.randomUUID(),
      name: itemName.trim(),
      weight: Number(itemWeight) || 0,
      grade: itemGrade !== '' ? Number(itemGrade) : undefined
    };

    const updatedData: EvaluationData = {
      theory_weight: evalData.theory_weight || 50,
      practical_weight: evalData.practical_weight || 50,
      tests: [...tests],
      projects: [...projects]
    };

    if (itemType === 'test') {
      updatedData.tests.push(newItem);
    } else {
      updatedData.projects.push(newItem);
    }

    if (project) {
      try {
        const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
        setProject(updatedProject);
      } catch {
        setProject({ ...project, evaluation_data: updatedData });
      }
    } else {
      setProject({
        id: cadeiraId || 'uc-1',
        name: 'Unidade Curricular',
        type: 'academic',
        evaluation_data: updatedData
      });
    }

    setItemName('');
    setItemGrade('');
    setIsAddingItem(false);
  };

  const handleUpdateGrade = async (type: 'test' | 'project', itemId: string, gradeValue: string) => {
    const updatedData: EvaluationData = {
      theory_weight: evalData.theory_weight || 50,
      practical_weight: evalData.practical_weight || 50,
      tests: [...tests],
      projects: [...projects]
    };

    const list = type === 'test' ? updatedData.tests : updatedData.projects;
    const item = list.find((i) => i.id === itemId);
    if (item) {
      item.grade = gradeValue !== '' ? Number(gradeValue) : undefined;
      if (project) {
        try {
          const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
          setProject(updatedProject);
        } catch {
          setProject({ ...project, evaluation_data: updatedData });
        }
      }
    }
  };

  const handleDeleteItem = async (type: 'test' | 'project', itemId: string) => {
    const updatedData: EvaluationData = {
      theory_weight: evalData.theory_weight || 50,
      practical_weight: evalData.practical_weight || 50,
      tests: tests.filter((i) => i.id !== itemId),
      projects: projects.filter((i) => i.id !== itemId)
    };

    if (project) {
      try {
        const updatedProject = await updateProject(project.id, { evaluation_data: updatedData });
        setProject(updatedProject);
      } catch {
        setProject({ ...project, evaluation_data: updatedData });
      }
    }
  };

  if (loading) {
    return (
      <div className="text-slate-500 text-xs py-12 text-center flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <span>A carregar avaliações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo da Nota e Edição de Pesos */}
      <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-xl space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-200">Cálculo de Média Estimada</h2>
              <p className="text-xs text-slate-400">Insere as notas obtidas nos exames e trabalhos.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setTheoryWeightInput(evalData.theory_weight || 50);
                setPracticalWeightInput(evalData.practical_weight || 50);
                setIsEditingWeights(!isEditingWeights);
              }}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5 font-medium bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              {isEditingWeights ? 'Cancelar Edição' : 'Editar Pesos (%)'}
            </button>

            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Média Atual</span>
              <span className={`text-xl font-extrabold ${finalGrade ? (Number(finalGrade) >= 9.5 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
                {finalGrade ? `${finalGrade} / 20` : 'Sem Notas'}
              </span>
            </div>
          </div>
        </div>

        {/* Form para Editar Percentagens (Teórica / Prática) */}
        {isEditingWeights && (
          <form onSubmit={handleSaveWeights} className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4 bg-slate-950/50 p-3 rounded-lg">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Teórica:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={theoryWeightInput}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTheoryWeightInput(val);
                    setPracticalWeightInput(100 - val);
                  }}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-slate-100 focus:outline-none focus:border-sky-500"
                />
                <span className="text-slate-400">%</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Prática:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={practicalWeightInput}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPracticalWeightInput(val);
                    setTheoryWeightInput(100 - val);
                  }}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingWeights(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200"
                title="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Guardar Pesos
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Teórica */}
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" /> Componente Teórica ({evalData.theory_weight}%)
            </h3>
            <span className="text-xs font-semibold text-sky-400">{theoryAvg !== null ? `${theoryAvg.toFixed(1)} / 20` : '-'}</span>
          </div>

          {tests.length === 0 ? (
            <p className="text-slate-500 text-xs py-2">Nenhum teste/exame registado.</p>
          ) : (
            <div className="space-y-2">
              {tests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-slate-200">{test.name}</p>
                    <span className="text-[10px] text-slate-500">Peso: {test.weight}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      placeholder="Nota"
                      value={test.grade ?? ''}
                      onChange={(e) => handleUpdateGrade('test', test.id, e.target.value)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-100 focus:outline-none"
                    />
                    <button onClick={() => handleDeleteItem('test', test.id)} className="text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prática */}
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> Componente Prática ({evalData.practical_weight}%)
            </h3>
            <span className="text-xs font-semibold text-emerald-400">{practicalAvg !== null ? `${practicalAvg.toFixed(1)} / 20` : '-'}</span>
          </div>

          {projects.length === 0 ? (
            <p className="text-slate-500 text-xs py-2">Nenhum trabalho/projeto registado.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((proj) => (
                <div key={proj.id} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-slate-200">{proj.name}</p>
                    <span className="text-[10px] text-slate-500">Peso: {proj.weight}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      placeholder="Nota"
                      value={proj.grade ?? ''}
                      onChange={(e) => handleUpdateGrade('project', proj.id, e.target.value)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-100 focus:outline-none"
                    />
                    <button onClick={() => handleDeleteItem('project', proj.id)} className="text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formulário para Adicionar Elementos */}
      {!isAddingItem ? (
        <button
          onClick={() => setIsAddingItem(true)}
          className="w-full py-2.5 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Adicionar Elemento de Avaliação
        </button>
      ) : (
        <form onSubmit={handleAddItem} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 max-w-md mx-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setItemType('test')}
              className={`py-1.5 rounded text-xs font-semibold border ${itemType === 'test' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
            >
              Teste / Exame
            </button>
            <button
              type="button"
              onClick={() => setItemType('project')}
              className={`py-1.5 rounded text-xs font-semibold border ${itemType === 'project' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
            >
              Trabalho / Projeto
            </button>
          </div>

          <input
            type="text"
            required
            placeholder="Nome (Ex: Frequência 1)"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              required
              min="1"
              max="100"
              placeholder="Peso em %"
              value={itemWeight}
              onChange={(e) => setItemWeight(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
            />
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              placeholder="Nota (Opcional)"
              value={itemGrade}
              onChange={(e) => setItemGrade(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAddingItem(false)} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5">
              Cancelar
            </button>
            <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-4 py-1.5 rounded-lg font-medium">
              Guardar Elemento
            </button>
          </div>
        </form>
      )}
    </div>
  );
}