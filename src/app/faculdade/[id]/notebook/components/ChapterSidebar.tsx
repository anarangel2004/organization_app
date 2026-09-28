'use client';

import { useState, type RefObject } from 'react';
import Link from 'next/link';
import c from './caderno.module.css';
import { Chapter, NextAssessment, OutlineItem, editedLabel, htmlToText, shortDay, wordCount } from './types';

interface ChapterSidebarProps {
  subjectId: string;
  tabLabel: string;
  chapters: Chapter[];
  totalInTab: number;
  selectedId: string;
  onSelect: (id: string) => void;
  liveWords: number;
  query: string;
  onQuery: (q: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  creating: boolean;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onCreate: (title: string) => void;
  onDelete: (chapter: Chapter) => void;
  outline: OutlineItem[];
  currentHeading: number;
  onJump: (index: number) => void;
  pdfName?: string;
  onOpenPdf: () => void;
  nextAssessment: NextAssessment | null;
}

export function ChapterSidebar({
  subjectId,
  tabLabel,
  chapters,
  totalInTab,
  selectedId,
  onSelect,
  liveWords,
  query,
  onQuery,
  searchRef,
  creating,
  onStartCreate,
  onCancelCreate,
  onCreate,
  onDelete,
  outline,
  currentHeading,
  onJump,
  pdfName,
  onOpenPdf,
  nextAssessment,
}: ChapterSidebarProps) {
  const [draft, setDraft] = useState('');
  const selected = chapters.find((ch) => ch.id === selectedId);

  return (
    <aside className={c.side} aria-label="Capítulos">
      <div className={c.sideHead}>
        <span className={c.caps}>
          CAPÍTULOS <span style={{ color: 'var(--mut2)', fontWeight: 400 }}>· {totalInTab}</span>
        </span>
        <button type="button" aria-label="Novo capítulo" title="Novo capítulo (Alt+N)" className={c.plus} onClick={onStartCreate}>
          +
        </button>
      </div>

      <label className={c.search} style={{ margin: '10px 12px 4px' }}>
        <span className="sr-only">Pesquisar no caderno</span>
        <input ref={searchRef} type="search" placeholder="Pesquisar no caderno…" value={query} onChange={(e) => onQuery(e.target.value)} />
        <kbd className={c.kbd}>/</kbd>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px' }}>
        {creating && (
          <form
            className={c.newChapter}
            onSubmit={(e) => {
              e.preventDefault();
              onCreate(draft.trim());
              setDraft('');
            }}
          >
            <input
              autoFocus
              value={draft}
              placeholder={`Título do capítulo em ${tabLabel}`}
              aria-label="Título do novo capítulo"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDraft('');
                  onCancelCreate();
                }
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className={c.fill} style={{ height: 24 }}>
                Criar
              </button>
              <button
                type="button"
                className={c.btn}
                style={{ height: 24 }}
                onClick={() => {
                  setDraft('');
                  onCancelCreate();
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {chapters.length === 0 && !creating && (
          <p style={{ margin: '4px 4px 0', fontSize: 12, color: 'var(--mut2)' }}>
            {query ? 'Nada encontrado neste caderno.' : `Ainda sem capítulos em ${tabLabel}.`}
          </p>
        )}

        {chapters.map((ch) => {
          const on = ch.id === selectedId;
          const words = on ? liveWords : wordCount(htmlToText(ch.content));
          const meta = [`Editado ${editedLabel(ch.updatedAt)}`];
          if (on) meta.push(`${words} ${words === 1 ? 'palavra' : 'palavras'}`, 'aberto');
          if (ch.isCompleted) meta.push('✓');
          return (
            <div key={ch.id} className={c.chapterRow}>
              <button type="button" className={`${c.chapter} ${on ? c.chapterOn : ''}`} aria-current={on ? 'true' : undefined} onClick={() => onSelect(ch.id)}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', whiteSpace: 'nowrap', minWidth: 0, paddingRight: 16 }}>
                  <span className={c.num} style={on ? { color: 'var(--sky)' } : undefined}>
                    {ch.number}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: on ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title || 'Sem título'}</span>
                </span>
                <span style={{ fontSize: 11, color: on ? 'var(--mut)' : 'var(--mut2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta.join(' · ')}
                </span>
              </button>
              <button
                type="button"
                className={c.chapterDel}
                aria-label={`Apagar ${ch.title}`}
                title="Apagar capítulo"
                onClick={() => onDelete(ch)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {selected && outline.length > 0 && (
        <div className={c.sideBlock}>
          <span className={c.sideLabel}>NESTE CAPÍTULO</span>
          {outline.map((h, i) => (
            <button
              key={`${i}-${h.text}`}
              type="button"
              className={`${c.outline} ${h.level === 2 ? c.outlineTop : c.outlineSub} ${i === currentHeading ? c.outlineOn : ''}`}
              onClick={() => onJump(i)}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}

      {selected && (pdfName || nextAssessment) && (
        <div className={c.sideBlock} style={{ marginTop: 12, gap: 8 }}>
          <span className={c.sideLabel} style={{ paddingBottom: 0 }}>
            LIGADO A
          </span>
          {pdfName && (
            <button type="button" className={c.linked} onClick={onOpenPdf} title="Abrir no split view">
              <span className={c.tagPdf}>PDF</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{pdfName}</span>
            </button>
          )}
          {nextAssessment && (
            <Link href={`/faculdade/${subjectId}#avaliacao`} className={c.linked}>
              <span className={c.tagAmber}>{nextAssessment.tag}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nextAssessment.title} · {shortDay(nextAssessment.due)}
              </span>
            </Link>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', padding: 12 }}>
        <button type="button" className={c.fill} style={{ width: '100%', height: 32, fontWeight: 600 }} onClick={onStartCreate}>
          + Novo capítulo
        </button>
      </div>
    </aside>
  );
}
