'use client';

import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import d from '@/app/components/denso/denso.module.css';
import { SECTION_SHORT, TYPE_COLOR, shortDate, toLibDoc, type FileRow, type LibCategory } from '../disciplinaData';
import { DeleteButton, Field, SaveStatus, errorMessage, type SaveState } from './shared';

// Editor da biblioteca: enviar ficheiros (arrastar ou escolher), acrescentar
// ligações, e editar / apagar cada documento no sítio.

const CATEGORIES: [LibCategory, string][] = [
  ['TEÓRICAS', 'Teóricas'],
  ['PRÁTICAS', 'Práticas'],
  ['EXAMES', 'Exames'],
  ['GERAL', 'Geral'],
];

// O volume vai no fim do título, ex.: "Slides T03 (VOL. 03)".
function splitVol(title: string): { title: string; vol: string } {
  const m = title.match(/^(.*?)\s*\((VOL\.\s*[^)]+)\)$/i);
  return m ? { title: m[1], vol: m[2].replace(/^VOL\.\s*/i, '') } : { title, vol: '' };
}
function joinVol(title: string, vol: string): string {
  const v = vol.trim().toUpperCase().replace(/^VOL\.\s*/, '');
  return v ? `${title} (VOL. ${v})` : title;
}

function CategoryPick({ value, onChange }: { value: LibCategory; onChange: (c: LibCategory) => void }) {
  return (
    <div className={d.segPick} role="group" aria-label="Secção" style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      {CATEGORIES.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} style={{ padding: 0 }}>
          {label}
        </button>
      ))}
    </div>
  );
}

interface Draft {
  title: string;
  vol: string;
  category: LibCategory;
  url: string;
  file: File | null;
}

export function BibliotecaEditor({
  subjectId,
  files,
  onFilesChange,
  onUpload,
  uploading,
  uploadError,
}: {
  subjectId: string;
  files: FileRow[];
  onFilesChange: (update: (prev: FileRow[]) => FileRow[]) => void;
  onUpload: (files: File[], category: LibCategory) => void;
  uploading: boolean;
  uploadError: string | null;
}) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [category, setCategory] = useState<LibCategory>('TEÓRICAS');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<SaveState>({ kind: 'idle' });
  const pickInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      files
        .map((row) => ({ row, doc: toLibDoc(row) }))
        .filter(({ doc }) => !q || doc.title.toLowerCase().includes(q) || doc.type.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q)),
    [files, q]
  );

  const urlValid = /^https?:\/\/\S+\.\S+/i.test(linkUrl.trim());

  const addLink = async () => {
    if (!urlValid) return;
    const url = linkUrl.trim();
    setStatus({ kind: 'saving' });
    try {
      const { data, error } = await supabase
        .from('subject_files')
        .insert([{ subject_id: subjectId, title: linkTitle.trim() || url.replace(/^https?:\/\//, ''), file_name: null, category, file_url: url }])
        .select()
        .single();
      if (error) throw error;
      onFilesChange((prev) => [data as FileRow, ...prev]);
      setLinkTitle('');
      setLinkUrl('');
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) });
    }
  };

  const open = (row: FileRow) => {
    const doc = toLibDoc(row);
    const { title, vol } = splitVol(row.title || doc.title);
    setOpenId(row.id);
    setStatus({ kind: 'idle' });
    setDraft({ title, vol, category: doc.category, url: doc.type === 'LINK' ? doc.url : '', file: null });
  };

  // Próximo volume livre (maior VOL. usado + 1).
  const nextVol = () => {
    const max = files.reduce((m, f) => {
      const n = Number(splitVol(f.title || '').vol.match(/\d+/)?.[0] || 0);
      return Math.max(m, n);
    }, 0);
    return String(max + 1).padStart(2, '0');
  };

  const storagePath = (url: string | null) => (url && url.includes('/academic_materials/') ? url.split('/academic_materials/')[1] : null);

  const save = async (row: FileRow) => {
    if (!draft) return;
    const isLink = toLibDoc(row).type === 'LINK' && !row.file_name;
    setStatus({ kind: 'saving' });
    try {
      let file_url = isLink ? draft.url.trim() || row.file_url : row.file_url;
      let file_name = row.file_name;
      if (draft.file) {
        const ext = draft.file.name.includes('.') ? draft.file.name.split('.').pop() : 'bin';
        const path = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('academic_materials').upload(path, draft.file);
        if (upErr) throw upErr;
        file_url = supabase.storage.from('academic_materials').getPublicUrl(path).data.publicUrl;
        file_name = draft.file.name;
        // O ficheiro antigo deixa de ser usado.
        const old = storagePath(row.file_url);
        if (old) await supabase.storage.from('academic_materials').remove([old]);
      }
      const patch = { title: joinVol(draft.title.trim() || file_name || 'Sem título', draft.vol), category: draft.category, file_url, file_name };
      const { error } = await supabase.from('subject_files').update(patch).eq('id', row.id);
      if (error) throw error;
      onFilesChange((prev) => prev.map((f) => (f.id === row.id ? { ...f, ...patch } : f)));
      setOpenId(null);
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) });
    }
  };

  const remove = async (row: FileRow) => {
    setStatus({ kind: 'saving' });
    try {
      const { error } = await supabase.from('subject_files').delete().eq('id', row.id);
      if (error) throw error;
      const path = storagePath(row.file_url);
      if (path) await supabase.storage.from('academic_materials').remove([path]);
      onFilesChange((prev) => prev.filter((f) => f.id !== row.id));
      setOpenId(null);
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err) });
    }
  };

  const pick = (list: FileList | null) => {
    const chosen = list ? Array.from(list) : [];
    if (chosen.length) onUpload(chosen, category);
  };

  return (
    <>
      {/* ADICIONAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span className={d.groupTitle} style={{ border: 0, padding: 0 }}>ADICIONAR</span>
          <div className={d.segPick} role="group" aria-label="Tipo">
            <button type="button" aria-pressed={mode === 'file'} onClick={() => setMode('file')}>Ficheiro</button>
            <button type="button" aria-pressed={mode === 'link'} onClick={() => setMode('link')}>Ligação</button>
          </div>
        </div>
        <CategoryPick value={category} onChange={setCategory} />
        {mode === 'file' ? (
          <button
            type="button"
            onClick={() => pickInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files);
            }}
            disabled={uploading}
            style={{
              minHeight: 84,
              border: `1px dashed ${dragOver ? 'var(--sky)' : 'var(--box2)'}`,
              background: dragOver ? 'rgba(127, 176, 203, 0.08)' : 'var(--bg)',
              color: 'var(--mut)',
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span style={{ color: 'var(--ink)' }}>{uploading ? 'A enviar…' : 'Arrasta ficheiros para aqui ou toca para escolher'}</span>
            <span style={{ fontSize: 11, color: 'var(--mut2)' }}>Vão para {CATEGORIES.find(([id]) => id === category)?.[1]} · podes escolher vários</span>
          </button>
        ) : (
          <div className={d.fieldRow} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) auto', alignItems: 'end' }}>
            <Field label="NOME">
              <input className={d.input} value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Moodle da cadeira" />
            </Field>
            <Field label="ENDEREÇO">
              <input
                className={`${d.input} ${linkUrl && !urlValid ? d.inputInvalid : ''}`}
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLink();
                }}
                placeholder="https://…"
              />
            </Field>
            <button type="button" className={d.btnFill} onClick={addLink} disabled={!urlValid}>Adicionar</button>
          </div>
        )}
        {uploadError && <span className={d.errorText}>{uploadError}</span>}
        <input
          ref={pickInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* DOCUMENTOS */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          <span className={d.groupTitle} style={{ border: 0, padding: 0 }}>
            DOCUMENTOS <span className={d.muted} style={{ fontWeight: 400 }}>{files.length}</span>
          </span>
          <input
            type="search"
            className={d.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar…"
            aria-label="Filtrar documentos"
            style={{ width: 170, height: 30 }}
          />
        </div>
        {files.length === 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Ainda não há documentos.</p>}
        {files.length > 0 && rows.length === 0 && <p className={d.muted} style={{ margin: '10px 0 0', fontSize: 13 }}>Nenhum documento corresponde.</p>}
        {rows.map(({ row, doc }) => {
          const created = new Date(doc.createdAt);
          if (openId === row.id && draft) {
            const isLink = doc.type === 'LINK' && !row.file_name;
            return (
              <div key={row.id} className={d.slot} style={{ borderColor: 'var(--box2)', margin: '6px 0' }}>
                <div className={d.fieldRow} style={{ gridTemplateColumns: 'minmax(0, 1fr) 110px' }}>
                  <Field label="NOME">
                    <input autoFocus className={d.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  </Field>
                  <Field label="VOLUME">
                    <div style={{ display: 'flex' }}>
                      <input className={d.input} value={draft.vol} onChange={(e) => setDraft({ ...draft, vol: e.target.value })} placeholder="—" style={{ minWidth: 0 }} />
                      <button type="button" className={`${d.btnGhost} ${d.sm}`} title="Próximo volume livre" onClick={() => setDraft({ ...draft, vol: nextVol() })} style={{ height: 38, padding: '0 8px', borderLeft: 0 }}>
                        +1
                      </button>
                    </div>
                  </Field>
                </div>
                <Field label="SECÇÃO">
                  <CategoryPick value={draft.category} onChange={(c) => setDraft({ ...draft, category: c })} />
                </Field>
                {isLink ? (
                  <Field label="ENDEREÇO">
                    <input className={d.input} type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
                  </Field>
                ) : (
                  <Field label="FICHEIRO">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span className={d.ellipsis} style={{ fontSize: 13, color: draft.file ? 'var(--sky)' : 'var(--mut)', minWidth: 0 }}>
                        {draft.file ? `Novo: ${draft.file.name}` : row.file_name || 'Ficheiro atual'}
                      </span>
                      <button type="button" className={`${d.btnLine} ${d.xs}`} onClick={() => replaceInput.current?.click()} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        Substituir
                      </button>
                    </div>
                  </Field>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
                  <DeleteButton onConfirm={() => remove(row)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={() => setOpenId(null)}>Cancelar</button>
                    <button type="button" className={`${d.btnFill} ${d.sm}`} onClick={() => save(row)} disabled={status.kind === 'saving'}>Guardar</button>
                  </div>
                </div>
              </div>
            );
          }
          const vol = splitVol(row.title || '').vol;
          return (
            <button
              key={row.id}
              type="button"
              className={d.rowLink}
              onClick={() => open(row)}
              style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', alignItems: 'center', gap: 10, minHeight: 42, padding: '0 4px', background: 'none', border: 0, borderBottom: '1px solid var(--line2)', textAlign: 'left', fontSize: 13, color: 'var(--ink)' }}
            >
              <span style={{ fontSize: 10, color: TYPE_COLOR[doc.type], border: '1px solid #333', textAlign: 'center' }}>{doc.type}</span>
              <span className={d.ellipsis}>
                {doc.title}
                {vol && <span className={d.muted}> · vol. {vol}</span>}
              </span>
              <span className={d.muted} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {SECTION_SHORT[doc.category]}
                {Number.isNaN(created.getTime()) ? '' : ` · ${shortDate(created)}`}
              </span>
            </button>
          );
        })}
        <input
          ref={replaceInput}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && draft) setDraft({ ...draft, file });
            e.target.value = '';
          }}
        />
      </div>

      <SaveStatus state={status} />
    </>
  );
}
