'use client';

import { useRef, useState, type RefObject } from 'react';
import c from './caderno.module.css';
import { PdfDoc } from './types';
import { PdfSlides } from './PdfSlides';

interface PdfPaneProps {
  pdfUrl?: string;
  pdfName?: string;
  libraryPdfs: PdfDoc[];
  page: number;
  onPageChange: (page: number) => void;
  linkedPages: Set<number>;
  follow: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  onPick: (doc: PdfDoc) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploading: boolean;
  selectRef: RefObject<HTMLSelectElement | null>;
  hasChapter: boolean;
}

export function PdfPane({
  pdfUrl,
  pdfName,
  libraryPdfs,
  page,
  onPageChange,
  linkedPages,
  follow,
  onToggleFollow,
  onClose,
  onPick,
  onUpload,
  onRemove,
  uploading,
  selectRef,
  hasChapter,
}: PdfPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const currentInLibrary = libraryPdfs.find((d) => d.url === pdfUrl);
  const value = pdfUrl ? currentInLibrary?.id ?? 'current' : '';
  const src = pdfUrl ? `${pdfUrl.split('#')[0]}#page=${page}&view=FitH` : '';
  // Guardados com o endereço, para não valerem para o PDF seguinte.
  const [count, setCount] = useState<{ url: string; total: number } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const total = pdfUrl && count?.url === pdfUrl ? count.total : null;
  const failed = !!pdfUrl && failedUrl === pdfUrl;

  const onSelect = (v: string) => {
    if (v === 'upload') {
      fileRef.current?.click();
      return;
    }
    if (v === 'remove') {
      if (window.confirm('Tirar este PDF do capítulo? As referências às páginas passam a texto normal.')) onRemove();
      return;
    }
    const doc = libraryPdfs.find((d) => d.id === v);
    if (doc) onPick(doc);
  };

  return (
    <section aria-label="PDF de consulta" className={`${c.pane} no-print`}>
      <div className={c.pdfHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className={c.tagPdf}>PDF</span>
          <select
            ref={selectRef}
            aria-label="PDF de consulta"
            className={c.select}
            style={{ maxWidth: 220 }}
            value={value}
            disabled={!hasChapter || uploading}
            onChange={(e) => onSelect(e.target.value)}
          >
            {!pdfUrl && <option value="">{uploading ? 'A carregar…' : 'Escolher PDF…'}</option>}
            {pdfUrl && !currentInLibrary && <option value="current">{pdfName || 'PDF do capítulo'}</option>}
            {libraryPdfs.length > 0 && (
              <optgroup label="Biblioteca da disciplina">
                {libraryPdfs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="upload">Carregar PDF…</option>
            {pdfUrl && <option value="remove">Tirar do capítulo</option>}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          {failed && linkedPages.has(page) && <span className={c.linkedTag}>LIGADO ÀS NOTAS</span>}
          <button type="button" aria-label="Página anterior" className={c.pageBtn} disabled={!pdfUrl || page <= 1} onClick={() => onPageChange(page - 1)}>
            ‹
          </button>
          <span style={{ color: 'var(--mut)' }}>
            {total ? (
              <>
                <span style={{ color: 'var(--ink)' }}>{page}</span> / {total}
              </>
            ) : (
              <>
                p. <span style={{ color: 'var(--ink)' }}>{page}</span>
              </>
            )}
          </span>
          <button
            type="button"
            aria-label="Página seguinte"
            className={c.pageBtn}
            disabled={!pdfUrl || (total !== null && page >= total)}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </button>
          <span className={c.vsep} style={{ height: 18, margin: '0 2px' }} />
          <button
            type="button"
            className={c.btn}
            aria-pressed={follow}
            title="O PDF acompanha as referências onde pões o cursor nas notas"
            style={{ height: 26, padding: '0 8px', background: follow ? 'var(--deep2)' : 'transparent' }}
            onClick={onToggleFollow}
          >
            Seguir notas
          </button>
          <button type="button" aria-label="Fechar PDF" className={c.btn} style={{ width: 26, height: 26, padding: 0, color: 'var(--mut)' }} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className={c.pdfBody}>
        {pdfUrl && !failed ? (
          <PdfSlides
            url={pdfUrl}
            page={page}
            onPageChange={onPageChange}
            onCount={(n) => setCount({ url: pdfUrl, total: n })}
            linkedPages={linkedPages}
            onError={() => setFailedUrl(pdfUrl)}
          />
        ) : pdfUrl ? (
          // Se o pdf.js não conseguir abrir o ficheiro, fica o leitor do browser.
          // Remonta em cada página: o leitor do browser não reage só à mudança do #page.
          <iframe key={src} src={src} title={pdfName || 'PDF de consulta'} className={c.pdfFrame} />
        ) : (
          <div className={c.pdfEmpty}>
            <span style={{ color: 'var(--ink)', fontSize: 14 }}>Sem PDF de consulta</span>
            <span>
              {hasChapter
                ? libraryPdfs.length
                  ? 'Escolhe uns slides da biblioteca desta disciplina ou carrega um PDF para o ler ao lado das notas.'
                  : 'Carrega um PDF para o ler ao lado das notas. Os PDF da biblioteca da disciplina também aparecem aqui.'
                : 'Cria ou abre um capítulo para lhe ligar um PDF.'}
            </span>
            {hasChapter && (
              <button type="button" className={c.fill} disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'A carregar…' : 'Carregar PDF…'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
