'use client';

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  Search,
  Plus,
  Upload,
  Trash2,
  Paperclip,
  Check,
  FolderOpen,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { Subject } from '../types';
import { supabase } from '@/lib/supabase';

export type FileCategory = 'Teórico' | 'Prático' | 'Projeto' | 'Teste / Exame';

export interface SubjectFile {
  id: string;
  title: string;
  fileName: string;
  category: FileCategory;
  size?: string;
  date: string;
  fileUrl?: string;
}

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
  onFilesUpdated?: () => void;
}

const CATEGORIES: ('Todas' | FileCategory)[] = [
  'Todas',
  'Teórico',
  'Prático',
  'Projeto',
  'Teste / Exame',
];

export function LibraryModal({
  isOpen,
  onClose,
  subject,
  onFilesUpdated,
}: LibraryModalProps) {
  const [files, setFiles] = useState<SubjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | FileCategory>('Todas');

  const [isAdding, setIsAdding] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FileCategory>('Teórico');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchFiles = async () => {
    if (!subject) return;
    setLoadingFiles(true);

    const { data, error } = await supabase
      .from('subject_files')
      .select('*')
      .eq('subject_id', subject.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar ficheiros:', error.message);
    } else if (data) {
      const formatted: SubjectFile[] = data.map((item) => ({
        id: item.id,
        title: item.title,
        fileName: item.file_name,
        category: item.category as FileCategory,
        size: item.file_size,
        date: new Date(item.created_at).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'short',
        }),
        fileUrl: item.file_url,
      }));
      setFiles(formatted);
    }
    setLoadingFiles(false);
  };

  useEffect(() => {
    if (isOpen && subject) {
      fetchFiles();
    }
  }, [isOpen, subject]);

  if (!isOpen || !subject) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedFile || !subject) {
      alert('Por favor, preenche todos os campos obrigatórios.');
      return;
    }

    setUploading(true);
    let fileUrl = '';

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${subject.id}/${Date.now()}.${fileExt}`;
      const { data: storageData } = await supabase.storage
        .from('subject-files')
        .upload(filePath, selectedFile);

      if (storageData) {
        const { data: urlData } = supabase.storage
          .from('subject-files')
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }
    } catch {
      // Caso não exista storage configurado
    }

    const fileSizeStr = formatFileSize(selectedFile.size);

    const { error: dbError } = await supabase.from('subject_files').insert([
      {
        subject_id: subject.id,
        title: title.trim(),
        file_name: selectedFile.name,
        category,
        file_size: fileSizeStr,
        file_url: fileUrl,
      },
    ]);

    if (dbError) {
      console.error('Erro ao guardar ficheiro:', dbError.message);
      alert('Erro ao guardar ficheiro na base de dados!');
      setUploading(false);
      return;
    }

    const updatedCount = files.length + 1;
    await supabase
      .from('subjects')
      .update({ files_count: updatedCount })
      .eq('id', subject.id);

    if (onFilesUpdated) {
      onFilesUpdated();
    }

    await fetchFiles();
    setTitle('');
    setCategory('Teórico');
    setSelectedFile(null);
    setIsAdding(false);
    setUploading(false);
  };

  const handleDeleteFile = async (id: string) => {
    const { error } = await supabase.from('subject_files').delete().eq('id', id);

    if (error) {
      console.error('Erro ao eliminar ficheiro:', error.message);
      alert('Erro ao eliminar ficheiro!');
      return;
    }

    const updatedCount = Math.max(0, files.length - 1);

    await supabase
      .from('subjects')
      .update({ files_count: updatedCount })
      .eq('id', subject.id);

    if (onFilesUpdated) {
      onFilesUpdated();
    }

    fetchFiles();
  };

  const handleCancelAdd = () => {
    setTitle('');
    setCategory('Teórico');
    setSelectedFile(null);
    setIsAdding(false);
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Todas' || file.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeClass = (cat: FileCategory) => {
    switch (cat) {
      case 'Teórico':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Prático':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Projeto':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Teste / Exame':
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      {/* ALTURA FIXA: h-[580px] */}
      <div className="bg-[#f7f6f2] border border-slate-300 w-full max-w-2xl h-[580px] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* CABEÇALHO (Altura Fixa) */}
        <div className="p-5 bg-white border-b border-slate-200 flex justify-between items-start shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
              {subject.code}
            </span>
            <h2 className="text-xl font-serif font-bold text-slate-900 mt-1.5 flex items-center gap-2">
              {isAdding ? (
                <>
                  <Upload className="w-5 h-5 text-amber-600" /> Adicionar Ficheiro
                </>
              ) : (
                <>
                  <FolderOpen className="w-5 h-5 text-amber-600" /> Biblioteca de {subject.name}
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdding
                ? 'Preenche os detalhes abaixo para carregar um novo documento.'
                : `${files.length} ficheiro(s) guardado(s).`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. MODO: ADICIONAR FICHEIRO */}
        {isAdding ? (
          <form onSubmit={handleAddFile} className="p-6 space-y-4 flex-1 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título do Ficheiro / Documento *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sebenta de Apoio Capítulo 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['Teórico', 'Prático', 'Projeto', 'Teste / Exame'] as FileCategory[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`text-xs py-2 px-2 rounded-xl border text-center transition-all cursor-pointer font-medium ${
                          category === cat
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Anexar Ficheiro *
                </label>
                <label className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white p-5 rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs text-slate-600 cursor-pointer transition-colors">
                  <Paperclip className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-700 truncate max-w-[300px]">
                    {selectedFile ? selectedFile.name : 'Clique para selecionar o ficheiro'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    PDF, DOCX, ZIP, PNG, etc.
                  </span>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={handleCancelAdd}
                disabled={uploading}
                className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Lista
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs px-5 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> A guardar...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Guardar Ficheiro
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* 2. MODO: LISTA DE FICHEIROS */
          <>
            {/* Filtros e Barra de Pesquisa (Altura Fixa) */}
            <div className="p-4 bg-white/70 border-b border-slate-200 space-y-3 shrink-0">
              <div className="flex justify-between items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar ficheiro..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>
                <button
                  onClick={() => setIsAdding(true)}
                  className="bg-slate-900 hover:bg-black text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Ficheiro
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                  Filtro:
                </span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap font-medium ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area (Ajusta-se ao espaço restante sem redimensionar o modal) */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingFiles ? (
                <div className="h-full flex items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">A carregar ficheiros...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs space-y-1.5">
                  <FileText className="w-9 h-9 text-slate-300" />
                  <p className="font-medium text-slate-500">
                    Nenhum ficheiro encontrado nesta categoria.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Clica em <strong>"Adicionar Ficheiro"</strong> para carregar o teu primeiro documento.
                  </p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white border border-slate-200/90 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-300 transition-all hover:shadow-2xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {file.title}
                          </p>
                          <span
                            className={`text-[9px] font-bold border px-1.5 py-0.2 rounded-md ${getCategoryBadgeClass(
                              file.category
                            )}`}
                          >
                            {file.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="truncate max-w-[180px]">{file.fileName}</span>
                          <span>•</span>
                          <span>{file.size}</span>
                          <span>•</span>
                          <span>{file.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {file.fileUrl && (
                        <a
                          href={file.fileUrl}
                          download={file.fileName}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Descarregar ficheiro"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar ficheiro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* RODAPÉ (Altura Fixa) */}
            <div className="p-3 bg-slate-100/80 border-t border-slate-200 text-right shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}