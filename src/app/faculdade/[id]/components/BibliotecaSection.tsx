'use client';

import { useState, useMemo } from 'react';

export interface DocumentItem {
  id: string;
  name: string;
  chapter: string;
  type?: 'PDF' | 'ZIP' | 'LINK' | 'DOC';
  url?: string;
  size?: string;
}

interface BibliotecaSectionProps {
  documents?: DocumentItem[];
  onOpenDocument?: (doc: DocumentItem) => void;
}

const DEFAULT_DOCS: DocumentItem[] = [
  { id: '1', name: 'Guião de Laboratório 01 — Buffer Overflows.pdf', chapter: 'VOL. 02 · PRÁTICAS', type: 'PDF', size: '2.4 MB' },
  { id: '2', name: 'Criptografia Assimétrica e Assinaturas Digitais.pdf', chapter: 'VOL. 01 · TEÓRICAS', type: 'PDF', size: '4.1 MB' },
  { id: '3', name: 'Regulamento de Avaliação e Prazos 2024.pdf', chapter: 'GERAL', type: 'PDF', size: '890 KB' },
  { id: '4', name: 'Exercícios Resolvidos — Protocolos de Redes.pdf', chapter: 'VOL. 02 · PRÁTICAS', type: 'PDF', size: '1.8 MB' },
];

export function BibliotecaSection({
  documents = DEFAULT_DOCS,
  onOpenDocument,
}: BibliotecaSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'TODOS' | 'TEÓRICAS' | 'PRÁTICAS'>('TODOS');

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedFilter === 'TODOS' ||
        (selectedFilter === 'TEÓRICAS' && doc.chapter.includes('TEÓRICAS')) ||
        (selectedFilter === 'PRÁTICAS' && doc.chapter.includes('PRÁTICAS'));

      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedFilter]);

  return (
    <section id="biblioteca" className="space-y-6 pt-12">
      {/* CABEÇALHO DA SECÇÃO */}
      <div className="border-b border-[#D8D5CC] pb-4 space-y-2">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase block">
          SECÇÃO 04 // RECURSOS DE ESTUDO
        </span>
        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
          BIBLIOTECA.
        </h2>
      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="PESQUISAR RECURSO OU FICHEIRO..."
            className="w-full bg-[#F6F3EC] border border-[#D8D5CC] px-3 py-2 font-mono text-[11px] text-[#111111] placeholder-[#767571] uppercase focus:outline-none focus:border-[#111111] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#767571] hover:text-[#111111] px-1"
            >
              [LIMPAR]
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 font-mono text-[10px] uppercase">
          {(['TODOS', 'TEÓRICAS', 'PRÁTICAS'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 border transition-colors ${
                selectedFilter === filter
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111] font-bold'
                  : 'bg-[#F6F3EC] text-[#767571] border-[#D8D5CC] hover:border-[#111111] hover:text-[#111111]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DE DOCUMENTOS */}
      <div className="border-t border-[#111111] divide-y divide-[#D8D5CC]">
        {filteredDocs.length > 0 ? (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-2 hover:bg-[#F6F3EC] transition-colors gap-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] bg-[#EBE8E1] border border-[#D8D5CC] px-1.5 py-0.5 font-bold shrink-0">
                  {doc.type || 'PDF'}
                </span>
                <span className="font-sans text-[13px] font-bold text-[#111111] truncate">
                  {doc.name}
                </span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 font-mono text-[10px] shrink-0">
                <span className="text-[#767571] uppercase">{doc.chapter}</span>
                <button
                  onClick={() => onOpenDocument?.(doc)}
                  className="border border-[#111111] bg-transparent text-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] px-3 py-1 font-bold uppercase transition-colors"
                >
                  ABRIR &rarr;
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center font-mono text-[11px] text-[#767571] uppercase border-b border-[#D8D5CC]">
            NENHUM DOCUMENTO ENCONTRADO PARA "{searchQuery}".
          </div>
        )}
      </div>
    </section>
  );
}