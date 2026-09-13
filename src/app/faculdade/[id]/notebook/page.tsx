'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase'; // Ajusta o caminho para o teu cliente Supabase

import { Chapter, NotebookTab, PaperStyle } from './components/types';
import { NotebookHeader } from './components/NotebookHeader';
import { NotebookSidebar } from './components/NotebookSidebar';
import { NotebookToolbar } from './components/NotebookToolbar';
import { NotebookEditor } from './components/editor/NotebookEditor';
import { NotebookSplitView } from './components/NotebookSplitView';

function NotebookContent({ subjectId }: { subjectId: string }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as NotebookTab) || 'TEORICAS';

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeTab, setActiveTab] = useState<NotebookTab>(initialTab);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('PAUTADO');

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSplitViewOpen, setIsSplitViewOpen] = useState<boolean>(false);
  const [splitViewWidth, setSplitViewWidth] = useState<number>(420);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. CARREGAR CAPÍTULOS DO SUPABASE (COM DESENHOS INCLUÍDOS)
  useEffect(() => {
    async function fetchChapters() {
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
          drawingData: item.drawing_data || item.drawing || '', // CORRIGIDO: Mapeia o desenho do Supabase
          pdfUrl: item.pdf_url,
          pdfName: item.pdf_name,
          createdAt: item.created_at,
          updatedAt: new Date(item.updated_at).toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));

        setChapters(mappedChapters);

        const firstInTab = mappedChapters.find((c) => c.category === initialTab);
        if (firstInTab) {
          setSelectedChapterId(firstInTab.id);
        }
      }
      setIsLoading(false);
    }

    fetchChapters();
  }, [subjectId, initialTab]);

  // 2. CRIAR NOVO CAPÍTULO NO SUPABASE
  const handleAddChapter = async (title: string) => {
    if (!title || !title.trim()) return;

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
      title: title.toUpperCase(),
      category: activeTab,
      content: '',
      drawingData: '',
      updatedAt: nowFormatted,
      createdAt: new Date().toISOString(),
    };

    setChapters((prev) => [...prev, tempChapter]);
    setSelectedChapterId(tempId);

    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert([
          {
            subject_id: subjectId,
            number: nextNumber,
            title: title.toUpperCase(),
            category: activeTab,
            content: '',
            drawing_data: '',
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

  // 3. ATUALIZAR TEXTO NO SUPABASE
  const handleUpdateContent = async (newContent: string) => {
    if (!selectedChapterId) return;

    const nowFormatted = new Date().toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setChapters((prev) =>
      prev.map((c) =>
        c.id === selectedChapterId
          ? { ...c, content: newContent, updatedAt: nowFormatted }
          : c
      )
    );

    await supabase
      .from('chapters')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', selectedChapterId);
  };

  // 4. ATUALIZAR DESENHO NO SUPABASE (CORRIGIDO)
  const handleUpdateDrawing = async (drawingData: string) => {
    if (!selectedChapterId) return;

    // Actualiza o estado da lista de capítulos na UI
    setChapters((prev) =>
      prev.map((c) =>
        c.id === selectedChapterId ? { ...c, drawingData } : c
      )
    );

    // Guarda diretamente na coluna 'drawing_data' da tabela 'chapters'
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

  // 6. REMOVER PDF
  const handlePdfRemove = async () => {
    if (!selectedChapterId) return;

    const { error } = await supabase
      .from('chapters')
      .update({ pdf_url: null, pdf_name: null })
      .eq('id', selectedChapterId);

    if (!error) {
      setChapters((prev) =>
        prev.map((c) =>
          c.id === selectedChapterId
            ? { ...c, pdfName: undefined, pdfUrl: undefined }
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

  const handleTabChange = (newTab: NotebookTab) => {
    setActiveTab(newTab);
    const tabChapters = chapters.filter((c) => c.category === newTab);
    if (tabChapters.length > 0) {
      setSelectedChapterId(tabChapters[0].id);
    } else {
      setSelectedChapterId('');
    }
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
      <NotebookHeader
        subjectId={subjectId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ÍNDICE ESQUERDO */}
        {isSidebarOpen && (
          <NotebookSidebar
            chapters={filteredChapters}
            selectedChapterId={selectedChapterId}
            onSelectChapter={setSelectedChapterId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab={activeTab}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
          />
        )}

        {/* ÁREA CENTRAL E SPLIT VIEW */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center font-mono text-xs uppercase bg-[#FAF8F3]">
            A carregar dados do Supabase...
          </div>
        ) : activeChapter ? (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              <NotebookToolbar
                paperStyle={paperStyle}
                onPaperStyleChange={setPaperStyle}
                isSplitViewOpen={isSplitViewOpen}
                onToggleSplitView={() => setIsSplitViewOpen(!isSplitViewOpen)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              />

              <NotebookEditor
                chapter={activeChapter}
                paperStyle={paperStyle}
                activeTab={activeTab}
                onUpdateDrawing={handleUpdateDrawing}
                onUpdateContent={handleUpdateContent}
                onUpdateTitle={handleUpdateTitle}
              />
            </div>

            {isSplitViewOpen && (
              <NotebookSplitView
                chapter={activeChapter}
                subjectId={subjectId}
                width={splitViewWidth}
                onWidthChange={setSplitViewWidth}
                onClose={() => setIsSplitViewOpen(false)}
                onPdfUpload={handlePdfUpload}
                onPdfRemove={handlePdfRemove}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#FAF8F3] p-8 border-r border-[#D8D5CC]">
            <div className="border border-[#D8D5CC] bg-[#EBE8DF] p-8 max-w-md w-full space-y-3 text-center font-mono">
              <div className="w-8 h-8 bg-[#111111] text-[#FCF9F2] flex items-center justify-center font-bold mx-auto text-sm">
                !
              </div>
              <span className="font-bold text-xs text-[#111111] uppercase block tracking-wider">
                SEM CAPÍTULOS EM {activeTab}
              </span>
              <p className="text-[10px] text-[#767571] uppercase leading-relaxed">
                Ainda não existe nenhum capítulo nesta secção. Utilize o botão{' '}
                <strong className="text-[#111111]">+ NOVO CAPÍTULO</strong> no índice para criar o primeiro.
              </p>
            </div>
          </div>
        )}
      </div>
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