'use client';

import { useState, use, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export type NotebookTab = 'TEORICAS' | 'PRATICAS' | 'TESTES';
export type PaperStyle = 'PAUTADO' | 'QUADRICULA' | 'LISO';

export interface Chapter {
  id: string;
  number: string;
  title: string;
  date: string;
  pagesCount: number;
  category: NotebookTab;
}

const INITIAL_CHAPTERS: Chapter[] = [
  { id: '1', number: '01', title: 'Cifra de Feistel & Redes SPN', date: 'HOJE, 10:42', pagesCount: 14, category: 'TEORICAS' },
  { id: '2', number: '02', title: 'Criptografia Assimétrica & RSA', date: '24 OUT', pagesCount: 14, category: 'TEORICAS' },
  { id: '3', number: '03', title: 'Protocolos & TLS / SSL', date: '19 OUT', pagesCount: 9, category: 'TEORICAS' },
  { id: '4', number: '01', title: 'Guião 1 - Cifras Clássicas e Python', date: '12 OUT', pagesCount: 5, category: 'PRATICAS' },
  { id: '5', number: '01', title: 'Preparação para o Teste 1', date: '05 OUT', pagesCount: 8, category: 'TESTES' },
];

function NotebookContent({ subjectId }: { subjectId: string }) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as NotebookTab) || 'TEORICAS';

  const [activeTab, setActiveTab] = useState<NotebookTab>(initialTab);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('PAUTADO');
  const [isSplitViewOpen, setIsSplitViewOpen] = useState<boolean>(true);

  const filteredChapters = INITIAL_CHAPTERS.filter((chap) => {
    const matchesTab = chap.category === activeTab;
    const matchesSearch =
      chap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chap.number.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  const activeChapter =
    INITIAL_CHAPTERS.find((c) => c.id === selectedChapterId) || filteredChapters[0];

  return (
    <div className="flex flex-col h-screen bg-[#F6F4EE] text-[#111111] font-sans antialiased overflow-hidden">
      {/* 1. TOPBAR */}
      <header className="h-12 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[11px] font-mono shrink-0">
        <div className="flex items-center gap-3 font-bold">
          <Link
            href={`/faculdade/${subjectId}`}
            className="hover:opacity-70 transition-opacity uppercase text-[#767571] flex items-center gap-1"
          >
            ← VOLTAR
          </Link>
          <span className="text-[#D8D5CC]">|</span>
          <span className="text-[#767571] uppercase">FACULDADE</span>
          <span className="text-[#D8D5CC]">//</span>
          <span className="text-[#767571] uppercase">CADERNO</span>
          <span className="text-[#D8D5CC]">//</span>

          <div className="flex items-center gap-1 bg-[#EBE8DF] p-0.5 border border-[#D8D5CC]">
            {(['TEORICAS', 'PRATICAS', 'TESTES'] as NotebookTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#111111] text-[#FCF9F2]'
                    : 'text-[#767571] hover:text-[#111111]'
                }`}
              >
                {tab === 'TEORICAS' ? 'TEÓRICAS' : tab === 'PRATICAS' ? 'PRÁTICAS' : 'TESTES'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px]">
          <div className="hidden sm:flex items-center gap-2 text-[#767571]">
            <span className="w-2 h-2 bg-green-600 inline-block"></span>
            <span>IPAD PRO VINCULADO</span>
            <span>·</span>
            <span>100% SINCRONIZADO</span>
          </div>

          <button className="bg-[#EBE8DF] hover:bg-[#111111] hover:text-[#FCF9F2] px-3 py-1.5 border border-[#D8D5CC] font-bold uppercase transition-colors cursor-pointer">
            EXPORTAR PDF
          </button>
        </div>
      </header>

      {/* 2. ÁREA PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden">
        {/* ÍNDICE ESQUERDO */}
        <aside className="w-72 border-r border-[#D8D5CC] flex flex-col bg-[#F6F4EE] shrink-0">
          <div className="p-4 border-b border-[#D8D5CC] space-y-3">
            <h2 className="font-mono text-[10px] font-bold tracking-widest text-[#767571] uppercase">
              ÍNDICE DE CAPÍTULOS
            </h2>
            <input
              type="text"
              placeholder="Q PESQUISAR NO NOTEBOOK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#EBE8DF] border border-[#D8D5CC] p-2 text-[10px] font-mono focus:outline-none focus:border-[#111111] placeholder-[#A1A09A]"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#EBE8DF]">
            {filteredChapters.length === 0 ? (
              <div className="p-4 font-mono text-[10px] text-[#767571] uppercase">
                Sem capítulos registados em {activeTab.toLowerCase()}.
              </div>
            ) : (
              filteredChapters.map((chap) => {
                const isSelected = activeChapter?.id === chap.id;
                return (
                  <button
                    key={chap.id}
                    onClick={() => setSelectedChapterId(chap.id)}
                    className={`w-full p-4 text-left font-mono transition-colors block cursor-pointer ${
                      isSelected
                        ? 'bg-[#EBE8DF] border-l-4 border-l-[#111111]'
                        : 'hover:bg-[#EBE8DF]/50'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-[#111111] line-clamp-1">
                      {chap.number} - {chap.title}
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-[#767571] mt-2">
                      <span>{chap.date}</span>
                      {isSelected ? (
                        <span className="font-bold text-[#111111] uppercase">[ ATIVO ]</span>
                      ) : (
                        <span>{chap.pagesCount} PÁG</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-[#D8D5CC]">
            <button className="w-full bg-[#111111] text-[#FCF9F2] py-2.5 px-4 font-mono text-[10px] font-bold tracking-wider hover:bg-[#31312C] transition-colors uppercase cursor-pointer">
              + NOVO CAPÍTULO
            </button>
          </div>
        </aside>

        {/* EDITOR CENTRAL */}
        <main className="flex-1 flex flex-col bg-[#FAF8F3] overflow-y-auto border-r border-[#D8D5CC]">
          <div className="h-10 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[10px] font-mono shrink-0">
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 font-bold hover:text-[#767571]">
                <span>T</span> TEXTO
              </button>
              <span className="text-[#D8D5CC]">|</span>
              <button className="hover:text-[#767571]">TRAÇO 0.5MM</button>
              <span className="text-[#D8D5CC]">|</span>

              <div className="flex items-center gap-2">
                <span className="text-[#767571]">PÁGINA:</span>
                {(['PAUTADO', 'QUADRICULA', 'LISO'] as PaperStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setPaperStyle(style)}
                    className={`px-1.5 py-0.5 font-bold uppercase cursor-pointer ${
                      paperStyle === style
                        ? 'bg-[#111111] text-[#FCF9F2]'
                        : 'text-[#767571] hover:text-[#111111]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsSplitViewOpen(!isSplitViewOpen)}
              className="font-bold border border-[#D8D5CC] px-2 py-0.5 hover:bg-[#111111] hover:text-[#FCF9F2] transition-colors cursor-pointer"
            >
              SPLIT VIEW {isSplitViewOpen ? '(ATIVO)' : '(INATIVO)'}
            </button>
          </div>

          <div
            className={`flex-1 p-8 md:p-12 max-w-4xl mx-auto w-full space-y-6 ${
              paperStyle === 'PAUTADO'
                ? 'bg-[linear-gradient(to_bottom,#E5E2D9_1px,transparent_1px)] bg-[size:100%_28px]'
                : ''
            }`}
          >
            {activeChapter ? (
              <>
                <div className="font-mono text-[9px] font-bold text-[#767571] tracking-wider uppercase">
                  CAPÍTULO {activeChapter.number} // {activeTab}
                </div>

                <h1 className="font-mono text-2xl md:text-3xl font-extrabold uppercase text-[#111111] tracking-tight">
                  {activeChapter.title}
                </h1>

                <div className="font-mono text-[9px] text-[#A1A09A] border-b border-[#D8D5CC] pb-3 uppercase">
                  ÚLTIMA EDIÇÃO: {activeChapter.date} · SINCRONIZADO IPAD PRO
                </div>

                <div className="space-y-4 text-xs md:text-sm text-[#111111] leading-relaxed font-serif">
                  <p>
                    A arquitetura de Feistel resolve de modo elegante a questão fundamental das cifras simétricas de bloco: como construir uma permutação invertível sem obrigar a função interna F(R, K) a ser matematicamente bijetiva.
                  </p>

                  <div className="bg-[#EBE8DF]/80 border-l-2 border-[#111111] p-3 font-mono text-[11px] space-y-1 my-4">
                    <p className="text-[#767571]">// Relações recursivas por ronda (i = 1 ... n):</p>
                    <p className="font-bold">L_i = R_&#123;i-1&#125;</p>
                    <p className="font-bold">R_i = L_&#123;i-1&#125; ⊕ F(R_&#123;i-1&#125;, K_i)</p>
                  </div>

                  <div className="bg-[#FFF4F4] border border-[#FFD0D0] p-3 font-mono text-[10px] text-[#D32F2F] font-bold my-4">
                    Atenção: min. 3 rondas p/ difusão total. Teorema Luby-Rackoff exige 4 rondas!
                  </div>
                </div>
              </>
            ) : (
              <div className="font-mono text-xs text-[#767571] uppercase">
                Selecione um capítulo no índice.
              </div>
            )}
          </div>
        </main>

        {/* SPLIT VIEW DIREITO */}
        {isSplitViewOpen && (
          <aside className="w-96 border-l border-[#D8D5CC] bg-[#EBE8DF] flex flex-col shrink-0">
            <div className="h-10 border-b border-[#D8D5CC] px-3 flex items-center justify-between font-mono text-[10px] font-bold bg-[#F6F4EE]">
              <span className="truncate max-w-[180px]">SLIDES_AULA03_FEISTEL.PDF</span>
              <div className="flex items-center gap-2">
                <span>14 / 46</span>
                <button className="hover:text-[#767571] px-1">‹</button>
                <button className="hover:text-[#767571] px-1">›</button>
                <button
                  onClick={() => setIsSplitViewOpen(false)}
                  className="hover:text-red-600 ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center">
              <div className="bg-white border border-[#D8D5CC] shadow-sm w-full aspect-[4/3] p-4 flex flex-col justify-between font-mono text-[10px]">
                <div className="text-[8px] text-[#767571] uppercase">
                  ENGENHARIA INFORMÁTICA · SLIDE 14
                </div>
                <div className="space-y-2">
                  <div className="font-bold text-xs uppercase">PROPRIEDADE DE REVERSIBILIDADE</div>
                  <p className="text-[9px] text-[#31312C] leading-snug">
                    Dado que o bloco esquerdo L_i = R_&#123;i-1&#125;, a recuperação da metade L_&#123;i-1&#125; depende unicamente da operação XOR.
                  </p>
                </div>
                <div className="text-[8px] text-[#A1A09A] uppercase">PROF. DR. V. ALMEIDA · TEÓRICA 03</div>
              </div>
            </div>
          </aside>
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
    <Suspense fallback={<div className="p-8 font-mono text-xs uppercase">CARREGANDO NOTEBOOK...</div>}>
      <NotebookContent subjectId={subjectId} />
    </Suspense>
  );
}