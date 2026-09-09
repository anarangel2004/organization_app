'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  getProjects, 
  createProject, 
  deleteProject, 
  Project, 
  EvaluationData 
} from '@/lib/db';
import { 
  GraduationCap, 
  Plus, 
  Trash2, 
  BookOpen, 
  Calculator, 
  X, 
  ArrowRight,
  Percent
} from 'lucide-react';

const PRESET_COLORS = [
  '#3b82f6', // Azul
  '#06b6d4', // Ciano
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#10b981', // Verde
  '#f59e0b', // Âmbar
];

export default function FaculdadePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [theoryWeight, setTheoryWeight] = useState(50);
  const [practicalWeight, setPracticalWeight] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await getProjects('academic');
      setProjects(data);
    } catch (err) {
      console.error('Erro ao carregar cadeiras:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateCadeira = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const evaluationData: EvaluationData = {
        theory_weight: Number(theoryWeight),
        practical_weight: Number(practicalWeight),
        tests: [],
        projects: [],
      };

      await createProject({
        name: name.trim(),
        color: selectedColor,
        context: 'academic',
        evaluation_data: evaluationData,
      });

      setName('');
      setTheoryWeight(50);
      setPracticalWeight(50);
      setIsModalOpen(false);
      await loadProjects();
    } catch (err) {
      console.error('Erro ao criar cadeira:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tens a certeza que queres eliminar a cadeira "${name}"?`)) return;
    
    try {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      console.error('Erro ao eliminar cadeira:', err);
    }
  };

  // Função para calcular a média estimada com base nos dados de avaliação
  const calculateAverage = (evalData?: EvaluationData) => {
    if (!evalData) return null;
    
    const allItems = [...(evalData.tests || []), ...(evalData.projects || [])];
    const gradedItems = allItems.filter(i => typeof i.grade === 'number');
    
    if (gradedItems.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    gradedItems.forEach(item => {
      weightedSum += (item.grade! * item.weight);
      totalWeight += item.weight;
    });

    if (totalWeight === 0) return null;
    return (weightedSum / totalWeight).toFixed(1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabecalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <GraduationCap className="w-4 h-4" /> Mestrado em Cibersegurança
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Cadeiras & Avaliações</h1>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow-md shadow-sky-600/20"
        >
          <Plus className="w-4 h-4" /> Adicionar Cadeira
        </button>
      </div>

      {/* Lista de Unidades Curriculares */}
      {loading ? (
        <div className="text-slate-500 text-xs py-10 text-center">A carregar cadeiras...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">Nenhuma cadeira registada</h3>
          <p className="text-slate-500 text-xs mt-1 mb-4">Adiciona as disciplinas do semestre para acompanhar as notas e entregas.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Criar a primeira cadeira
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const avg = calculateAverage(p.evaluation_data);
            return (
              <div
                key={p.id}
                className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color || '#06b6d4' }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        UC
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                      title="Eliminar cadeira"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h2 className="text-base font-bold text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-1">
                    {p.name}
                  </h2>

                  {/* Ponderações Teórica/Prática */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-sky-400" /> Teórica: {p.evaluation_data?.theory_weight ?? 50}%
                    </span>
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-emerald-400" /> Prática: {p.evaluation_data?.practical_weight ?? 50}%
                    </span>
                  </div>
                </div>

                {/* Média Atual & Acesso Detalhado */}
                <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Média:</span>
                    <span className={`text-sm font-bold ${avg ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {avg ? `${avg} / 20` : 'Sem notas'}
                    </span>
                  </div>

                  <Link
                    href={`/faculdade/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  >
                    Gerir <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação de Cadeira */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-sky-400" /> Nova Cadeira
            </h2>
            <p className="text-xs text-slate-400 mb-5">Adiciona uma unidade curricular do Mestrado.</p>

            <form onSubmit={handleCreateCadeira} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nome da Cadeira</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cibersegurança em Redes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Cor Identificadora</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        selectedColor === color ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Peso Teórico (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={theoryWeight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTheoryWeight(val);
                      setPracticalWeight(100 - val);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Peso Prático (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={practicalWeight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPracticalWeight(val);
                      setTheoryWeight(100 - val);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-md shadow-sky-600/20 disabled:opacity-50"
                >
                  {submitting ? 'A guardar...' : 'Criar Cadeira'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}