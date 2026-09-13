'use client';

import { useState, useEffect, use, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

import { Chapter, NotebookTab, PaperStyle } from './components/types';
import { NotebookHeader } from './components/NotebookHeader';
import { NotebookSidebar } from './components/NotebookSidebar';
import { NotebookToolbar } from './components/NotebookToolbar';
import { NotebookEditor } from './components/editor/NotebookEditor';
import { NotebookSplitView } from './components/NotebookSplitView';

export type SyncStatus = 'synced' | 'saving' | 'error';

function NotebookContent({ subjectId }: { subjectId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  
  const currentTabFromUrl = (searchParams.get('tab') as NotebookTab) || 'TEORICAS';

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeTab, setActiveTab] = useState<NotebookTab>(currentTabFromUrl);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('PAUTADO');

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSplitViewOpen, setIsSplitViewOpen] = useState<boolean>(false);
  const [splitViewWidth, setSplitViewWidth] = useState<number>(420);
  const [, setIsLoading] = useState<boolean>(true);

  // Estados para o modal de novo capítulo
  const [isNewChapterModalOpen, setIsNewChapterModalOpen] = useState<boolean>(false);
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');

  // Sincroniza o estado caso a URL mude externamente
  useEffect(() => {
    setActiveTab(currentTabFromUrl);
  }, [currentTabFromUrl]);

  // 1. CARREGAR CAPÍTULOS DO SUPABASE
  const fetchChapters = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const mappedChapters: Chapter[] = data.map((item) => ({
        id: item.id,
        subjectId: item.subject_id,
        number: item.number,
        title: item.title,
        category: item.category as NotebookTab,
        content: item.content || '',
        drawingData: item.drawing_data || item.drawing || '',
        pdfUrl: item.pdf_url,
        pdfName: item.pdf_name,
        isCompleted: Boolean(item.is_completed),
        createdAt: item.created_at,
        updatedAt: new Date(item.updated_at).toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));

      setChapters(mappedChapters);

      setSelectedChapterId((prevId) => {
        if (prevId && mappedChapters.some((c) => c.id === prevId)) {
          return prevId;
        }
        const firstInTab = mappedChapters.find((c) => c.category === currentTabFromUrl);
        return firstInTab ? firstInTab.id : '';
      });
    }
    setIsLoading(false);
  }, [subjectId, currentTabFromUrl, supabase]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  // 2. ABRIR MODAL / CRIAR NOVO CAPÍTULO NO SUPABASE
  const handleOpenAddChapterModal = () => {
    setNewChapterTitle('');
    setIsNewChapterModalOpen(true);
  };

  const executeAddChapter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const finalTitle = newChapterTitle.trim() || 'NOVO CAPÍTULO';

    const categoryChapters = chapters.filter((c) => c.category === activeTab);
    const nextNumber = String(categoryChapters.length + 1).padStart(2, '0');
    const tempId = `temp-${Date.now()}`;
    const nowFormatted = new Date().toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const tempChapter: Chapter = {
      id: tempId,
      subjectId,
      number: nextNumber,
      title: finalTitle.toUpperCase(),
      category: activeTab,
      content: '',
      drawingData: '',
      isCompleted: false,
      updatedAt: nowFormatted,
      createdAt: new Date().toISOString(),
    };

    setChapters((prev) => [...prev, tempChapter]);
    setSelectedChapterId(tempId);
    setIsNewChapterModalOpen(false);

    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert([
          {
            subject_id: subjectId,
            number: nextNumber,
            title: finalTitle.toUpperCase(),
            category: activeTab,
            content: '',
            drawing_data: '',
            is_completed: false,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Erro ao guardar capítulo no Supabase:', error);
        alert(`Não foi possível guardar no Supabase: ${error.message}`);
        setChapters((prev) => prev.filter((c) => c.id !== tempId));
        return;
      }

      if (data) {
        setChapters((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: data.id } : c))
        );
        setSelectedChapterId(data.id);
      }
    } catch (err) {
      console.error('Erro de ligação ao Supabase:', err);
    }
  };

  // 3. ATUALIZAR TEXTO NO SUPABASE COM ATUALIZAÇÃO OTIMISTA DE ESTADO LOCAL
  const handleUpdateContent = async (newContent: string) => {
    if (!selectedChapterId) return;

    setSyncStatus('saving');

    setChapters((prev) =>
      prev.map((c) =>
        c.id === selectedChapterId ? { ...c, content: newContent } : c
      )
    );

    const { error } = await supabase
      .from('chapters')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', selectedChapterId);

    if (error) {
      setSyncStatus('error');
    } else {
      setSyncStatus('synced');
    }
  };

  // 4. ATUALIZAR DESENHO NO SUPABASE
  const handleUpdateDrawing = async (drawingData: string) => {
    if (!selectedChapterId) return;

    setChapters((prev) =>
      prev.map((c) =>
        c.id === selectedChapterId ? { ...c, drawingData } : c
      )
    );

    await supabase
      .from('chapters')
      .update({
        drawing_data: drawingData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedChapterId);
  };

  // 5. UPLOAD DE PDF PARA O SUPABASE STORAGE
  const handlePdfUpload = async (file: File) => {
    if (!selectedChapterId) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${subjectId}/${selectedChapterId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('notebook-pdfs')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Erro ao fazer upload do PDF:', uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('notebook-pdfs')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    const fileName = file.name.toUpperCase();

    const { error: dbError } = await supabase
      .from('chapters')
      .update({ pdf_url: publicUrl, pdf_name: fileName })
      .eq('id', selectedChapterId);

    if (!dbError) {
      setChapters((prev) =>
        prev.map((c) =>
          c.id === selectedChapterId
            ? { ...c, pdfName: fileName, pdfUrl: publicUrl }
            : c
        )
      );
    }
  };

  // 6. REMOVER PDF E APAGAR TODOS OS LINKS ASSOCIADOS
  const handlePdfRemove = async () => {
    if (!selectedChapterId) return;

    const editorEl = document.querySelector('[contenteditable="true"]') as HTMLElement;
    let cleanedContent: string | null = null;

    if (editorEl) {
      const links = editorEl.querySelectorAll('a');

      if (links.length > 0) {
        links.forEach((link) => {
          const parent = link.parentNode;
          while (link.firstChild) {
            parent?.insertBefore(link.firstChild, link);
          }
          parent?.removeChild(link);
        });

        cleanedContent = editorEl.innerHTML;
        editorEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    const currentChapter = chapters.find((c) => c.id === selectedChapterId);
    const finalContent = cleanedContent !== null ? cleanedContent : (currentChapter?.content || '');

    const { error } = await supabase
      .from('chapters')
      .update({ 
        pdf_url: null, 
        pdf_name: null, 
        content: finalContent,
        updated_at: new Date().toISOString() 
      })
      .eq('id', selectedChapterId);

    if (!error) {
      setChapters((prev) =>
        prev.map((c) =>
          c.id === selectedChapterId
            ? { 
                ...c, 
                pdfName: undefined, 
                pdfUrl: undefined, 
                content: finalContent 
              }
            : c
        )
      );
    }
  };

  // 7. APAGAR CAPÍTULO NO SUPABASE
  const handleDeleteChapter = async (id: string) => {
    const { error } = await supabase.from('chapters').delete().eq('id', id);

    if (!error) {
      setChapters((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        if (selectedChapterId === id) {
          const nextInTab = updated.find((c) => c.category === activeTab);
          setSelectedChapterId(nextInTab ? nextInTab.id : '');
        }
        return updated;
      });
    }
  };

  // TROCA DE ABA COM ATUALIZAÇÃO DA URL
  const handleTabChange = (newTab: NotebookTab) => {
    setActiveTab(newTab);
    const tabChapters = chapters.filter((c) => c.category === newTab);
    if (tabChapters.length > 0) {
      setSelectedChapterId(tabChapters[0].id);
    } else {
      setSelectedChapterId('');
    }

    // Atualiza o parâmetro ?tab= na URL sem dar refresh à página
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (!selectedChapterId) return;

    setChapters((prev) =>
      prev.map((c) =>
        c.id === selectedChapterId ? { ...c, title: newTitle } : c
      )
    );

    await supabase
      .from('chapters')
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq('id', selectedChapterId);
  };

  const filteredChapters = chapters.filter((chap) => {
    const matchesTab = chap.category === activeTab;
    const matchesSearch =
      chap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chap.number.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  const activeChapter = chapters.find(
    (c) => c.id === selectedChapterId && c.category === activeTab
  );

  return (
    <div className="flex flex-col h-screen bg-[#F6F4EE] text-[#111111] font-sans antialiased overflow-hidden">
      {/* 1. HEADER */}
      <div className="no-print">
        <NotebookHeader
          subjectId={subjectId}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeChapterId={activeChapter?.id}
          isCompleted={activeChapter?.isCompleted}
          onChapterUpdate={fetchChapters}
          syncStatus={syncStatus}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 2. BARRA LATERAL / ÍNDICE */}
        {isSidebarOpen && (
          <aside className="no-print">
            <NotebookSidebar
              chapters={filteredChapters}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeTab={activeTab}
              onAddChapter={handleOpenAddChapterModal}
              onDeleteChapter={handleDeleteChapter}
            />
          </aside>
        )}

        {/* 3. ÁREA CENTRAL DO EDITOR */}
        {activeChapter && (
          <div className="flex-1 flex flex-col min-w-0 printable-editor">
            <div className="no-print">
              <NotebookToolbar
                paperStyle={paperStyle}
                onPaperStyleChange={setPaperStyle}
                isSplitViewOpen={isSplitViewOpen}
                onToggleSplitView={() => setIsSplitViewOpen(!isSplitViewOpen)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              />
            </div>

            <NotebookEditor
              chapter={activeChapter}
              paperStyle={paperStyle}
              activeTab={activeTab}
              onUpdateDrawing={handleUpdateDrawing}
              onUpdateContent={handleUpdateContent}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>
        )}

        {/* 4. SPLIT VIEW DE PDF */}
        {isSplitViewOpen && (
          <div className="no-print">
            <NotebookSplitView
              chapter={activeChapter}
              subjectId={subjectId}
              width={splitViewWidth}
              onWidthChange={setSplitViewWidth}
              onClose={() => setIsSplitViewOpen(false)}
              onPdfUpload={handlePdfUpload}
              onPdfRemove={handlePdfRemove}
            />
          </div>
        )}
      </div>

      {/* MODAL PERSONALIZADO PARA NOVO CAPÍTULO */}
      {isNewChapterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#F6F4EE] border border-[#111111]/10 rounded-xl shadow-2xl p-6 font-sans">
            <h3 className="text-sm font-semibold tracking-wider text-[#111111] uppercase mb-1">
              Novo Capítulo
            </h3>
            <p className="text-xs text-[#111111]/60 mb-4">
              Insere o título para o capítulo da secção <span className="font-semibold text-[#111111]">{activeTab}</span>.
            </p>

            <form onSubmit={executeAddChapter}>
              <input
                type="text"
                autoFocus
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="EX: INTRODUÇÃO À MATÉRIA"
                className="w-full px-3 py-2 text-sm bg-white border border-[#111111]/20 rounded-lg focus:outline-none focus:border-[#111111] uppercase tracking-wide placeholder:normal-case mb-5"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewChapterModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#111111]/70 hover:text-[#111111] hover:bg-black/5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#111111] hover:bg-[#111111]/90 rounded-lg shadow-sm transition-colors uppercase tracking-wider"
                >
                  Criar Capítulo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubjectNotebookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: subjectId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="p-8 font-mono text-xs uppercase">
          CARREGANDO NOTEBOOK...
        </div>
      }
    >
      <NotebookContent subjectId={subjectId} />
    </Suspense>
  );
}