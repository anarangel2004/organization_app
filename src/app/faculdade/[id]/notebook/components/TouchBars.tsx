'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import c from './caderno.module.css';
import type { SubjectChip, MenuDef } from './CadernoBars';
import type { BlockTag, FormatState } from './NotesPane';
import { NotebookTab, PAPER_LABEL, PaperStyle, PdfDoc, SyncStatus, TABS } from './types';
import { PdfSlides } from './PdfSlides';

const keepSelection = (e: { preventDefault: () => void }) => e.preventDefault();

export function syncText(sync: SyncStatus) {
  return sync === 'saving' ? 'a guardar…' : sync === 'error' ? 'erro ao guardar' : 'sincronizado';
}

// ==========================================
// iPad: disciplina + volumes (1.ª barra) e capítulo + formatação (2.ª barra)
// ==========================================
export function TabletBars({
  subjectId,
  subjects,
  hrefFor,
  tab,
  onTab,
  showExport,
  onExport,
  onOptions,
  onChapters,
  chapterLabel,
  format,
  editable,
  onBlock,
  onBold,
  onItalic,
  onRef,
  split,
  onToggleSplit,
}: {
  subjectId: string;
  subjects: SubjectChip[];
  hrefFor: (id: string) => string;
  tab: NotebookTab;
  onTab: (t: NotebookTab) => void;
  showExport: boolean;
  onExport: () => void;
  onOptions: () => void;
  onChapters: () => void;
  chapterLabel: string;
  format: FormatState;
  editable: boolean;
  onBlock: (tag: BlockTag) => void;
  onBold: () => void;
  onItalic: () => void;
  onRef: () => void;
  split: boolean;
  onToggleSplit: () => void;
}) {
  return (
    <>
      <div className={`${c.tBar} no-print`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Link href={`/faculdade/${subjectId}`} aria-label="Voltar à disciplina" className={c.tBtn} style={{ width: 40, padding: 0 }}>
            ←
          </Link>
          {subjects.map((s) => {
            const on = s.id === subjectId;
            return (
              <Link key={s.id} href={hrefFor(s.id)} aria-current={on ? 'page' : undefined} className={`${c.tSubject} ${on ? c.tSubjectOn : ''}`}>
                <span className={c.dot} style={{ background: s.dot }} />
                {on && s.name && s.name !== s.code ? `${s.code} · ${s.name}` : s.code}
              </Link>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div role="tablist" aria-label="Volumes" className={c.tSeg}>
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {showExport && (
            <button type="button" className={c.tFill} onClick={onExport} style={{ height: 36, padding: '0 14px' }}>
              Exportar
            </button>
          )}
          <button type="button" aria-label="Mais opções" className={c.tBtn} style={{ width: 40, height: 36, padding: 0 }} onClick={onOptions}>
            ···
          </button>
        </div>
      </div>

      <div className={`${c.tBar2} no-print`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <button type="button" className={c.tBtn} onClick={onChapters} aria-label="Capítulos">
            ☰ Capítulos
          </button>
          <span
            style={{ fontFamily: "var(--font-newsreader), 'Newsreader', Georgia, serif", fontSize: 17, paddingLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {chapterLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: editable ? 1 : 0.4 }}>
          <select aria-label="Estilo" className={c.tSelect} value={format.block} disabled={!editable} onChange={(e) => onBlock(e.target.value as BlockTag)}>
            <option value="p">Normal</option>
            <option value="h2">Título</option>
            <option value="h3">Subtítulo</option>
          </select>
          <button type="button" aria-label="Negrito" aria-pressed={format.bold} className={c.tIcon} disabled={!editable} onMouseDown={keepSelection} onClick={onBold} style={{ fontWeight: 700 }}>
            B
          </button>
          <button
            type="button"
            aria-label="Itálico"
            aria-pressed={format.italic}
            className={c.tIcon}
            disabled={!editable}
            onMouseDown={keepSelection}
            onClick={onItalic}
            style={{ fontFamily: "var(--font-newsreader), 'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 17 }}
          >
            I
          </button>
          <button
            type="button"
            className={c.tBtn}
            disabled={!editable}
            onMouseDown={keepSelection}
            onClick={onRef}
            style={{ borderColor: 'var(--deep2)', color: 'var(--sky)' }}
          >
            ↗ Ref. PDF
          </button>
        </div>
        <button type="button" className={split ? c.tFill : c.tBtn} aria-pressed={split} onClick={onToggleSplit}>
          Split view
        </button>
      </div>
    </>
  );
}

// ==========================================
// iPhone: barra de cima
// ==========================================
export function PhoneBar({
  subjectId,
  subjectCode,
  chapterLabel,
  subLabel,
  onChapters,
  onPdf,
  onOptions,
}: {
  subjectId: string;
  subjectCode: string;
  chapterLabel: string;
  subLabel: string;
  onChapters: () => void;
  onPdf: () => void;
  onOptions: () => void;
}) {
  return (
    <div className={`${c.pBar} no-print`}>
      <Link href={`/faculdade/${subjectId}`} className={c.pBack}>
        ‹ {subjectCode}
      </Link>
      <button type="button" className={c.pTitle} onClick={onChapters} aria-label="Capítulos">
        <span style={{ fontSize: 15, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapterLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--mut)', whiteSpace: 'nowrap' }}>{subLabel}</span>
      </button>
      <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button type="button" onClick={onPdf} className={c.tBtn} style={{ borderColor: 'var(--deep2)', color: 'var(--sky)' }}>
          PDF
        </button>
        <button type="button" aria-label="Mais opções" onClick={onOptions} className={c.tBtn} style={{ width: 36, padding: 0 }}>
          ···
        </button>
      </span>
    </div>
  );
}

// ==========================================
// iPhone: barra de formatação por cima do teclado
// ==========================================
const NEXT_BLOCK: Record<BlockTag, BlockTag> = { p: 'h2', h2: 'h3', h3: 'p' };
const BLOCK_NAME: Record<BlockTag, string> = { p: 'Normal', h2: 'Título', h3: 'Subtítulo' };

export function PhoneFormatBar({
  format,
  editable,
  onBlock,
  onExec,
  onChecklist,
  onLink,
  onRef,
}: {
  format: FormatState;
  editable: boolean;
  onBlock: (tag: BlockTag) => void;
  onExec: (command: string, value?: string) => void;
  onChecklist: () => void;
  onLink: () => void;
  onRef: () => void;
}) {
  const btn = (label: string, content: ReactNode, onClick: () => void, extra?: CSSProperties, pressed?: boolean) => (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={!editable} onMouseDown={keepSelection} onClick={onClick} style={extra}>
      {content}
    </button>
  );
  return (
    <div role="toolbar" aria-label="Formatação" className={`${c.pFormat} no-print`} style={{ opacity: editable ? 1 : 0.5 }}>
      {btn(`Estilo: ${BLOCK_NAME[format.block]}`, format.block === 'p' ? 'Aa' : format.block === 'h2' ? 'H1' : 'H2', () => onBlock(NEXT_BLOCK[format.block]))}
      {btn('Negrito', 'B', () => onExec('bold'), { fontWeight: 700 }, format.bold)}
      {btn('Itálico', 'I', () => onExec('italic'), { fontFamily: "var(--font-newsreader), 'Newsreader', Georgia, serif", fontStyle: 'italic', fontSize: 18 }, format.italic)}
      {btn('Lista', '•—', () => onExec('insertUnorderedList'))}
      {btn('Checklist', '☐', onChecklist)}
      {btn('Link', '⌁', onLink)}
      {btn('Referência ao PDF', '↗ Ref.', onRef, { color: '#2f5f78', fontWeight: 600 })}
      {btn('Marcador', '▬', () => onExec('hiliteColor', '#f6e27f'), { color: '#d9b92f' })}
    </div>
  );
}

// ==========================================
// Folha que sobe de baixo: PDF de consulta (iPhone)
// ==========================================
export function PdfSheet({
  pdfUrl,
  pdfName,
  page,
  onPageChange,
  linkedPages,
  libraryPdfs,
  onPick,
  onUpload,
  uploading,
  hasChapter,
  onInsertRef,
  onClose,
}: {
  pdfUrl?: string;
  pdfName?: string;
  page: number;
  onPageChange: (p: number) => void;
  linkedPages: Set<number>;
  libraryPdfs: PdfDoc[];
  onPick: (doc: PdfDoc) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  hasChapter: boolean;
  onInsertRef: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState<{ url: string; total: number } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const total = pdfUrl && count?.url === pdfUrl ? count.total : null;
  const failed = !!pdfUrl && failedUrl === pdfUrl;

  return (
    <>
      <button type="button" className={c.sheetScrim} aria-label="Fechar" onClick={onClose} />
      <div role="dialog" aria-label="PDF de consulta" className={c.bottomSheet}>
        <span className={c.grabber} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pdfUrl ? (pdfName || 'PDF de consulta').replace(/\.pdf$/i, '') : 'PDF de consulta'}
            </span>
            {pdfUrl && (
              <span style={{ fontSize: 12, color: 'var(--mut)' }}>
                Página {page}
                {total ? ` de ${total}` : ''}
                {linkedPages.has(page) ? ' · ligada às notas' : ''}
              </span>
            )}
          </div>
          <button type="button" className={c.tBtn} onClick={onClose}>
            Fechar
          </button>
        </div>

        {pdfUrl ? (
          <>
            <div className={c.sheetPdf}>
              {!failed ? (
                <PdfSlides
                  url={pdfUrl}
                  page={page}
                  onPageChange={onPageChange}
                  onCount={(n) => setCount({ url: pdfUrl, total: n })}
                  linkedPages={linkedPages}
                  onError={() => setFailedUrl(pdfUrl)}
                />
              ) : (
                <iframe key={page} src={`${pdfUrl.split('#')[0]}#page=${page}&view=FitH`} title={pdfName || 'PDF'} className={c.pdfFrame} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" aria-label="Página anterior" className={c.tBtn} style={{ width: 44, height: 44, padding: 0 }} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                ‹
              </button>
              <button type="button" className={c.tFill} style={{ flex: 1, height: 44, fontSize: 14 }} disabled={!hasChapter} onClick={onInsertRef}>
                Inserir referência a esta página
              </button>
              <button
                type="button"
                aria-label="Página seguinte"
                className={c.tBtn}
                style={{ width: 44, height: 44, padding: 0 }}
                disabled={total !== null && page >= total}
                onClick={() => onPageChange(page + 1)}
              >
                ›
              </button>
            </div>
          </>
        ) : (
          <div className={c.sheetList}>
            <span style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 6 }}>
              {hasChapter ? 'Este capítulo ainda não tem PDF de consulta.' : 'Cria ou abre um capítulo para lhe ligar um PDF.'}
            </span>
            {hasChapter && libraryPdfs.length > 0 && <span className={c.sheetGroup}>BIBLIOTECA DA DISCIPLINA</span>}
            {hasChapter &&
              libraryPdfs.map((doc) => (
                <button key={doc.id} type="button" className={c.sheetItem} onClick={() => onPick(doc)}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                  <span className={c.tagPdf}>PDF</span>
                </button>
              ))}
            {hasChapter && (
              <button type="button" className={c.tFill} style={{ height: 44, marginTop: 12 }} disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'A carregar…' : 'Carregar PDF…'}
              </button>
            )}
          </div>
        )}
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
    </>
  );
}

// ==========================================
// "···": opções (menus, papel, modo) numa folha de baixo
// ==========================================
export function OptionsSheet({
  menus,
  paper,
  onPaper,
  modeEdit,
  onToggleMode,
  tabs,
  onClose,
}: {
  menus: MenuDef[];
  paper: PaperStyle;
  onPaper: (p: PaperStyle) => void;
  modeEdit: boolean;
  onToggleMode: () => void;
  // iPhone: os volumes também vivem aqui.
  tabs?: { tab: NotebookTab; onTab: (t: NotebookTab) => void };
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" className={c.sheetScrim} aria-label="Fechar" onClick={onClose} />
      <div role="dialog" aria-label="Opções do caderno" className={c.bottomSheet}>
        <span className={c.grabber} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Opções</span>
          <button type="button" className={c.tBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className={c.sheetList}>
          {tabs && (
            <>
              <span className={c.sheetGroup}>CADERNO</span>
              <div role="tablist" aria-label="Volumes" className={c.tSeg} style={{ alignSelf: 'flex-start' }}>
                {TABS.map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tabs.tab === id} onClick={() => tabs.onTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <span className={c.sheetGroup}>FOLHA</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className={c.tSeg}>
              {(Object.keys(PAPER_LABEL) as PaperStyle[]).map((p) => (
                <button key={p} type="button" aria-pressed={paper === p} onClick={() => onPaper(p)}>
                  {PAPER_LABEL[p]}
                </button>
              ))}
            </div>
            <button type="button" className={modeEdit ? c.tBtn : c.tFill} onClick={onToggleMode}>
              {modeEdit ? 'Rever (só leitura)' : 'Voltar a escrever'}
            </button>
          </div>
          {menus.map((m) => (
            <div key={m.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span className={c.sheetGroup}>{m.label.toUpperCase()}</span>
              {m.items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  className={c.sheetItem}
                  disabled={it.disabled}
                  onMouseDown={keepSelection}
                  onClick={() => {
                    onClose();
                    it.onClick();
                  }}
                >
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
