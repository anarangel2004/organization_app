'use client';

import { useEffect, type ReactNode } from 'react';
import d from '@/app/components/denso/denso.module.css';

// Painel lateral "Gerir" da disciplina, com um separador por editor.

export type ManagePanel = 'horario' | 'avaliacao' | 'biblioteca';

export const MANAGE_TABS: [ManagePanel, string][] = [
  ['horario', 'Horário'],
  ['avaliacao', 'Avaliação'],
  ['biblioteca', 'Biblioteca'],
];

export function GerirDrawer({
  panel,
  code,
  onPick,
  onClose,
  children,
}: {
  panel: ManagePanel | null;
  code: string;
  onPick: (panel: ManagePanel) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, onClose]);

  if (!panel) return null;

  return (
    <>
      <button type="button" className={d.drawerScrim} aria-label="Fechar" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Gerir disciplina" className={d.drawer}>
        <div className={d.drawerHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Gerir</h2>
              <span className={`${d.serif} ${d.ellipsis}`} style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--sky)' }}>{code}</span>
            </div>
            <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={onClose}>
              Fechar
            </button>
          </div>
          <div className={d.steps} role="tablist" aria-label="O que gerir" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {MANAGE_TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={panel === id}
                onClick={() => onPick(id)}
                className={`${d.step} ${panel === id ? d.stepOn : ''}`}
                style={{ fontSize: 13, cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={d.drawerBody} style={{ gap: 22 }}>{children}</div>
      </aside>
    </>
  );
}
