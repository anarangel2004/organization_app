'use client';

import { useState, useMemo, useEffect } from 'react';
import { FolderOpen, SearchX, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface ResourceItem {
  id: string;
  title: string;
  url: string;
  type: 'PDF' | 'ZIP' | 'LINK';
  category: 'TEÓRICAS' | 'PRÁTICAS' | 'EXAMES' | 'GERAL';
  vol?: string;
  createdAt: string;
  fileName: string;
}

interface Props {
  subjectId?: string;
}

const ITEMS_PER_PAGE = 12; // 8 de cada lado na grelha de 2 colunas

export function BibliotecaSection({ subjectId }: Props) {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'TODOS' | 'TEÓRICAS' | 'PRÁTICAS' | 'EXAMES' | 'GERAL'>('TODOS');
  
  const [sortBy, setSortBy] = useState<'created' | 'title'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estado da Paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Estado do Modal (Criação / Edição)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'PDF' | 'ZIP' | 'LINK'>('PDF');
  const [newCategory, setNewCategory] = useState<'TEÓRICAS' | 'PRÁTICAS' | 'EXAMES' | 'GERAL'>('TEÓRICAS');
  const [newVol, setNewVol] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Reset da página quando se altera o filtro de pesquisa ou aba
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [search, activeTab, sortBy, sortOrder]);

  // 1. CARREGAR FICHEIROS
  // Cada disciplina só pode ver os seus próprios ficheiros: sem um subjectId
  // válido não fazemos pedido nenhum (evita mostrar/misturar ficheiros de
  // outras disciplinas enquanto o subject ainda está a carregar).
  const fetchResources = async () => {
    if (!subjectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subject_files')
        .select('*')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData: ResourceItem[] = data.map((item) => {
          let detectedType: 'PDF' | 'ZIP' | 'LINK' = 'LINK';
          if (item.file_name?.endsWith('.pdf') || item.file_url?.endsWith('.pdf')) detectedType = 'PDF';
          else if (item.file_name?.match(/\.(zip|rar|7z)$/i)) detectedType = 'ZIP';

          let extractedVol = undefined;
          let cleanTitle = item.title;
          const volMatch = item.title?.match(/^(.*?)\s*\((VOL\.\s*[^)]+)\)$/i);
          if (volMatch) {
            cleanTitle = volMatch[1];
            extractedVol = volMatch[2];
          }

          return {
            id: item.id,
            title: cleanTitle,
            type: detectedType,
            category: (item.category as ResourceItem['category']) || 'GERAL',
            vol: extractedVol,
            url: item.file_url || '#',
            fileName: item.file_name || item.title,
            createdAt: item.created_at,
          };
        });
        setItems(formattedData);
      }
    } catch (err) {
      console.error('Erro ao carregar subject_files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchResources não é memoizada; depende só do subjectId
  }, [subjectId]);

  // RESET / ABRIR MODAL CRIAÇÃO
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setNewTitle('');
    setNewType('PDF');
    setNewCategory('TEÓRICAS');
    setNewVol('');
    setNewUrl('');
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  // ABRIR MODAL EDIÇÃO
  const handleOpenEditModal = (item: ResourceItem) => {
    setEditingItem(item);
    setNewTitle(item.title);
    setNewType(item.type);
    setNewCategory(item.category);
    setNewVol(item.vol || '');
    setNewUrl(item.type === 'LINK' ? item.url : '');
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  // AUTO VOLUME
  const handleAutoNextVol = () => {
    let maxVolNum = 0;
    items.forEach((item) => {
      if (item.vol) {
        const match = item.vol.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxVolNum) maxVolNum = num;
        }
      }
    });

    const nextVol = maxVolNum + 1;
    const formattedNext = nextVol < 10 ? `VOL. 0${nextVol}` : `VOL. ${nextVol}`;
    setNewVol(formattedNext);
  };

  // 2. GUARDAR / EDITAR FICHEIRO
  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectId) {
      alert('Não foi possível identificar a disciplina desta biblioteca. Recarrega a página e tenta novamente.');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalUrl = editingItem ? editingItem.url : newUrl.trim();
      const fileNameToSave = selectedFile 
        ? selectedFile.name 
        : (editingItem ? editingItem.fileName : newTitle);

      if (newType !== 'LINK' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const safePath = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('academic_materials')
          .upload(safePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('academic_materials')
          .getPublicUrl(safePath);

        finalUrl = publicUrlData.publicUrl;
      }

      let titleToUse = newTitle.trim() || fileNameToSave;
      let formattedVol: string | undefined = undefined;

      if (newVol.trim()) {
        const uppercaseVol = newVol.trim().toUpperCase();
        formattedVol = uppercaseVol.startsWith('VOL.') ? uppercaseVol : `VOL. ${uppercaseVol}`;
        titleToUse = `${titleToUse} (${formattedVol})`;
      }

      if (editingItem) {
        const { error: dbError } = await supabase
          .from('subject_files')
          .update({
            title: titleToUse,
            file_name: fileNameToSave,
            category: newCategory,
            file_url: finalUrl,
          })
          .eq('id', editingItem.id);

        if (dbError) throw dbError;

        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? {
                  ...item,
                  title: newTitle.trim() || fileNameToSave,
                  type: newType,
                  category: newCategory,
                  vol: formattedVol,
                  url: finalUrl,
                  fileName: fileNameToSave,
                }
              : item
          )
        );
      } else {
        const { data: insertedData, error: dbError } = await supabase
          .from('subject_files')
          .insert([
            {
              subject_id: subjectId,
              title: titleToUse,
              file_name: fileNameToSave,
              category: newCategory,
              file_url: finalUrl,
            },
          ])
          .select()
          .single();

        if (dbError) throw dbError;

        if (insertedData) {
          const newItem: ResourceItem = {
            id: insertedData.id,
            title: newTitle.trim() || fileNameToSave,
            type: newType,
            category: insertedData.category as ResourceItem['category'],
            vol: formattedVol,
            url: insertedData.file_url,
            fileName: insertedData.file_name,
            createdAt: insertedData.created_at,
          };
          setItems((prev) => [newItem, ...prev]);
        }
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao guardar em subject_files:', err);
      alert(`Erro ao guardar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. APAGAR FICHEIRO
  const handleDeleteResource = async (item: ResourceItem) => {
    const confirmDelete = window.confirm(`Tens a certeza que pretendes apagar "${item.title}"?`);
    if (!confirmDelete) return;

    try {
      const { error: dbError } = await supabase
        .from('subject_files')
        .delete()
        .eq('id', item.id);

      if (dbError) throw dbError;

      if (item.type !== 'LINK' && item.url) {
        const urlParts = item.url.split('/academic_materials/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('academic_materials').remove([filePath]);
        }
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error('Erro ao apagar recurso:', err);
      alert(`Erro ao apagar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  const handleOpen = (url: string) => {
    if (url && url !== '#') {
      window.open(url, '_blank');
    }
  };

  // FILTRAGEM E ORDENAÇÃO
  const filteredResources = useMemo(() => {
    return items
      .filter((item) => {
        const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
        const matchesTab = activeTab === 'TODOS' || item.category === activeTab;
        return matchesSearch && matchesTab;
      })
      .sort((a, b) => {
        const valA = sortBy === 'title' ? a.title.toLowerCase() : new Date(a.createdAt).getTime();
        const valB = sortBy === 'title' ? b.title.toLowerCase() : new Date(b.createdAt).getTime();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [items, search, activeTab, sortBy, sortOrder]);

  // CÁLCULO DA PAGINAÇÃO
  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);

  const paginatedResources = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResources.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredResources, currentPage]);

  return (
    <section className="space-y-6 relative">
      <div>
        <span className="text-[10px] tracking-[0.12em] text-[#767571] uppercase block mb-1">
          SECÇÃO 04 // RECURSOS DE ESTUDO
        </span>
        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
          BIBLIOTECA.
        </h2>
      </div>

      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="PESQUISAR RECURSO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#F2EFE9] border border-neutral-300 px-4 py-2 text-xs font-mono uppercase focus:outline-none focus:border-black w-full md:w-72 placeholder:text-neutral-400"
          />

          <button
            onClick={handleOpenCreateModal}
            disabled={!subjectId}
            title={!subjectId ? 'A carregar disciplina...' : undefined}
            className="bg-[#111111] text-[#FCF9F2] px-4 py-2 text-xs font-mono font-bold uppercase hover:bg-neutral-800 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>+</span> ADICIONAR
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {(['TODOS', 'TEÓRICAS', 'PRÁTICAS', 'EXAMES', 'GERAL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase border cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'bg-[#F2EFE9] text-neutral-500 border-neutral-300 hover:text-black'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-[10px] uppercase text-neutral-500 pt-2 border-t border-neutral-200">
        <div className="flex items-center gap-2">
          <span>ORDENAR:</span>
          {[
            { key: 'created', label: 'CRIAÇÃO' },
            { key: 'title', label: 'A-Z' },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => setSortBy(mode.key as 'created' | 'title')}
              className={`px-2 py-0.5 border cursor-pointer ${
                sortBy === mode.key
                  ? 'border-black font-bold text-black bg-[#F2EFE9]'
                  : 'border-transparent hover:text-black'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="border border-neutral-300 px-2 py-0.5 hover:border-black text-black font-bold flex items-center gap-1 cursor-pointer"
        >
          {sortOrder === 'desc' ? 'ORDEM: DESC [↓]' : 'ORDEM: ASC [↑]'}
        </button>
      </div>

      <div className="border-b border-black w-full" />

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest">A CARREGAR FICHEIROS...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0">
            {paginatedResources.map((item) => (
              <div
                key={item.id}
                className="py-3 border-b border-neutral-300 flex items-center justify-between gap-3 hover:bg-[#F2EFE9]/60 transition-colors px-1 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="bg-neutral-200 text-[#111111] text-[10px] font-mono font-bold px-2 py-1 shrink-0 uppercase">
                    {item.type}
                  </span>
                  <div className="truncate">
                    <h4 className="font-bold text-xs sm:text-sm text-[#111111] truncate" title={item.title}>
                      {item.title}
                    </h4>
                    <span className="font-mono text-[9px] text-neutral-400 block uppercase truncate">
                      {item.fileName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline font-mono text-[10px] text-neutral-400 uppercase mr-1">
                    {item.vol ? `${item.vol} · ` : ''}{item.category}
                  </span>

                  <button
                    onClick={() => handleOpen(item.url)}
                    className="border border-black bg-white px-2.5 py-1 font-mono text-xs font-bold uppercase hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    ABRIR <span className="text-sm">→</span>
                  </button>

                  <div className="flex items-center gap-1 border-l border-neutral-300 pl-2">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      title="Editar Recurso"
                      className="p-1 font-mono text-[10px] text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteResource(item)}
                      title="Apagar Recurso"
                      className="p-1 font-mono text-[10px] text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CONTROLO DE PAGINAÇÃO COM SETAS */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 font-mono text-xs border-t border-neutral-200">
              <span className="text-neutral-500 text-[11px] uppercase">
                MOSTRANDO {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredResources.length)} DE {filteredResources.length} RECURSOS
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-black bg-white font-bold uppercase hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black cursor-pointer disabled:cursor-not-allowed"
                >
                  ← ANTERIOR
                </button>

                <span className="px-3 py-1.5 font-bold border border-neutral-300 bg-[#F2EFE9]">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-black bg-[#111111] text-[#FCF9F2] font-bold uppercase hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:hover:bg-[#111111] disabled:hover:text-[#FCF9F2] cursor-pointer disabled:cursor-not-allowed"
                >
                  SEGUINTE →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && filteredResources.length === 0 && (
        <div className="border-2 border-dashed border-neutral-300 bg-[#F2EFE9]/50 py-16 px-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#111111] flex items-center justify-center">
            {items.length === 0 ? (
              <FolderOpen className="w-5 h-5 text-[#FCF9F2]" />
            ) : (
              <SearchX className="w-5 h-5 text-[#FCF9F2]" />
            )}
          </div>

          {items.length === 0 ? (
            <>
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#111111]">
                ESTA BIBLIOTECA AINDA NÃO TEM FICHEIROS
              </h3>
              <p className="font-mono text-[11px] text-neutral-500 uppercase max-w-xs leading-relaxed">
                Os recursos que adicionares aqui ficam exclusivos desta disciplina.
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-2 bg-[#111111] text-[#FCF9F2] px-4 py-2 text-xs font-mono font-bold uppercase hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>+</span> ADICIONAR PRIMEIRO FICHEIRO
              </button>
            </>
          ) : (
            <>
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#111111]">
                SEM RESULTADOS
              </h3>
              <p className="font-mono text-[11px] text-neutral-500 uppercase max-w-xs leading-relaxed">
                Nenhum recurso corresponde à pesquisa ou ao filtro selecionado.
              </p>
            </>
          )}
        </div>
      )}

      {/* MODAL (CRIAR / EDITAR) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FCF9F2] border-2 border-black p-6 w-full max-w-md space-y-5 shadow-[8px_8px_0px_0px_#111111]">
            <div className="flex justify-between items-center border-b border-black pb-3">
              <h3 className="font-mono text-sm font-black uppercase text-[#111111]">
                {editingItem ? '[✎] EDITAR RECURSO' : '[+] NOVO RECURSO'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="font-mono text-xs font-bold hover:text-red-600 cursor-pointer"
              >
                [X]
              </button>
            </div>

            <form onSubmit={handleSaveResource} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1 font-bold">
                    TIPO
                  </label>
                  <select
                    value={newType}
                    disabled={!!editingItem}
                    onChange={(e) => {
                      setNewType(e.target.value as 'PDF' | 'ZIP' | 'LINK');
                      setSelectedFile(null);
                      setNewUrl('');
                    }}
                    className="w-full bg-[#F2EFE9] border border-neutral-400 p-2.5 uppercase focus:outline-none focus:border-black cursor-pointer disabled:opacity-60"
                  >
                    <option value="PDF">PDF (FICHEIRO)</option>
                    <option value="ZIP">ZIP / COMPACTADO</option>
                    <option value="LINK">LINK / URL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1 font-bold">
                    CATEGORIA
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ResourceItem['category'])}
                    className="w-full bg-[#F2EFE9] border border-neutral-400 p-2.5 uppercase focus:outline-none focus:border-black cursor-pointer"
                  >
                    <option value="TEÓRICAS">TEÓRICAS</option>
                    <option value="PRÁTICAS">PRÁTICAS</option>
                    <option value="EXAMES">EXAMES</option>
                    <option value="GERAL">GERAL</option>
                  </select>
                </div>
              </div>

              {newType === 'LINK' ? (
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1 font-bold">
                    URL / LINK *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/documento"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-[#F2EFE9] border border-neutral-400 p-2.5 focus:outline-none focus:border-black"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1 font-bold">
                    {editingItem ? 'SUBSTITUIR FICHEIRO (OPCIONAL)' : `SELECIONAR FICHEIRO (${newType}) *`}
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      required={!editingItem && !selectedFile}
                      accept={newType === 'PDF' ? '.pdf' : '.zip,.rar,.7z'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          if (!newTitle) setNewTitle(file.name);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full bg-[#F2EFE9] border border-neutral-400 p-2.5 text-neutral-600 truncate flex items-center justify-between">
                      <span className="truncate text-xs">
                        {selectedFile
                          ? selectedFile.name
                          : editingItem
                          ? `MANTER: ${editingItem.fileName}`
                          : `CARREGAR FICHEIRO ${newType}...`}
                      </span>
                      <span className="text-[10px] font-bold bg-[#111111] text-[#FCF9F2] px-2 py-0.5 ml-2 shrink-0 uppercase">
                        PROCURAR
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-neutral-500 mb-1 font-bold">
                  TÍTULO DO RECURSO (OPCIONAL)
                </label>
                <input
                  type="text"
                  placeholder={selectedFile ? selectedFile.name : 'Ex: Guião de Laboratório'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#F2EFE9] border border-neutral-400 p-2.5 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] uppercase text-neutral-500 font-bold">
                    VOLUME (OPCIONAL)
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoNextVol}
                    className="text-[9px] font-bold uppercase underline hover:text-black text-neutral-600 cursor-pointer"
                  >
                    + VOL AUTO
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ex: VOL. 01, 02 ou personalizado"
                  value={newVol}
                  onChange={(e) => setNewVol(e.target.value)}
                  className="w-full bg-[#F2EFE9] border border-neutral-400 p-2.5 uppercase focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#111111] text-[#FCF9F2] py-2.5 font-bold uppercase hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'A GUARDAR...' : editingItem ? 'ATUALIZAR' : 'GUARDAR FICHEIRO'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-neutral-400 px-4 py-2.5 font-bold uppercase hover:border-black cursor-pointer"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}