'use client';

import d from '@/app/components/denso/denso.module.css';
import { chapterTab } from '@/lib/studyPath';
import type { ChapterRow } from '../disciplinaData';

// Escolha dos capítulos do caderno que é preciso fazer para um teste.
// A preparação na Visão Geral é: concluídos ÷ escolhidos.

const GROUPS: ['TEORICAS' | 'PRATICAS' | 'TESTES', string, string][] = [
  ['TEORICAS', 'TEÓRICAS', 'T'],
  ['PRATICAS', 'PRÁTICAS', 'P'],
  ['TESTES', 'TESTES ANTERIORES', 'Teste'],
];

const num = (n: ChapterRow['number']) => {
  const v = parseInt(String(n ?? ''), 10);
  return Number.isFinite(v) ? v : null;
};

export function ChapterPicker({ chapters, value, onChange }: { chapters: ChapterRow[]; value: string[]; onChange: (ids: string[]) => void }) {
  const chosen = new Set(value);
  const picked = chapters.filter((c) => chosen.has(String(c.id)));
  const done = picked.filter((c) => c.is_completed).length;
  const pct = picked.length ? Math.round((done / picked.length) * 100) : 0;

  const toggle = (id: string) => onChange(chosen.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const setGroup = (ids: string[], on: boolean) => {
    const rest = value.filter((x) => !ids.includes(x));
    onChange(on ? [...rest, ...ids] : rest);
  };

  return (
    <div className={d.field}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span className={d.fieldLabel}>CAPÍTULOS PARA ESTAR PREPARADA</span>
        {picked.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--mut)', whiteSpace: 'nowrap' }}>
            {done} de {picked.length} concluídos · <span style={{ color: 'var(--amber, #e3a857)' }}>{pct}%</span>
          </span>
        )}
      </div>
      {chapters.length === 0 ? (
        <span className={d.hint}>O caderno desta cadeira ainda não tem capítulos.</span>
      ) : (
        <div style={{ border: '1px solid var(--line)', maxHeight: 260, overflowY: 'auto', padding: '4px 10px 8px' }}>
          {GROUPS.map(([tab, title, short]) => {
            const list = chapters
              .filter((c) => chapterTab(c.category) === tab)
              .sort((a, b) => (num(a.number) ?? 999) - (num(b.number) ?? 999) || (a.title || '').localeCompare(b.title || '', 'pt'));
            if (!list.length) return null;
            const ids = list.map((c) => String(c.id));
            const all = ids.every((id) => chosen.has(id));
            return (
              <div key={tab} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 2px' }}>
                  <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--mut2)' }}>{title}</span>
                  <button type="button" onClick={() => setGroup(ids, !all)} style={{ background: 'none', border: 0, padding: 0, fontSize: 11, color: 'var(--sky)' }}>
                    {all ? 'Nenhum' : 'Todos'}
                  </button>
                </div>
                {list.map((c) => {
                  const id = String(c.id);
                  const n = num(c.number);
                  return (
                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 34, fontSize: 13, cursor: 'pointer', borderTop: '1px solid var(--line2)' }}>
                      <input type="checkbox" className={d.chk} checked={chosen.has(id)} onChange={() => toggle(id)} />
                      <span className={d.ellipsis} style={{ flexGrow: 1, minWidth: 0 }}>
                        <span className={d.muted}>{n !== null ? `${short}${short === 'Teste' ? ' ' : ''}${n} · ` : ''}</span>
                        {c.title || 'Sem título'}
                      </span>
                      <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: c.is_completed ? 'var(--sky)' : 'var(--faint)' }}>
                        {c.is_completed ? '✓ concluído' : 'por fazer'}
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <span className={d.hint}>Marca no caderno cada capítulo como concluído à medida que o fazes; a percentagem na Visão Geral acompanha.</span>
    </div>
  );
}
